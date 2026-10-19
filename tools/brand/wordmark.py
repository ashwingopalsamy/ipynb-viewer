import sys
from textpath import Face
F = {w: Face(f'.cache/fonts/inter-{w}.ttf') for w in (400, 700)}
SIZE = 120; TR = -0.03
INK = {'light': '#1d1d1f', 'dark': '#f5f5f7'}
DOT = {'light': '#1d8a4a', 'dark': '#4cc38a'}

def wordmark(theme, pad=8):
    base = SIZE  # baseline y before cropping
    bold, w1 = F[700].run('ipynb', SIZE, 0, base, TR)
    gap = SIZE * 0.24
    reg_d, w2 = F[400].text_d('viewer', SIZE, w1 + gap, base, TR)
    paths = []; dot = None
    for g, tr in bold:
        if g == 'i':
            cs = F[700].contours(g, tr)
            cs.sort(key=lambda c: c[1][1])  # topmost contour has smallest y
            tittle, stem = cs[0], cs[1:]
            paths += [c[0] for c in stem]
            (x0, y0, x1, y1) = tittle[1]; sx0, _, sx1, _ = stem[0][1]
            cx = (sx0 + sx1) / 2; sw = sx1 - sx0; r = sw * 0.58; xh = stem[0][1][1]; cy = xh - sw * 0.5 - r
            dot = (cx, cy, r)
        else:
            paths.append(F[700].d(g, tr))
    # crop: top = dot top, bottom = descender of y
    top = dot[1] - dot[2]; bottom = base + SIZE * 0.25
    W = w1 + gap + w2
    vb = f'{-pad:.1f} {top - pad:.1f} {W + 2*pad:.1f} {bottom - top + 2*pad:.1f}'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{(W+2*pad)/2:.0f}" height="{(bottom-top+2*pad)/2:.0f}" role="img" aria-label="ipynb viewer">
<path fill="{INK[theme]}" d="{''.join(paths)}"/>
<path fill="{INK[theme]}" d="{reg_d}"/>
<circle cx="{dot[0]:.2f}" cy="{dot[1]:.2f}" r="{dot[2]:.2f}" fill="{DOT[theme]}"/>
</svg>
'''

for t in ('light', 'dark'):
    open(f'../../.github/assets/wordmark-{t}.svg', 'w').write(wordmark(t))

