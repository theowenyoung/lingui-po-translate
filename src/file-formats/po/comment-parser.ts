/**
 * Parsed comment structure from PO file extracted comments (#.)
 */
export interface ParsedComment {
  /** Languages that require manual translation */
  manual: string[];
  /** Context to be passed to AI translation service */
  context: string;
}

/**
 * Parse extracted comments from PO file
 *
 * Supports:
 * - @manual:zh-Hans,zh-Hant - languages requiring manual translation
 * - @context:text - context for AI translation
 * - Plain text (without @) - also treated as context
 * - Multiple directives can be separated by ; or newline
 *
 * Example:
 * #. @manual:zh-Hans; @context:This is a save button
 * Or:
 * #. @manual:zh-Hans
 * #. @context:This is a save button
 *
 * @param extracted - The extracted comment string from PO file
 * @returns ParsedComment with manual languages and context
 */
export function parseExtractedComment(extracted: string | undefined): ParsedComment {
  const result: ParsedComment = {
    manual: [],
    context: "",
  };

  if (!extracted) {
    return result;
  }

  // Split by newline first, then by ; for each line
  const parts: string[] = [];
  for (const line of extracted.split("\n")) {
    for (const part of line.split(";")) {
      const trimmed = part.trim();
      if (trimmed) {
        parts.push(trimmed);
      }
    }
  }

  const contextParts: string[] = [];

  for (const part of parts) {
    if (part.startsWith("@manual:")) {
      // Parse @manual:zh-Hans,zh-Hant
      const langList = part.substring("@manual:".length).trim();
      if (langList) {
        result.manual = langList.split(",").map((lang) => lang.trim()).filter(Boolean);
      }
    } else if (part.startsWith("@context:")) {
      // Parse @context:text
      const contextText = part.substring("@context:".length).trim();
      if (contextText) {
        contextParts.push(contextText);
      }
    } else if (!part.startsWith("@")) {
      // Plain text without @ prefix is also context
      contextParts.push(part);
    }
  }

  result.context = contextParts.join(" ");
  return result;
}

/**
 * Check if a target language should be skipped (manual translation required)
 */
export function shouldSkipForManual(
  parsedComment: ParsedComment,
  targetLng: string
): boolean {
  return parsedComment.manual.includes(targetLng);
}

/**
 * Check if this entry has any @manual marking
 */
export function hasManualMarking(parsedComment: ParsedComment): boolean {
  return parsedComment.manual.length > 0;
}
