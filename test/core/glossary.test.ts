import { join } from "path";
import {
  GlossaryEntry,
  matchGlossaryEntries,
  readGlossaryFile,
} from "../../src/glossary/glossary";
import { CoreArgs, TSet } from "../../src/core/core-definitions";
import { injectFakeService, TResult, TService, TServiceArgs } from "../../src/services/service-definitions";
import { invokeTranslationService } from "../../src/core/invoke-translation-service";

const glossaryPath = join(process.cwd(), "test-assets/glossary/basic.yml");

test("read glossary YAML file", () => {
  expect(readGlossaryFile(glossaryPath)).toEqual<GlossaryEntry[]>([
    {
      source: "Workspace",
      target: "工作区",
      note: "IDE/workspace concept",
    },
    {
      source: "Repository",
      target: "仓库",
    },
    {
      source: "Token",
      target: "令牌",
    },
  ]);
});

test("match glossary entries case-insensitively", () => {
  const glossary = readGlossaryFile(glossaryPath);
  expect(
    matchGlossaryEntries("Workspace Repository Token", glossary)
  ).toEqual<GlossaryEntry[]>([
    {
      source: "Repository",
      target: "仓库",
    },
    {
      source: "Workspace",
      target: "工作区",
      note: "IDE/workspace concept",
    },
    {
      source: "Token",
      target: "令牌",
    },
  ]);
});

test("invokeTranslationService attaches matched glossary entries per string", async () => {
  class CaptureService implements TService {
    capturedArgs: TServiceArgs | null = null;

    async translateStrings(args: TServiceArgs): Promise<TResult[]> {
      this.capturedArgs = args;
      return args.strings.map((tString) => ({
        key: tString.key,
        translated: tString.value,
      }));
    }
  }

  const captureService = new CaptureService();
  injectFakeService("typechat-manual", captureService);

  const inputs: TSet = new Map([
    ["workspace", "Open Workspace"],
    ["plain", "Hello world"],
  ]);

  const args: CoreArgs = {
    src: new Map(),
    srcLng: "en",
    srcFile: "test.po",
    oldTarget: null,
    targetLng: "zh-CN",
    service: "typechat-manual",
    serviceConfig: null,
    matcher: "none",
    prompt: "",
    glossary: readGlossaryFile(glossaryPath),
    sourceOverride: new Map(),
    baseUrl: null,
    debug: false,
    model: null,
  };

  await invokeTranslationService(inputs, args);

  expect(captureService.capturedArgs?.strings).toEqual([
    {
      key: "workspace",
      value: "Open Workspace",
      context: undefined,
      glossary: [
        {
          source: "Workspace",
          target: "工作区",
          note: "IDE/workspace concept",
        },
      ],
    },
    {
      key: "plain",
      value: "Hello world",
      context: undefined,
      glossary: undefined,
    },
  ]);
});
