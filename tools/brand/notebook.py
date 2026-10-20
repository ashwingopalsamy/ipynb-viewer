import ast, io, json, base64, contextlib, sys, types
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt

# The example notebook, and the demo behind "Open Demo". It is written here so that every output is real:
# each code cell runs once, in order, and what it prints or draws is stored. Three cells are the exception
# (a progress bar, a traceback and a pip install); those outputs are recorded in the shape Jupyter writes them.
# Run: python3 notebook.py ../../examples/cooling-coffee.ipynb ../../public/cooling-coffee.ipynb

ESC = '\x1b'

cells = [
('markdown', """# Cooling coffee

A cup of filter coffee, a kitchen at 22 °C, and a thermometer read every two minutes. How long until it is pleasant to drink?

> **Try it.** Press `t` for the contents, `s` on any cell to save it as an image, `i` for what this notebook gives away, `/` to search, `?` for every key.

Newton's law of cooling says a cup loses heat in proportion to how much warmer it is than the room:

$$\\frac{dT}{dt} = -k\\,(T - T_{\\text{room}})$$"""),
('code', """%pip install -q tqdm""", {'recorded': []}),
('code', """import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

room = 22.0
minutes = np.arange(0, 32, 2)
rng = np.random.default_rng(7)

cups = {"ceramic": 0.047, "glass": 0.058, "travel mug": 0.012}
temp = {
    name: room + (88 - room) * np.exp(-k * minutes) + rng.normal(0, 0.4, minutes.size)
    for name, k in cups.items()
}

fig, ax = plt.subplots(figsize=(8, 3.6))
colours = {"ceramic": "#0066cc", "glass": "#1d8f6e", "travel mug": "#8a5cf5"}
for name, series in temp.items():
    ax.plot(minutes, series, lw=2.2, color=colours[name], label=name)
ax.axhspan(room, 60, color="#ff375f", alpha=0.07)
ax.axhline(60, color="#ff375f", lw=1.2, ls=(0, (4, 4)))
ax.text(30, 61.5, "drinkable", color="#d0224a", ha="right", va="bottom")
ax.set(xlabel="minutes", ylabel="°C")
ax.legend(frameon=False)""", {'alt': 'Three cooling curves for a ceramic cup, a glass and a travel mug, falling from 88 °C toward room temperature; the travel mug cools far more slowly. A dashed line marks 60 °C, the drinkable limit.'}),
('markdown', """## The model

Solving the equation gives one number, $k$, for each cup:

$$\\begin{align}
T(t) &= T_{\\text{room}} + (T_0 - T_{\\text{room}})\\,e^{-kt} \\\\
t_{1/2} &= \\frac{\\ln 2}{k}
\\end{align}$$

| Symbol | Meaning | Value |
|---|---|---|
| $T_0$ | Temperature when poured | 88 °C |
| $T_{\\text{room}}$ | The kitchen | 22 °C |
| $k$ | How fast the cup gives up heat | fitted, per minute |

### Assumptions

- [x] The room stays at 22 °C
- [x] The coffee is stirred, so it has one temperature
- [ ] Evaporation matters (it does, a little; we ignore it)"""),
('markdown', """## The data

Sixteen readings per cup, one every two minutes."""),
('code', """readings = pd.DataFrame({"minute": minutes, **{name: s.round(1) for name, s in temp.items()}})
readings"""),
('markdown', """### The same frame, as plain text

A `print` of a frame is not an HTML table, but the viewer reads the columns back into one."""),
('code', """print(readings.head(10))"""),
('markdown', """## Fitting k

Taking the log of the excess temperature turns the curve into a straight line, so a plain least squares fit is enough."""),
('code', """excess = np.log(readings["ceramic"] - room)
slope, intercept = np.polyfit(readings.minute, excess, 1)
k = -slope

print(f"k = {k:.4f} per minute")
print(f"half the excess heat is gone every {np.log(2) / k:.1f} minutes")"""),
('code', """t = np.linspace(0, 30, 200)
fit = room + np.exp(intercept) * np.exp(-k * t)
residual = readings["ceramic"] - (room + np.exp(intercept) * np.exp(-k * readings.minute))

fig, (top, bottom) = plt.subplots(
    2, 1, figsize=(8, 4.6), sharex=True,
    gridspec_kw={"height_ratios": [3, 1], "hspace": 0.12},
)
top.plot(t, fit, color="#0066cc", lw=2.4, label="fit")
top.scatter(readings.minute, readings["ceramic"], s=26, color="#1d1d1f", zorder=3, label="thermometer")
top.axhline(60, color="#ff375f", lw=1.2, ls=(0, (4, 4)))
top.set(ylabel="°C")
top.legend(frameon=False)

bottom.axhline(0, color="#1d1d1f", lw=0.9)
bottom.vlines(readings.minute, 0, residual, color="#0066cc", lw=2)
bottom.scatter(readings.minute, residual, s=18, color="#0066cc", zorder=3)
bottom.set(xlabel="minutes", ylabel="residual")""", {'alt': 'The ceramic cup readings as dots with the fitted curve through them, and below them the residuals, which stay within half a degree of zero.'}),
('markdown', """### How sure are we?

Refit on 200 random resamples of the readings. A progress bar like this one is stored frame by frame, and the viewer keeps only the last."""),
('code', """from tqdm import tqdm

ks = []
for _ in tqdm(range(200)):
    pick = rng.integers(0, minutes.size, minutes.size)
    s, _b = np.polyfit(minutes[pick], np.log(temp["ceramic"][pick] - room), 1)
    ks.append(-s)

lo, hi = np.percentile(ks, [2.5, 97.5])
print(f"k is between {lo:.4f} and {hi:.4f} (95%)")""", {'tqdm': 200}),
('code', """GREEN, AMBER, RESET = "\\033[32m", "\\033[33m", "\\033[0m"

print(f"{GREEN}PASS{RESET}  residuals centred on zero (mean {residual.mean():+.2f} °C)")
print(f"{GREEN}PASS{RESET}  every reading below the pour temperature")
print(f"{AMBER}WARN{RESET}  thermometer resolution is 0.1 °C; the last readings sit close to the room")"""),
('code', """for m in range(0, 31):
    print(f"t = {m:2d} min   {room + np.exp(intercept) * np.exp(-k * m):5.1f} °C")"""),
('markdown', """## What the fit says

The cup cools fastest while it is hottest. The gap to the room shrinks by the same fraction every minute, so the first ten minutes decide most of the story."""),
('code', """ks_grid = np.linspace(0.03, 0.07, 9)
rooms = np.linspace(16, 28, 7)
wait = np.array([[np.log((88 - r) / (60 - r)) / kk for kk in ks_grid] for r in rooms])

fig, ax = plt.subplots(figsize=(8, 3.8))
image = ax.imshow(wait, cmap="YlGnBu", aspect="auto", origin="lower")
ax.set_xticks(range(len(ks_grid)), [f"{v:.3f}" for v in ks_grid])
ax.set_yticks(range(len(rooms)), [f"{v:.0f}" for v in rooms])
ax.set(xlabel="k per minute", ylabel="room °C")
ax.grid(False)
for i in range(len(rooms)):
    for j in range(len(ks_grid)):
        ax.text(j, i, f"{wait[i, j]:.0f}", ha="center", va="center", fontsize=8.5, color="white" if wait[i, j] > 14 else "#1d1d1f")
fig.colorbar(image, label="minutes until 60 °C")""", {'alt': 'A grid of minutes until the coffee reaches 60 °C, for room temperatures from 16 to 28 °C and cooling constants from 0.03 to 0.07. Warmer rooms and slower cups mean a longer wait.'}),
('code', """fig, axes = plt.subplots(1, 3, figsize=(8, 2.8), sharey=True)
for ax, (name, series) in zip(axes, temp.items()):
    rate = -np.gradient(series, minutes)
    ax.fill_between(minutes, rate, color=colours[name], alpha=0.18)
    ax.plot(minutes, rate, color=colours[name], lw=2)
    ax.set_title(name, fontsize=10.5)
    ax.set_xlabel("minutes")
axes[0].set_ylabel("°C lost per minute")
fig.tight_layout()""", {'alt': 'Three small charts, one per cup, showing how many degrees per minute each loses: steep at first and flattening, much flatter for the travel mug.'}),
('markdown', """## When to drink

Most people stop flinching at 60 °C."""),
('code', """from IPython.display import SVG, Markdown

drinkable = np.log((88 - room) / (60 - room)) / k
SVG(f'''<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120" role="img" aria-label="A thermometer marked at 60 degrees">
  <rect x="20" y="52" width="320" height="16" rx="8" fill="#e8e8ed"/>
  <rect x="20" y="52" width="{320 * (60 - room) / (88 - room):.0f}" height="16" rx="8" fill="#0066cc"/>
  <line x1="{20 + 320 * (60 - room) / (88 - room):.0f}" y1="36" x2="{20 + 320 * (60 - room) / (88 - room):.0f}" y2="84" stroke="#ff375f" stroke-width="2" stroke-dasharray="4 4"/>
  <text x="{20 + 320 * (60 - room) / (88 - room):.0f}" y="28" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" fill="#d0224a">60 °C</text>
  <text x="20" y="104" font-family="system-ui, sans-serif" font-size="12" fill="#6e6e73">{room:.0f} °C</text>
  <text x="340" y="104" text-anchor="end" font-family="system-ui, sans-serif" font-size="12" fill="#6e6e73">88 °C</text>
</svg>''')"""),
('code', """Markdown(f"**Drinkable after {drinkable:.1f} minutes.** A travel mug would take about {np.log((88 - room) / (60 - room)) / 0.012:.0f}.")"""),
('code', """readings["temp"]"""),
('markdown', """## Before you share this

Press `i`. The sheet lists what a notebook gives away without its author noticing: a key pasted into a cell, a home folder in a traceback. It also lists what the notebook needs to run and what makes it heavy, and it can make a link with the notebook inside it.

Everything here is made up, including the token below.

To run the same fit from a shell, or against a table of readings:

```bash
pip install numpy pandas matplotlib tqdm
jupyter lab cooling-coffee.ipynb
```

```sql
SELECT cup, MIN(minute) AS minutes_to_drinkable
FROM readings
WHERE temp_c <= 60
GROUP BY cup;
```"""),
('code', """SCALE_API_TOKEN = "demo-9f3a71c2e8d4b605"  # not a real key; the sheet flags it anyway
print("Scale token set:", SCALE_API_TOKEN[:5] + "…")"""),
]

