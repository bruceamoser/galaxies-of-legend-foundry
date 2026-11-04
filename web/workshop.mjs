import { ATTRIBUTES, createDraft, evaluate } from "../src/rules/creation.mjs";

const key = "gol-character-workshop-v1";
const steps = ["Identity", "Origins", "Level 0", "Class", "Level 1", "Equipment", "Review"];
const app = document.querySelector("#app");
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));
const e = escape;
const rulesMarkup = text => e(text)
  .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
let catalog;
let draft = createDraft();
let step = 0;
let cardQuery = "";
let activeCard = "";
let storageAvailable = true;
let model;
try {
  const stored = JSON.parse(localStorage.getItem(key));
  if (stored?.draft) {
    draft = { ...createDraft(), ...stored.draft };
    step = Math.min(6, Math.max(0, Number(stored.step) || 0));
  }
} catch { storageAvailable = false; }

const option = (id, label, value) => `<option value="${e(id)}"${id === value ? " selected" : ""}>${e(label)}</option>`;
const select = (field, label, values, value = draft[field]) =>
  `<label>${e(label)}<select data-field="${field}">${option("", "Choose…", value)}${values.map(x => option(x.id, x.name, value)).join("")}</select></label>`;
const byId = (rows, id) => rows.find(x => x.id === id);
const cardName = id => byId(catalog.cards, id)?.name ?? id;
const button = (label, action, id, extra = "") =>
  `<button type="button" data-action="${action}" data-id="${e(id)}" ${extra}>${e(label)}</button>`;

