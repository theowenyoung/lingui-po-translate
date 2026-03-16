import { GlossaryEntry } from "../glossary/glossary";
import { TString } from "./service-definitions";

export function buildGlossarySection(glossary?: GlossaryEntry[]): string {
  if (!glossary?.length) {
    return "";
  }

  return `\n\n## Required Terminology\nIf the source text contains any of the following terms, use the specified target translation exactly.\n${glossary
    .map(formatGlossaryEntry)
    .join("\n")}`;
}

export function buildGlossaryByKeySection(strings: TString[]): string {
  const glossaryLines = strings
    .filter((tString) => tString.glossary?.length)
    .map((tString) => {
      const glossary = tString.glossary
        ?.map(formatInlineGlossaryEntry)
        .join("; ");
      return `- "${tString.key}": ${glossary}`;
    })
    .join("\n");

  if (!glossaryLines) {
    return "";
  }

  return `\nGlossary for specific keys:\n${glossaryLines}\n\n`;
}

function formatGlossaryEntry(entry: GlossaryEntry): string {
  return `- ${formatInlineGlossaryEntry(entry)}`;
}

function formatInlineGlossaryEntry(entry: GlossaryEntry): string {
  return `${entry.source} -> ${entry.target}${
    entry.note ? ` (${entry.note})` : ""
  }`;
}
