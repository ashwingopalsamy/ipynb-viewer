import ast, io, json, base64, contextlib, sys
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt

cells = [
('markdown', """# Cooling coffee

A cup of filter coffee, a kitchen at 22 °C, and a thermometer read every two minutes. How long until it is pleasant to drink?"""),
('markdown', """## The model

Newton's law of cooling says the cup loses heat in proportion to how much warmer it is than the room:

$$\\frac{dT}{dt} = -k\\,(T - T_{\\text{room}})$$

which solves to $T(t) = T_{\\text{room}} + (T_0 - T_{\\text{room}})\\,e^{-kt}$. One number, $k$, describes the cup."""),
('code', """import numpy as np
import pandas as pd

room = 22.0
minutes = np.arange(0, 32, 2)
rng = np.random.default_rng(7)
temp = room + (88 - room) * np.exp(-0.047 * minutes) + rng.normal(0, 0.4, minutes.size)

readings = pd.DataFrame({"minute": minutes, "temp_c": temp.round(1)})
readings.head(6)"""),
('markdown', """## Fitting k

Taking the log of the excess temperature turns the curve into a straight line, so a plain least squares fit is enough."""),
('code', """excess = np.log(readings.temp_c - room)
slope, intercept = np.polyfit(readings.minute, excess, 1)
k = -slope

print(f"k = {k:.4f} per minute")
print(f"half the excess heat is gone every {np.log(2) / k:.1f} minutes")"""),
('code', """t = np.linspace(0, 30, 200)
fit = room + np.exp(intercept) * np.exp(-k * t)

fig, ax = plt.subplots(figsize=(8, 3.6))
ax.plot(t, fit, color="#0066cc", lw=2.4, label="fit")
ax.scatter(readings.minute, readings.temp_c, s=26, color="#1d1d1f", zorder=3, label="thermometer")
ax.axhline(60, color="#ff375f", lw=1.2, ls=(0, (4, 4)))
ax.set(xlabel="minutes", ylabel="°C")
ax.legend(frameon=False)"""),
('markdown', """## When to drink

Most people stop flinching at 60 °C."""),
('code', """drinkable = np.log((88 - room) / (60 - room)) / k
print(f"Drinkable after {drinkable:.1f} minutes.")"""),
]

plt.rcParams.update({
  'figure.dpi': 100, 'savefig.dpi': 160, 'font.size': 10.5,
  'axes.spines.top': False, 'axes.spines.right': False,
  'axes.edgecolor': '#1d1d1f', 'axes.linewidth': 0.9,
  'axes.grid': True, 'grid.color': '#e8e8ed', 'grid.linewidth': 0.8,
  'xtick.color': '#1d1d1f', 'ytick.color': '#1d1d1f', 'text.color': '#1d1d1f', 'axes.labelcolor': '#1d1d1f',
  'figure.facecolor': 'white', 'axes.facecolor': 'white',
})

ns = {'plt': plt}
out_cells, n = [], 0
def lines(s):
    l = s.split('\n'); return [x + '\n' for x in l[:-1]] + ([l[-1]] if l[-1] else [])
for kind, src in cells:
    if kind == 'markdown':
        out_cells.append({'cell_type': 'markdown', 'metadata': {}, 'source': lines(src)}); continue
    n += 1
    tree = ast.parse(src); last = None
    if tree.body and isinstance(tree.body[-1], ast.Expr):
        last = ast.Expression(tree.body.pop().value)
    buf = io.StringIO(); outputs = []
    with contextlib.redirect_stdout(buf):
        exec(compile(tree, '<cell>', 'exec'), ns)
        val = eval(compile(last, '<cell>', 'eval'), ns) if last else None
    if buf.getvalue():
        outputs.append({'output_type': 'stream', 'name': 'stdout', 'text': lines(buf.getvalue())})
    if plt.get_fignums():
        b = io.BytesIO(); plt.gcf().savefig(b, format='png', bbox_inches='tight'); plt.close('all')
        outputs.append({'output_type': 'display_data', 'metadata': {}, 'data': {'image/png': base64.b64encode(b.getvalue()).decode(), 'text/plain': ['<Figure size 800x360 with 1 Axes>']}})
    elif val is not None:
        data = {'text/plain': lines(repr(val))}
        if hasattr(val, '_repr_html_'): data['text/html'] = lines(val._repr_html_())
        outputs.append({'output_type': 'execute_result', 'execution_count': n, 'metadata': {}, 'data': data})
    out_cells.append({'cell_type': 'code', 'execution_count': n, 'metadata': {}, 'outputs': outputs, 'source': lines(src)})

nb = {'cells': out_cells, 'metadata': {'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'}, 'language_info': {'name': 'python', 'version': '3.12.4'}}, 'nbformat': 4, 'nbformat_minor': 5}
json.dump(nb, open(sys.argv[1], 'w'), indent=1, ensure_ascii=False)
open(sys.argv[1], 'a').write('\n')