function identity() {
  return `<p>Give your explorer a name and assign six attributes. Use values from −2 to +2 with a combined total of +3.</p>
  <div class="fields"><label>Explorer name<input data-field="name" value="${e(draft.name)}" maxlength="80"></label>
  <label>Pronouns<input data-field="pronouns" value="${e(draft.pronouns)}" maxlength="40"></label></div>
  <div class="attributes">${ATTRIBUTES.map(name => `<label>${name}<select data-attribute="${name}">${[-2, -1, 0, 1, 2].map(value => option(value, value > 0 ? `+${value}` : value, draft.attributes[name])).join("")}</select></label>`).join("")}</div>
  <p class="callout">Attribute total <strong>${model.attributeTotal >= 0 ? "+" : ""}${model.attributeTotal}</strong> <span>Target +3</span></p>`;
}
function origins() {
  const selected = model.ancestry;
  const picked = [byId(catalog.cultures, draft.culture), byId(catalog.backgrounds, draft.background)].filter(Boolean);
  return `<p>Choose a lineage and two traits, then choose the community and work that shaped you.</p>
  <div class="lineages">${catalog.ancestries.map(a =>
    `<button type="button" class="lineage" aria-pressed="${a.id === draft.ancestry}" data-action="ancestry" data-id="${a.id}">
    <img src="assets/lineage-${a.id}.webp" alt=""><span>${e(a.name)}</span></button>`).join("")}</div>
  ${selected ? `<h3>${e(selected.name)} traits <small>${draft.traits.length} / 2</small></h3><div class="choices">${selected.traits.map(t =>
    `<label class="choice"><input type="checkbox" data-list="traits" value="${t.id}" ${draft.traits.includes(t.id) ? "checked" : ""} ${draft.traits.length === 2 && !draft.traits.includes(t.id) ? "disabled" : ""}><span><strong>${e(t.name)}</strong><small>${e(t.text)}</small></span></label>`).join("")}</div>` : ""}
  <div class="fields">${select("culture", "Culture", catalog.cultures)}${select("background", "Background", catalog.backgrounds)}</div>
  ${picked.map(x => `<p class="callout"><strong>${e(x.name)}</strong> · ${e(x.rank)} 1 and ${e(cardName(x.card))}. <span>+${x.coins} coins</span></p>`).join("")}
  <div class="fields"><label>Shared language<input value="Galactic Standard" readonly></label>
  <label>Other ordinary language<input list="language-options" data-field="language" value="${e(draft.language)}" maxlength="80"></label></div>
  <datalist id="language-options">${catalog.languages.map(x => option(x, x, "")).join("")}</datalist>`;
}
function training(phase) {
  const choices = phase ? model.level1Choices : model.level0Choices;
  const filtered = choices.filter(x => `${x.name} ${x.requirement} ${x.action}`.toLowerCase().includes(cardQuery.toLowerCase()));
  const ranks = phase && model.profession ? catalog.disciplines.filter(d => (model.ranks[d] ?? 0) < 3) : [];
  const purchases = model.ledger.filter(row => row.phase === phase);
  return `<p>${phase ? "Spend this separate pool on discipline ranks and eligible Novice abilities." : "Buy eligible Novice abilities using origin grants. Class grants and discipline purchases come later."} Unspent DP expires at creation.</p>
  <p class="callout"><strong>${model.remaining[phase]} / ${model.pools[phase]} DP</strong> <span>remaining in Level ${phase}</span></p>
  ${ranks.length ? `<div class="inline"><label>Buy next discipline rank<select id="rank-choice">${ranks.map(d => {
    const rank = (model.ranks[d] ?? 0) + 1;
    return option(d, `${d} ${rank} · ${model.profession.prices[d][rank - 1]} DP`, "");
  }).join("")}</select></label>${button("Buy rank", "rank", "", 'class="primary"')}</div>` : ""}
  <h3>Purchase ledger</h3>${purchases.length ? `<ol class="ledger">${purchases.map((x, index) => `<li>${e(x.label)} <span>${x.valid ? `${x.price} DP` : "Needs review"}</span>${button("Remove", "remove", index)}</li>`).join("")}</ol>` : "<p class='muted'>No purchases yet.</p>"}
  <h3>Eligible abilities</h3><label>Filter abilities<input id="card-search" type="search" value="${e(cardQuery)}" placeholder="Name, discipline or action"></label>
  <div class="catalog">${filtered.length ? filtered.map(x => `<article><div><strong>${e(x.name)}</strong><small>${e(x.action)} · ${e(x.requirement)} · ${x.dp} DP</small></div><div class="row-actions">${button("Read", "detail", x.id)}${button("Buy", "buy", x.id, x.dp > model.remaining[phase] ? "disabled" : "")}</div></article>`).join("") : "<p class='muted'>No matching eligible abilities.</p>"}</div>`;
}
function chooseClass() {
  const current = model.profession;
  return `<p>Choose a class, two starting disciplines and one level-1 signature.</p>
  <div class="class-grid">${catalog.classes.map(x => `<button type="button" aria-pressed="${x.id === draft.classId}" data-action="class" data-id="${x.id}"><strong>${e(x.name)}</strong><small>${e(x.role)}</small><span>${e(x.minimums.join(" · "))} ≥ 0</span></button>`).join("")}</div>
  ${current ? `<h3>Starting disciplines <small>${draft.startingRanks.length} / 2</small></h3><div class="chips">${current.ranks.map(x => `<label><input type="checkbox" data-list="startingRanks" value="${e(x)}" ${draft.startingRanks.includes(x) ? "checked" : ""} ${draft.startingRanks.length === 2 && !draft.startingRanks.includes(x) ? "disabled" : ""}>${e(x)}</label>`).join("")}</div>
  <h3>Level-1 signatures</h3><div class="catalog">${current.signatures.map(id => byId(catalog.cards, id)).filter(x => x?.level === "1").map(x => `<article><label class="radio"><input type="radio" name="signature" data-field="signature" value="${x.id}" ${draft.signature === x.id ? "checked" : ""}>${e(x.name)}</label>${button("Read", "detail", x.id)}</article>`).join("")}</div>` : ""}`;
}
function equipment() {
  const hands = model.equipment.flatMap((item, index) => item?.hands ? [{ id: String(index + 1), name: item.name }] : []);
  return `<p>Buy equipment with starting coins, then record what is in each hand.</p>
  <p class="callout"><strong>${model.coins - model.cost} / ${model.coins} coins</strong><span>${model.bulk} / ${model.capacity} Bulk</span></p>
  ${model.bulk > model.capacity ? "<p class='warning'>Over Capacity. Apply the book’s encumbrance ruling before recording final Speed.</p>" : ""}
  <div class="inline"><label>Market<select id="gear-choice">${catalog.equipment.map(x => option(x.id, `${x.name} · ${x.price} coins · Bulk ${x.bulk}`, "")).join("")}</select></label>${button("Add gear", "gear", "", 'class="primary"')}</div>
  <h3>Carried gear</h3><ul class="ledger">${model.equipment.map((x, index) => `<li>${e(x?.name ?? "Unavailable gear")} <span>${x?.price ?? 0} coins</span>${button("Remove", "remove-gear", index)}</li>`).join("")}</ul>
  <div class="fields">${[0, 1].map(i => `<label>${i ? "Right" : "Left"} hand<select data-hand="${i}">${option("", "Empty", draft.hands[i])}${hands.map(x => option(x.id, x.name, draft.hands[i])).join("")}</select></label>`).join("")}</div>`;
}
function review() {
  return `<p>Check your choices and download a portable copy of your explorer. This is a workshop draft export.</p>
  <h3>${e(draft.name || "Unnamed explorer")} <small>Level 1</small></h3>
  <div class="fields"><div><strong>Identity</strong><p>${e(model.ancestry?.name)} · ${e(model.profession?.name)}</p><p>Galactic Standard${draft.language ? ", " + e(draft.language) : ""}</p></div>
  <div><strong>Disciplines</strong><p>${Object.entries(model.ranks).map(([d, n]) => `${e(d)} ${n}`).join(" · ") || "None yet"}</p></div></div>
  <h3>Known abilities</h3><div class="catalog">${model.owned.map(id => `<article><strong>${e(cardName(id))}</strong>${button("Read", "detail", id)}</article>`).join("")}</div>
  <p class="muted">Start with zero wounds and death marks. Unspent creation DP expires.</p>
  ${button("Download explorer JSON", "export", "", `class="primary" ${model.errors.length ? "disabled" : ""}`)}
  ${button("Start another draft", "reset", "")}`;
}
const renderers = [identity, origins, () => training(0), chooseClass, () => training(1), equipment, review];

