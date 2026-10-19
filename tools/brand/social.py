from scenes import *
W, H = 1920, 1272
html = f'''<!doctype html><style>{BASE_CSS}
html,body{{width:1280px;height:640px;background:#0a0a0c;overflow:hidden}}
.stage{{position:absolute;left:0;top:0;width:{W}px;height:{H}px;transform-origin:0 0;transform:translate(560px,150px) scale(.44)}}
.wm{{position:absolute;left:72px;top:92px;width:300px}}
h1{{position:absolute;left:72px;top:200px;width:520px;font:700 50px/1.06 I;letter-spacing:-.035em;color:#f5f5f7}}
p{{position:absolute;left:72px;top:336px;width:420px;font:400 21px/1.45 I;letter-spacing:-.01em;color:#f5f5f7;opacity:.62}}
.chip{{transform:translate(474px,446px) rotate(-5deg) scale(.5);transform-origin:0 0;left:0;top:0}}
.cursor{{left:640px;top:486px;width:24px;height:30px}}
</style><body>
<img class="wm" src="../../../.github/assets/wordmark-dark.svg">
<h1>Jupyter notebooks,<br>without Jupyter.</h1>
<p>Lightweight and fully local. Just drop the file and read it, delightfully.</p>
<div class="stage">{window(W, H, 'light.png', 'dark.png', (0.60, 0.44), 'dark')}</div>
{chip('dark')}
</body>'''
open('.cache/social.html', 'w').write(html)
