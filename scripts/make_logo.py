"""Builds the SSS HR System mark as pure SVG paths (no fonts needed to show it): a regular pointy-top hexagon in the
brand green, an inset gold border, three overlapping S (white s, gold S, white S) in IBM Plex Sans, a gold rule and
"HR". Run with a Python that has fontTools and brotli (the backend's venv does), after `npm install`:
    python scripts/make_logo.py public/logo.svg
then copy it to docs/brand/ and render the PNGs (docs/brand/README.md)."""

import math
import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent  # the frontend repository
FILES = str(ROOT / "node_modules/@fontsource/ibm-plex-sans-arabic/files") + "/"
GREEN, GREEN_DARK, GOLD, WHITE = "#006c35", "#005a2c", "#d4a63a", "#ffffff"
SIZE, CX, CY, R = 512, 256.0, 256.0, 238.0


def font(weight):
    return TTFont(f"{FILES}ibm-plex-sans-arabic-latin-{weight}-normal.woff2")


def glyph(f, char):
    name = f.getBestCmap()[ord(char)]
    gs = f.getGlyphSet()
    bounds = BoundsPen(gs)
    gs[name].draw(bounds)
    return gs, name, bounds.bounds, gs[name].width


def place(f, text, *, cap_px, left=None, center=None, baseline, fill, tracking=0.0):
    """Paths for `text`, scaled so a capital is cap_px tall, its baseline at `baseline`."""
    cap = f["OS/2"].sCapHeight
    k = cap_px / cap
    parts, advance = [], 0.0
    pieces = []
    for ch in text:
        gs, name, b, width = glyph(f, ch)
        pieces.append((gs, name, advance))
        advance += width + tracking * f["head"].unitsPerEm
    advance -= tracking * f["head"].unitsPerEm
    x0 = (center - advance * k / 2) if center is not None else left
    for gs, name, dx in pieces:
        pen = SVGPathPen(gs)
        gs[name].draw(TransformPen(pen, (k, 0, 0, -k, x0 + dx * k, baseline)))
        parts.append(pen.getCommands())
    return f'<path fill="{fill}" d="{" ".join(parts)}"/>', advance * k


def hexagon(r, cx=CX, cy=CY):
    pts = [(cx + r * math.sin(math.radians(a)), cy - r * math.cos(math.radians(a))) for a in range(0, 360, 60)]
    return " ".join(f"{x:.2f},{y:.2f}" for x, y in pts)


def build():
    medium, bold = font(400), font(600)
    s = R / 166.5  # the original's scale
    X = lambda x: CX + (x - 197.5) * s  # noqa: E731 - original pixels → ours
    Y = lambda y: CY + (y - 197.5) * s  # noqa: E731
    base = Y(215)
    big, wbig = place(medium, "S", cap_px=102 * s, left=X(192), baseline=base, fill=WHITE)
    mid, wmid = place(medium, "S", cap_px=76 * s, left=X(163), baseline=base, fill=GOLD)
    small, _ = place(medium, "s", cap_px=76 * s, left=X(141), baseline=base, fill=WHITE)  # x-height ≈ 53 px
    hr, _ = place(bold, "HR", cap_px=36 * s, center=CX, baseline=Y(295), fill=GOLD, tracking=0.04)
    rule_y, rule_half = Y(237.5), 47 * s
    label = "SSS HR System"
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" role="img" aria-label="{label}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{GREEN}"/>
      <stop offset="1" stop-color="{GREEN_DARK}"/>
    </linearGradient>
  </defs>
  <polygon points="{hexagon(R)}" fill="url(#g)" stroke="{GREEN_DARK}" stroke-width="2" stroke-linejoin="round"/>
  <polygon points="{hexagon(R - 30)}" fill="none" stroke="{GOLD}" stroke-width="3.2" stroke-linejoin="round"/>
  {small}
  {mid}
  {big}
  <rect x="{CX - rule_half:.2f}" y="{rule_y - 1.4:.2f}" width="{2 * rule_half:.2f}" height="2.8" rx="1.4" \
fill="{GOLD}"/>
  {hr}
</svg>
"""


if __name__ == "__main__":
    open(sys.argv[1], "w").write(build())
