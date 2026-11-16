"""Generate the 25x25 watch menu icon (resources/images/icon_app.png).

Drawn pixel by pixel with hard edges (no antialiasing), which is what the
Pebble bitmap converter handles best on every platform.
Usage: python3 store/make_menu_icon.py   (requires Pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw

KRAFT = (201, 151, 94, 255)
LIGHT = (222, 178, 124, 255)
DARK = (160, 112, 64, 255)
LINE = (92, 58, 30, 255)
GREEN = (60, 150, 80, 255)
WHITE = (255, 255, 255, 255)


def main():
    img = Image.new("RGBA", (25, 25), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Handle: a loop that ends inside the bag's top edge.
    d.ellipse([6, 1, 18, 17], outline=LINE, width=2)

    # Body.
    d.rectangle([3, 8, 21, 23], fill=KRAFT)
    d.rectangle([16, 8, 21, 23], fill=DARK)      # side gusset
    d.rectangle([3, 8, 21, 10], fill=LIGHT)      # top fold
    d.line([(3, 11), (21, 11)], fill=DARK)
    d.rectangle([3, 8, 21, 23], outline=LINE)
    d.line([(16, 8), (16, 23)], fill=LINE)

    # Label with a check mark.
    d.rectangle([6, 14, 13, 20], fill=WHITE)
    for xy in ((7, 17), (8, 18), (9, 19), (10, 18), (11, 17), (12, 16)):
        d.point(xy, fill=GREEN)

    out = Path(__file__).resolve().parent.parent / "resources/images/icon_app.png"
    img.save(out)


if __name__ == "__main__":
    main()
