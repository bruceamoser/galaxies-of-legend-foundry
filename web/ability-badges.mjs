const codes = { "Main Action": "A", Maneuver: "M", Reaction: "R", Passive: "P" };

export function disciplineIcon(name, e) {
  const slug = name.toLowerCase();
  if (!/^[a-z]+$/.test(slug)) return "";
  return `<img class="discipline-icon" src="assets/disciplines/${e(slug)}.svg" alt="" title="${e(name)}">`;
}

export function actionBadge(action, e) {
  return codes[action] ? `<span class="action-code" title="${e(action)}" aria-label="${e(action)}">${codes[action]}</span>` : "";
}

export function abilityBadges(card, e) {
  const discipline = /^([A-Za-z]+) ([1-3])$/.exec(card.requirement);
  return `<span class="ability-badges">${actionBadge(card.action, e)}${discipline
    ? `<span class="discipline-badge" title="${e(card.requirement)}">${disciplineIcon(discipline[1], e)}<small>${discipline[2]}</small></span>` : ""}</span>`;
}

export function actionCounts(cards, e) {
  return `<span class="action-counts">${Object.keys(codes).map(action =>
    `<span>${actionBadge(action, e)} ${cards.filter(card => card.action === action).length}</span>`).join("")}</span>`;
}
