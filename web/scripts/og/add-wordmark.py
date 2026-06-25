#!/usr/bin/env python3
"""Overlay the YOTOGI wordmark onto the EXISTING OG image (keeps the current
triptych composition + the「怪談を生成する」catch). We do NOT regenerate the
art -- we only add the brand wordmark so shared thumbnails carry the name.

Wordmark = "YOTOGI" (Young Serif, uppercase) -- same brand face as the splash
<h1>. Placed bottom-right, baseline-aligned with the existing catch which sits
bottom-left, so the share image reads:  怪談を生成する ........... YOTOGI

A soft bottom-right gradient lift guarantees contrast without a hard seam.
Run: python3 web/scripts/og/add-wordmark.py
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = 'web/src/app/opengraph-image.png'          # current triptych + catch
OUT = ['web/src/app/opengraph-image.png', 'web/src/app/twitter-image.png']
PREVIEW = '/Users/kohei/.openclaw/workspace/yotogi_og_AFTER_2026-06-18.png'
FONT = '/tmp/ogfonts/YoungSerif-Regular.ttf'
TEXT = 'YOTOGI'
OFFWHITE = (246, 242, 234)

img = Image.open(SRC).convert('RGBA')
W, H = img.size  # 1200x630

# --- bottom-right contrast lift: radial-ish soft dark pad under the wordmark,
# feathered so there is no visible box/seam.
font = ImageFont.truetype(FONT, 80)
draw = ImageDraw.Draw(img)
bbox = draw.textbbox((0, 0), TEXT, font=font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
margin_x = 84
# Brand lockup TOP-RIGHT (away from the bottom-left catch) -> reads:
#   YOTOGI (brand, top)  /  怪談を生成する (tagline, bottom).
draw_x = W - margin_x - tw - bbox[0]
draw_y = 64 - bbox[1]

# top-right contrast lift: soft feathered dark pad, no hard box/seam
pad = Image.new('RGBA', (W, H), (0, 0, 0, 0))
pd = ImageDraw.Draw(pad)
cx, cy = draw_x + tw // 2, draw_y + th // 2
rw, rh = int(tw * 0.9), int(th * 2.0)
pd.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=(6, 6, 9, 140))
pad = pad.filter(ImageFilter.GaussianBlur(40))
img = Image.alpha_composite(img, pad)

# --- drop shadow
shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.text((draw_x + 3, draw_y + 5), TEXT, font=font, fill=(0, 0, 0, 235))
shadow = shadow.filter(ImageFilter.GaussianBlur(7))
img = Image.alpha_composite(img, shadow)

# --- wordmark
ImageDraw.Draw(img).text((draw_x, draw_y), TEXT, font=font, fill=OFFWHITE + (255,))

out = img.convert('RGBA')
out.save(PREVIEW, format='PNG')
print('wrote preview', PREVIEW, out.size)
import sys
if '--apply' in sys.argv:
    for p in OUT:
        out.save(p, format='PNG')
        print('wrote', p)
