"""Etqadem logo v2: writes icons/logo-etq2*.svg (the "lifter's rank" mark).

A rank badge for lifters: two level-up chevrons stacked on a barbell. The lower chevron is ink
(where you were), the top one Deep Teal (the level you just reached), and the barbell plates are
teal too. Up reads the same in Arabic and English. Replaces the stick-figure stair-climber
(logo-etq*.svg, kept for cache safety, unreferenced).

Run: python tools/icons/gen-etq2-svgs.py, then
PLAYWRIGHT_CORE=<path to playwright-core> node tools/icons/render-pngs-etq2.mjs
Mark box is 96 x 96, drawn at tile scale (k=1 = the rounded paper tile). New filenames (-etq2)
because /icons/ is served with an immutable cache. The animated #bootLoader in index.html and
native/android/.../drawable/splash_logo.xml reuse this geometry by hand: update them together.
"""
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent.parent / "icons"
TEAL = "#0B7A75"; LIT = "#3CC2B8"; PAPER = "#F3F0E8"; INK = "#14161B"; WHITE = "#ffffff"

CHEV_TOP = "M24 32L48 16L72 32"     # the level you just reached (accent)
CHEV_LOW = "M24 52L48 36L72 52"     # the level before it (ink)
CHEV_W = 11
BAR = (10, 86, 70, 7)               # x0, x1, y, thickness
PLATES = [(14, 56), (73, 56)]       # x, y of each 9 x 28 plate


def chev(d, col, w=CHEV_W):
    return (f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>')


def bar(fg):
    x0, x1, y, t = BAR
    return f'<rect x="{x0}" y="{y - t / 2:g}" width="{x1 - x0}" height="{t}" rx="{t / 2:g}" fill="{fg}"/>'


def plates(fg):
    return "".join(f'<rect x="{x}" y="{y}" width="9" height="28" rx="4.5" fill="{fg}"/>' for x, y in PLATES)


def mark(fg, accent):
    return chev(CHEV_LOW, fg) + chev(CHEV_TOP, accent) + bar(fg) + plates(accent)


def small(fg, accent):
    """16px variant: heavier chevrons so the gap between them survives at 1px = 6 units."""
    return chev(CHEV_LOW, fg, 12) + chev(CHEV_TOP, accent, 12) + bar(fg) + plates(accent)


def scaled(inner, k):
    return f'<g transform="translate(48 48) scale({k}) translate(-48 -48)">{inner}</g>'


def svg(label, comment, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="{label}">\n'
            f'  <!-- {comment} -->\n  {body}\n</svg>\n')


tile = f'<rect width="96" height="96" rx="21" ry="21" fill="{PAPER}"/>'
full = f'<rect width="96" height="96" fill="{PAPER}"/>'
files = {
    "logo-etq2.svg": svg("Etqadem logo", "Lifter's rank mark: ink and Deep Teal level-up chevrons on a barbell with teal plates, on a rounded paper tile.",
                         tile + mark(INK, TEAL)),
    "logo-etq2-ondark.svg": svg("Etqadem logo", "Reversed mark, no tile, for dark surfaces.",
                                mark(PAPER, LIT)),
    "logo-etq2-mono.svg": svg("Etqadem logo, monochrome", "Single-colour silhouette, transparent bg.",
                              mark(WHITE, WHITE)),
    "logo-etq2-maskable.svg": svg("Etqadem logo", "Maskable: full-bleed paper, mark inside the 80% safe circle.",
                                  full + scaled(mark(INK, TEAL), 0.72)),
    "logo-etq2-tiny.svg": svg("Etqadem logo", "Small-size variant (16px): heavier chevrons.",
                              tile + small(INK, TEAL)),
    "logo-etq2-android-fg.svg": svg("Etqadem logo, Android adaptive foreground",
                                    "Adaptive foreground: transparent, mark inside the 66% safe zone; pair with flat #F3F0E8.",
                                    scaled(mark(INK, TEAL), 0.6)),
    "logo-etq2-android-mono.svg": svg("Etqadem logo, Android themed monochrome",
                                      "Android 13+ themed-icon layer: silhouette inside the safe zone.",
                                      scaled(mark(WHITE, WHITE), 0.6)),
}
for name, content in files.items():
    (OUT / name).write_text(content, encoding="utf-8", newline="\n")
    print("wrote", name)
(OUT / "android-bg-color-etq2.txt").write_text(PAPER + "\n", encoding="utf-8", newline="\n")
