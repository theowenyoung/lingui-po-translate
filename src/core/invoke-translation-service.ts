import { CoreArgs, TServiceInvocation, TSet } from "./core-definitions";
import {
  instantiateTMatcher,
  reInsertInterpolations,
  replaceInterpolations,
  Replacer,
} from "../matchers/matcher-definitions";
import {
  instantiateTService,
  TResult,
  TServiceArgs,
  TServiceType,
  TString,
} from "../services/service-definitions";
import { getParsedComments } from "../file-formats/po/po-files";
import { matchGlossaryEntries } from "../glossary/glossary";

const promptAwareServices: TServiceType[] = ["openai", "typechat", "typechat-manual"];

function serviceSupportsPromptAugmentation(service: TServiceType): boolean {
  return promptAwareServices.includes(service);
}

function serviceShouldLogTranslations(service: TServiceType): boolean {
  return promptAwareServices.includes(service);
}

function previewLogValue(value: string, maxLength = 120): string {
  const preview =
    value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
  return JSON.stringify(preview);
}

export async function invokeTranslationService(
  serviceInputs: TSet,
  args: CoreArgs
): Promise<TServiceInvocation> {
  if (args.prompt && !serviceSupportsPromptAugmentation(args.service)) {
    console.warn(
      `Warning: The '--prompt' parameter is only supported by 'openai', 'typechat', and 'typechat-manual' services. Your prompt will be ignored when using '${args.service}'.`
    );
  }
  if (args.glossary.length && !serviceSupportsPromptAugmentation(args.service)) {
    console.warn(
      `Warning: The '--glossaryFile' parameter is only supported by 'openai', 'typechat', and 'typechat-manual' services. Your glossary will be ignored when using '${args.service}'.`
    );
  }

  /**
   * Some translation services throw errors if they see empty strings.
   * Therefore, we bypass empty strings without changing them.
   */
  const rawInputs: TString[] = [];
  const results: TSet = new Map();
  serviceInputs.forEach((value, key) => {
    if (args.service != 'key-as-translation' && (!value || !value.trim().length)) {
      results.set(key, value);
    } else {
      rawInputs.push({
        key,
        value: value ?? "",
      });
    }
  });
  if (results.size) {
    console.info(`Bypass ${results.size} strings because they are empty...`);
  }
  let translateResults: TResult[] = [];
  if (rawInputs.length) {
    translateResults = await runTranslationService(rawInputs, args);
  }
  translateResults.forEach((tResult) => {
    results.set(tResult.key, tResult.translated);
  });
  return {
    inputs: serviceInputs,
    results,
  };
}

async function runTranslationService(
  rawInputs: TString[],
  args: CoreArgs
): Promise<TResult[]> {
  const matcher = instantiateTMatcher(args.matcher);
  const replacers = new Map<string, Replacer>();
  const rawInputsByKey = new Map<string, TString>();
  rawInputs.forEach((rawString) => {
    const replacer = replaceInterpolations(rawString.value, matcher);
    replacers.set(rawString.key, replacer);
    rawInputsByKey.set(rawString.key, rawString);
  });
  const loggedKeys = new Set<string>();
  let loggedCount = 0;
  const shouldLogTranslations = serviceShouldLogTranslations(args.service);

  const logTranslatedString = (rawResult: TResult) => {
    if (!shouldLogTranslations || loggedKeys.has(rawResult.key)) {
      return;
    }

    const input = rawInputsByKey.get(rawResult.key);
    const replacer = replacers.get(rawResult.key);
    if (!input || !replacer) {
      return;
    }

    const translated = reInsertInterpolations(
      rawResult.translated,
      replacer.replacements
    );
    loggedKeys.add(rawResult.key);
    loggedCount++;
    console.info(
      `  [${loggedCount}/${rawInputs.length}] ${previewLogValue(
        input.value
      )} -> ${args.targetLng}: ${previewLogValue(translated)}`
    );
  };

  // Get parsed comments for context
  const parsedComments = getParsedComments(args.srcFile);

  const replacedInputs: TString[] = rawInputs.map((rawString) => {
    const parsed = parsedComments.get(rawString.key);
    const cleanValue = replacers.get(rawString.key)!.clean;
    const glossary = matchGlossaryEntries(cleanValue, args.glossary);
    return {
      key: rawString.key,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      value: cleanValue,
      context: parsed?.rawComment ?? parsed?.context,
      glossary: glossary.length ? glossary : undefined,
    };
  });

  const serviceArgs: TServiceArgs = {
    strings: replacedInputs,
    srcLng: args.srcLng,
    targetLng: args.targetLng,
    serviceConfig: args.serviceConfig,
    prompt: args.prompt,
    baseUrl: args.baseUrl,
    debug: args.debug,
    model: args.model,
    onTranslationResult: shouldLogTranslations ? logTranslatedString : undefined,
  };

  console.info(
    `Invoke '${args.service}' from '${args.srcLng}' to '${args.targetLng}' with ${serviceArgs.strings.length} inputs...`
  );
  const translationService = await instantiateTService(args.service);
  const rawResults = await translationService.translateStrings(serviceArgs);
  rawResults.forEach(logTranslatedString);
  return rawResults.map((rawResult) => {
    const cleanResult = reInsertInterpolations(
      rawResult.translated,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      replacers.get(rawResult.key)!.replacements
    );
    return {
      key: rawResult.key,
      translated: cleanResult,
    };
  });
}
