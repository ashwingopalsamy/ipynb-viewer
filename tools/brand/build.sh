#!/bin/sh
# Redraws everything in .github/assets and the example notebook. See README.md beside this file.
set -e
cd "$(dirname "$0")"
mkdir -p .cache
python3 fonts.py
python3 notebook.py ../../examples/cooling-coffee.ipynb ../../public/cooling-coffee.ipynb
python3 wordmark.py
python3 tags.py
python3 hero.py
python3 social.py
npm --prefix ../.. run build --silent
node draw.mjs
node edit.mjs
