import { parseDocument } from "yaml";
import { readManagedUtf8 } from "../file-formats/common/managed-utf8";
import { getDebugPath, logFatal } from "../util/util";

export interface GlossaryEntry {
  source: string;
  target: string;
  note?: string;
}

interface GlossaryFileShape {
  terms?: unknown;
}

const DEFAULT_MAX_MATCHES = 10;

export function readGlossaryFile(path: string | undefined): GlossaryEntry[] {
  if (!path) {
    return [];
  }

  const rawFile = readManagedUtf8(path);
  if (!rawFile.trim().length) {
    return [];
  }

  const document = parseDocument(rawFile, {
    prettyErrors: true,
  });
  if (document.errors?.length) {
    const errorMsg = document.errors
      .map((e) => {
        e.makePretty();
        return e.message;
      })
      .join("\n");
    logFatal(
      `Failed to parse glossary file ${getDebugPath(path)}.\n${errorMsg}`
    );
  }

  const data = document.toJS();
  const rawTerms = extractRawTerms(data, path);
  return rawTerms.map((entry, index) =>
    normalizeGlossaryEntry(entry, path, index)
  );
}

export function matchGlossaryEntries(
  text: string,
  glossary: GlossaryEntry[],
  maxMatches = DEFAULT_MAX_MATCHES
): GlossaryEntry[] {
  if (!text.trim().length || !glossary.length) {
    return [];
  }

  const normalizedText = text.toLocaleLowerCase();
  const seen = new Set<string>();

  return [...glossary]
    .sort((left, right) => right.source.length - left.source.length)
    .filter((entry) => {
      const normalizedSource = entry.source.toLocaleLowerCase();
      if (!normalizedText.includes(normalizedSource) || seen.has(normalizedSource)) {
        return false;
      }
      seen.add(normalizedSource);
      return true;
    })
    .slice(0, maxMatches);
}

function extractRawTerms(data: unknown, path: string): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    const terms = (data as GlossaryFileShape).terms;
    if (Array.isArray(terms)) {
      return terms;
    }
  }

  logFatal(
    `Glossary file ${getDebugPath(
      path
    )} must be a YAML list or an object with a 'terms' array.`
  );
}

function normalizeGlossaryEntry(
  entry: unknown,
  path: string,
  index: number
): GlossaryEntry {
  if (!entry || typeof entry !== "object") {
    logFatal(
      `Glossary entry #${index + 1} in ${getDebugPath(
        path
      )} must be an object with 'source' and 'target' fields.`
    );
  }

  const record = entry as Record<string, unknown>;
  const source = typeof record.source === "string" ? record.source.trim() : "";
  const target = typeof record.target === "string" ? record.target.trim() : "";
  const noteValue = record.note;

  if (!source || !target) {
    logFatal(
      `Glossary entry #${index + 1} in ${getDebugPath(
        path
      )} must contain non-empty 'source' and 'target' strings.`
    );
  }

  if (
    noteValue !== undefined &&
    (typeof noteValue !== "string" || !noteValue.trim().length)
  ) {
    logFatal(
      `Glossary entry #${index + 1} in ${getDebugPath(
        path
      )} has an invalid 'note'. It must be a non-empty string when provided.`
    );
  }

  return {
    source,
    target,
    note: typeof noteValue === "string" ? noteValue.trim() : undefined,
  };
}
