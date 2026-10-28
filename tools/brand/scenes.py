import math
def squircle(w, h, r, n=4.2, steps=24):
    """rounded rect whose corners are superellipse quarters (continuous curvature, like iOS)"""
    pts = []
    def corner(cx, cy, a0):
        for i in range(steps + 1):
            t = math.radians(a0 + 90 * i / steps); c, s = math.cos(t), math.sin(t)
            x = cx + r * math.copysign(abs(c) ** (2 / n), c); y = cy + r * math.copysign(abs(s) ** (2 / n), s)
            pts.append((x, y))
    corner(w - r, r, 270); corner(w - r, h - r, 0); corner(r, h - r, 90); corner(r, r, 180)
    return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z'

FONTS = ''.join(f"@font-face{{font-family:I;font-weight:{w};src:url(fonts/inter-{w}.ttf)}}" for w in (400,500,600,700,800)) + "@font-face{font-family:M;src:url(fonts/mono-500.ttf)}"

def window(W, H, light, dark, cut, theme, bar=72):
    """one browser window, light theme on the left of a slanted cut, dark on the right"""
    clip = squircle(W, H, 34)
    (ta, tb) = cut  # x of the cut at top and bottom, as a fraction of width
    L = f"polygon(0 0,{ta*100}% 0,{tb*100}% 100%,0 100%)"
    R = f"polygon({ta*100}% 0,100% 0,100% 100%,{tb*100}% 100%)"
    def half(img, mode, poly):
        bg, line, url, txt = (('#ececf0', 'rgba(0,0,0,.08)', '#ffffff', '#1d1d1f') if mode == 'light' else ('#1c1c21', 'rgba(255,255,255,.08)', '#2a2a31', '#f5f5f7'))
        return f'''<div class="half" style="clip-path:{poly}">
  <div class="bar" style="height:{bar}px;background:{bg};box-shadow:inset 0 -1px 0 {line}">
    <i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i>
    <div class="url" style="background:{url};color:{txt}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>ipynb.ashwingopalsamy.in</div>
  </div>
  <img src="{img}" style="top:{bar}px;width:{W}px;height:{H-bar}px">
</div>'''
    edge = 'rgba(0,0,0,.10)' if theme == 'light' else 'rgba(255,255,255,.14)'
    return f'''<div class="win" style="width:{W}px;height:{H}px;clip-path:path('{clip}')">
{half(light, 'light', L)}{half(dark, 'dark', R)}
</div>
<svg class="edge" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><path d="{clip}" fill="none" stroke="{edge}" stroke-width="2"/></svg>'''

def chip(theme):
    bg, fg, sub = ('#ffffff', '#1d1d1f', '#6e6e73') if theme == 'light' else ('#ffffff', '#1d1d1f', '#6e6e73')
    return f'''<div class="chip"><div class="doc"><svg width="40" height="48" viewBox="0 0 40 48"><path d="{squircle(40,48,10)}" fill="#1d1d1f"/><circle cx="12" cy="13" r="4" fill="#4cc38a"/><rect x="9" y="25" width="22" height="4" rx="2" fill="#fff" opacity=".9"/><rect x="9" y="33" width="15" height="4" rx="2" fill="#fff" opacity=".55"/></svg></div><div><b>cooling-coffee.ipynb</b><span>269 KB</span></div></div>
<svg class="cursor" width="44" height="56" viewBox="0 0 22 28"><path d="M2 2v20l5.2-4.6 3.4 7.6 3.6-1.6-3.4-7.4H18z" fill="#1d1d1f" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'''

BASE_CSS = FONTS + '''
*{box-sizing:border-box;margin:0}
body{font-family:I;-webkit-font-smoothing:antialiased}
.win{position:absolute;overflow:hidden}
.edge{position:absolute;pointer-events:none}
.half{position:absolute;inset:0}
.half img{position:absolute;left:0;object-fit:cover;object-position:top}
.bar{position:relative;display:flex;align-items:center;gap:14px;padding-left:28px}
.bar i{width:18px;height:18px;border-radius:50%;display:block}
.url{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);height:42px;padding:0 26px 0 20px;border-radius:21px;display:flex;align-items:center;gap:10px;font:500 21px/1 I;letter-spacing:-.01em}
.url svg{opacity:.55}
.chip{position:absolute;display:flex;align-items:center;gap:18px;padding:16px 34px 16px 18px;border-radius:999px;background:#fff;color:#1d1d1f;
 box-shadow:0 0 0 1px rgba(0,0,0,.06),0 2px 4px rgba(0,0,0,.06),0 24px 48px -12px rgba(0,0,0,.28)}
.chip .doc{display:grid;place-items:center;width:64px;height:64px;border-radius:999px;background:#f5f5f7}
.chip b{display:block;font:600 27px/1.2 I;letter-spacing:-.015em}
.chip span{display:block;font:500 20px/1.3 I;color:#6e6e73}
.cursor{position:absolute;filter:drop-shadow(0 6px 10px rgba(0,0,0,.25))}
'''

