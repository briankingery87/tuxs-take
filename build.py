#!/usr/bin/env python3
"""
Tux's Take - build step.

Inlines vendor/leaflet.css and vendor/leaflet.js into src/app.template.html and
writes index.html. That is the whole build: no npm, no bundler, no watch mode.

    python build.py

Why inline rather than a CDN link: the app then has zero external code
dependencies. It works offline for everything except the data itself, and it
cannot be broken by a corporate network blocking a CDN.
"""
import re, pathlib, sys

root = pathlib.Path(__file__).parent
tpl  = (root / 'src' / 'app.template.html').read_text(encoding='utf-8')
css  = (root / 'vendor' / 'leaflet.css').read_text(encoding='utf-8')
js   = (root / 'vendor' / 'leaflet.js').read_text(encoding='utf-8')
js   = re.sub(r'//# sourceMappingURL=.*', '', js)

if '/*LEAFLET_CSS*/' not in tpl or '/*LEAFLET_JS*/' not in tpl:
    sys.exit('ERROR: template is missing the /*LEAFLET_CSS*/ or /*LEAFLET_JS*/ marker.')
if '</script' in js.lower():
    sys.exit('ERROR: vendor js contains a script close tag and cannot be inlined as-is.')

out = tpl.replace('/*LEAFLET_CSS*/', '\n/* Leaflet (BSD-2-Clause) - inlined, unmodified */\n' + css)
out = out.replace('/*LEAFLET_JS*/',  '\n/* Leaflet (BSD-2-Clause) https://leafletjs.com - inlined, unmodified */\n' + js)
(root / 'index.html').write_text(out, encoding='utf-8')

# extract the app script so `node --check` can catch syntax errors before you open a browser
blocks = re.findall(r'<script>(.*?)</script>', out, re.S)
(root / '.appcheck.js').write_text(blocks[-1], encoding='utf-8')

print('built index.html  {:,} bytes  ({} script blocks)'.format(len(out), len(blocks)))
print('now run:  node --check .appcheck.js')
