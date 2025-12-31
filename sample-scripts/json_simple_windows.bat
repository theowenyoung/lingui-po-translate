:: This example translates a single JSON-file from English into German.

:: Run "npm install --global lingui-po-translate" before you try this example.
lingui-po-translate --srcFile=json-simple/en.json --srcLng=en --srcFormat=nested-json --targetFile=json-simple/de.json --targetLng=de --targetFormat=nested-json --service=openai