plt.rcParams.update({
  'figure.dpi': 100, 'savefig.dpi': 130, 'font.size': 10.5,
  'axes.spines.top': False, 'axes.spines.right': False,
  'axes.edgecolor': '#1d1d1f', 'axes.linewidth': 0.9,
  'axes.grid': True, 'grid.color': '#e8e8ed', 'grid.linewidth': 0.8,
  'xtick.color': '#1d1d1f', 'ytick.color': '#1d1d1f', 'text.color': '#1d1d1f', 'axes.labelcolor': '#1d1d1f',
  'figure.facecolor': 'white', 'axes.facecolor': 'white',
})

BAR_WIDTH = 10
def tqdm_frames(total):
    out = []
    for i in list(range(0, total + 1, max(1, total // 10))) + ([total] if total % max(1, total // 10) else []):
        pct = i * 100 // total
        fill = '█' * (i * BAR_WIDTH // total)
        seconds = i * 0.0163
        rate = f'{(i / seconds):.2f}it/s' if seconds else '?it/s'
        eta = (total - i) * 0.0163
        out.append(f'{pct:3d}%|{fill:<{BAR_WIDTH}}| {i}/{total} [{int(seconds // 60):02d}:{int(seconds % 60):02d}<{int(eta // 60):02d}:{int(eta % 60):02d}, {rate}]\n')
    return ''.join(out)

def fake_tqdm(it):
    items = list(it)
    for x in items:
        yield x

def traceback_for(exc, count):
    home = '/Users/barista/miniconda3/lib/python3.12/site-packages/pandas/core'
    bar = '---------------------------------------------------------------------------'
    red, green, cyan, reset = f'{ESC}[0;31m', f'{ESC}[0;32m', f'{ESC}[0;36m', f'{ESC}[0m'
    return [
        f'{red}{bar}{reset}',
        f'{red}KeyError{reset}                                  Traceback (most recent call last)',
        f'File {green}{home}/indexes/base.py:3805{reset}, in {cyan}Index.get_loc{reset}(self, key)\n'
        f'   3804 try:\n-> 3805     return self._engine.get_loc(casted_key)\n   3806 except KeyError as err:',
        f'File {green}index.pyx:167{reset}, in {cyan}pandas._libs.index.IndexEngine.get_loc{reset}()',
        f'{red}KeyError{reset}: \'temp\'',
        f'\nThe above exception was the direct cause of the following exception:\n',
        f'{red}KeyError{reset}                                  Traceback (most recent call last)',
        f'Cell {green}In[{count}], line 1{reset}\n----> 1 readings["temp"]',
        f'File {green}{home}/frame.py:4102{reset}, in {cyan}DataFrame.__getitem__{reset}(self, key)\n'
        f'   4101 if self.columns.nlevels > 1:\n-> 4102     indexer = self.columns.get_loc(key)',
        f'{red}KeyError{reset}: \'temp\'',
    ]

# `from tqdm import tqdm` in the example resolves to this stand-in, so the generator needs no tqdm; its output frames are written by tqdm_frames.
sys.modules['tqdm'] = types.SimpleNamespace(tqdm=fake_tqdm)
ns = {'plt': plt}
out_cells, n = [], 0
def lines(s):
    l = s.split('\n'); return [x + '\n' for x in l[:-1]] + ([l[-1]] if l[-1] else [])
for i, (kind, src, *rest) in enumerate(cells):
    opts = rest[0] if rest else {}
    cid = f'cell-{i:02d}'
    if kind == 'markdown':
        out_cells.append({'cell_type': 'markdown', 'id': cid, 'metadata': {}, 'source': lines(src)}); continue
    n += 1
    if 'recorded' in opts:
        out_cells.append({'cell_type': 'code', 'id': cid, 'execution_count': n, 'metadata': {}, 'outputs': opts['recorded'], 'source': lines(src)}); continue
    tree = ast.parse(src); last = None
    if tree.body and isinstance(tree.body[-1], ast.Expr):
        last = ast.Expression(tree.body.pop().value)
    buf = io.StringIO(); outputs = []; error = None
    with contextlib.redirect_stdout(buf):
        try:
            exec(compile(tree, '<cell>', 'exec'), ns)
            val = eval(compile(last, '<cell>', 'eval'), ns) if last else None
        except KeyError as exc:
            error = exc; val = None
    if buf.getvalue():
        outputs.append({'output_type': 'stream', 'name': 'stdout', 'text': lines(buf.getvalue())})
    if 'tqdm' in opts:
        outputs.insert(0, {'output_type': 'stream', 'name': 'stderr', 'text': lines(tqdm_frames(opts['tqdm']))})
    if error is not None:
        outputs.append({'output_type': 'error', 'ename': 'KeyError', 'evalue': "'temp'", 'traceback': traceback_for(error, n)})
    elif plt.get_fignums():
        fig = plt.gcf(); w, h = fig.get_size_inches() * fig.dpi
        b = io.BytesIO(); fig.savefig(b, format='png', bbox_inches='tight', metadata={'Software': None}, pil_kwargs={'optimize': True}); plt.close('all')
        outputs.append({'output_type': 'display_data', 'metadata': {}, 'data': {'image/png': base64.b64encode(b.getvalue()).decode(), 'text/plain': [opts.get('alt', f'<Figure size {w:.0f}x{h:.0f}>')]}})
    elif val is not None and hasattr(val, '_repr_svg_'):
        outputs.append({'output_type': 'display_data', 'metadata': {}, 'data': {'image/svg+xml': lines(val._repr_svg_()), 'text/plain': ['<IPython.core.display.SVG object>']}})
    elif val is not None and hasattr(val, '_repr_markdown_'):
        outputs.append({'output_type': 'display_data', 'metadata': {}, 'data': {'text/markdown': lines(val._repr_markdown_()), 'text/plain': ['<IPython.core.display.Markdown object>']}})
    elif val is not None:
        data = {'text/plain': lines(repr(val))}
        if hasattr(val, '_repr_html_'): data['text/html'] = lines(val._repr_html_())
        outputs.append({'output_type': 'execute_result', 'execution_count': n, 'metadata': {}, 'data': data})
    out_cells.append({'cell_type': 'code', 'id': cid, 'execution_count': n, 'metadata': {}, 'outputs': outputs, 'source': lines(src)})

nb = {'cells': out_cells, 'metadata': {'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'}, 'language_info': {'name': 'python', 'version': '3.12.4'}}, 'nbformat': 4, 'nbformat_minor': 5}
for path in sys.argv[1:]:
    with open(path, 'w') as f:
        json.dump(nb, f, indent=1, ensure_ascii=False)
        f.write('\n')
