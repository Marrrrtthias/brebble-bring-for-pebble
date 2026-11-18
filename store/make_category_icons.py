"""Generate the item category icons shown in the list rows.

Usage: python3 store/make_category_icons.py   (requires Pillow)

Each icon is drawn on a 100x100 design grid, supersampled and scaled down to
the row icon size of each display class (see ICON_SIZES), which must match the
row geometry in src/c/bring_pebble.c:

  resources/images/icon_<name>.png          144x168 and 180x180 displays
  resources/images/icon_<name>~emery.png    Pebble Time 2 (200x228)
  resources/images/icon_<name>~gabbro.png   Pebble Round 2 (260x260)

The black & white watches don't show these icons (see window_load()).
Colours are taken from the Pebble 64-colour palette so the bitmap converter
keeps them as they are.
"""
from pathlib import Path
from PIL import Image, ImageDraw

S = 12                 # supersampling factor
N = 100 * S            # working canvas size

# Output file suffix -> icon edge length in pixels.
ICON_SIZES = {
    "": 30,
    "~emery": 36,
    "~gabbro": 36,
}

# Pebble palette colours (channel values 0, 85, 170, 255).
WHITE = (255, 255, 255)
LIGHT_GRAY = (170, 170, 170)
DARK_GRAY = (85, 85, 85)
BLACK = (0, 0, 0)
CHROME_YELLOW = (255, 170, 0)
WINDSOR_TAN = (170, 85, 0)
RAJAH = (255, 170, 85)
PASTEL_YELLOW = (255, 255, 170)
BLUE_MOON = (0, 85, 255)
PICTON_BLUE = (85, 170, 255)
COBALT = (0, 85, 170)
RED = (255, 0, 0)
DARK_CANDY_APPLE_RED = (170, 0, 0)
SUNSET_ORANGE = (255, 85, 85)
ISLAMIC_GREEN = (0, 170, 0)
MAY_GREEN = (85, 170, 85)
DARK_GREEN = (0, 85, 0)
LIBERTY = (85, 85, 170)
LAVENDER_INDIGO = (170, 85, 255)
PURPLE = (85, 0, 170)


def p(x, y):
    return (x * S, y * S)


def box(x0, y0, x1, y1):
    return [x0 * S, y0 * S, x1 * S, y1 * S]


def poly(*points):
    return [p(x, y) for x, y in points]


def thick_line(d, points, colour, width):
    """A polyline with round ends and joints."""
    d.line(poly(*points), fill=colour, width=width * S, joint="curve")
    r = width * S / 2
    for x, y in (points[0], points[-1]):
        d.ellipse([x * S - r, y * S - r, x * S + r, y * S + r], fill=colour)


def draw_default(d):
    # Shopping bag, like the app icon but in neutral grey.
    d.ellipse(box(30, 4, 70, 50), outline=DARK_GRAY, width=7 * S)
    body = poly((12, 32), (88, 32), (94, 96), (6, 96))
    d.polygon(body, fill=LIGHT_GRAY)
    d.polygon(poly((70, 32), (88, 32), (94, 96), (74, 96)), fill=DARK_GRAY)
    d.rectangle(box(12, 32, 88, 42), fill=WHITE)
    d.polygon(body, outline=BLACK, width=4 * S)


def draw_bread(d):
    # A loaf seen from the side with three scores on the crust.
    d.rounded_rectangle(box(4, 30, 96, 90), radius=16 * S, fill=WINDSOR_TAN)
    d.ellipse(box(4, 14, 96, 64), fill=WINDSOR_TAN)
    d.rounded_rectangle(box(9, 33, 91, 84), radius=13 * S, fill=CHROME_YELLOW)
    d.ellipse(box(9, 19, 91, 62), fill=CHROME_YELLOW)
    for x in (26, 46, 66):
        thick_line(d, [(x, 62), (x + 12, 36)], WINDSOR_TAN, 7)


def draw_dairy(d):
    # A milk carton: gable top, front face and a band with a drop.
    d.polygon(poly((22, 4), (78, 4), (78, 12), (22, 12)), fill=COBALT)
    d.polygon(poly((22, 12), (78, 12), (90, 36), (10, 36)), fill=PICTON_BLUE)
    d.rectangle(box(10, 36, 90, 96), fill=BLUE_MOON)
    d.rectangle(box(10, 52, 90, 76), fill=WHITE)
    d.ellipse(box(42, 56, 58, 73), fill=PICTON_BLUE)
    d.polygon(poly((50, 52), (43, 64), (57, 64)), fill=PICTON_BLUE)
    d.polygon(poly((22, 12), (78, 12), (90, 36), (90, 96), (10, 96), (10, 36)),
              outline=COBALT, width=3 * S)


