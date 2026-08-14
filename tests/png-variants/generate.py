"""Regenerates the PNG decoding fixtures, using Pillow as the reference decoder.

    python tests/png-variants/generate.py

Every file here is a colour type or bit depth that real Minecraft skins turn out to use. The
expected pixels come from Pillow rather than from our own decoder, so the test compares two
independent implementations instead of checking our work against itself.
"""
import json
import os

from PIL import Image

out = os.path.dirname(os.path.abspath(__file__))
expected = {}


def record(name):
    rgba = Image.open(os.path.join(out, name)).convert("RGBA")
    expected[name] = {"w": rgba.width, "h": rgba.height, "data": list(rgba.tobytes())}


def save(name, im, **kwargs):
    im.save(os.path.join(out, name), **kwargs)
    record(name)


base = Image.new("RGBA", (8, 8))
cols = [(255, 0, 0, 255), (0, 255, 0, 255), (0, 0, 255, 255), (255, 255, 0, 255), (0, 0, 0, 0)]
for y in range(8):
    for x in range(8):
        base.putpixel((x, y), cols[(x + y) % len(cols)])

# 4-bit indexed: this is the one that crashed the decoder on a real skin
save("palette-4bit.png", base.convert("RGB").quantize(colors=8), bits=4)
# palette with an index declared transparent
save("palette-8bit-trns.png", base.convert("P", palette=Image.ADAPTIVE, colors=16), transparency=0)
# RGB with a tRNS colour key, which two of fifteen real skins used
save("rgb-trns.png", base.convert("RGB"), transparency=(255, 0, 0))
save("rgb.png", base.convert("RGB"))
save("rgba.png", base)
save("gray.png", base.convert("L"))
save("gray-alpha.png", base.convert("LA"))
save("bw-1bit.png", base.convert("1"))
save("rgba-16bit.png", base)

with open(os.path.join(out, "expected.json"), "w") as f:
    json.dump(expected, f)
print(f"wrote {len(expected)} variants")
