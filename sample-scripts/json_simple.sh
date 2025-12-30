#!/bin/bash
set -e

# This example translates a single JSON-file from English into German.

# Run "npm install --global lingui-ai-translate" before you try this example.
lingui-ai-translate --srcFile=json-simple/en.json --srcLng=English --srcFormat=nested-json --targetFile=json-simple/de.json --targetLng=German --targetFormat=nested-json --service=openai
