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
import math
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
ORANGE = (255, 85, 0)
CELESTE = (170, 255, 255)
TIFFANY_BLUE = (0, 170, 170)
MEDIUM_AQUAMARINE = (85, 255, 170)
FASHION_MAGENTA = (255, 0, 170)
BRILLIANT_ROSE = (255, 85, 170)
BULGARIAN_ROSE = (85, 0, 0)


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


def draw_produce(d):
    # Fruit & vegetables: a carrot behind an apple.
    d.polygon(poly((52, 30), (90, 22), (82, 98)), fill=ORANGE)
    for y in (44, 60, 76):
        thick_line(d, [(64, y), (74, y - 2)], WINDSOR_TAN, 3)
    for x0, x1 in ((50, 66), (62, 80), (74, 96)):
        d.ellipse(box(x0, 0, x1, 30), fill=ISLAMIC_GREEN)
    d.ellipse(box(2, 40, 40, 96), fill=RED)
    d.ellipse(box(26, 40, 64, 96), fill=RED)
    d.ellipse(box(12, 50, 24, 64), fill=SUNSET_ORANGE)
    thick_line(d, [(33, 46), (35, 30)], WINDSOR_TAN, 6)
    d.ellipse(box(36, 26, 56, 38), fill=ISLAMIC_GREEN)


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


def draw_ingredients(d):
    # Ingredients & spices: a spice jar with paprika and a wooden lid.
    d.rounded_rectangle(box(16, 28, 84, 96), radius=10 * S, fill=CELESTE)
    d.rounded_rectangle(box(16, 52, 84, 96), radius=10 * S, fill=RED)
    d.rectangle(box(16, 52, 84, 62), fill=RED)
    d.rectangle(box(26, 60, 74, 82), fill=WHITE)
    d.ellipse(box(42, 64, 58, 78), fill=ORANGE)
    d.rounded_rectangle(box(16, 28, 84, 96), radius=10 * S, outline=DARK_GRAY, width=3 * S)
    d.rounded_rectangle(box(22, 6, 78, 30), radius=4 * S, fill=WINDSOR_TAN)
    d.rectangle(box(22, 14, 78, 18), fill=CHROME_YELLOW)


def draw_frozen(d):
    # Frozen & convenience: a snowflake.

    cx, cy = 50, 50
    for k in range(3):
        a = math.pi / 2 + k * math.pi / 3
        dx, dy = math.cos(a), math.sin(a)
        thick_line(d, [(cx - 44 * dx, cy - 44 * dy), (cx + 44 * dx, cy + 44 * dy)], COBALT, 9)
    for k in range(6):
        a = math.pi / 2 + k * math.pi / 3
        dx, dy = math.cos(a), math.sin(a)
        bx, by = cx + 26 * dx, cy + 26 * dy
        for side in (-1, 1):
            b = a + side * math.pi / 4
            thick_line(d, [(bx, by), (bx + 15 * math.cos(b), by + 15 * math.sin(b))], PICTON_BLUE, 7)
    d.ellipse(box(40, 40, 60, 60), fill=PICTON_BLUE)


def draw_grain(d):
    # Grain products: an ear of wheat.
    thick_line(d, [(50, 98), (50, 16)], WINDSOR_TAN, 6)
    for y in (24, 40, 56, 72):
        for x0, x1 in ((24, 50), (50, 76)):
            d.ellipse(box(x0, y, x1, y + 20), fill=CHROME_YELLOW, outline=WINDSOR_TAN, width=2 * S)
    d.ellipse(box(38, 2, 62, 28), fill=CHROME_YELLOW, outline=WINDSOR_TAN, width=2 * S)


def draw_snacks(d):
    # Snacks & sweets: a wrapped candy.
    d.polygon(poly((26, 50), (2, 26), (10, 50), (2, 74)), fill=BRILLIANT_ROSE)
    d.polygon(poly((74, 50), (98, 26), (90, 50), (98, 74)), fill=BRILLIANT_ROSE)
    d.ellipse(box(18, 24, 82, 76), fill=FASHION_MAGENTA)
    for x in (34, 50, 66):
        thick_line(d, [(x - 6, 30), (x + 6, 70)], WHITE, 5)
    d.ellipse(box(18, 24, 82, 76), outline=BULGARIAN_ROSE, width=3 * S)


def draw_household(d):
    # Household: a spray bottle.
    d.polygon(poly((30, 4), (76, 4), (82, 14), (82, 24), (30, 24)), fill=DARK_GRAY)
    d.polygon(poly((30, 4), (14, 8), (14, 14), (30, 14)), fill=DARK_GRAY)
    d.polygon(poly((56, 24), (68, 24), (62, 44), (52, 36)), fill=DARK_GRAY)
    d.rectangle(box(36, 24, 56, 38), fill=LIGHT_GRAY)
    d.rounded_rectangle(box(24, 36, 76, 96), radius=10 * S, fill=TIFFANY_BLUE)
    d.rounded_rectangle(box(32, 54, 68, 82), radius=4 * S, fill=WHITE)
    d.ellipse(box(42, 60, 58, 76), fill=MEDIUM_AQUAMARINE)


def draw_care(d):
    # Care & health: a lotion bottle with a pump.
    d.rectangle(box(42, 6, 78, 14), fill=PURPLE)
    d.rectangle(box(42, 6, 52, 30), fill=PURPLE)
    d.rectangle(box(36, 26, 58, 40), fill=PURPLE)
    d.rounded_rectangle(box(18, 36, 76, 96), radius=10 * S, fill=LAVENDER_INDIGO)
    d.rounded_rectangle(box(26, 54, 68, 82), radius=4 * S, fill=WHITE)
    d.ellipse(box(38, 60, 56, 76), fill=PICTON_BLUE)




def draw_pet(d):
    # Pet supplies: a paw print.
    d.ellipse(box(24, 46, 76, 92), fill=WINDSOR_TAN)
    for x, y, r in ((14, 40, 11), (34, 18, 12), (66, 18, 12), (86, 40, 11)):
        d.ellipse(box(x - r, y - r, x + r, y + r + 4), fill=WINDSOR_TAN)


def draw_garden(d):
    # Home & garden: a potted plant.
    thick_line(d, [(50, 64), (50, 30)], DARK_GREEN, 6)
    d.ellipse(box(10, 24, 50, 48), fill=ISLAMIC_GREEN)
    d.ellipse(box(50, 12, 90, 36), fill=MAY_GREEN)
    d.ellipse(box(34, 2, 66, 30), fill=ISLAMIC_GREEN)
    d.polygon(poly((18, 64), (82, 64), (74, 98), (26, 98)), fill=ORANGE)
    d.rectangle(box(14, 58, 86, 70), fill=WINDSOR_TAN)


# One icon per Bring! section. Must match the ICON_* order in
# src/pkjs/categorize.js (and CATEGORY_RESOURCE_IDS in src/c/bring_pebble.c).
ICONS = {
    "default": draw_default,
    "produce": draw_produce,
    "bread": draw_bread,
    "dairy": draw_dairy,
    "meat": draw_meat,
    "ingredients": draw_ingredients,
    "frozen": draw_frozen,
    "grain": draw_grain,
    "snacks": draw_snacks,
    "drink": draw_drink,
    "household": draw_household,
    "care": draw_care,
    "pet": draw_pet,
    "garden": draw_garden,
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
