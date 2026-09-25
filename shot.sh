#!/usr/bin/env bash
#
# shot.sh — grab the connected phone's current screen into Docs/AuthScreenImg.
#
#   ./shot.sh                 -> Docs/AuthScreenImg/shot-20260923-121530.png
#   ./shot.sh login-dark      -> Docs/AuthScreenImg/login-dark-20260923-121530.png
#
# Always timestamped, so hitting it twice never overwrites the first one.
#
# Uses `adb exec-out screencap -p` and pipes straight to a PC file: there is no
# device-side path, which is what avoids the Git-Bash/MSYS path mangling that
# turns `/sdcard/x.png` into `C:/Program Files/Git/sdcard/x.png`.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/Docs/AuthScreenImg"
LABEL="${1:-shot}"
LABEL="$(printf '%s' "$LABEL" | tr -c 'A-Za-z0-9._-' '-')"   # keep filenames sane
OUT="$DIR/${LABEL}-$(date +%Y%m%d-%H%M%S).png"

mkdir -p "$DIR"

# A phone that is listed but "offline" or "unauthorized" still exits 0 on
# `adb devices`, and screencap then writes a 0-byte file that looks like a
# black screenshot. Check the state word itself.
STATE="$(adb get-state 2>&1 | tr -d '\r')"
if [ "$STATE" != "device" ]; then
  echo "No device ready (adb get-state: $STATE)."
  echo "Plug the phone in, unlock it, and accept the USB-debugging prompt."
  exit 1
fi

adb exec-out screencap -p > "$OUT"

# Byte count is the check that matters: a failed capture leaves a tiny or empty
# file, and 'the command exited 0' does not tell you which you got.
BYTES=$(wc -c < "$OUT" | tr -d ' ')
if [ "$BYTES" -lt 10000 ]; then
  echo "Capture looks empty (${BYTES} bytes) — screen off, or a secure screen that blocks capture."
  rm -f "$OUT"
  exit 1
fi

echo "Saved: $OUT  (${BYTES} bytes)"
