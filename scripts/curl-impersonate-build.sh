#!/bin/bash
set -euo pipefail

# Builds curl-impersonate for a local checkout, into curl-impersonate/install.
ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

cd "$ROOT_DIR"
CURL_IMPERSONATE_PREFIX="$ROOT_DIR/curl-impersonate/install" \
  bash scripts/ci/build-curl-impersonate.sh local "$WORK_DIR"
