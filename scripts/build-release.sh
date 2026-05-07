#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
STAGE_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${STAGE_DIR}"
}

trap cleanup EXIT

VERSION="$(
  ROOT_DIR="${ROOT_DIR}" python3 - <<'PY'
import json
import os
from pathlib import Path

root = Path(os.environ["ROOT_DIR"])
manifest = json.loads((root / "manifest.json").read_text())
print(manifest["version"])
PY
)"

ARCHIVE_PATH="${DIST_DIR}/chattrim-v${VERSION}.zip"

rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"

for required_file in \
  "${ROOT_DIR}/icons/icon16.png" \
  "${ROOT_DIR}/icons/icon32.png" \
  "${ROOT_DIR}/icons/icon48.png" \
  "${ROOT_DIR}/icons/icon128.png"; do
  if [[ ! -f "${required_file}" ]]; then
    echo "Missing required asset: ${required_file}" >&2
    exit 1
  fi
done

cp "${ROOT_DIR}/manifest.json" "${STAGE_DIR}/"
cp "${ROOT_DIR}/content.js" "${STAGE_DIR}/"
cp -R "${ROOT_DIR}/icons" "${STAGE_DIR}/"

(
  cd "${STAGE_DIR}"
  zip -qr "${ARCHIVE_PATH}" manifest.json content.js icons
)

echo "Built ${ARCHIVE_PATH}"
