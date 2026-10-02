#!/usr/bin/env bash
# Validación completa antes de commitear o después de mergear:
# typecheck (frontend + backend) → tests → build. Sale con código != 0 ante el primer error.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▶ Typecheck"
npm run typecheck

echo "▶ Tests"
npm test

echo "▶ Build"
npm run build

echo "▶ Chequeo de archivos sensibles trackeados"
if git ls-files | grep -E '(^|/)\.env$|\.db$|\.db-(wal|shm)$|\.sqlite$|(^|/)data/' ; then
  echo "✗ Hay archivos sensibles trackeados por git (ver arriba)." >&2
  exit 1
fi

echo "✓ Todo OK"
