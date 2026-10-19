from scenes import *
W, H = 1920, 1272
for theme in ('light', 'dark'):
    shadow = '0 50px 100px -30px rgba(10,10,20,.35), 0 20px 40px -20px rgba(10,10,20,.25)' if theme == 'light' else '0 50px 100px -30px rgba(0,0,0,.7)'
    html = f'''<!doctype html><style>{BASE_CSS}
html,body{{width:2400px;height:1236px;background:transparent}}
.stage{{position:absolute;left:240px;top:72px;width:{W}px;height:{H}px;filter:drop-shadow(0 40px 60px rgba(0,0,0,{'.22' if theme=='light' else '.5'}))}}
.chip{{left:40px;top:250px;transform:rotate(-5deg)}}
.cursor{{left:470px;top:322px}}
</style><body>
<div class="stage">{window(W, H, 'light.png', 'dark.png', (0.60, 0.44), theme)}</div>
{chip(theme)}
</body>'''
    open(f'.cache/hero-{theme}.html', 'w').write(html)
