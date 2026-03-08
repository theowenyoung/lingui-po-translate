import { Configuration, OpenAIApi, ChatCompletionRequestMessage } from "openai";
import {
  DEFAULT_MODEL,
  TResult,
  TService,
  TServiceArgs,
  TString,
} from "./service-definitions";
import { logFatal } from "../util/util";
import { chunk, flatten } from "lodash";

async function translateSingleString(
  tString: TString,
  args: TServiceArgs
): Promise<string> {
  const OPENAI_API_KEY = args.serviceConfig;
  if (!OPENAI_API_KEY || !OPENAI_API_KEY.trim().length) {
    logFatal(
      'Missing OpenAI API Key: Please get an API key from https://platform.openai.com/account/api-keys and then call lingui-po-translate with --serviceConfig="YOUR API KEY"'
    );
  }

  const configuration = new Configuration({
    apiKey: OPENAI_API_KEY,
    basePath: args.baseUrl ?? process.env.OPENAI_BASE_URL ?? undefined,
  });
  const openai = new OpenAIApi(configuration);

  const { systemPrompt, userPrompt } = generatePrompt(tString, args);

  const messages: ChatCompletionRequestMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];

  const model = args.model ?? DEFAULT_MODEL;

  if (args.debug) {
    console.log("\n[DEBUG] OpenAI Request:");
    console.log("  Model:", model);
    console.log("  System:", systemPrompt);
    console.log("  User:", userPrompt);
  }

  /**
   * https://platform.openai.com/docs/api-reference/completions/create
   * What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.
   * We generally recommend altering this or top_p but not both.
   */
  try {
    const completion = await openai.createChatCompletion({
      model,
      messages: messages,
      max_completion_tokens: 2048,
      reasoning_effort: "low",
    } as any);

    if (args.debug) {
      console.log(
        "\n[DEBUG] OpenAI Full Response:",
        JSON.stringify(completion.data, null, 2)
      );
    }
    const text = completion.data.choices[0].message?.content;
    if (text == undefined) {
      logFatal("OpenAI returned undefined for prompt " + prompt);
    }
    return text;
  } catch (e: any) {
    if (typeof e.message === "string") {
      const responseData = e?.response?.data;
      const detail = responseData?.error?.message ?? JSON.stringify(responseData);
      logFatal(
        "OpenAI: " +
          e.message +
          (detail ? ", Detail: " + detail : "") +
          ", Status text: " +
          JSON.stringify(e?.response?.statusText)
      );
    } else {
      throw e;
    }
  }
}

interface GeneratedPrompt {
  systemPrompt: string;
  userPrompt: string;
}

function getChineseVariantInstruction(targetLng: string): string {
  const simplified = ["zh-CN", "zh-Hans", "zh-SG", "zh"];
  const traditional = ["zh-TW", "zh-Hant", "zh-HK", "zh-MO"];

  if (traditional.some((code) => targetLng.startsWith(code))) {
    if (targetLng.startsWith("zh-HK") || targetLng.startsWith("zh-MO")) {
      return "\n- Use Traditional Chinese with Hong Kong conventions (e.g., 檔案 not 文件, 視窗 not 窗口)";
    }
    return "\n- Use Traditional Chinese with **Taiwan conventions** (e.g., 檔案 not 文件, 軟體 not 軟件, 使用者 not 用戶)";
  }

  if (simplified.some((code) => targetLng.startsWith(code))) {
    return "\n- Use Simplified Chinese (Mainland China conventions, e.g., 文件 not 檔案, 用户 not 使用者)";
  }

  return "";
}

function generatePrompt(tString: TString, args: TServiceArgs): GeneratedPrompt {
  const systemPrompt = `You are an expert software UI translator specializing in i18n localization.
Task: Translate the UI string from ${args.srcLng} to ${args.targetLng}.

## Output Rules
- Return ONLY the translated text — no tags, no quotes, no explanation
- If the source text requires no translation (numbers, URLs, code, symbols), return it as-is
- Never add punctuation that wasn't in the original

## Translation Rules
- Preserve ALL placeholders exactly: {name}, {{count}}, %s, %d, %(var)s, etc.
- Preserve ALL HTML/JSX tags and their attributes: <br/>, <strong>, <0>, etc.
- Preserve whitespace, newlines, and leading/trailing spaces
- Do NOT translate: brand names, product names, technical identifiers

## UI Localization Guidelines
- Match the tone of the original: formal stays formal, casual stays casual
- For buttons/labels: use concise, action-oriented phrasing in ${args.targetLng}
- For error messages: keep the same level of urgency
- For plurals: use the grammatically correct form for ${args.targetLng}
- Prefer natural, idiomatic ${
    args.targetLng
  } over literal translation${getChineseVariantInstruction(args.targetLng)}${
    tString.context
      ? `\n\n## Context (IMPORTANT)\nThe following context describes where/how this string is used in the UI. **Use it to disambiguate meaning and choose the correct translation. Do NOT default to the most common meaning — pick the one that fits the context.**\n${tString.context}`
      : ""
  }${args.prompt ? `\n\n## Additional Instructions\n${args.prompt}` : ""}`;

  const userPrompt = `<source>${tString.value}</source>`;
  return { systemPrompt, userPrompt };
}

async function translateBatch(
  batch: TString[],
  args: TServiceArgs
): Promise<TResult[]> {
  console.log(
    "Translate a batch of " + batch.length + " strings with OpenAI..."
  );
  const promises: Promise<TResult>[] = batch.map(async (tString: TString) => {
    const rawResult = await translateSingleString(tString, args);
    const result: TResult = {
      key: tString.key,
      translated: rawResult.trim(),
    };
    return result;
  });
  const resolvedPromises: TResult[] = await Promise.all(promises);
  return resolvedPromises;
}

export class OpenAITranslate implements TService {
  async translateStrings(args: TServiceArgs) {
    const batches: TString[][] = chunk(args.strings, 5);
    const results: TResult[][] = [];
    for (const batch of batches) {
      const result = await translateBatch(batch, args);
      results.push(result);
    }
    return flatten(results);
  }
}
