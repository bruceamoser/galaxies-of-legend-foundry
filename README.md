# Galaxies of Legend Foundry

The GoL character workshop is a browser prototype for the future Foundry implementation. The GoL rulebook is the design authority.

## Open the workshop

Run `npm run dev` from this checkout, then open [the local workshop](http://127.0.0.1:8765/web/). The app needs Node for checks and Python for the static server and catalog importer. It has no application dependencies.

The workshop has two modes. The builder verifies each step and previews ancestry and origin grants, class costs, signatures, abilities, ranks and equipment. The character sheet supports rolls, advancement through level 10, inventory and hand assignment, conditions, HP, Grit, death and wound records, treatment, and self-administered medical doses. Named saves, local autosave, and JSON import/export preserve the play record.

The workshop is a single-character tool. Resolve targeting, wound applicability, movement, and condition timing at the table. Foundry Actors, linked combat, chat cards and the separate HoL utility apps remain future work.

## Structure

- `web/` contains the browser workshop, ancestry illustrations and generated catalog.
- `src/rules/` contains pure creation rules, independent of browser and Foundry documents.
- `content/source-lock.json` records the GoL base commit and the hashes of the exact imported Markdown. The initial snapshot includes unpublished working-tree changes.
- `scripts/import-catalog.py` refreshes the catalog from a GoL rulebook checkout.
- `docs/` records rules authority and implementation boundaries.

Run `npm run check` to verify the workshop source and rules. Run `python3 scripts/import-catalog.py /path/to/galaxies-of-legend` to refresh the data deliberately.
