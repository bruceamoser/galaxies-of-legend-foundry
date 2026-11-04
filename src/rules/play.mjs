export const die = sides => {
  const buffer = new Uint32Array(1);
  const limit = Math.floor(2 ** 32 / sides) * sides;
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % sides + 1;
};
export function roll(attribute, net = 0, next = die) {
  const extra = Math.max(-3, Math.min(3, net));
  const dice = Array.from({ length: 3 + Math.abs(extra) }, () => next(6));
  const kept = [...dice].sort((a, b) => extra < 0 ? a - b : b - a).slice(0, 3);
  const total = kept.reduce((sum, face) => sum + face, attribute);
  const critical = kept.every(face => face === 6);
  const fumble = kept.every(face => face === 1);
  return { dice, kept, total, critical, fumble,
    band: critical ? "Strong" : fumble ? "Weak" : total <= 8 ? "Weak" : total >= 15 ? "Strong" : "Standard" };
}
export function createPlay(model) {
  return { hp: model.hp, spentGrit: 0, state: "active", marks: 0, wounds: [],
    conditions: [], items: model.equipment.map(item => item.id), hands: [], coins: model.coins - model.cost,
    notes: "", languages: [], favorites: [], levels: [], lastWords: 0 };
}
export function advancement(play, model, catalog) {
  const ranks = { ...model.ranks };
  const known = new Set(model.owned);
  let remaining = 0;
  let total = 0;
  const issues = [];
  const history = [];
  const level = 1 + play.levels.length;
  const cards = new Map(catalog.cards.map(card => [card.id, card]));
  function eligible(card, at) {
    if (!card || card.level === "Universal" || Number(card.level) > at || known.has(card.id)) return false;
    if (card.requirement === "None") return true;
    if (card.requirement.startsWith("Class ")) return model.profession?.signatures.includes(card.id);
    const [discipline, rank] = card.requirement.split(" ");
    return (ranks[discipline] ?? 0) >= Number(rank);
  }
  for (const [index, entry] of play.levels.entries()) {
    const at = index + 2;
    const grant = 8 + at + Number(at === 3 && model.traits.some(trait => trait.level0DP));
    total += grant;
    remaining += grant;
    if (at === 3 || at === 7) {
      const card = cards.get(entry.signature);
      if (card && Number(card.level) === at && eligible(card, at)) known.add(card.id);
      else issues.push({ level: at, message: `Choose a level-${at} class signature.` });
    }
    for (const [position, purchase] of entry.purchases.entries()) {
      const card = cards.get(purchase.id);
      const rank = (ranks[purchase.id] ?? 0) + 1;
      const price = purchase.kind === "card" && eligible(card, at) ? card.dp
        : purchase.kind === "rank" && rank <= 3 ? model.profession?.prices[purchase.id]?.[rank - 1] : undefined;
      const valid = Number.isFinite(price) && price <= remaining;
      const label = purchase.kind === "rank" ? `${purchase.id} ${rank}` : card?.name ?? purchase.id;
      history.push({ at, position, label, price, valid });
      if (!valid) { issues.push({ level: at, message: `Review ${label}.` }); continue; }
      remaining -= price;
      if (purchase.kind === "rank") ranks[purchase.id] = rank;
      else known.add(purchase.id);
    }
  }
  return { level, ranks, known: [...known], remaining, total, history, issues,
    eligible: catalog.cards.filter(card => eligible(card, level)),
    grit: model.grit + Number(level >= 3) + Number(level >= 7) + Number(known.has("one-more-dawn")) };
}
export function woundRoll(family, prior, tables, next = die) {
  const dice = Array.from({ length: Math.min(5, 3 + prior) }, () => next(6));
  const code = [...dice].sort((a, b) => a - b).slice(-3).join("");
  return { family, dice, code, progress: 0, treatmentDay: null, ...tables[family][code] };
}
export function beginLastWords(play) {
  play.state = "last-words";
  play.hp = 0;
  play.lastWords = 2;
}
export function takeDamage(play, amount, family, tables, next = die) {
  if (!Number.isInteger(amount) || amount <= 0 || ["dead", "last-words"].includes(play.state)) return;
  play.hp = Math.max(0, play.hp - amount);
  if (play.hp > 0) return;
  if (play.state === "dying") play.marks++;
  else {
    const stabilized = play.state === "stable";
    const wound = woundRoll(family, play.wounds.length, tables, next);
    play.wounds.push(wound);
    play.state = "dying";
    play.marks = stabilized ? 1 : 0;
    if (wound.code === "666") beginLastWords(play);
  }
  if (play.marks >= 3) beginLastWords(play);
}
export function deathRoll(play, result) {
  if (play.state !== "dying") return;
  if (result.critical) { play.hp = 1; play.state = "active"; play.marks = 0; }
  else if (result.fumble) play.marks += 2;
  else if (result.band === "Weak") play.marks++;
  else if (result.band === "Strong") { play.state = "stable"; play.marks = 0; }
  if (play.marks >= 3) beginLastWords(play);
}
export function restoreHP(play, amount, maxHP) {
  if (["dead", "last-words"].includes(play.state) || amount <= 0) return;
  play.hp = Math.min(maxHP, play.hp + amount);
  if (play.hp > 0) { play.state = "active"; play.marks = 0; }
}

export const MEDICAL_DOSES = { "basic-medical-dose": 6, "greater-medical-dose": 10, "superior-medical-dose": 16 };

export function removeItem(play, index) {
  play.items.splice(index, 1);
  play.hands = play.hands.map(x => Number(x) === index + 1 ? "" : Number(x) > index + 1 ? String(Number(x) - 1) : x);
}

export function useMedicalDose(play, index, maxHP, resistance, next = die) {
  const dose = MEDICAL_DOSES[play.items[index]];
  if (!dose || play.state !== "active" || play.hp >= maxHP || play.hands.filter(Boolean).length >= 2) return;
  const amount = Math.min(maxHP - play.hp, Math.max(1, dose - resistance));
  restoreHP(play, amount, maxHP);
  const face = next(4);
  if (face === 1) removeItem(play, index);
  return { amount, face };
}
