import { Configuration, OpenAIApi, ChatCompletionRequestMessage } from "openai";
import {
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

  if (args.debug) {
    console.log("\n[DEBUG] OpenAI Request:");
    console.log("  Model: gpt-4o-mini-2024-07-18");
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
      model: "gpt-4o-mini-2024-07-18",
      messages: messages,
      temperature: 0,
      max_tokens: 2048,
    });

    if (args.debug) {
      console.log("\n[DEBUG] OpenAI Full Response:", JSON.stringify(completion.data, null, 2));
    }
    const text = completion.data.choices[0].message?.content;
    if (text == undefined) {
      logFatal("OpenAI returned undefined for prompt " + prompt);
    }
    return text;
  } catch (e: any) {
    if (typeof e.message === "string") {
      logFatal(
        "OpenAI: " +
          e.message +
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

function generatePrompt(tString: TString, args: TServiceArgs): GeneratedPrompt {
  // System: Role, language pair, rules, context, and custom instructions
  let systemPrompt = `You are a software UI translator.

Task: Translate from ${args.srcLng} to ${args.targetLng}.
Input: User provides text in <source> tags.
Output: Return only the translated text, without any tags or explanations.
Rules: Keep all placeholders ({name}, %s, %d), HTML tags, and formatting unchanged.`;

  if (tString.context) {
    systemPrompt += `\nContext: ${tString.context}`;
  }
  if (args.prompt) {
    systemPrompt += `\nNote: ${args.prompt}`;
  }

  // User: Text wrapped in XML tags
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
    const batches: TString[][] = chunk(args.strings, 10);
    const results: TResult[][] = [];
    for (const batch of batches) {
      const result = await translateBatch(batch, args);
      results.push(result);
    }
    return flatten(results);
  }
}
