"""Turn raw emulator captures into App Store iPhone 6.9" screenshots.

WHY THIS EXISTS
---------------
There is no iOS device or simulator on the Windows dev machine, so the only way
to produce store screenshots locally is the Android emulator running the same
React Native screens. `adb shell wm size 1290x2796` + `wm density 480` makes the
emulator match iPhone 16 Pro Max exactly (1290x2796 @3x = 430x932 pt), so the app
lays out at true iPhone dimensions.

What still has to go is the Android chrome: `settings put global policy_control
immersive.full=*` no longer works on API 34, so the status bar and the gesture
pill are in every capture. This crops them off, then scales back up to the exact
1290x2796 Apple requires — uniform scale plus a small centre crop, so nothing is
stretched.

CAVEAT worth keeping in mind: these are Android renders of the same JS. Content
is genuine but safe-area insets and font metrics differ slightly from iOS.
Prefer real iPhone captures for the final listing where you can.

Usage:  python scripts/make-ios-screenshots.py <src-dir> [name=file.png ...]
"""

import os
import sys

from PIL import Image

TARGET_W, TARGET_H = 1290, 2796
CROP_TOP = 100      # Android status bar
CROP_BOTTOM = 44    # gesture pill

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "store", "ios")

# Ordered as they should appear in App Store Connect.
PLAN = [
    ("01-home.png", "1-home.png"),
    ("02-browse.png", "2-browse.png"),
    ("03-matches.png", "3-matches.png"),
    ("05-thread.png", "4-messages.png"),
]


def process(src_path, dst_path):
    img = Image.open(src_path).convert("RGB")
    w, h = img.size

    cropped = img.crop((0, CROP_TOP, w, h - CROP_BOTTOM))
    cw, ch = cropped.size

    # Uniform scale so height hits the target, then centre-crop the width.
    scale = TARGET_H / ch
    new_w = max(TARGET_W, int(round(cw * scale)))
    resized = cropped.resize((new_w, TARGET_H), Image.LANCZOS)

    left = (new_w - TARGET_W) // 2
    final = resized.crop((left, 0, left + TARGET_W, TARGET_H))

    assert final.size == (TARGET_W, TARGET_H), final.size
    final.save(dst_path, "PNG", optimize=True)
    return cropped.size, new_w, final.size


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    src_dir = sys.argv[1]
    os.makedirs(OUT_DIR, exist_ok=True)

    made = 0
    for src_name, dst_name in PLAN:
        src = os.path.join(src_dir, src_name)
        if not os.path.exists(src):
            print("SKIP (missing)  %s" % src_name)
            continue
        dst = os.path.join(OUT_DIR, dst_name)
        (cw, ch), new_w, size = process(src, dst)
        print("OK  %-16s -> %-14s crop %dx%d  scale-w %d  final %dx%d"
              % (src_name, dst_name, cw, ch, new_w, size[0], size[1]))
        made += 1

    print("\n%d screenshot(s) written to %s" % (made, OUT_DIR))
    if made < 3:
        print("WARNING: App Store requires a MINIMUM of 3 screenshots.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
