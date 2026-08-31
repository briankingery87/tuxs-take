# Tux's Take

The post-game half of the **CFB Atlas**. One HTML file, no server, no build step
beyond inlining Leaflet, no API key. It reads the published ArcGIS services live
over REST on every page load.

Live sibling apps: [Ask the Atlas](https://briankingery87.github.io/ask-the-atlas/)
(the preview side) and the [CFB Atlas Experience](https://experience.arcgis.com/experience/99f6d8062d3943c08aa7728d209060ff/)
(the configurable side).

## Pages

| Page | Question |
|---|---|
| Home | the latest week at a glance |
| Q1. The Aftermath | What did I miss? |
| Q2. The Dig | Show me the games that... |
| Q3. The Yard | Where did it happen? |
| Q4. The Long Season | Which week was the best one? |
| Under the Couch | How does a dog know any of this? |

A single game is a drawer plus a permalink, not a page of its own.

## Data

| Key | Service |
|---|---|
| results | `CFB_Atlas_Recaps/FeatureServer/0` - `GameResults`, facts only |
| recaps | `CFB_Atlas_Recaps/FeatureServer/1` - `GameRecaps`, the writing |
| teams | `CFB_Atlas_Teams/FeatureServer/0` - campus coordinates for the map |

Built by `08b_game_recaps.ipynb` in the CFB Atlas workspace. Join key is the CFBD
`game_id`. The app opens on `is_latest = 1`, so the week advances on its own and
nothing here is hard-coded.

## Working on it

```
python build.py            # inlines vendor/leaflet into index.html
node --check .appcheck.js  # catches syntax errors before a browser does
node smoke.js              # 37 assertions against MOCKED services, no network
publish.bat                # add, commit, push
```

**Never hand-edit `index.html`.** It is generated from `src/app.template.html`.

`smoke.js` runs the real built file in headless Chromium with every ArcGIS request
mocked, so it needs no network and no live service. Its fixture deliberately includes
the awkward cases: a game with no betting line, one with no excitement index, an
overtime game, a neutral site, a home team with no coordinates, a templated recap and
a null crowd. It also measures horizontal overflow on a 390px phone for every page.

## Honesty rules this app follows

- Every composite index publishes its components, weights and denominator on the same
  screen as the number. A component with no data leaves the denominator; it is never
  scored as zero.
- Blanks sort last in both directions. A null is not a zero.
- Machine-written prose is labelled as such, per row, with the model that wrote it.
- Division II and III are **absent, not empty** - no free source publishes their
  scores, so those games are dropped rather than shown as blanks.
- Neutral-site games are partly blank on purpose: the venue name is right, but
  capacity, city and travel distance would describe the home team's own stadium.
- Betting lines are results, never advice. "Gamble Responsibly. 18+."

## Licence

Code MIT (see LICENSE). Data: CollegeFootballData.com. Basemap: Esri. School names
and marks are trademarks of their institutions, used for identification only.
TUX is a fictional character; the beagle is real.
