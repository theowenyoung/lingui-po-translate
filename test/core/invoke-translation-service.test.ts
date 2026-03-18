import { CoreArgs, TSet } from "../../src/core/core-definitions";
import { invokeTranslationService } from "../../src/core/invoke-translation-service";
import {
  injectFakeService,
  TResult,
  TService,
  TServiceArgs,
} from "../../src/services/service-definitions";

afterEach(() => {
  jest.restoreAllMocks();
});

class ReportingService implements TService {
  async translateStrings(args: TServiceArgs): Promise<TResult[]> {
    const results: TResult[] = args.strings.map((tString) => {
      if (tString.key === "greeting") {
        return {
          key: tString.key,
          translated: "你好 <span>0</span>",
        };
      }
      return {
        key: tString.key,
        translated: "保存",
      };
    });
    results.forEach((result) => args.onTranslationResult?.(result));
    return results;
  }
}

class SilentService implements TService {
  async translateStrings(args: TServiceArgs): Promise<TResult[]> {
    return args.strings.map((tString) => ({
      key: tString.key,
      translated: "Speichern",
    }));
  }
}

function buildArgs(service: CoreArgs["service"], matcher: CoreArgs["matcher"]): CoreArgs {
  return {
    src: new Map(),
    srcLng: "en",
    srcFile: "test.po",
    oldTarget: null,
    targetLng: service === "openai" ? "zh-Hans" : "de",
    service,
    serviceConfig: null,
    matcher,
    prompt: "",
    glossary: [],
    sourceOverride: new Map(),
    baseUrl: null,
    debug: false,
    model: null,
  };
}

test("invokeTranslationService logs friendly per-string output for model services", async () => {
  injectFakeService("openai", new ReportingService());
  const infoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);

  const inputs: TSet = new Map([
    ["greeting", "Hello {name}"],
    ["save", "Save"],
  ]);

  await invokeTranslationService(inputs, buildArgs("openai", "icu"));

  const infoLines = infoSpy.mock.calls.map((call) => String(call[0]));
  expect(infoLines).toContain(
    "Invoke 'openai' from 'en' to 'zh-Hans' with 2 inputs..."
  );
  expect(infoLines).toContain('  [1/2] "Hello {name}" -> zh-Hans: "你好 {name}"');
  expect(infoLines).toContain('  [2/2] "Save" -> zh-Hans: "保存"');
  expect(
    infoLines.filter((line) => line.includes("-> zh-Hans:")).length
  ).toBe(2);
});

test("invokeTranslationService keeps per-string logs disabled for non-model services", async () => {
  injectFakeService("google-translate", new SilentService());
  const infoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);

  const inputs: TSet = new Map([["save", "Save"]]);

  await invokeTranslationService(inputs, buildArgs("google-translate", "none"));

  const infoLines = infoSpy.mock.calls.map((call) => String(call[0]));
  expect(infoLines).toContain(
    "Invoke 'google-translate' from 'en' to 'de' with 1 inputs..."
  );
  expect(infoLines.some((line) => line.includes("-> de:"))).toBe(false);
});
