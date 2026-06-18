#!/usr/bin/env python3
"""Generate the OG / Twitter share image for yotogi (netlore).

Art   : the Kuniyoshi triptych (相馬の古内裏 / Takiyasha + skeleton spectre),
        cropped to 1200x630. Source web/public/images/pc-splash-bg.jpg is the
        clean, text-free plate.
Brand : "YOTOGI" wordmark (Young Serif, the splash <h1> face) top-right.
Catch : 「怪談を生成する」 set in Shippori Mincho (the splash sub-catch face),
        with generous tracking and a soft, tall bottom gradient -- NOT a heavy
        gothic caption on a black bar. Refined, literary, horror-leaning.

Output: 1200x630 RGBA PNG (RGBA so Next/Turbopack accepts the static metadata
image). Run:  python3 web/scripts/og/build-og.py  [--no-apply]
"""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1200, 630
SRC = 'web/public/images/pc-splash-bg.jpg'          # clean triptych (2258x1110)
OUT = ['web/src/app/opengraph-image.png', 'web/src/app/twitter-image.png']
PREVIEW = '/Users/kohei/.openclaw/workspace/yotogi_og_AFTER_2026-06-18.png'

CATCH_FONT = '/tmp/ogfonts/Shippori-800.ttf'        # Shippori Mincho ExtraBold
WORD_FONT = '/tmp/ogfonts/YoungSerif-Regular.ttf'   # brand wordmark
CATCH = '怪談を生成する'
WORD = 'YOTOGI'
OFFWHITE = (244, 240, 232)


def text_tracked(draw, xy, text, font, fill, tracking=0):
    """Draw text with per-glyph letter-spacing. Returns total advance width."""
    x, y = xy
    widths = [draw.textbbox((0, 0), ch, font=font)[2] - draw.textbbox((0, 0), ch, font=font)[0] for ch in text]
    cx = x
    for ch, w in zip(text, widths):
        draw.text((cx, y), ch, font=font, fill=fill)
        cx += w + tracking
    return sum(widths) + tracking * (len(text) - 1)


# ---- 1) Crop triptych -> 1200x630 (keep all three panels; skull centred).
src = Image.open(SRC).convert('RGB')
CROP_H = 900
CROP_W = int(round(CROP_H * (W / H)))   # 1714
base = src.crop((132, 0, 132 + CROP_W, CROP_H)).resize((W, H), Image.LANCZOS).convert('RGBA')

# ---- 1b) gentle, even horror tone (no flat-black patches).
base = Image.alpha_composite(base, Image.new('RGBA', (W, H), (6, 6, 9, 52)))

# ---- 2) soft, tall bottom gradient for catch legibility (no harsh bar).
SCRIM = (7, 6, 9)
BAND_TOP, BAND_FULL, MAX_A = int(H * 0.42), H, 210
band = Image.new('RGBA', (W, H), (0, 0, 0, 0))
bd = ImageDraw.Draw(band)
for y in range(H):
    if y <= BAND_TOP:
        a = 0
    else:
        t = (y - BAND_TOP) / (BAND_FULL - BAND_TOP)
        a = int(MAX_A * (t ** 2.0))     # gentle ease-in, stays airy up high
    bd.line([(0, y), (W, y)], fill=SCRIM + (a,))
canvas = Image.alpha_composite(base, band)
draw = ImageDraw.Draw(canvas)

# ---- 3) brand-only: YOTOGI wordmark anchored BOTTOM-LEFT (where the
# 「怪談を生成する」catch used to sit). Sized down from the centred hero so it
# lives in the left corner and never crosses the centred skeleton. Young Serif,
# tracked, soft shadow, feathered dark lift so it reads without a box.
wfont = ImageFont.truetype(WORD_FONT, 104)
TRACK = 5
# measure tracked width
ww = sum(draw.textbbox((0, 0), c, font=wfont)[2] - draw.textbbox((0, 0), c, font=wfont)[0] for c in WORD) + TRACK * (len(WORD) - 1)
wb = draw.textbbox((0, 0), WORD, font=wfont)
th = wb[3] - wb[1]
MARGIN_X = 76          # left inset
RULE_Y = H - 70        # red rule baseline near the bottom edge
GAP = 26               # gap between wordmark baseline and the rule
wx = MARGIN_X
wy = RULE_Y - GAP - th - wb[1]
cx, cyc = wx + ww // 2, (wy + wb[1]) + th // 2

# feathered contrast lift, hugging the bottom-left lockup
pad = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(pad).ellipse([cx - int(ww * 0.70), cyc - 140, cx + int(ww * 0.70), cyc + 150], fill=(6, 6, 9, 135))
canvas = Image.alpha_composite(canvas, pad.filter(ImageFilter.GaussianBlur(60)))

# shadow
wsh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
text_tracked(ImageDraw.Draw(wsh), (wx + 3, wy + 6), WORD, wfont, (0, 0, 0, 235), TRACK)
canvas = Image.alpha_composite(canvas, wsh.filter(ImageFilter.GaussianBlur(9)))

# wordmark only -- left-aligned bottom-left lockup, no accent rule
draw = ImageDraw.Draw(canvas)
text_tracked(draw, (wx, wy), WORD, wfont, OFFWHITE + (255,), TRACK)

out = canvas.convert('RGBA')
out.save(PREVIEW)
print('wrote preview', PREVIEW)
if '--no-apply' not in sys.argv:
    for p in OUT:
        out.save(p)
        print('wrote', p)