def draw_fruit(d):
    # An apple with stem and leaf.
    d.ellipse(box(6, 26, 58, 94), fill=RED)
    d.ellipse(box(42, 26, 94, 94), fill=RED)
    d.ellipse(box(20, 60, 80, 98), fill=RED)
    d.ellipse(box(18, 36, 34, 56), fill=SUNSET_ORANGE)
    thick_line(d, [(50, 34), (52, 8)], WINDSOR_TAN, 7)
    d.polygon(poly((54, 20), (66, 6), (88, 6), (78, 18)), fill=ISLAMIC_GREEN)
    d.ellipse(box(54, 6, 88, 24), fill=ISLAMIC_GREEN)


def draw_vegetable(d):
    # Broccoli: a cloud of florets on a thick stalk.
    d.polygon(poly((40, 56), (60, 56), (66, 96), (34, 96)), fill=MAY_GREEN)
    for x0, y0, x1, y1 in ((4, 26, 44, 64), (56, 26, 96, 64), (24, 4, 76, 50),
                           (20, 34, 80, 70)):
        d.ellipse(box(x0, y0, x1, y1), fill=ISLAMIC_GREEN)
    for x, y in ((26, 30), (50, 18), (70, 38), (44, 46)):
        d.ellipse(box(x - 5, y - 5, x + 5, y + 5), fill=DARK_GREEN)


def draw_meat(d):
    # A drumstick: bone towards the bottom right.
    thick_line(d, [(46, 54), (78, 86)], PASTEL_YELLOW, 12)
    for x, y in ((80, 78), (70, 88)):
        d.ellipse(box(x - 10, y - 10, x + 10, y + 10), fill=PASTEL_YELLOW)
    d.ellipse(box(4, 4, 66, 66), fill=DARK_CANDY_APPLE_RED)
    d.polygon(poly((30, 60), (60, 30), (62, 58), (56, 62)), fill=DARK_CANDY_APPLE_RED)
    d.ellipse(box(16, 14, 34, 32), fill=SUNSET_ORANGE)


def draw_drink(d):
    # A takeaway cup with lid and straw.
    thick_line(d, [(52, 20), (64, 2)], WHITE, 7)
    thick_line(d, [(52, 20), (64, 2)], RED, 4)
    d.polygon(poly((16, 26), (84, 26), (74, 96), (26, 96)), fill=CHROME_YELLOW)
    d.polygon(poly((60, 26), (84, 26), (74, 96), (62, 96)), fill=WINDSOR_TAN)
    d.rounded_rectangle(box(10, 18, 90, 30), radius=4 * S, fill=WHITE,
                        outline=DARK_GRAY, width=2 * S)
    d.rectangle(box(20, 48, 80, 66), fill=RAJAH)


def draw_cleaning(d):
    # A soap bottle with a pump.
    d.rectangle(box(42, 6, 78, 14), fill=PURPLE)
    d.rectangle(box(42, 6, 52, 30), fill=PURPLE)
    d.rectangle(box(36, 26, 58, 40), fill=PURPLE)
    d.rounded_rectangle(box(18, 36, 76, 96), radius=10 * S, fill=LAVENDER_INDIGO)
    d.rounded_rectangle(box(26, 54, 68, 82), radius=4 * S, fill=WHITE)
    d.ellipse(box(38, 60, 56, 76), fill=PICTON_BLUE)


# Must match the category order in src/pkjs/categorize.js.
ICONS = {
    "default": draw_default,
    "bread": draw_bread,
    "dairy": draw_dairy,
    "fruit": draw_fruit,
    "vegetable": draw_vegetable,
    "meat": draw_meat,
    "drink": draw_drink,
    "cleaning": draw_cleaning,
}


def main():
    out = Path(__file__).resolve().parent.parent / "resources/images"
    for name, draw in ICONS.items():
        img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        draw(ImageDraw.Draw(img))
        for suffix, size in ICON_SIZES.items():
            img.resize((size, size), Image.LANCZOS).save(out / f"icon_{name}{suffix}.png")


if __name__ == "__main__":
    main()
