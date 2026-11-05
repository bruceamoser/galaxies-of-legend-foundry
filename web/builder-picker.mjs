import { equipmentEligibility, gearNeeds, supportsGearNeed } from "../src/rules/equipment.mjs";
import { abilityBadges, disciplineIcon } from "./ability-badges.mjs";

export function builderPicker({ kind, phase, query, catalog, model, e, button, abilityReason, development, filter }) {
  const market = kind === "equipment";
  const ranks = kind === "discipline";
  const available = new Set((development?.eligible ?? (phase === 0 ? model.level0Choices : model.level1Choices)).map(card => card.id));
  const dp = development?.remaining ?? model.remaining[phase];
  const knownRanks = development?.ranks ?? (phase === 0 ? model.earlyRanks : model.ranks);
  const match = text => text.toLowerCase().includes(query.trim().toLowerCase());
  const known = development?.known ?? model.owned;
  const needs = gearNeeds(catalog, known);
  const balance = market ? `${model.coins - model.cost} coins` : `${dp} DP`;
  const rankTags = Object.entries(knownRanks)
    .map(([name, rank]) => `<span class="grant-chip">${e(name)} ${rank}</span>`).join("");
  const bought = (development ? development.history.filter(row => row.at === development.level && row.valid) : model.ledger.filter(row => row.phase === phase && row.valid))
    .map(row => row.kind === "card" ? button(row.label, "detail", row.id, 'class="reference-link"')
      : `<span class="grant-chip">${e(row.label)}</span>`).join("");
  const context = `<div class="picker-context"><strong>${balance} remaining</strong>
    ${market ? `<span>Bulk ${model.bulk} / ${model.capacity}</span>` : `
      <div><small>Known disciplines</small> ${rankTags || "None yet"}</div>
      <div><small>Purchased this step</small> ${bought || "None yet"}</div>`}</div>
    <label>Search ${market ? "equipment" : ranks ? "disciplines" : "abilities"}
    <input id="picker-search" type="search" value="${e(query)}"></label>
    ${kind === "ability" ? `<label>Discipline<select id="discipline-filter" aria-label="Discipline">${[["all", "All disciplines"], ["universal", "Universal · no discipline required"], ...catalog.disciplines.map(name => [name, name])].map(([id, name]) =>
      `<option value="${e(id)}" ${id === filter ? "selected" : ""}>${e(name)}</option>`).join("")}</select></label>` : ""}`;
  if (market) {
    const rows = catalog.equipment.filter(x => match(x.name + " " + x.category)).map(item => {
      const trained = equipmentEligibility(item, known);
      const disabled = !trained || item.price > model.coins - model.cost;
      const supports = needs.filter(need => supportsGearNeed(item, need.label)).flatMap(need => need.cards);
      const required = catalog.cards.find(card => card.id === item.requiredAbility);
      return `<tr><th scope="row">${button(item.name, "market-read", item.id, 'class="reference-link"')}
      ${required ? `<small>Requires ${button(required.name, "detail", required.id, 'class="reference-link"')}</small>` : ""}
      ${supports.length ? `<small>Supports ${supports.map(card => button(card.name, "detail", card.id, 'class="reference-link"')).join(" ")}</small>` : ""}</th>
      <td>${item.price}</td><td>${item.bulk}</td><td>${item.hands}</td>
      <td><input aria-label="Quantity ${e(item.name)}" id="quantity-${e(item.id)}" type="number" min="1" max="200" value="1"></td>
      <td>${button(!trained ? "Training required" : disabled ? "Over budget" : "Buy", "market-buy", item.id, disabled ? "disabled" : "")}</td></tr>`;
    });
    return context + `<div class="picker-results"><table class="market-table"><thead><tr><th>Item</th><th>Coins</th><th>Bulk</th><th>Hands</th><th>Qty</th><th>Action</th></tr></thead>
    <tbody>${rows.join("") || '<tr><td colspan="6">No matching items.</td></tr>'}</tbody></table></div>`;
  }
  const choices = ranks ? catalog.disciplines.filter(name => match(name)).map(name => {
    const rank = (knownRanks[name] ?? 0) + 1;
    const cost = model.profession?.prices[name]?.[rank - 1];
    return { id: name, discipline: name, name: rank > 3 ? name : `${name} ${rank}`, cost, ready: cost <= dp,
      reason: rank > 3 ? "Rank 3 already known." : cost === undefined ? "Choose a class first." : "Insufficient DP.",
      summary: catalog.cards.filter(card => card.requirement === `${name} ${rank}`)
        .map(card => `${card.name} (level ${card.level})`).join(" · ") };
  }) : catalog.cards.filter(card => match(`${card.name} ${card.requirement} ${card.action}`) && (
    filter === "all" || (filter === "universal" ? card.requirement === "None" : card.requirement.startsWith(filter + " "))
  )).map(card => {
    const eligible = available.has(card.id);
    return { ...card, cost: card.level === "Universal" ? undefined : card.dp, free: card.level === "Universal", ready: eligible && card.dp <= dp,
      reason: eligible ? "Insufficient DP." : !development ? abilityReason(card, phase)
        : development.known.includes(card.id) ? "Already known."
          : Number(card.level) > development.level ? `Available at level ${card.level}.`
            : `Requires ${card.requirement} before purchase.`,
      summary: `${card.action} · ${card.requirement}` };
  });
  return context + `<div class="picker-results">${["free", true, false].map(ready => {
    const group = choices.filter(x => ready === "free" ? x.free : !x.free && x.ready === ready);
    if (!group.length) return "";
    return `<h3>${ready === "free" ? "Free universal actions · already known" : ready ? "Available to learn" : "Not available yet"} <small>${group.length}</small></h3>
    <div class="picker-cards">${group.map(x => `<article class="choice-card"><h3>${ranks ? disciplineIcon(x.discipline, e) : abilityBadges(x, e)}${e(x.name)}</h3>
      <p>${e(x.summary || "No additional ability listed for this rank.")}</p>
      <p>${x.cost === undefined ? "" : `<strong>${x.cost} DP</strong> · `}${x.free ? "No DP cost" : ready ? "Eligible" : e(x.reason)}</p>
      <div class="row-actions">${ranks ? "" : button("Read rules", "detail", x.id)}
      ${ready === true ? button("Learn", ranks ? "picker-buy-rank" : "picker-buy-card", x.id) : ""}</div></article>`).join("")}</div>`;
  }).join("") || "<p>No matching choices.</p>"}</div>`;
}
