import { ATTRIBUTES } from "../src/rules/creation.mjs";

import { MEDICAL_DOSES } from "../src/rules/play.mjs";

const tabs = ["Main", "Abilities", "Inventory", "Character", "Development"];
const summary = (title, body) => `<details class="sheet-group" open><summary>${title}</summary>${body}</details>`;

export function sheet({ draft, play, model, dev, catalog, tab, e, button, facts }) {
  const b = button;
  const owned = catalog.cards.filter(x => dev.known.includes(x.id) || x.level === "Universal");
  const itemRows = play.items.map(id => catalog.equipment.find(x => x.id === id));
  const load = itemRows.reduce((n, item) => n + (item?.bulk ?? 0), 0);
  const rows = (items, favorite = false) => `<div class="catalog">${items.map(x =>
    `<article><div><strong>${e(x.name)}</strong><small>${e(x.action)} · ${e(x.attribute)}</small></div>
    <div class="row-actions">${favorite ? b(play.favorites.includes(x.id) ? "★" : "☆", "favorite", x.id,
      `aria-label="${play.favorites.includes(x.id) ? "Unfavorite" : "Favorite"} ${e(x.name)}"`) : ""}
    ${b("Read", "detail", x.id)}${ATTRIBUTES.includes(x.attribute) ? b("Roll", "sheet-roll", x.id) : ""}</div></article>`).join("") || "<p class='muted'>No entries.</p>"}</div>`;
  const groups = ["Main Action", "Maneuver", "Reaction", "Passive"];
  let content;
  if (tab === "Main") {
    content = summary("Favorites", rows(owned.filter(x => play.favorites.includes(x.id)), true))
      + groups.map(group => summary(group, rows(owned.filter(x => x.action === group), true))).join("")
      + summary("Conditions", `<ul class="ledger">${play.conditions.map((c, i) => `<li>${e(c.name)} ${c.rating || ""}${c.persistent ? "*" : ""} ${b("Read", "condition-read", i)}${b("Remove", "condition-remove", i)}</li>`).join("")}</ul>
      ${b("Add condition", "condition-add", "")}<p class="muted">Record ongoing effects and apply their printed timing at the table.</p>`)
      + summary("Recovery", `<div class="play-actions">${b("Apply damage", "damage", "")}
      ${b("Restore HP", "heal", "")}${b("Safe breath", "breath", "")}
      ${b("Death roll", "death", "", play.state !== "dying" ? "disabled" : "")}
      ${b("Spend Grit", "grit", "", play.state !== "dying" || play.spentGrit >= dev.grit ? "disabled" : "")}
      ${b("Stabilize", "stabilize", "", play.state !== "dying" ? "disabled" : "")}
      ${play.state === "last-words" ? b("End Last Words turn", "last-turn", "") : ""}</div>`);
  } else if (tab === "Abilities") {
    content = facts(Object.entries(dev.ranks)) + rows(owned, true);
  } else if (tab === "Inventory") {
    content = facts([["Carried Bulk", `${load} / ${model.capacity}`], ["Coins", play.coins]])
      + `<label>Coins<input type="number" min="0" value="${play.coins}" data-play-field="coins"></label>
      <div class="inline"><label>Catalog equipment<select id="sheet-item">${catalog.equipment.map(x => `<option value="${e(x.id)}">${e(x.name)} · Bulk ${x.bulk}</option>`).join("")}</select></label>
      ${b("Review item", "item-add", "")}</div><p class="muted">Log gear acquired in play. This does not buy it from the creation pool.</p>
      <ul class="ledger">${itemRows.map((x, i) => `<li>${e(x?.name ?? "Unavailable equipment")} <span>Bulk ${x?.bulk ?? "—"}</span>
      ${b("Read", "item-read", play.items[i])}${MEDICAL_DOSES[x?.id] ? b("Use dose", "dose", i) : ""}${b("Remove", "item-remove", i)}</li>`).join("")}</ul>
      <div class="fields">${[0, 1].map(hand => `<label>${hand ? "Right" : "Left"} hand<select data-play-hand="${hand}"><option value="">Empty</option>
      ${itemRows.map((x, i) => x?.hands ? `<option value="${i + 1}" ${play.hands[hand] === String(i + 1) ? "selected" : ""}>${e(x.name)}</option>` : "").join("")}</select></label>`).join("")}</div>`;
  } else if (tab === "Character") {
    content = facts([["Ancestry", model.ancestry?.name], ["Culture", catalog.cultures.find(x => x.id === draft.culture)?.name],
      ["Background", catalog.backgrounds.find(x => x.id === draft.background)?.name], ["Class", model.profession?.name]])
      + summary("Ancestry traits", model.traits.map(t => `<p><strong>${e(t.name)}</strong> · ${e(t.text)}</p>`).join(""))
      + summary("Languages", `<p>Galactic Standard · ${e(draft.language)}${play.languages.map(x => " · " + e(x)).join("")}</p>
      <div class="inline"><label>Campaign grant or restriction<input id="extra-language" maxlength="80"></label>${b("Record language", "language-add", "")}</div>`)
      + summary("Wounds and scars", `<ul class="ledger">${play.wounds.map((w, i) => `<li><strong>${e(w.family)} ${e(w.code)}</strong><span>${e(w.injury)}</span>${b("Details", "wound", i)}</li>`).join("")}</ul>`)
      + `<label>Character notes<textarea data-play-field="notes" maxlength="10000">${e(play.notes)}</textarea></label>`;
  } else {
    const current = play.levels.at(-1);
    const signatures = model.profession?.signatures.map(id => catalog.cards.find(x => x.id === id))
      .filter(x => Number(x.level) === dev.level) ?? [];
    const nextRanks = catalog.disciplines.filter(d => (dev.ranks[d] ?? 0) < 3);
    content = facts([["Level", dev.level], ["Advancement DP", dev.remaining], ["DP spent", dev.total - dev.remaining]])
      + `<div class="play-actions">${b("Review level up", "level-up", "", dev.level >= 10 || dev.issues.length ? "disabled" : "")}
      ${b("Edit creation", "builder", "")}</div><p class="muted">Each new level grants 8 + level DP. Unspent advancement DP carries forward.</p>`
      + ([3, 7].includes(dev.level) ? summary("Milestone signature", `<div class="catalog">${signatures.map(x =>
        `<article><strong>${e(x.name)}${current.signature === x.id ? " · Chosen" : ""}</strong><div class="row-actions">${b("Read", "detail", x.id)}
        ${b("Choose", "milestone", x.id, current.signature ? "disabled" : "")}</div></article>`).join("")}</div>`) : "")
      + (current ? `<div class="inline"><label>Next rank<select id="advance-rank">${nextRanks.map(d => {
        const rank = (dev.ranks[d] ?? 0) + 1;
        return `<option value="${e(d)}">${e(d)} ${rank} · ${model.profession.prices[d][rank - 1]} DP</option>`;
      }).join("")}</select></label>${b("Review rank", "advance-rank", "", nextRanks.length ? "" : "disabled")}</div>
      <h3>Eligible abilities</h3><div class="catalog">${dev.eligible.map(x => `<article><div><strong>${e(x.name)}</strong><small>${e(x.requirement)} · ${x.dp} DP</small></div>
      <div class="row-actions">${b("Read", "detail", x.id)}${b("Review purchase", "advance-card", x.id, x.dp > dev.remaining ? "disabled" : "")}</div></article>`).join("")}</div>` : "")
      + summary("Advancement ledger", `<ul class="ledger">${dev.history.map(x => `<li>Level ${x.at} · ${e(x.label)}<span>${x.valid ? x.price + " DP" : "Needs review"}</span>${b("Remove", "remove-advancement", `${x.at}:${x.position}`)}</li>`).join("")}</ul>
      ${dev.issues.map(x => `<p class="warning">${e(x.message)}</p>`).join("")}`);
  }
  return `<div class="play-sheet"><header class="sheet-header">
    ${model.ancestry ? `<img src="assets/lineage-${e(model.ancestry.id)}.webp" alt="">` : ""}
    <div><div class="eyebrow">EXPLORER RECORD · LEVEL ${dev.level}</div><h1 tabindex="-1">${e(draft.name)}</h1>
    <p>${e(model.ancestry?.name)} · ${e(model.profession?.name)}</p></div>
    ${facts([["HP", `${play.hp} / ${model.hp}`], ["Grit", Math.max(0, dev.grit - play.spentGrit)],
      ["Speed before penalties", model.speed], ["Wounds", play.wounds.length], ["State", play.state], ["Death marks", play.marks]])}
    </header><div class="sheet-attributes">${ATTRIBUTES.map(name => b(`${name} ${draft.attributes[name] >= 0 ? "+" : ""}${draft.attributes[name]}`, "attribute-roll", name)).join("")}</div>
    <nav class="sheet-nav" aria-label="Character sheet">${tabs.map(name => b(name, "sheet-tab", name,
      name === tab ? 'aria-current="page"' : "")).join("")}</nav><section class="sheet-panel"><h2>${e(tab)}</h2>${content}</section></div>`;
}
