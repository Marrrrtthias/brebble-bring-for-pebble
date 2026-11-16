"""Generate the Rebble store icons (a paper shopping bag).

Usage: python3 store/make_icons.py   (requires Pillow)
Writes store/icon_large.png (144x144) and store/icon_small.png (48x48).
"""
from pathlib import Path
from PIL import Image, ImageDraw

S = 8                      # supersampling factor
N = 144 * S                # working canvas size

KRAFT = (201, 151, 94)
KRAFT_LIGHT = (222, 178, 124)
KRAFT_DARK = (160, 112, 64)
OUTLINE = (92, 58, 30)
HANDLE = (92, 58, 30)
GREEN = (60, 150, 80)
WHITE = (255, 255, 255)


def p(x, y):
    return (x * S, y * S)


def box(x0, y0, x1, y1):
    return [x0 * S, y0 * S, x1 * S, y1 * S]


def draw():
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Handles (behind the bag): two rope loops.
    d.arc(box(46, 8, 78, 52), 180, 360, fill=HANDLE, width=5 * S)
    d.arc(box(66, 8, 98, 52), 180, 360, fill=HANDLE, width=5 * S)

    # Bag body.
    body = [p(24, 44), p(120, 44), p(124, 132), p(20, 132)]
    d.polygon(body, fill=KRAFT)

    # Folded-in side gusset on the right.
    d.polygon([p(100, 44), p(120, 44), p(124, 132), p(104, 132)], fill=KRAFT_DARK)

    # Top fold band.
    d.rectangle(box(24, 44, 120, 56), fill=KRAFT_LIGHT)
    d.line([p(24, 56), p(120, 56)], fill=KRAFT_DARK, width=2 * S)

    # Label with a green check mark (a nod to ticking off the list).
    d.rounded_rectangle(box(40, 74, 86, 114), radius=5 * S, fill=WHITE,
                        outline=KRAFT_DARK, width=2 * S)
    d.line([p(49, 95), p(58, 105), p(77, 83)], fill=GREEN, width=6 * S,
           joint="curve")
    for x, y in ((49, 95), (58, 105), (77, 83)):  # round the line ends
        r = 3 * S
        d.ellipse([x * S - r, y * S - r, x * S + r, y * S + r], fill=GREEN)

    # Outline.
    d.polygon(body, outline=OUTLINE, width=3 * S)
    d.line([p(100, 44), p(104, 132)], fill=OUTLINE, width=2 * S)
    return img


def main():
    out = Path(__file__).resolve().parent
    big = draw()
    big.resize((144, 144), Image.LANCZOS).save(out / "icon_large.png")
    big.resize((48, 48), Image.LANCZOS).save(out / "icon_small.png")


if __name__ == "__main__":
    main()
