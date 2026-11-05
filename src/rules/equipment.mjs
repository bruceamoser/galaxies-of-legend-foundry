export function equipmentEligibility(item, known) {
  return !item.requiredAbility || known.includes(item.requiredAbility);
}

export function supportsGearNeed(item, need) {
  return item.name.toLowerCase() === need.toLowerCase() || item.tags?.includes(need.toLowerCase());
}

export function gearNeeds(catalog, known) {
  const groups = new Map();
  for (const card of catalog.cards) {
    if (!known.includes(card.id)) continue;
    for (const label of card.gearNeeds ?? []) {
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(card);
    }
  }
  return [...groups].map(([label, cards]) => ({ label, cards }));
}
