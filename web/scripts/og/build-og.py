#!/usr/bin/env python3
"""Generate the OG / Twitter share images for yotogi (netlore).

Composition
-----------
HERO = the Takiyasha giant skull (骸骨). We crop the skeleton source
(web/public/images/pc-splash-bg.jpg, same family as the phone splash skull
crop skeleton-phone.jpg) so the SKULL HEAD sits center / center-right and is
fully visible, with the ribcage trailing off to the right. The whole skeleton
stays visible -- NO wide left slab, NO hard vertical seam, NO floating ribcage.

For text legibility we use a BOTTOM-ANCHORED gradient scrim band: fully
transparent across the upper ~55% (so nothing covers the skull), then ramping
to a dark, near-opaque base at the very bottom. The single catch copy
"怪談を生成する" (offwhite Hiragino W8) sits in that lower band with a soft
drop shadow as belt-and-suspenders contrast. No eyebrow, no divider/ruled
lines, no wordmark, no footer.

Output: 1200x630 RGBA PNG (RGBA required so Next/Turbopack does not choke on
the static metadata image).

Run with:
    python3 web/scripts/og/build-og.py
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1200, 630
SRC = 'web/public/images/pc-splash-bg.jpg'   # Takiyasha skeleton (2258x1110)
FONT = '/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc'
TEXT = '怪談を生成する'
OFFWHITE = (246, 242, 234)
OUT = ['web/src/app/opengraph-image.png', 'web/src/app/twitter-image.png']

# ---- 1) Crop: skull as hero (center / center-right), ribcage trailing right.
# Source skull head is around full-x 700..1180 (center ~955), cranium top ~y40,
# jaw/teeth ~y560. We take a window of height 900 (full headroom, top=0) and
# width 900*(1200/630)=1714, left=132 -> skull center lands at ~0.48 of frame.
src = Image.open(SRC).convert('RGB')
CROP_H = 900
CROP_W = int(round(CROP_H * (W / H)))   # 1714
CROP_LEFT, CROP_TOP = 132, 0
base = src.crop((CROP_LEFT, CROP_TOP, CROP_LEFT + CROP_W, CROP_TOP + CROP_H))
base = base.resize((W, H), Image.LANCZOS).convert('RGBA')

# ---- 1b) Gentle global darkening / horror tone (multiply toward ink-black),
# uniform so no part of the skull is flattened into a flat black rectangle.
tone = Image.new('RGBA', (W, H), (6, 6, 8, 56))   # low-alpha veil, even across frame
base = Image.alpha_composite(base, tone)

# ---- 2) Bottom-anchored gradient scrim band (NO left slab, NO vertical seam).
# Transparent above BAND_TOP, then smooth ease-in to near-opaque at the bottom.
SCRIM = (8, 7, 9)
BAND_TOP = int(H * 0.50)     # nothing above this is touched -> skull stays clean
BAND_FULL = int(H * 0.985)   # near the very bottom reaches max opacity
MAX_A = 232
band = Image.new('RGBA', (W, H), (0, 0, 0, 0))
bd = ImageDraw.Draw(band)
for y in range(H):
    if y <= BAND_TOP:
        a = 0
    elif y >= BAND_FULL:
        a = MAX_A
    else:
        t = (y - BAND_TOP) / (BAND_FULL - BAND_TOP)
        a = int(MAX_A * (t ** 1.7))   # ease-in: stays light high up, darkens low
    bd.line([(0, y), (W, y)], fill=SCRIM + (a,))
canvas = Image.alpha_composite(base, band)

# ---- 3) Single catch copy in the lower band, left-aligned, offwhite + shadow.
font = ImageFont.truetype(FONT, 116)
tmp = ImageDraw.Draw(canvas)
bbox = tmp.textbbox((0, 0), TEXT, font=font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
margin_x = 84
draw_x = margin_x - bbox[0]
# baseline sits in the dark part of the band, comfortably above the bottom edge.
draw_y = (H - 74) - bbox[3]

shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.text((draw_x + 4, draw_y + 6), TEXT, font=font, fill=(0, 0, 0, 235))
shadow = shadow.filter(ImageFilter.GaussianBlur(8))
canvas = Image.alpha_composite(canvas, shadow)
ImageDraw.Draw(canvas).text((draw_x, draw_y), TEXT, font=font, fill=OFFWHITE + (255,))

out = canvas.convert('RGBA')
for p in OUT:
    out.save(p, format='PNG')
    print('wrote', p, out.mode, out.size)
