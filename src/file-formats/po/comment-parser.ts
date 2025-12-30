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
 *
 * Example:
 * #. @manual:zh-Hans
 * #. @context:This is a save button
 * #. Some additional context
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

  const lines = extracted.split("\n");
  const contextParts: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("@manual:")) {
      // Parse @manual:zh-Hans,zh-Hant
      const langList = trimmedLine.substring("@manual:".length).trim();
      if (langList) {
        result.manual = langList.split(",").map((lang) => lang.trim()).filter(Boolean);
      }
    } else if (trimmedLine.startsWith("@context:")) {
      // Parse @context:text
      const contextText = trimmedLine.substring("@context:".length).trim();
      if (contextText) {
        contextParts.push(contextText);
      }
    } else if (trimmedLine && !trimmedLine.startsWith("@")) {
      // Plain text without @ prefix is also context
      contextParts.push(trimmedLine);
    }
  }

  result.context = contextParts.join("\n");
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
