export function builderPicker({ kind, phase, query, catalog, model, e, button, abilityReason, development }) {
  const market = kind === "equipment";
  const ranks = kind === "discipline";
  const available = new Set((development?.eligible ?? (phase === 0 ? model.level0Choices : model.level1Choices)).map(card => card.id));
  const dp = development?.remaining ?? model.remaining[phase];
  const knownRanks = development?.ranks ?? (phase === 0 ? model.earlyRanks : model.ranks);
  const match = text => text.toLowerCase().includes(query.trim().toLowerCase());
  const balance = market ? `${model.coins - model.cost} coins` : `${dp} DP`;
  const rankTags = Object.entries(knownRanks)
    .map(([name, rank]) => `<span class="grant-chip">${e(name)} ${rank}</span>`).join("");
  const bought = (development ? development.history.filter(row => row.at === development.level && row.valid) : model.ledger.filter(row => row.phase === phase && row.valid))
    .map(row => `<span class="grant-chip">${e(row.label)}</span>`).join("");
  const context = `<div class="picker-context"><strong>${balance} remaining</strong>
    ${market ? `<span>Bulk ${model.bulk} / ${model.capacity}</span>` : `
      <div><small>Known disciplines</small> ${rankTags || "None yet"}</div>
      <div><small>Purchased this step</small> ${bought || "None yet"}</div>`}</div>
    <label>Search ${market ? "equipment" : ranks ? "disciplines" : "abilities"}
    <input id="picker-search" type="search" value="${e(query)}"></label>`;
  if (market) {
    const rows = catalog.equipment.filter(x => match(x.name + " " + x.category)).map(item => {
      const disabled = item.price > model.coins - model.cost;
      return `<tr><th scope="row">${button(item.name, "market-read", item.id, 'class="reference-link"')}</th>
      <td>${item.price}</td><td>${item.bulk}</td><td>${item.hands}</td>
      <td><input aria-label="Quantity ${e(item.name)}" id="quantity-${e(item.id)}" type="number" min="1" max="200" value="1"></td>
      <td>${button(disabled ? "Over budget" : "Buy", "market-buy", item.id, disabled ? "disabled" : "")}</td></tr>`;
    });
    return context + `<div class="picker-results"><table class="market-table"><thead><tr><th>Item</th><th>Coins</th><th>Bulk</th><th>Hands</th><th>Qty</th><th>Action</th></tr></thead>
    <tbody>${rows.join("") || '<tr><td colspan="6">No matching items.</td></tr>'}</tbody></table></div>`;
  }
  const choices = ranks ? catalog.disciplines.filter(name => match(name)).map(name => {
    const rank = (knownRanks[name] ?? 0) + 1;
    const cost = model.profession?.prices[name]?.[rank - 1];
    return { id: name, name: rank > 3 ? name : `${name} ${rank}`, cost, ready: cost <= dp,
      reason: rank > 3 ? "Rank 3 already known." : cost === undefined ? "Choose a class first." : "Insufficient DP.",
      summary: catalog.cards.filter(card => card.requirement === `${name} ${rank}`)
        .map(card => `${card.name} (level ${card.level})`).join(" · ") };
  }) : catalog.cards.filter(card => card.level !== "Universal" && match(`${card.name} ${card.requirement} ${card.action}`)).map(card => {
    const eligible = available.has(card.id);
    return { ...card, cost: card.dp, ready: eligible && card.dp <= dp,
      reason: eligible ? "Insufficient DP." : !development ? abilityReason(card, phase)
        : development.known.includes(card.id) ? "Already known."
          : Number(card.level) > development.level ? `Available at level ${card.level}.`
            : `Requires ${card.requirement} before purchase.`,
      summary: `${card.action} · ${card.requirement}` };
  });
  return context + `<div class="picker-results">${[true, false].map(ready => {
    const group = choices.filter(x => x.ready === ready);
    if (!group.length) return "";
    return `<h3>${ready ? "Available to learn" : "Not available yet"} <small>${group.length}</small></h3>
    <div class="picker-cards">${group.map(x => `<article class="choice-card"><h3>${e(x.name)}</h3>
      <p>${e(x.summary || "No additional ability listed for this rank.")}</p>
      <p>${x.cost === undefined ? "" : `<strong>${x.cost} DP</strong> · `}${ready ? "Eligible" : e(x.reason)}</p>
      <div class="row-actions">${ranks ? "" : button("Read rules", "detail", x.id)}
      ${ready ? button("Learn", ranks ? "picker-buy-rank" : "picker-buy-card", x.id) : ""}</div></article>`).join("")}</div>`;
  }).join("") || "<p>No matching choices.</p>"}</div>`;
}
