"""Generate the two Android-only Play Store graphics.

Play requires a 1024x500 feature graphic (no alpha) and a 512x512 icon. Neither
has an existing asset that fits: the app icon is 1024x1024 and there is no
landscape banner anywhere in the repo.

Brand colours are sampled from the real logo file, not the brand guide, so the
graphic matches the mark that actually ships: navy #001951 + turquoise #00C0A1.
Typeface is Inter (what the app renders in), taken from node_modules.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "store", "play")
os.makedirs(OUT, exist_ok=True)

NAVY = (0, 25, 81)
NAVY_LIGHT = (10, 44, 106)
TURQ = (0, 192, 161)
CYAN = (122, 213, 215)
WHITE = (255, 255, 255)

INTER = os.path.join(ROOT, "node_modules", "@expo-google-fonts", "inter")
def font(weight, size):
    return ImageFont.truetype(os.path.join(INTER, weight, f"Inter_{weight}.ttf"), size)


def recolour(img, mapping):
    """Swap exact-ish source colours for new ones, preserving alpha (anti-aliasing)."""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            best = min(mapping, key=lambda c: (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2)
            nr, ng, nb = mapping[best]
            px[x, y] = (nr, ng, nb, a)
    return img


# ---------------------------------------------------------------- feature graphic
W, H = 1024, 500
canvas = Image.new("RGB", (W, H), NAVY)

# Diagonal navy gradient, drawn per-row then sheared by column weight.
grad = Image.new("RGB", (W, H))
gd = grad.load()
for y in range(H):
    for x in range(0, W, 4):
        t = (x / W) * 0.65 + (1 - y / H) * 0.35
        c = tuple(int(NAVY[i] + (NAVY_LIGHT[i] - NAVY[i]) * t) for i in range(3))
        for dx in range(4):
            if x + dx < W:
                gd[x + dx, y] = c
canvas = grad

# Turquoise glow bleeding in from the right, where the ghost mark sits.
glow = Image.new("L", (W, H), 0)
gdraw = ImageDraw.Draw(glow)
for i in range(60, 0, -1):
    r = i * 9
    gdraw.ellipse((855 - r, 235 - r, 855 + r, 235 + r), fill=int(52 * (1 - i / 60)))
canvas = Image.composite(Image.new("RGB", (W, H), TURQ), canvas, glow)

# Ghost mark: the icon foreground (already transparent), turquoise, half off-canvas.
mark = Image.open(os.path.join(ROOT, "assets/images/android-icon-foreground.png"))
mark = recolour(mark, {NAVY: TURQ, TURQ: CYAN})
mark = mark.resize((560, 560), Image.LANCZOS)
ghost = mark.copy()
ghost.putalpha(ghost.getchannel("A").point(lambda a: int(a * 0.28)))
canvas.paste(ghost, (655, -30), ghost)

draw = ImageDraw.Draw(canvas)

# Logo, navy strokes flipped to white so the mark reads on a dark field.
logo = Image.open(os.path.join(ROOT, "assets/images/greenbidz_logo.png"))
logo = recolour(logo, {NAVY: WHITE, TURQ: TURQ})
LOGO_W = 430
logo = logo.resize((LOGO_W, round(LOGO_W * logo.height / logo.width)), Image.LANCZOS)

M = 64
y = 86
canvas.paste(logo, (M, y), logo)
y += logo.height + 46

f_head = font("700Bold", 41)
f_sub = font("500Medium", 23)
for line in ("Snap a photo.", "Our AI writes the listing."):
    draw.text((M, y), line, font=f_head, fill=WHITE)
    y += 50

y += 12
draw.rectangle((M, y, M + 58, y + 4), fill=TURQ)
y += 24
draw.text((M, y), "Used lab & industrial equipment marketplace", font=f_sub, fill=CYAN)

canvas.save(os.path.join(OUT, "feature-graphic-1024x500.png"), "PNG")
print("feature graphic:", canvas.size, canvas.mode)

# ---------------------------------------------------------------------- 512 icon
icon = Image.open(os.path.join(ROOT, "assets/images/icon.png")).convert("RGB")
icon = icon.resize((512, 512), Image.LANCZOS)
icon.save(os.path.join(OUT, "play-icon-512.png"), "PNG")
print("icon:", icon.size, icon.mode)
