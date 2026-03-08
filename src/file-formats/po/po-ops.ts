import {
  GetTextComment,
  GetTextTranslation,
  GetTextTranslations,
  po,
} from "gettext-parser";
import { TSet } from "../../core/core-definitions";
import { ReadTFileArgs, WriteTFileArgs } from "../file-format-definitions";
import { logParseError } from "../common/parse-utils";
import { potCache } from "./po-files";
import { parseExtractedComment } from "./comment-parser";

function mergePotComments(args: {
  source: GetTextComment | null;
  oldTarget: GetTextComment;
}): GetTextComment {
  if (!args.source) {
    return args.oldTarget;
  }
  const source = args.source as unknown as Record<string, string>;
  const oldTarget = args.oldTarget as unknown as Record<string, string>;
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    if (!oldTarget[key]) {
      oldTarget[key] = sourceValue;
    }
  }
  return args.oldTarget;
}

export function extractPotTranslations(
  args: ReadTFileArgs,
  potFile: GetTextTranslations
): TSet {
  const tSet: TSet = new Map();
  traversePot(potFile, (getText) => {
    const key: string = getText.msgid;
    const rawValue: string = getText.msgstr.join();
    // Treat empty msgstr as null (needs translation) rather than "" (already translated)
    const value: string | null = rawValue === "" ? null : rawValue;
    if (key) {
      tSet.set(key, value);
    }
    const comments = getText.comments;
    if (typeof key === "string") {
      const parsedComment = parseExtractedComment(comments?.extracted);
      parsedComment.rawComment = buildRawComment(comments);
      potCache.insert({
        path: args.path,
        key,
        entry: {
          comments: comments ?? ({} as GetTextComment),
          parsedComment,
        },
      });
    }
  });
  return tSet;
}

export function updatePotTranslations(
  args: WriteTFileArgs,
  potFile: GetTextTranslations
) {
  const oldTarget = potCache.lookupSameFileAuxdata({ path: args.path });
  if (oldTarget) {
    potFile.headers = oldTarget.potFile.headers;
  }
  traversePot(potFile, (getText) => {
    const key: string = getText.msgid;
    const value = args.tSet.get(key);
    if (value !== undefined) {
      getText.msgstr = [value ?? ""];
    }
    const oldTargetComments = potCache.lookup({
      path: args.path,
      key,
    })?.comments;
    if (typeof key === "string" && oldTargetComments) {
      getText.comments = mergePotComments({
        source: getText.comments ?? null,
        oldTarget: oldTargetComments,
      });
    }

    if (args.changeSet.added.has(key)) {
      // add a special marking for newly-added PO-entries
      const newPoMarker = "NEEDS WORK";
      if (getText.comments) {
        if (typeof getText.comments.reference === "string") {
          getText.comments.reference += (" " + newPoMarker);
        } else {
          getText.comments.reference = newPoMarker
        }
      } else {
        getText.comments = {
          reference: newPoMarker
        } as GetTextComment;
      }
    }
  });
}

export function parsePotFile(
  args: ReadTFileArgs,
  rawFile: string
): GetTextTranslations {
  try {
    const potFile = po.parse(rawFile);
    if (!potFile.headers) {
      potFile.headers = {};
    }
    potFile.headers["X-Generator"] = "lingui-po-translate";
    return potFile;
  } catch (e) {
    console.error(e);
    logParseError("GetText parsing error", args);
  }
}

function buildRawComment(
  comments: GetTextComment | undefined
): string | undefined {
  if (!comments) return undefined;

  const parts: string[] = [];

  if (comments.extracted) {
    for (const line of comments.extracted.split("\n")) {
      let trimmed = line.trim();
      if (!trimmed) continue;
      // Strip @context: prefix for cleaner output
      if (trimmed.startsWith("@context:")) {
        trimmed = trimmed.substring("@context:".length).trim();
      } else if (trimmed.startsWith("@context ")) {
        trimmed = trimmed.substring("@context ".length).trim();
      }
      // Skip @manual directives - not useful for translation
      if (trimmed.startsWith("@manual:") || trimmed.startsWith("@manual ")) continue;
      if (trimmed) {
        parts.push(`- ${trimmed}`);
      }
    }
  }

  if (typeof comments.reference === "string" && comments.reference.trim()) {
    const refs: string[] = [];
    for (const line of comments.reference.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) {
        refs.push(trimmed);
      }
    }
    if (refs.length) {
      parts.push(`Files: ${refs.join(", ")}`);
    }
  }

  return parts.length > 0 ? parts.join("\n") : undefined;
}

function traversePot(
  potFile: GetTextTranslations,
  operation: (getText: GetTextTranslation) => void
) {
  for (const outerKey of Object.keys(potFile.translations)) {
    const potEntry: { [msgId: string]: GetTextTranslation } =
      potFile.translations[outerKey];
    for (const innerKey of Object.keys(potEntry)) {
      const getText: GetTextTranslation = potEntry[innerKey];
      operation(getText);
    }
  }
}
