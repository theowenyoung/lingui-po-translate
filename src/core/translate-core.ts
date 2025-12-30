import {
  CoreArgs,
  CoreResults,
  TChangeSet,
  TServiceInvocation,
  TSet,
} from "./core-definitions";
import {
  joinResultsPreserveOrder,
  leftMinusRight,
  selectLeftDistinct,
} from "./tset-ops";
import { logCoreResults, readTFileCore } from "./core-util";
import { logFatal } from "../util/util";
import { invokeTranslationService } from "./invoke-translation-service";
import { getParsedComments } from "../file-formats/po/po-files";
import { hasManualMarking, shouldSkipForManual } from "../file-formats/po/comment-parser";
import path from "path";

/**
 * Result of filtering entries based on @manual marking
 */
interface ManualFilterResult {
  /** Entries to be translated by AI */
  toTranslate: TSet;
  /** Entries to skip completely (target lang in @manual list) */
  toSkip: TSet;
  /** Entries to copy original text (has @manual but target not in list, no override) */
  toCopyOriginal: TSet;
  /** Entries to translate from override source */
  toTranslateFromOverride: TSet;
}

/**
 * Filter entries based on @manual marking
 */
function filterByManualMarking(
  inputs: TSet,
  args: CoreArgs
): ManualFilterResult {
  const parsedComments = getParsedComments(args.srcFile);
  const overrideSourceLng = args.sourceOverride?.get(args.targetLng);

  const toTranslate: TSet = new Map();
  const toSkip: TSet = new Map();
  const toCopyOriginal: TSet = new Map();
  const toTranslateFromOverride: TSet = new Map();

  inputs.forEach((value, key) => {
    const parsed = parsedComments.get(key);

    if (!parsed || !hasManualMarking(parsed)) {
      // No @manual marking, translate normally
      toTranslate.set(key, value);
      return;
    }

    if (shouldSkipForManual(parsed, args.targetLng)) {
      // Target language is in @manual list, skip
      toSkip.set(key, value);
      return;
    }

    // Has @manual but target not in list
    if (overrideSourceLng) {
      // Has source override, translate from override source
      toTranslateFromOverride.set(key, value);
    } else {
      // No override, copy original text
      toCopyOriginal.set(key, value);
    }
  });

  return { toTranslate, toSkip, toCopyOriginal, toTranslateFromOverride };
}

/**
 * Infer override source file path from current source file path
 * e.g., /path/to/en.po with override zh-Hans -> /path/to/zh-Hans.po
 */
function inferOverrideSourcePath(srcFile: string, overrideLng: string): string {
  const dir = path.dirname(srcFile);
  const ext = path.extname(srcFile);
  return path.join(dir, `${overrideLng}${ext}`);
}

/**
 * Read translations from override source file
 */
async function readOverrideSource(
  srcFile: string,
  overrideLng: string
): Promise<TSet | null> {
  const overridePath = inferOverrideSourcePath(srcFile, overrideLng);
  try {
    const result = await readTFileCore("po", {
      path: overridePath,
      lng: overrideLng,
      format: "po",
    });
    return result;
  } catch (e) {
    console.warn(`Warning: Could not read override source file ${overridePath}`);
    return null;
  }
}

function extractStringsToTranslate(args: CoreArgs): TSet {
  const src: TSet = args.src;
  if (!src.size) {
    logFatal("Did not find any source translations");
  }
  const oldTarget: TSet | null = args.oldTarget;
  if (!oldTarget) {
    // Translate everything if an old target does not yet exist.
    return src;
  } else {
    // Translate values whose keys are not in the target.
    return selectLeftDistinct(src, oldTarget, "COMPARE_KEYS_AND_NULL_VALUES");
  }
}

function extractStaleTranslations(args: CoreArgs): TSet | null {
  if (args.oldTarget) {
    return leftMinusRight(args.oldTarget, args.src);
  } else {
    return null;
  }
}

function computeChangeSet(
  args: CoreArgs,
  serviceInvocation: TServiceInvocation | null
): TChangeSet {
  const deleted = extractStaleTranslations(args);
  if (!serviceInvocation) {
    return {
      added: new Map(),
      updated: new Map(),
      skipped: new Map(),
      deleted,
    };
  }
  const skipped = selectLeftDistinct(
    serviceInvocation.inputs,
    serviceInvocation.results,
    "COMPARE_KEYS"
  );
  if (!args.oldTarget) {
    return {
      added: serviceInvocation.results,
      updated: new Map(),
      skipped,
      deleted,
    };
  }
  const added = selectLeftDistinct(
    serviceInvocation.results,
    args.oldTarget,
    "COMPARE_KEYS"
  );
  const updated = selectLeftDistinct(
    serviceInvocation.results,
    args.oldTarget,
    "COMPARE_VALUES"
  );
  return {
    added,
    updated,
    skipped,
    deleted,
  };
}

