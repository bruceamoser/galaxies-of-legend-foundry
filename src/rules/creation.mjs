export const ATTRIBUTES = ["Brawn", "Fortitude", "Agility", "Guile", "Knowledge", "Reason"];
export const createDraft = () => ({
  name: "", pronouns: "", attributes: { Brawn: 0, Fortitude: 0, Agility: 1, Guile: 0, Knowledge: 2, Reason: 0 },
  ancestry: "", traits: [], culture: "", background: "", language: "", classId: "",
  startingRanks: [], signature: "", level0: [], level1: [], gear: [], hands: ["", ""],
});

export function evaluate(draft, catalog) {
  const ancestry = catalog.ancestries.find(x => x.id === draft.ancestry);
  const culture = catalog.cultures.find(x => x.id === draft.culture);
  const background = catalog.backgrounds.find(x => x.id === draft.background);
  const profession = catalog.classes.find(x => x.id === draft.classId);
  const cards = new Map(catalog.cards.map(card => [card.id, card]));
  const traits = ancestry?.traits.filter(trait => draft.traits.includes(trait.id)) ?? [];
  const ranks = {};
  const owned = new Set();
  const errors = [];
  const ledger = [];
  let duplicates = 0;
  const check = (stage, condition, message) => { if (!condition) errors.push({ stage, message }); };
  const attributes = draft.attributes;
  const attributeTotal = ATTRIBUTES.reduce((sum, key) => sum + attributes[key], 0);
  check(0, draft.name.trim(), "Name your explorer.");
  check(0, attributeTotal === 3 && ATTRIBUTES.every(key =>
    Number.isInteger(attributes[key]) && Math.abs(attributes[key]) <= 2),
  "Assign six attributes from −2 to +2 for a total of +3.");
  check(1, ancestry && traits.length === 2 && draft.traits.length === 2, "Choose an ancestry and exactly two traits.");
  check(1, culture && background, "Choose both a culture and a background.");
  check(1, draft.language.trim() && draft.language.trim().toLowerCase() !== "galactic standard",
    "Record one ordinary language in addition to Galactic Standard.");
  for (const origin of [culture, background].filter(Boolean)) {
    if (ranks[origin.rank]) duplicates++;
    if (owned.has(origin.card)) duplicates++;
    ranks[origin.rank] = 1;
    owned.add(origin.card);
  }
  const base = 10 + attributes.Knowledge + attributes.Reason + attributes.Guile;
  const pools = [
    base + duplicates + traits.reduce((sum, trait) => sum + trait.level0DP, 0),
    base,
  ];
  const remaining = [...pools];

  function cardEligible(card, phase) {
    if (!card || card.level !== "1" || owned.has(card.id)) return false;
    if (card.requirement === "None") return true;
    if (card.requirement.startsWith("Class ")) {
      return phase === 1 && profession?.signatures.includes(card.id);
    }
    const [discipline, rank] = card.requirement.split(" ");
    return (ranks[discipline] ?? 0) >= Number(rank);
  }

  function applyPurchases(phase, purchases) {
    for (const purchase of purchases) {
      const card = cards.get(purchase.id);
      const rank = (ranks[purchase.id] ?? 0) + 1;
      const price = purchase.kind === "card" && cardEligible(card, phase) ? card.dp
        : purchase.kind === "rank" && phase === 1 && rank <= 3
          ? profession?.prices[purchase.id]?.[rank - 1] : undefined;
      const valid = Number.isFinite(price) && price <= remaining[phase];
      check(phase === 0 ? 2 : 4, valid, `Review purchase: ${card?.name ?? purchase.id}.`);
      ledger.push({ phase, label: purchase.kind === "rank" ? `${purchase.id} ${rank}` : card?.name ?? purchase.id, price, valid });
      if (!valid) continue;
      remaining[phase] -= price;
      if (purchase.kind === "rank") ranks[purchase.id] = rank;
      else owned.add(purchase.id);
    }
  }

  applyPurchases(0, draft.level0);
  const level0Choices = catalog.cards.filter(card => cardEligible(card, 0));
  check(3, profession, "Choose a class.");
  if (profession) {
    check(3, profession.minimums.every(key => attributes[key] >= 0), "Meet your class attribute minimums.");
    const startingRanks = [...new Set(draft.startingRanks)].filter(rank => profession.ranks.includes(rank));
    check(3, startingRanks.length === 2 && draft.startingRanks.length === 2, "Choose two distinct class disciplines.");
    for (const rank of startingRanks) {
      if (ranks[rank]) { pools[1]++; remaining[1]++; }
      ranks[rank] = 1;
    }
    const signature = cards.get(draft.signature);
    const valid = signature?.level === "1" && profession.signatures.includes(signature.id);
    check(3, valid, "Choose a level-1 signature.");
    if (valid) owned.add(signature.id);
  }
  applyPurchases(1, draft.level1);
  const level1Choices = catalog.cards.filter(card => cardEligible(card, 1));
  const equipment = draft.gear.map(id => catalog.equipment.find(item => item.id === id));
  check(5, equipment.every(Boolean), "Remove unavailable equipment.");
  const coins = 40 + (ancestry?.coins ?? 0) + (culture?.coins ?? 0)
    + (background?.coins ?? 0) + (profession?.coins ?? 0);
  const cost = equipment.reduce((sum, item) => sum + (item?.price ?? 0), 0);
  const bulk = equipment.reduce((sum, item) => sum + (item?.bulk ?? 0), 0);
  const capacity = 10 + 3 * attributes.Brawn;
  check(5, cost <= coins, "Your equipment exceeds your starting coins.");
  for (const index of draft.hands.filter(Boolean)) {
    const item = equipment[Number(index) - 1];
    const held = draft.hands.filter(hand => hand === index).length;
    check(5, item && item.hands === held, "Equip one-handed gear once, and two-handed gear in both hands.");
  }
  return { ancestry, profession, traits, ranks, owned: [...owned], pools, remaining, duplicates, ledger, errors,
    level0Choices, level1Choices, equipment, coins, cost, bulk, capacity,
    hp: 12 + (ancestry?.hp ?? 0) + (profession?.hp ?? 0) + attributes.Fortitude,
    speed: Math.max(0, (ancestry?.speed ?? 6) + attributes.Agility),
    grit: 2, attributeTotal };
}
