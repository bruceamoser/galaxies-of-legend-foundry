# Galaxies of Legend Foundry

The GoL character workshop is a browser prototype for the future Foundry implementation. The GoL rulebook is the design authority.

## Open the workshop

Run `npm run dev` from this checkout, then open [the local workshop](http://127.0.0.1:8765/web/). The app needs Node for checks and Python for the static server and catalog importer. It has no application dependencies.

The workshop covers level-1 creation, ability previews, shopping, local autosave and JSON export. The JSON is a workshop record. Native Foundry Actors, advancement and runtime integration are future implementation work.

## Structure

- `web/` contains the browser workshop, ancestry illustrations and generated catalog.
- `src/rules/` contains pure creation rules, independent of browser and Foundry documents.
- `content/source-lock.json` records the GoL base commit and the hashes of the exact imported Markdown. The initial snapshot includes unpublished working-tree changes.
- `scripts/import-catalog.py` refreshes the catalog from a GoL rulebook checkout.
- `docs/` records rules authority and implementation boundaries.

Run `npm run check` to verify the workshop source and rules. Run `python3 scripts/import-catalog.py /path/to/galaxies-of-legend` to refresh the data deliberately.
