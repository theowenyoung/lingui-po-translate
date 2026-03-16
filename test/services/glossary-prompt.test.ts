import {
  buildGlossaryByKeySection,
  buildGlossarySection,
} from "../../src/services/glossary-prompt";

test("buildGlossarySection formats required terminology block", () => {
  expect(
    buildGlossarySection([
      {
        source: "Workspace",
        target: "工作区",
        note: "IDE/workspace concept",
      },
      {
        source: "Repository",
        target: "仓库",
      },
    ])
  ).toBe(
    "\n\n## Required Terminology\nIf the source text contains any of the following terms, use the specified target translation exactly.\n- Workspace -> 工作区 (IDE/workspace concept)\n- Repository -> 仓库"
  );
});

test("buildGlossaryByKeySection formats per-key glossary block", () => {
  expect(
    buildGlossaryByKeySection([
      {
        key: "workspace",
        value: "Open Workspace",
        glossary: [
          {
            source: "Workspace",
            target: "工作区",
            note: "IDE/workspace concept",
          },
        ],
      },
      {
        key: "repo",
        value: "Repository settings",
        glossary: [
          {
            source: "Repository",
            target: "仓库",
          },
          {
            source: "Token",
            target: "令牌",
          },
        ],
      },
    ])
  ).toBe(
    '\nGlossary for specific keys:\n- "workspace": Workspace -> 工作区 (IDE/workspace concept)\n- "repo": Repository -> 仓库; Token -> 令牌\n\n'
  );
});