function computeNewTarget(
  args: CoreArgs,
  changeSet: TChangeSet,
  serviceInvocation: TServiceInvocation | null
): TSet {
  const oldTargetRef: TSet | null =
    args.oldTarget && changeSet.deleted
      ? leftMinusRight(args.oldTarget, changeSet.deleted)
      : args.oldTarget;

  if (!serviceInvocation) {
    return oldTargetRef ?? new Map<string, string | null>();
  }
  if (!oldTargetRef) {
    return serviceInvocation.results;
  }
  return joinResultsPreserveOrder({
    translateResults: serviceInvocation.results,
    changeSet,
    oldTarget: oldTargetRef,
    src: args.src,
  });
}

function computeCoreResults(
  args: CoreArgs,
  serviceInvocation: TServiceInvocation | null,
  changeSet: TChangeSet
): CoreResults {
  return {
    changeSet,
    serviceInvocation,
    newTarget: computeNewTarget(args, changeSet, serviceInvocation),
  };
}

export async function translateCore(args: CoreArgs): Promise<CoreResults> {
  const rawServiceInputs = extractStringsToTranslate(args);

  // Filter entries based on @manual marking
  const filtered = filterByManualMarking(rawServiceInputs, args);

  // Log what we're doing
  if (filtered.toSkip.size > 0) {
    console.info(`Skip ${filtered.toSkip.size} entries marked as @manual:${args.targetLng}`);
  }
  if (filtered.toCopyOriginal.size > 0) {
    console.info(`Copy original text for ${filtered.toCopyOriginal.size} entries with @manual (no override)`);
  }
  if (filtered.toTranslateFromOverride.size > 0) {
    const overrideLng = args.sourceOverride.get(args.targetLng);
    console.info(`Translate ${filtered.toTranslateFromOverride.size} entries from override source ${overrideLng}`);
  }

  let serviceInvocation: TServiceInvocation | null = null;

  // Translate entries without @manual marking
  if (filtered.toTranslate.size >= 1) {
    serviceInvocation = await invokeTranslationService(filtered.toTranslate, args);
  }

  // Handle entries that need to copy original text
  if (filtered.toCopyOriginal.size > 0) {
    if (!serviceInvocation) {
      serviceInvocation = { inputs: new Map(), results: new Map() };
    }
    filtered.toCopyOriginal.forEach((value, key) => {
      serviceInvocation!.inputs.set(key, value);
      serviceInvocation!.results.set(key, value); // Copy original
    });
  }

  // Handle entries that need to translate from override source
  if (filtered.toTranslateFromOverride.size > 0) {
    const overrideLng = args.sourceOverride.get(args.targetLng);
    if (overrideLng) {
      const overrideSource = await readOverrideSource(args.srcFile, overrideLng);
      if (overrideSource) {
        // Create inputs from override source
        const overrideInputs: TSet = new Map();
        filtered.toTranslateFromOverride.forEach((_, key) => {
          const overrideValue = overrideSource.get(key);
          if (overrideValue) {
            overrideInputs.set(key, overrideValue);
          }
        });

        if (overrideInputs.size > 0) {
          // Translate from override source
          const overrideArgs: CoreArgs = {
            ...args,
            src: overrideInputs,
            srcLng: overrideLng,
          };
          const overrideResult = await invokeTranslationService(overrideInputs, overrideArgs);

          // Merge results
          if (!serviceInvocation) {
            serviceInvocation = { inputs: new Map(), results: new Map() };
          }
          overrideResult.inputs.forEach((value, key) => {
            serviceInvocation!.inputs.set(key, value);
          });
          overrideResult.results.forEach((value, key) => {
            serviceInvocation!.results.set(key, value);
          });
        }
      } else {
        // Fallback: copy original if override source not available
        if (!serviceInvocation) {
          serviceInvocation = { inputs: new Map(), results: new Map() };
        }
        filtered.toTranslateFromOverride.forEach((value, key) => {
          serviceInvocation!.inputs.set(key, value);
          serviceInvocation!.results.set(key, value);
        });
      }
    }
  }

  const changeSet = computeChangeSet(args, serviceInvocation);
  const results = computeCoreResults(args, serviceInvocation, changeSet);
  logCoreResults(args, results);
  return results;
}
