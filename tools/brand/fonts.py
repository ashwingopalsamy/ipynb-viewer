"""Pins the variable fonts the app ships to the static weights the drawings use."""
import os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

os.makedirs('.cache/fonts', exist_ok=True)
for w in (400, 500, 600, 700, 800):
    f = instancer.instantiateVariableFont(TTFont('../../public/fonts/inter.woff2'), {'wght': w})
    f.flavor = None; f.save(f'.cache/fonts/inter-{w}.ttf')
f = instancer.instantiateVariableFont(TTFont('../../public/fonts/jetbrains-mono.woff2'), {'wght': 500})
f.flavor = None; f.save('.cache/fonts/mono-500.ttf')
