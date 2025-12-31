# lingui-ai-translate

AI-powered translation tool for [Lingui](https://lingui.dev/) PO files with context-aware translations.

## Features

- **Context-aware translations**: Pass context from source code comments to AI for better translations
- **Manual translation marking**: Mark specific entries for manual translation with `@manual:lang1,lang2`
- **Source language override**: Translate Traditional Chinese from Simplified Chinese instead of English
- **Incremental translation**: Only translates new or changed entries, preserves manual edits
- **Multiple AI services**: Supports OpenAI, TypeChat, Google Translate, Azure, and more

## Installation

```bash
npm install -g lingui-ai-translate
```

Or as a dev dependency:

```bash
npm install --save-dev lingui-ai-translate
```

## Quick Start

```bash
# Basic translation
lingui-ai-translate \
  --srcFile=locales/en.po \
  --srcLng=en \
  --srcFormat=po \
  --targetFile=locales/zh-Hans.po \
  --targetLng=zh-Hans \
  --targetFormat=po \
  --service=openai \
  --serviceConfig="YOUR_OPENAI_API_KEY"
```

## Source Code Annotations

Add annotations in your Lingui source code to control translation behavior:

### Context for AI (`@context`)

```jsx
import { t } from "@lingui/macro"

// Provide context for better AI translation
t({
  message: "Save",
  comment: "@context:Button to save form data, not 'save money'"
})
```

Generated PO file:
```po
#. @context:Button to save form data, not 'save money'
msgid "Save"
msgstr ""
```

### Manual Translation (`@manual`)

Mark entries that require manual translation for specific languages:

```jsx
// Only manually translate to zh-Hans, auto-translate to other languages
t({
  message: "Acme Corp",
  comment: "@manual:zh-Hans"
})

// Manually translate both zh-Hans and zh-Hant
t({
  message: "Special Term",
  comment: "@manual:zh-Hans,zh-Hant"
})

// Combine with context
t({
  message: "Technical term",
  comment: `
    @manual:zh-Hans
    @context:Industry-specific terminology
  `
})
```

### Behavior with `@manual`

| Target Language | `@manual:zh-Hans` | Behavior |
|-----------------|-------------------|----------|
| zh-Hans | In list | Skip (wait for manual translation) |
| zh-Hant | Not in list + has sourceOverride | Translate from zh-Hans |
| de, fr, etc. | Not in list | Copy original text |

## Source Language Override

Translate certain languages from a different source (e.g., Traditional Chinese from Simplified Chinese):

```bash
lingui-ai-translate \
  --srcFile=locales/en.po \
  --srcLng=en \
  --srcFormat=po \
  --targetFile=locales/zh-Hant.po \
  --targetLng=zh-Hant \
  --targetFormat=po \
  --service=openai \
  --serviceConfig="YOUR_API_KEY" \
  --sourceOverride="zh-Hant:zh-Hans"
```

This will:
1. For entries **without** `@manual`: Translate from English as usual
2. For entries **with** `@manual:zh-Hans`: Translate from `zh-Hans.po` (if zh-Hans translation exists)

## Batch Translation Script

Create a script to translate all your locales:

```bash
#!/bin/bash
# translate.sh

BASE_DIR="locales"
COMMON_ARGS=(
  "--srcLng=en"
  "--srcFormat=po"
  "--targetFormat=po"
  "--service=openai"
  "--serviceConfig=$OPENAI_API_KEY"
)

# Translate to Simplified Chinese (manual entries skipped)
lingui-ai-translate \
  --srcFile=$BASE_DIR/en.po \
  --targetFile=$BASE_DIR/zh-Hans.po \
  --targetLng=zh-Hans \
  "${COMMON_ARGS[@]}"

# Translate to Traditional Chinese (from zh-Hans for @manual entries)
lingui-ai-translate \
  --srcFile=$BASE_DIR/en.po \
  --targetFile=$BASE_DIR/zh-Hant.po \
  --targetLng=zh-Hant \
  --sourceOverride="zh-Hant:zh-Hans" \
  "${COMMON_ARGS[@]}"

# Translate to other languages
for lang in de fr ja ko; do
  lingui-ai-translate \
    --srcFile=$BASE_DIR/en.po \
    --targetFile=$BASE_DIR/$lang.po \
    --targetLng=$lang \
    "${COMMON_ARGS[@]}"
done
```

## CLI Options

```
Usage: lingui-ai-translate [options]

Options:
  --srcFile <sourceFile>          The source PO file to be translated
  --srcLng <sourceLanguage>       A language code for the source language
  --srcFormat <sourceFileFormat>  One of "po", "flat-json", "nested-json", "yaml", "xml", etc.
  --targetFile <targetFile>       The target file for the translations
  --targetLng <targetLanguage>    A language code for the target language
  --targetFormat <targetFileFormat>  Target file format (usually same as srcFormat)
  --service <translationService>  One of "openai", "typechat", "google-translate", "azure", etc.
  --serviceConfig <serviceKey>    API key for the translation service
  --sourceOverride <mapping>      Override source language (e.g., "zh-Hant:zh-Hans,pt-BR:pt-PT")
  --baseUrl <url>                 Custom API base URL for OpenAI-compatible APIs
  --prompt <prompt>               Additional instructions for AI translation
  --matcher <matcher>             Interpolation matcher: "none", "icu", "i18next", "sprintf"
  -v, --version                   Output the version number
  -h, --help                      Display help
```

## Available Translation Services

| Service | Description | Config Required |
|---------|-------------|-----------------|
| `openai` | OpenAI GPT models | API key via `--serviceConfig` |
| `typechat` | TypeChat with OpenAI/compatible API | `OPENAI_API_KEY` env var |
| `google-translate` | Google Cloud Translation | Service account JSON path |
| `azure` | Azure Cognitive Services | API key |
| `sync-without-translate` | Copy without translation | None |
| `manual` | Manual typing | None |

## Environment Variables

For OpenAI service:
- `OPENAI_BASE_URL` - Custom API base URL for OpenAI-compatible APIs (e.g., DeepSeek, Ollama)

For TypeChat service:
- `OPENAI_API_KEY` - Your OpenAI API key
- `OPENAI_MODEL` - Model to use (default: `gpt-4o-mini-2024-07-18`)
- `OPENAI_ENDPOINT` - Custom API endpoint (for Azure OpenAI or compatible APIs)
- `TYPECHAT_RPM` - Requests per minute limit
- `OPEN_AI_BATCH_SIZE` - Batch size for translation (default: 10)

### Using OpenAI-Compatible APIs

You can use any OpenAI-compatible API by setting the base URL:

```bash
# Using DeepSeek
export OPENAI_BASE_URL="https://api.deepseek.com/v1"
lingui-ai-translate --service=openai --serviceConfig="YOUR_DEEPSEEK_KEY" ...

# Using local Ollama
export OPENAI_BASE_URL="http://localhost:11434/v1"
lingui-ai-translate --service=openai --serviceConfig="ollama" ...

# Or via CLI argument (takes precedence over env var)
lingui-ai-translate --baseUrl="https://api.deepseek.com/v1" --serviceConfig="YOUR_KEY" ...
```

## Custom Prompts

Provide additional instructions to the AI:

```bash
lingui-ai-translate \
  --srcFile=locales/en.po \
  --targetFile=locales/ja.po \
  --targetLng=ja \
  --service=openai \
  --serviceConfig="YOUR_API_KEY" \
  --prompt="This is a medical application. Keep technical terms like 'MRI', 'CT scan' in English. Use polite Japanese (敬語)."
```

## Weblate Integration

For entries marked with `@manual`, the tool copies the original text to `msgstr`. This prevents Weblate from flagging them as "untranslated".

To configure Weblate to ignore these entries:
1. The entries will have the original English text as the translation
2. Configure Weblate checks to ignore "unchanged translation" for entries with specific comments

## License

GPL

## Credits

Based on [attranslate](https://github.com/fkirc/attranslate) by Felix Kirchengast.
