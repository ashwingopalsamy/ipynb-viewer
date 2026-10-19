from textpath import Face
F = Face('.cache/fonts/inter-500.ttf')
TAGS = {'never-runs-code': ('Never runs code', True), 'mit': ('MIT licence', False)}
THEME = {'light': ('#1d1d1f', '#f5f5f7', '#4cc38a'), 'dark': ('#f5f5f7', '#1d1d1f', '#1d8a4a')}
H, SIZE = 30, 13.5
for slug, (label, dot) in TAGS.items():
    for theme, (bg, fg, green) in THEME.items():
        x0 = 30 if dot else 14
        d, w = F.text_d(label, SIZE, x0, 19.9, -0.005)
        W = x0 + w + 14
        dot_svg = f'<circle cx="17" cy="15" r="4" fill="{green}"/>' if dot else ''
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H}" viewBox="0 0 {W:.1f} {H}" role="img" aria-label="{label}"><rect width="{W:.1f}" height="{H}" rx="15" fill="{bg}"/>{dot_svg}<path fill="{fg}" d="{d}"/></svg>
'''
        open(f'../../.github/assets/tag-{slug}-{theme}.svg', 'w').write(svg)
