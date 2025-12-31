# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Build the project (compiles TypeScript and creates npm link)
npm run build

# Run all tests (10 second timeout per test)
npm test

# Run a specific test file
npx jest test/e2e/scripts-po.test.ts

# Run tests matching a pattern
npx jest -t "po clean"

# Generate reference files for tests
GENERATE_REFS=True npm test

# Run Windows-specific tests
npm run test:windows
```

## Architecture Overview

This is a CLI tool for AI-powered translation of Lingui PO files. The codebase follows a modular architecture with three main extension points:

### Core Translation Flow

1. **Entry Point**: `src/index.ts` - CLI argument parsing with Commander
2. **CLI Handler**: `src/core/translate-cli.ts` - Orchestrates the translation workflow
3. **Translation Core**: `src/core/translate-core.ts` - Core translation logic including:
   - Extracting strings to translate (new/changed entries only)
   - Filtering by `@manual` annotations
   - Source language override handling for entries marked `@manual`
4. **Service Invocation**: `src/core/invoke-translation-service.ts` - Calls translation services

### Plugin Systems

**Translation Services** (`src/services/`):
- Each service implements `TService` interface with `translateStrings()` method
- Services are dynamically imported for faster startup
- Key services: `openai-translate.ts`, `typechat.ts`, `google-translate.ts`
- Service definition map in `src/services/service-definitions.ts`

**File Formats** (`src/file-formats/`):
- Each format implements `TFileFormat` interface with `readTFile()` and `writeTFile()`
- Formats: PO, JSON (flat/nested), YAML, XML, iOS strings, ARB, CSV
- Format definition map in `src/file-formats/file-format-definitions.ts`

**Matchers** (`src/matchers/`):
- Handle interpolation placeholders (ICU, i18next, sprintf)
- Prevent placeholders from being translated
- Definition map in `src/matchers/matcher-definitions.ts`

### Key Types

- `TSet`: `Map<string, string | null>` - Core translation data structure (msgid -> msgstr)
- `CoreArgs`: Translation arguments including source/target files, languages, service config
- `TChangeSet`: Tracks added/updated/deleted/skipped translations
- `ParsedComment`: Extracted `@manual` and `@context` annotations from PO comments

### PO File Comment Annotations

The `src/file-formats/po/comment-parser.ts` parses special annotations:
- `@manual:lang1,lang2` - Skip auto-translation for specified languages
- `@context:text` - Context passed to AI for better translations
- Multiple annotations can be separated by `;` or newline:
  - Single line: `#. @manual:zh; @context:Button text`
  - Multi-line: `#. @manual:zh` followed by `#. @context:Button text`

## Test Structure

- `test/core/` - Unit tests for core translation logic
- `test/e2e/` - End-to-end tests using sample scripts in `sample-scripts/`
- `test/file-formats/` - File format read/write tests
- `test/matchers/` - Interpolation matcher tests

E2E tests run shell scripts from `sample-scripts/` and verify output. Use `injectFakeService()` from `service-definitions.ts` to mock translation services in tests.
