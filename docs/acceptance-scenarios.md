# Workshop acceptance

Use the web prototype to settle navigation, selection, purchase and review before implementing native Foundry applications. Keep the rules evaluator independent of document persistence.

- Build Iona from the Player's Book. Confirm 13 and 12 DP in her separate creation pools, 16 HP, Speed 7, Grit 2, and 19 coins after buying a toolkit.
- Buy a card before and after buying its required rank. An earlier purchase must not become valid retroactively.
- Change an origin or class after shopping. Review invalid selections without silently dropping purchases.
- Preview an ability, complete the draft, download JSON and reload. The local draft must survive reload.
- Use the workshop at mobile width. Controls and navigation must remain reachable without page overflow.

- Open an origin grant and confirm its paired ability, coin contribution and duplicate DP. Open a purchase and confirm the final cost before the ledger changes.
- Open the playable sheet, advance to level 3 and choose a signature. Confirm HP is unchanged and Grit and DP update without resetting play state.
- Confirm that a wound is added on entry into Dying, that further damage while Dying adds a mark, and that a safe breath does not restore spent Grit. Verify a medical dose heals before its inventory die can empty.

Native Foundry acceptance will require its own disposable-world checks. The current prototype creates no Foundry documents.

## HoL builder comparison

The eight-step flow follows the HoL workshop from Identity through Review. Use separate ancestry and origin steps, grant-bearing origin labels, eligibility-first class cards, and searchable learning and market pickers. A valid Continue advances directly. An invalid Continue shows the issues and offers a way back to the relevant step. Reading a rule from a picker returns to the same search. Apply the same learning picker to advancement.

Retest an existing seven-step autosave. It should preserve character data and map its old step to the corresponding step in the new flow. Verify the size of selected, unselected and disabled trait controls on desktop and mobile.
