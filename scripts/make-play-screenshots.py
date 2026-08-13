"""Make Play-compliant phone screenshots from the App Store captures.

WHY THIS IS NEEDED: the Apple 6.5" slot is 1284x2778 = ratio 1:2.164. Google Play
rejects a phone screenshot whose aspect ratio exceeds 2:1, so the same files
cannot be reused as-is. Google's own guidance: 16:9 or 9:16, min side 320px, max
side 3840px.

Approach: fit each capture INSIDE a 1080x1920 (9:16, ratio 1:1.778) canvas by
height and pad the sides. Padding, not cropping -- cropping a screenshot of a UI
cuts off real content (a price, a tab bar), which is worse than a visible margin.
The pad colour is sampled from the capture's own top-left pixel so the seam is
invisible on the app's tinted backgrounds.
"""
import os
from PIL import Image

SRC = r'c:\Users\Pc\Desktop\greenBridge\GreenBridgeApp\store\apple\screenshot\en-US\APP_IPHONE_65'
DST = r'c:\Users\Pc\Desktop\greenBridge\GreenBridgeApp\assets\store\play\screenshots'
TARGET = (1080, 1920)

os.makedirs(DST, exist_ok=True)

for name in sorted(os.listdir(SRC)):
    if not name.lower().endswith('.png'):
        continue
    src = Image.open(os.path.join(SRC, name)).convert('RGB')
    w, h = src.size

    # Scale to fit the target height, preserving aspect.
    scale = TARGET[1] / h
    new = (max(1, int(round(w * scale))), TARGET[1])
    if new[0] > TARGET[0]:                      # too wide after fitting: fit width instead
        scale = TARGET[0] / w
        new = (TARGET[0], max(1, int(round(h * scale))))
    resized = src.resize(new, Image.LANCZOS)

    bg = src.getpixel((2, 2))                   # the app's own background tint
    canvas = Image.new('RGB', TARGET, bg)
    canvas.paste(resized, ((TARGET[0] - new[0]) // 2, (TARGET[1] - new[1]) // 2))

    out = os.path.join(DST, name)
    canvas.save(out, 'PNG', optimize=True)
    ratio = TARGET[1] / TARGET[0]
    print('  %-14s %sx%s -> %sx%s  ratio 1:%.3f  %s  (%.0f KB)' % (
        name, w, h, TARGET[0], TARGET[1], ratio,
        'OK' if ratio <= 2.0 else 'STILL TOO TALL',
        os.path.getsize(out) / 1024))

print('\nwrote to:', DST)