function render(focusSelector) {
  model = evaluate(draft, catalog);
  try { localStorage.setItem(key, JSON.stringify({ draft, step })); } catch { storageAvailable = false; }
  const errors = step === 6 ? model.errors : model.errors.filter(x => x.stage === step);
  const details = byId(catalog.cards, activeCard);
  const workshop = `<div class="shell"><nav aria-label="Creation steps"><div class="eyebrow">CREW MANIFEST / 01</div>
    ${steps.map((title, i) => `<button type="button" data-action="step" data-id="${i}" ${i === step ? 'aria-current="step"' : ""}><span>0${i + 1}</span>${title}</button>`).join("")}</nav>
    <section class="stage"><div class="eyebrow">EXPLORER CREATION / STEP 0${step + 1}</div><h1 tabindex="-1">${steps[step]}</h1>
    ${renderers[step]()}
    ${errors.length ? `<aside class="warning" aria-label="Choices to review"><strong>Choices to review</strong><ul>${errors.map(x => `<li>${e(x.message)}</li>`).join("")}</ul></aside>` : ""}
    <footer class="controls">${step ? button("← Back", "step", step - 1) : "<span></span>"}${step < 6 ? button("Continue →", "step", step + 1, 'class="primary"') : ""}</footer></section>
    <aside class="summary"><div class="eyebrow">LIVE CHARACTER</div>
    ${model.ancestry ? `<img class="portrait" src="assets/lineage-${model.ancestry.id}.webp" alt="">` : '<div class="placeholder" aria-hidden="true">◈</div>'}
    <h2>${e(draft.name || "New explorer")}</h2><p>${e([model.ancestry?.name, model.profession?.name].filter(Boolean).join(" · ") || "Level 1 draft")}</p>
    <dl><div><dt>HP</dt><dd>${model.hp}</dd></div><div><dt>Base Speed</dt><dd>${model.speed}</dd></div><div><dt>Grit</dt><dd>${model.grit}</dd></div><div><dt>Coins</dt><dd>${model.coins - model.cost}</dd></div></dl>
    <p class="muted">${storageAvailable ? "Draft saved in this browser." : "Browser storage is unavailable."}</p></aside></div>
    <dialog id="ability-detail" aria-labelledby="ability-title">${details ? `<h2 id="ability-title">${e(details.name)}</h2><pre>${rulesMarkup(details.text)}</pre><form method="dialog"><button>Close</button></form>` : ""}</dialog>`;
  app.innerHTML = workshop;
  if (details) {
    const dialog = app.querySelector("dialog");
    dialog.addEventListener("close", () => {
      const closedCard = activeCard;
      activeCard = "";
      app.querySelector(`[data-action="detail"][data-id="${CSS.escape(closedCard)}"]`)?.focus();
    }, { once: true });
    dialog.showModal();
  }
  if (focusSelector) app.querySelector(focusSelector)?.focus();
}

