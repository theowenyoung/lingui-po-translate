#!/bin/bash
set -e # abort on errors

# This example translates an english JSON-file into spanish, chinese and german.
BASE_DIR="json-advanced"
COMMON_ARGS=( "--srcLng=en" "--srcFormat=nested-json" "--targetFormat=nested-json" "--service=google-translate" "--serviceConfig=gcloud/gcloud_service_account.json" )

# install lingui-ai-translate if it is not installed yet
lingui-ai-translate --version || npm install --global lingui-ai-translate

lingui-ai-translate --srcFile=$BASE_DIR/en/fruits.json --targetFile=$BASE_DIR/es/fruits.json --targetLng=es "${COMMON_ARGS[@]}"
lingui-ai-translate --srcFile=$BASE_DIR/en/fruits.json --targetFile=$BASE_DIR/zh/fruits.json --targetLng=zh "${COMMON_ARGS[@]}"
lingui-ai-translate --srcFile=$BASE_DIR/en/fruits.json --targetFile=$BASE_DIR/de/fruits.json --targetLng=de "${COMMON_ARGS[@]}"
