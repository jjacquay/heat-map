"""Generate the decorative contour artwork (site/assets/contours.svg).

Purely ornamental: nested wobbly rings from a sum of sines, not terrain or
data. Deterministic, so re-running produces the same file.
"""
import math
from pathlib import Path

W, H = 1200, 900
rings = []
for cx, cy, n, base, step, seed in [(880, 300, 14, 40, 26, 1.3), (240, 760, 9, 30, 28, 2.9), (1120, 820, 6, 30, 30, 4.1)]:
    for k in range(n):
        r0 = base + k * step
        pts = []
        for i in range(181):
            t = i / 180 * 2 * math.pi
            r = r0 * (1 + 0.10 * math.sin(3 * t + seed + k * 0.17) + 0.06 * math.sin(5 * t - seed * 1.7) + 0.035 * math.sin(9 * t + k * 0.3))
            pts.append(f'{cx + r * math.cos(t) * 1.25:.1f},{cy + r * math.sin(t):.1f}')
        rings.append(f'<path d="M{" L".join(pts)}Z"{" class=\"index\"" if k % 5 == 4 else ""}/>')
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">'
       '<style>path{fill:none;stroke:#182427;stroke-opacity:.09;stroke-width:1}.index{stroke-opacity:.16;stroke-width:1.3}</style>'
       + ''.join(rings) + '</svg>')
Path(__file__).resolve().parent.parent.joinpath('site/assets/contours.svg').write_text(svg)
print(len(rings), 'rings')