app.addEventListener("change", event => {
  const input = event.target;
  const { field, attribute, list, hand } = input.dataset;
  if (field && input.type !== "text") draft[field] = input.value;
  else if (attribute) draft.attributes[attribute] = Number(input.value);
  else if (list) draft[list] = input.checked ? [...draft[list], input.value] : draft[list].filter(x => x !== input.value);
  else if (hand !== undefined) {
    const item = model.equipment[Number(input.value) - 1];
    draft.hands[Number(hand)] = input.value;
    if (item?.hands === 2) draft.hands[1 - Number(hand)] = input.value;
    else if (model.equipment[Number(draft.hands[1 - Number(hand)]) - 1]?.hands === 2) draft.hands[1 - Number(hand)] = "";
  } else return;
  const focus = field ? `[data-field="${field}"]` : attribute ? `[data-attribute="${attribute}"]`
    : list ? `[data-list="${list}"][value="${CSS.escape(input.value)}"]` : `[data-hand="${hand}"]`;
  render(focus);
});

app.addEventListener("input", event => {
  const input = event.target;
  if (input.dataset.field && input.type === "text") {
    draft[input.dataset.field] = input.value;
    try { localStorage.setItem(key, JSON.stringify({ draft, step })); } catch { storageAvailable = false; }
    if (input.dataset.field === "name") app.querySelector(".summary h2").textContent = input.value || "New explorer";
    return;
  }
  if (input.id !== "card-search") return;
  cardQuery = event.target.value;
  render("#card-search");
});

app.addEventListener("click", event => {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;
  const { action, id } = trigger.dataset;
  const purchases = step === 2 ? draft.level0 : draft.level1;
  switch (action) {
    case "step": step = Number(id); cardQuery = ""; render("h1"); return;
    case "ancestry": if (draft.ancestry !== id) { draft.ancestry = id; draft.traits = []; } break;
    case "class": if (draft.classId !== id) { draft.classId = id; draft.startingRanks = []; draft.signature = ""; } break;
    case "detail": activeCard = id; break;
    case "buy": purchases.push({ kind: "card", id }); break;
    case "rank": {
      const rank = app.querySelector("#rank-choice").value;
      const cost = model.profession.prices[rank][model.ranks[rank] ?? 0];
      if (cost <= model.remaining[1]) purchases.push({ kind: "rank", id: rank });
      else { alert("This rank costs more DP than you have remaining."); return; }
      break;
    }
    case "remove": purchases.splice(Number(id), 1); break;
    case "gear": {
      const id = app.querySelector("#gear-choice").value;
      if (byId(catalog.equipment, id).price + model.cost > model.coins) {
        alert("This item costs more coins than you have remaining."); return;
      }
      draft.gear.push(id);
      break;
    }
    case "remove-gear": {
      const slot = Number(id) + 1;
      draft.gear.splice(slot - 1, 1);
      draft.hands = draft.hands.map(x => Number(x) === slot ? "" : Number(x) > slot ? String(Number(x) - 1) : x);
      break;
    }
    case "export": {
      if (model.errors.length) return;
      const data = { format: "gol-workshop-v1", level: 1, choices: draft, derived: {
        maximumHP: model.hp, currentHP: model.hp, speedBeforeEncumbrance: model.speed, grit: model.grit,
        coins: model.coins - model.cost, bulk: model.bulk, capacity: model.capacity,
        ranks: model.ranks, abilities: model.owned, languages: ["Galactic Standard", draft.language],
        wounds: [], deathMarks: 0,
      } };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "gol-explorer.json"; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    case "reset":
      if (!confirm("Replace the saved draft?")) return;
      draft = createDraft(); step = 0; render("h1"); return;
    default: return;
  }
  render(`[data-action="${action}"][data-id="${CSS.escape(id)}"]`);
});

try {
  const response = await fetch("./data/catalog.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  catalog = await response.json();
  render();
} catch (error) {
  app.textContent = `Could not open the workshop. Start the local server and reload. ${error.message}`;
}
