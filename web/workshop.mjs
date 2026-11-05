import { ATTRIBUTES, STEP, createDraft, evaluate } from "../src/rules/creation.mjs";

import { advancement, createPlay, deathRoll, restoreHP, roll, takeDamage, MEDICAL_DOSES, removeItem, useMedicalDose } from "../src/rules/play.mjs";
import { portable, readPortable } from "../src/rules/portable.mjs";
import { sheet } from "./sheet.mjs";
import { equipmentEligibility, gearNeeds, supportsGearNeed } from "../src/rules/equipment.mjs";
import { abilityBadges, actionCounts, disciplineIcon } from "./ability-badges.mjs";
import { builderPicker } from "./builder-picker.mjs";

const libraryKey = "gol-character-library-v2";
const key = "gol-character-workshop-v1";
const steps = ["Identity & attributes", "Ancestry & languages", "Culture & background", "Early learning", "Class", "Heroic learning", "Equipment", "Review"];
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
let pickerQuery = "";
let disciplineFilter = "all";
let popup = null;

let storageAvailable = true;
let model;
let play = null;
let mode = "builder";
let tab = "Main";
let saveId = null;
let dev;
try {
  const stored = JSON.parse(localStorage.getItem(key));
  if (stored?.draft) {
    draft = { ...createDraft(), ...stored.draft };
    play = stored.play ?? null;
    mode = stored.mode === "sheet" && play ? "sheet" : "builder";
    tab = stored.tab ?? "Main";
    saveId = stored.saveId ?? null;
    const oldStep = Math.max(0, Number(stored.step) || 0);
    step = stored.builderVersion === 2 ? Math.min(STEP.review, oldStep)
      : [STEP.identity, STEP.ancestry, STEP.early, STEP.class, STEP.heroic, STEP.equipment, STEP.review][oldStep] ?? STEP.review;
  }
} catch { storageAvailable = false; }

const option = (id, label, value) => `<option value="${e(id)}"${id === value ? " selected" : ""}>${e(label)}</option>`;
const select = (field, label, values, value = draft[field]) =>
  `<label>${e(label)}<select data-field="${field}">${option("", "Choose…", value)}${values.map(x => option(x.id, x.name, value)).join("")}</select></label>`;
const byId = (rows, id) => rows.find(x => x.id === id);
const cardName = id => byId(catalog.cards, id)?.name ?? id;
const button = (label, action, id, extra = "") =>
  `<button type="button" data-action="${action}" data-id="${e(id)}" ${extra}>${e(label)}</button>`;

const facts = entries => `<dl class="decision-facts">${entries.map(([name, value]) =>
  `<div><dt>${e(name)}</dt><dd>${e(value)}</dd></div>`).join("")}</dl>`;
const paragraphs = text => rulesMarkup(text.replace(/^# [^\n]+\n+/m, "").replace(/^\*\*Status:\*\*.*$/gm, "").trim());
const classPreview = x => facts([["Minimums", x.minimums.join(", ") + " ≥ 0"],
  ["Starting ranks", x.ranks.join(", ")], ["HP", `+${x.hp}`], ["Coins", `+${x.coins}`]])
  + `<p>${e(x.role)}</p><h3>Discipline costs</h3>${facts(Object.entries(x.prices).map(([name, price]) =>
    [name, price.join(" / ") + " DP"]))}<h3>Level-1 signatures</h3><p>${x.signatures
      .map(id => byId(catalog.cards, id)).filter(card => card.level === "1").map(card => e(card.name)).join(" · ")}</p>`;

function abilityReason(card, phase) {
  if (model.owned.includes(card.id)) return "Already known.";
  if (card.level !== "1") return `Available at level ${card.level}.`;
  if (card.requirement.startsWith("Class ")) {
    return phase === 0 ? "Class signatures are available after Level 0."
      : "Requires the named class.";
  }
  if (card.requirement !== "None") return `Requires ${card.requirement} before purchase.`;
  return "Review the purchase prerequisites.";
}

function identity() {
  return `<p>Give your explorer a name and assign six attributes. Use values from −2 to +2 with a combined total of +3.</p>
  <label>Explorer name<input data-field="name" value="${e(draft.name)}" maxlength="80"></label>
  <div class="attributes">${ATTRIBUTES.map(name => `<label>${name}<select data-attribute="${name}">${[-2, -1, 0, 1, 2].map(value => option(value, value > 0 ? `+${value}` : value, draft.attributes[name])).join("")}</select></label>`).join("")}</div>
  <p class="callout">Attribute total <strong>${model.attributeTotal >= 0 ? "+" : ""}${model.attributeTotal}</strong> <span>Target +3</span></p>`;
}
function ancestry() {
  const selected = model.ancestry;
  return `<p>Choose your ancestry, two traits, and a home language. Galactic Standard is already known.</p>
  <div class="lineage-grid">${catalog.ancestries.map(a => `<article class="choice-card ${a.id === draft.ancestry ? "chosen" : ""}">
    <img src="assets/lineage-${a.id}.webp" alt=""><h3>${e(a.name)}</h3>
    <p>${e(a.origin)} · +${a.hp} HP · Speed ${a.speed} · +${a.coins} coins</p>
    <div class="row-actions">${button("Read rules", "ancestry-info", a.id)}
    ${button(a.id === draft.ancestry ? "Selected" : "Choose", "ancestry", a.id, `aria-pressed="${a.id === draft.ancestry}"`)}</div></article>`).join("")}</div>
  <h3>Choose two traits <small>${draft.traits.length} / 2</small></h3>
  ${selected ? `<div class="choices trait-grid">${selected.traits.map(t =>
    `<div class="choice"><label><input type="checkbox" data-list="traits" value="${t.id}" ${draft.traits.includes(t.id) ? "checked" : ""} ${draft.traits.length === 2 && !draft.traits.includes(t.id) ? "disabled" : ""}><span>${e(t.name)}</span></label>
    ${button("Read", "trait-info", t.id, `aria-label="Read ${e(t.name)}"`)}</div>`).join("")}</div>` : "<p>Choose an ancestry to see its traits.</p>"}
  <label>Home language<input list="language-options" data-field="language" value="${e(draft.language)}" maxlength="80" placeholder="Choose or enter an ordinary language"></label>
  <datalist id="language-options">${catalog.languages.map(x => option(x, x, "")).join("")}</datalist>`;
}

function origins() {
  return `<p>Each choice grants the listed discipline rank and ability. Duplicate grants add 1 DP to Early learning.</p>
  <div class="origin-grid">${["culture", "background"].map(kind => {
    const rows = catalog[kind + "s"];
    const chosen = byId(rows, draft[kind]);
    const label = kind === "culture" ? "Culture" : "Background";
    return `<section class="choice-card">${select(kind, label, rows.map(row => ({ id: row.id,
      name: `${row.name} — ${row.rank} 1 + ${cardName(row.card)}` })))}
    ${chosen ? `<div class="origin-grants">${button(chosen.name, "origin-info", chosen.id, 'class="reference-link"')}
    <p>${e(chosen.intro)}</p><span class="grant-chip">${disciplineIcon(chosen.rank, e)}${e(chosen.rank)} 1</span>
    ${button(cardName(chosen.card), "detail", chosen.card, 'class="reference-link"')}
    <span class="grant-chip">+${chosen.coins} coins</span></div>` : ""}</section>`;
  }).join("")}</div>${model.duplicates ? `<p class="callout">Duplicate grants add <strong>+${model.duplicates} DP</strong> to Early learning.</p>` : ""}`;
}

function training(phase) {
  const purchases = model.ledger.filter(row => row.phase === phase);
  return `<p>${phase ? "Spend this separate pool on discipline ranks and eligible Novice abilities." : "Buy eligible Novice abilities using origin grants. Class grants and discipline purchases come later."} Unspent DP expires at creation.</p>
  <p class="callout"><strong>${model.remaining[phase]} / ${model.pools[phase]} DP</strong> remaining</p>
  <div class="row-actions">${button("Learn abilities", "open-picker", "ability", 'class="primary"')}
  ${phase ? button("Learn disciplines", "open-picker", "discipline") : ""}</div>
  <h3>Purchase ledger</h3>${purchases.length ? `<ol class="ledger">${purchases.map((x, index) =>
    `<li>${x.kind === "card" && x.valid ? button(x.label, "detail", x.id, 'class="reference-link"') : e(x.label)} <span>${x.valid ? `${x.price} DP` : "Needs review"}</span>${button("Remove", "remove", index)}</li>`).join("")}</ol>`
    : "<p class='muted'>No purchases yet.</p>"}`;
}
function chooseClass() {
  const current = model.profession;
  const eligible = profession => profession.minimums.every(key => draft.attributes[key] >= 0);
  const choices = [...catalog.classes].sort((a, b) => Number(eligible(b)) - Number(eligible(a)));
  return `<p>Classes you qualify for appear first. Choose two starting disciplines and one signature.</p>
  <div class="class-grid">${choices.map(x => `<article class="choice-card ${x.id === draft.classId ? "chosen" : ""}">
    <h3>${e(x.name)}</h3><p>${e(x.role)}</p><p>+${x.hp} HP · +${x.coins} coins</p>
    <p>${eligible(x) ? "Meets requirements" : `Requires ${e(x.minimums.filter(key => draft.attributes[key] < 0).join(", "))} ≥ 0`}</p>
    <div class="row-actions">${button("Read class", "class-info", x.id)}
    ${button(x.id === draft.classId ? "Selected" : "Choose", "class", x.id,
      `aria-pressed="${x.id === draft.classId}" ${eligible(x) ? "" : "disabled"}`)}</div></article>`).join("")}</div>
  ${current ? `<h3>Starting disciplines <small>${draft.startingRanks.length} / 2</small></h3>
  <div class="chips">${current.ranks.map(x => `<label><input type="checkbox" data-list="startingRanks" value="${e(x)}"
    ${draft.startingRanks.includes(x) ? "checked" : ""} ${draft.startingRanks.length === 2 && !draft.startingRanks.includes(x) ? "disabled" : ""}>
    ${e(x)} 1${model.earlyRanks[x] ? " · already known, +1 DP if chosen" : ""}</label>`).join("")}</div>
  <h3>Level-1 signature</h3><div class="signature-grid">${current.signatures.map(id => byId(catalog.cards, id)).filter(x => x?.level === "1").map(x =>
    `<article class="choice-card ${draft.signature === x.id ? "chosen" : ""}"><h3>${abilityBadges(x, e)}${e(x.name)}</h3><p>${e(x.action)} · ${e(x.attribute)} · free milestone choice</p>
    <div class="row-actions">${button("Read signature", "detail", x.id)}
    ${button(draft.signature === x.id ? "Selected" : "Choose", "select-signature", x.id, `aria-pressed="${draft.signature === x.id}"`)}</div></article>`).join("")}</div>` : ""}`;
}
function equipment() {
  const needs = gearNeeds(catalog, model.owned);
  const hands = model.equipment.flatMap((item, index) => item?.hands ? [{ id: String(index + 1), name: item.name }] : []);
  return `<p>Buy equipment with starting coins, then record what is in each hand.</p>
  <p class="callout"><strong>${model.coins - model.cost} / ${model.coins} coins</strong><span>${model.bulk} / ${model.capacity} Bulk</span></p>
  ${model.bulk > model.capacity ? "<p class='warning'>Over Capacity. Apply the book’s encumbrance ruling before recording final Speed.</p>" : ""}
  ${needs.length ? `<details class="sheet-group" open><summary>Gear for your abilities</summary>
  <p>Use your own gear, borrow from the crew, or use an alternative the ability allows.</p>
  <ul class="ledger">${needs.map(need => `<li><strong>${e(need.label)}</strong>
    <span>${model.equipment.some(item => item && supportsGearNeed(item, need.label)) ? "Carried" : "Check crew access"}</span>
    <div class="row-actions">${need.cards.map(card => button(card.name, "detail", card.id, 'class="reference-link"')).join("")}</div></li>`).join("")}</ul></details>` : ""}
  ${button("Buy inventory items", "open-picker", "equipment", 'class="primary"')}
  <h3>Carried gear</h3><ul class="ledger">${model.equipment.map((x, index) => `<li>${e(x?.name ?? "Unavailable gear")} <span>${x?.price ?? 0} coins</span>${button("Remove", "remove-gear", index)}</li>`).join("")}</ul>
  <div class="fields">${[0, 1].map(i => `<label>${i ? "Right" : "Left"} hand<select data-hand="${i}">${option("", "Empty", draft.hands[i])}${hands.map(x => option(x.id, x.name, draft.hands[i])).join("")}</select></label>`).join("")}</div>`;
}
function review() {
  return `<p>Check your choices and download a portable copy of your explorer. This is a workshop draft export.</p>
  <h3>${e(draft.name || "Unnamed explorer")} <small>Level 1</small></h3>
  <div class="fields"><div><strong>Identity</strong><p>${e(model.ancestry?.name)} · ${e(model.profession?.name)}</p><p>Galactic Standard${draft.language ? ", " + e(draft.language) : ""}</p></div>
  <div><strong>Disciplines</strong><p>${Object.entries(model.ranks).map(([d, n]) => `${e(d)} ${n}`).join(" · ") || "None yet"}</p></div></div>
  <h3>Learned abilities</h3>${actionCounts(catalog.cards.filter(x => model.owned.includes(x.id)), e)}
  <div class="catalog">${model.owned.map(id => `<article>${button(cardName(id), "detail", id, 'class="reference-link"')}
    ${abilityBadges(byId(catalog.cards, id), e)}</article>`).join("")}</div>
  <details class="sheet-group"><summary>Free universal actions</summary><div class="catalog">${catalog.cards.filter(card => card.level === "Universal")
    .map(card => `<article>${button(card.name, "detail", card.id, 'class="reference-link"')}${abilityBadges(card, e)}</article>`).join("")}</div></details>
  <details class="sheet-group"><summary>Creation ledger</summary>
  ${facts([["Early DP spent", model.pools[0] - model.remaining[0]], ["Early DP expiring", model.remaining[0]],
    ["Heroic DP spent", model.pools[1] - model.remaining[1]], ["Heroic DP expiring", model.remaining[1]],
    ["Starting coins left", model.coins - model.cost], ["Bulk / Capacity", `${model.bulk} / ${model.capacity}`]])}
  <ul class="ledger">${model.ledger.map(row => `<li>${row.phase ? "Heroic" : "Early"} · ${row.kind === "card" && row.valid ? button(row.label, "detail", row.id, 'class="reference-link"') : e(row.label)}
    <span>${row.valid ? row.price + " DP" : "Needs review"}</span></li>`).join("")}</ul></details>
  <p class="muted">Start with zero wounds and death marks. Unspent creation DP expires.</p>
  ${model.errors.length ? button("Review missing choices", "review-issues", "") : '<p class="callout"><strong>Creation complete</strong></p>'}
  ${button("Open character sheet", "sheet", "", model.errors.length ? "disabled" : 'class="primary"')}
  ${button("Download explorer JSON", "export", "", `class="primary" ${model.errors.length ? "disabled" : ""}`)}
  ${button("Start another draft", "reset", "")}`;
}
const renderers = [identity, ancestry, origins, () => training(0), chooseClass, () => training(1), equipment, review];

function persist() {
  try { localStorage.setItem(key, JSON.stringify({ builderVersion: 2, draft, step, play, mode, tab, saveId })); }
  catch { storageAvailable = false; }
}

function library() {
  const entries = JSON.parse(localStorage.getItem(libraryKey) ?? "[]");
  if (!Array.isArray(entries) || entries.some(x => !x || typeof x.id !== "string" || typeof x.name !== "string" || !x.character)) {
    throw new Error("The character library is unreadable. Its contents were preserved.");
  }
  return entries;
}

function equip(hands, items, side, value) {
  const item = items[Number(value) - 1];
  hands[side] = value;
  if (item?.hands === 2) hands[1 - side] = value;
  else if (value && hands[1 - side] === value) hands[1 - side] = "";
  else if (items[Number(hands[1 - side]) - 1]?.hands === 2) hands[1 - side] = "";
}

const issueList = issues => issues.length
  ? `<aside class="warning" aria-label="Choices to review"><strong>Choices to review</strong><ul>${issues.map(issue =>
    `<li>${e(issue.message)}${step === STEP.review ? " " + button("Go to step", "step", issue.stage) : ""}</li>`).join("")}</ul></aside>` : "";

function closePopup() {
  const closing = popup;
  popup = closing?.returnTo ?? null;
  render(popup ? "#picker-search" : closing?.restore);
}

function render(focusSelector) {
  model = evaluate(draft, catalog);
  persist();
  const errors = step === STEP.review ? model.errors : model.errors.filter(x => x.stage === step);

  dev = play ? advancement(play, model, catalog) : null;
  const toolbar = `<div class="workshop-toolbar" aria-label="Character files">
    ${button("New", "reset", "")}${button("Save", "save", "")}${button("Load", "library", "")}
    ${button("Import JSON", "import", "")}${button("Export JSON", "export", "", model.errors.length ? "disabled" : "")}
    ${mode === "sheet" ? button("Edit creation", "builder", "") : play ? button("Character sheet", "sheet", "") : ""}
    <input id="import-file" type="file" accept=".json,application/json" hidden></div>`;
  const builder = `<div class="shell"><nav aria-label="Creation steps"><div class="eyebrow">CREW MANIFEST / 01</div>
    ${steps.map((title, i) => `<button type="button" data-action="step" data-id="${i}" ${i === step ? 'aria-current="step"' : ""}><span>0${i + 1}</span>${title}</button>`).join("")}</nav>
    <section class="stage"><div class="eyebrow">EXPLORER CREATION / STEP 0${step + 1}</div><h1 tabindex="-1">${steps[step]}</h1>
    ${renderers[step]()}
    <div id="step-issues">${issueList(errors)}</div>
    <footer class="controls">${step ? button("← Back", "step", step - 1) : "<span></span>"}${step < STEP.review ? button("Continue →", "continue", step + 1, 'class="primary"') : ""}</footer></section>
    <aside class="summary"><div class="eyebrow">LIVE CHARACTER</div>
    ${model.ancestry ? `<img class="portrait" src="assets/lineage-${model.ancestry.id}.webp" alt="">` : '<div class="placeholder" aria-hidden="true">◈</div>'}
    <h2>${e(draft.name || "New explorer")}</h2><p>${e([model.ancestry?.name, model.profession?.name].filter(Boolean).join(" · ") || "Level 1 draft")}</p>
    <dl><div><dt>HP</dt><dd>${model.hp}</dd></div><div><dt>Base Speed</dt><dd>${model.speed}</dd></div><div><dt>Grit</dt><dd>${model.grit}</dd></div><div><dt>Coins</dt><dd>${model.coins - model.cost}</dd></div></dl>
    <p class="muted">${storageAvailable ? "Draft saved in this browser." : "Browser storage is unavailable."}</p></aside></div>
    `;
  const oldPickerResults = app.querySelector(".picker-results");
  const pickerScroll = oldPickerResults?.scrollTop ?? popup?.scroll ?? 0;
  const picker = popup?.picker;
  const modalBody = picker ? builderPicker({ kind: picker, phase: step === STEP.early ? 0 : 1,
    query: pickerQuery, catalog, model, e, button, abilityReason, filter: disciplineFilter, development: mode === "sheet" ? dev : null }) : popup?.body;
  const modal = `<dialog id="ability-detail" class="${picker ? "picker-dialog" : ""}" aria-labelledby="ability-title">${popup ? `<h2 id="ability-title">${e(popup.title)}</h2>
    ${modalBody}<div class="dialog-actions">${popup.returnTo ? button("Back to choices", "picker-back", "") : ""}
    ${button("Close", "close-popup", "")}
    ${popup.confirm ? button(popup.confirm.label, popup.confirm.action, popup.confirm.id, 'class="primary"') : ""}</div>` : ""}</dialog>`;
  app.innerHTML = toolbar + (mode === "sheet" ? sheet({ draft, play, model, dev, catalog, tab, e, button, facts }) : builder) + modal;
  if (popup) {
    const dialog = app.querySelector("dialog");
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      closePopup();
    });
    dialog.showModal();
    if (picker) dialog.querySelector(".picker-results").scrollTop = pickerScroll;
  }
  if (focusSelector) app.querySelector(focusSelector)?.focus();
}

app.addEventListener("change", event => {
  const input = event.target;
  if (input.id === "discipline-filter") {
    disciplineFilter = input.value;
    render("#discipline-filter");
    return;
  }
  if (input.id === "import-file") {
    const file = input.files[0];
    if (!file) return;
    void (async () => {
      try {
        if (file.size > 2_000_000) throw new Error("The character file is too large.");
        const imported = readPortable(JSON.parse(await file.text()));
        draft = imported.draft; play = imported.play; saveId = null; popup = null;
        mode = play && !evaluate(draft, catalog).errors.length ? "sheet" : "builder";
        step = STEP.review; tab = "Main"; render("h1");
      } catch (error) { popup = { title: "Import failed", body: `<p>${e(error.message)}</p>` }; render(); }
    })();
    return;
  }
  if (input.dataset.playHand !== undefined) {
    equip(play.hands, play.items.map(id => byId(catalog.equipment, id)), Number(input.dataset.playHand), input.value);
    render(`[data-play-hand="${input.dataset.playHand}"]`);
    return;
  }
  if (input.dataset.playField === "coins") {
    if (Number.isInteger(input.valueAsNumber) && input.valueAsNumber >= 0) play.coins = input.valueAsNumber;
    render('[data-play-field="coins"]');
    return;
  }
  const { field, attribute, list, hand } = input.dataset;
  if (field && input.type !== "text") draft[field] = input.value;
  else if (attribute) draft.attributes[attribute] = Number(input.value);
  else if (list) draft[list] = input.checked ? [...draft[list], input.value] : draft[list].filter(x => x !== input.value);
  else if (hand !== undefined) {
    equip(draft.hands, model.equipment, Number(hand), input.value);
  } else return;
  const focus = field ? `[data-field="${field}"]` : attribute ? `[data-attribute="${attribute}"]`
    : list ? `[data-list="${list}"][value="${CSS.escape(input.value)}"]` : `[data-hand="${hand}"]`;
  render(focus);
});

app.addEventListener("input", event => {
  const input = event.target;
  if (input.dataset.playField === "notes") { play.notes = input.value; persist(); return; }
  if (input.dataset.field && input.type === "text") {
    draft[input.dataset.field] = input.value;
    model = evaluate(draft, catalog);
    app.querySelector("#step-issues").innerHTML = issueList(model.errors.filter(issue => issue.stage === step));
    persist();
    if (input.dataset.field === "name") app.querySelector(".summary h2").textContent = input.value || "New explorer";
    return;
  }
  if (input.id !== "picker-search") return;
  pickerQuery = input.value;
  const caret = input.selectionStart;
  render("#picker-search");
  if (caret !== null) app.querySelector("#picker-search").setSelectionRange(caret, caret);
});

app.addEventListener("click", event => {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;
  const { action, id } = trigger.dataset;
  const purchases = step === STEP.early ? draft.level0 : draft.level1;
  const restore = `[data-action="${action}"][data-id="${CSS.escape(id)}"]`;
  const open = (title, body, confirm) => {
    if (popup?.picker) popup.scroll = app.querySelector(".picker-results")?.scrollTop ?? 0;
    popup = { title, body, confirm, restore, returnTo: popup?.picker ? popup : undefined };
    render();
  };
  const showVerification = rows => open("Review these choices", `<ul class="verify-list">${rows.map(row =>
    `<li><strong>${e(steps[row.stage])}</strong> · ${e(row.message)} ${button("Go to step", "step", row.stage)}</li>`).join("")}</ul>`);
  switch (action) {
    case "builder": popup = null; mode = "builder"; step = STEP.review; render("h1"); return;
    case "sheet":
      if (model.errors.length) { showVerification(model.errors); return; }
      if (!play) { play = createPlay(model); play.hands = [...draft.hands]; }
      play.hp = Math.min(play.hp, model.hp);
      popup = null; mode = "sheet"; render("h1"); return;
    case "sheet-tab": tab = id; render(restore); return;
    case "save":
      open("Save character", `<label>Save name<input id="save-name" maxlength="80" value="${e(draft.name || "New explorer")}"></label>
        <p>Save this character and its current play record to this browser.</p>
        ${saveId ? button("Save as copy", "confirm-save", "copy") : ""}`,
        { label: saveId ? "Update saved character" : "Save character", action: "confirm-save", id: "" }); return;
    case "confirm-save": {
      const name = app.querySelector("#save-name").value.trim();
      if (!name) return;
      try {
        const entries = library();
        const recordId = id === "copy" || !saveId ? crypto.randomUUID() : saveId;
        const character = portable(draft, play);
        localStorage.setItem(libraryKey, JSON.stringify([...entries.filter(x => x.id !== recordId), { id: recordId, name, character }]));
        saveId = recordId;
        open("Character saved", `<p>${e(name)} is available from Load.</p>`);
      } catch (error) { open("Save failed", `<p>${e(error.message)}</p>`); }
      return;
    }
    case "library":
      try {
        open("Load a character", `<div class="catalog">${library().map(x => `<article><strong>${e(x.name)}</strong>
        <div class="row-actions">${button("Load", "load-save", x.id)}${button("Delete", "delete-save", x.id)}</div></article>`).join("") || "<p>No named saves yet.</p>"}</div>`);
      } catch (error) { open("Library unavailable", `<p>${e(error.message)}</p>`); }
      return;
    case "load-save": {
      const record = library().find(x => x.id === id);
      if (!record) return;
      try {
        const imported = readPortable(record.character);
        draft = imported.draft; play = imported.play; saveId = id; popup = null;
        mode = play && !evaluate(draft, catalog).errors.length ? "sheet" : "builder";
        step = STEP.review; tab = "Main"; render("h1");
      } catch (error) { open("Load failed", `<p>${e(error.message)}</p>`); }
      return;
    }
    case "delete-save": open("Delete this saved character?", "<p>Your open draft remains available.</p>",
      { label: "Delete saved copy", action: "confirm-delete", id }); return;
    case "confirm-delete":
      localStorage.setItem(libraryKey, JSON.stringify(library().filter(x => x.id !== id)));
      if (saveId === id) saveId = null;
      popup = null; break;
    case "import": app.querySelector("#import-file").click(); return;
    case "step": popup = null; step = Number(id); pickerQuery = ""; render("h1"); return;
    case "continue": {
      const issues = model.errors.filter(x => x.stage === step);
      if (issues.length) { showVerification(issues); return; }
      popup = null; step = Number(id); pickerQuery = ""; render("h1"); return;
    }
    case "review-issues": showVerification(model.errors); return;
    case "trait-info": {
      const trait = model.ancestry?.traits.find(x => x.id === id);
      if (trait) open(trait.name, `<p>${e(trait.text)}</p>`);
      return;
    }
    case "ancestry-info": {
      const x = byId(catalog.ancestries, id);
      open(x.name, facts([["Origin", x.origin], ["HP", `+${x.hp}`], ["Base Speed", x.speed], ["Coins", `+${x.coins}`]])
        + `<pre>${paragraphs(x.overview)}</pre>`);
      return;
    }
    case "origin-info": {
      const x = byId([...catalog.cultures, ...catalog.backgrounds], id);
      const other = byId([...catalog.cultures, ...catalog.backgrounds], id === draft.culture ? draft.background : draft.culture);
      const duplicate = Number(other?.rank === x.rank) + Number(other?.card === x.card);
      open(x.name, facts([["Discipline", `${x.rank} 1`], ["Ability", cardName(x.card)],
        ["Coins", `+${x.coins}`], ["Duplicate grant DP", duplicate]]) + `<pre>${paragraphs(x.text)}</pre>`
        + `<details><summary>Read ${e(cardName(x.card))}</summary><pre>${rulesMarkup(byId(catalog.cards, x.card).text)}</pre></details>`);
      return;
    }
    case "class-info": {
      const x = byId(catalog.classes, id);
      open(x.name, classPreview(x));
      return;
    }
    case "ancestry": if (draft.ancestry !== id) { draft.ancestry = id; draft.traits = []; } break;
    case "select-signature": draft.signature = id; break;
    case "class": if (draft.classId !== id) { draft.classId = id; draft.startingRanks = []; draft.signature = ""; } break;
    case "open-picker": {
      const titles = { ability: "Learn abilities", discipline: "Learn disciplines", equipment: "Buy inventory items" };
      pickerQuery = "";
      disciplineFilter = "all";
      popup = { title: titles[id], picker: id, restore };
      render("#picker-search");
      return;
    }
    case "close-popup":
    case "picker-back": closePopup(); return;
    case "detail": {
      const card = byId(catalog.cards, id);
      const cost = mode === "builder" && step === STEP.class && card.level === "1"
        ? "Free as your milestone choice" : card.level === "Universal" ? "Universal" : `${card.dp} DP`;
      open(card.name, facts([["Action", card.action], ["Attribute", card.attribute], ["Requirement", card.requirement], ["Cost", cost]])
        + `<pre>${rulesMarkup(card.text)}</pre>`);
      return;
    }
    case "picker-buy-card": {
      if (mode === "sheet") {
        const card = byId(dev.eligible, id);
        if (card && card.dp <= dev.remaining) play.levels.at(-1)?.purchases.push({ kind: "card", id });
        break;
      }
      const choices = step === STEP.early ? model.level0Choices : model.level1Choices;
      const card = byId(choices, id);
      if (card && card.dp <= model.remaining[step === STEP.early ? 0 : 1]) purchases.push({ kind: "card", id });
      break;
    }
    case "picker-buy-rank": {
      if (mode === "sheet") {
        const cost = model.profession?.prices[id]?.[dev.ranks[id] ?? 0];
        if (cost <= dev.remaining) play.levels.at(-1)?.purchases.push({ kind: "rank", id });
        break;
      }
      const cost = model.profession?.prices[id]?.[model.ranks[id] ?? 0];
      if (cost <= model.remaining[1]) purchases.push({ kind: "rank", id });
      break;
    }
    case "remove": purchases.splice(Number(id), 1); break;
    case "market-read": {
      const item = byId(catalog.equipment, id);
      open(item.name, facts([["Cost", `${item.price} coins`], ["Bulk", item.bulk], ["Hands", item.hands]])
        + `<pre>${rulesMarkup(item.text)}</pre>`);
      return;
    }
    case "market-buy": {
      const item = byId(catalog.equipment, id);
      if (!equipmentEligibility(item, model.owned)) return;
      const quantity = app.querySelector(`#quantity-${CSS.escape(id)}`).valueAsNumber;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 200 - draft.gear.length || quantity * item.price > model.coins - model.cost) {
        open("Review quantity", "<p>Choose a positive quantity you can afford with your remaining starting coins.</p>");
        return;
      }
      draft.gear.push(...Array(quantity).fill(id));
      break;
    }
    case "remove-gear": {
      const slot = Number(id) + 1;
      draft.gear.splice(slot - 1, 1);
      draft.hands = draft.hands.map(x => Number(x) === slot ? "" : Number(x) > slot ? String(Number(x) - 1) : x);
      break;
    }
    case "favorite":
      play.favorites = play.favorites.includes(id) ? play.favorites.filter(x => x !== id) : [...play.favorites, id]; break;
    case "attribute-roll":
    case "sheet-roll":
    case "death": {
      const card = action === "sheet-roll" ? byId(catalog.cards, id) : null;
      const attribute = action === "death" ? "Fortitude" : card?.attribute ?? id;
      const poison = play.conditions.find(c => c.name === "Poisoned")?.rating ?? 0;
      open(action === "death" ? "Death roll" : card?.name ?? attribute,
        facts([["Attribute", `${attribute} ${draft.attributes[attribute]}`], ["Automatic Banes", poison]])
        + `<div class="fields"><label>Other Boons<input id="roll-boons" type="number" min="0" max="20" value="0"></label>
        <label>Other Banes<input id="roll-banes" type="number" min="0" max="20" value="0"></label></div>
        <p>Include applicable wounds, gear and circumstances in the roll. Boons and Banes cancel before the three-die cap.</p>`,
        { label: "Roll dice", action: "confirm-roll", id: action === "death" ? "death" : card ? `card:${id}` : attribute });
      return;
    }
    case "confirm-roll": {
      const card = id.startsWith("card:") ? byId(catalog.cards, id.slice(5)) : null;
      const attribute = id === "death" ? "Fortitude" : card?.attribute ?? id;
      const modifier = selector => Math.max(0, Math.trunc(Number(app.querySelector(selector).value) || 0));
      const poison = play.conditions.find(c => c.name === "Poisoned")?.rating ?? 0;
      const result = roll(draft.attributes[attribute], modifier("#roll-boons") - modifier("#roll-banes") - poison);
      if (id === "death") deathRoll(play, result);
      const resultText = result.fumble ? "Weak · natural 111" : result.critical ? "Strong · natural 666" : result.band;
      open(resultText, facts([["Rolled", result.dice.join(" · ")], ["Kept", result.kept.join(" · ")],
        ["Attribute", attribute], ["Total", result.total]])
        + (id === "death" ? `<p>State: ${e(play.state)} · ${play.marks} death marks.</p>` : "")
        + (card ? `<pre>${rulesMarkup(card.text)}</pre>` : ""));
      return;
    }
    case "damage":
      open("Apply damage", `<label>HP damage after resistance and cover<input type="number" id="hp-change" min="1" value="1"></label>
        <label>Wound family if the damage causes a wound<select id="wound-family">${Object.keys(catalog.wounds).map(x => option(x, x, "")).join("")}</select></label>
        <p>Use the type that dealt the most damage after resistance. Choose on ties.</p>`,
        { label: "Apply damage", action: "confirm-damage", id: "" }); return;
    case "confirm-damage": {
      const amount = app.querySelector("#hp-change").valueAsNumber;
      const family = app.querySelector("#wound-family").value;
      if (!Number.isInteger(amount) || amount < 1) return;
      const before = play.wounds.length;
      takeDamage(play, amount, family, catalog.wounds);
      if (play.wounds.length > before) {
        const wound = play.wounds.at(-1);
        open(`${wound.family} wound · ${wound.code}`, facts([["Roll", wound.dice.join(" · ")],
          ["Injury", wound.injury], ["Effects", wound.effects], ["Remedy", wound.remedy], ["RV", wound.rv]])
          + "<p>Resolve any immediate movement and conditions at the table. The wound remains recorded.</p>");
        return;
      }
      popup = null; break;
    }
    case "heal":
      open("Restore HP", '<label>Actual HP healed after any Life resistance<input id="hp-change" type="number" min="1" value="1"></label>',
        { label: "Apply healing", action: "confirm-heal", id: "" }); return;
    case "confirm-heal": {
      const amount = app.querySelector("#hp-change").valueAsNumber;
      if (!Number.isInteger(amount) || amount < 1) return;
      restoreHP(play, amount, model.hp); popup = null; break;
    }
    case "breath":
      open("Take a safe breath", "<p>Resolve Dying before resting. A safe breath restores HP and leaves Grit and wounds as recorded.</p>",
        play.state === "active" ? { label: "Restore full HP", action: "confirm-breath", id: "" } : undefined); return;
    case "confirm-breath": restoreHP(play, model.hp, model.hp); popup = null; break;
    case "grit":
      open("Spend Grit", "<p>At the start of this Dying turn, spend one Grit instead of making a death roll to restore full HP.</p>",
        { label: "Spend one Grit", action: "confirm-grit", id: "" }); return;
    case "confirm-grit":
      if (play.state === "dying" && play.spentGrit < dev.grit) { play.spentGrit++; restoreHP(play, model.hp, model.hp); }
      popup = null; break;
    case "stabilize":
      if (play.state === "dying") { play.state = "stable"; play.marks = 0; }
      break;
    case "last-turn":
      if (play.state === "last-words" && --play.lastWords <= 0) play.state = "dead";
      break;
    case "condition-add":
      open("Record condition", `<label>Condition<select id="condition-name">${catalog.conditions.map(x => option(x.name, x.name, "")).join("")}</select></label>
        <label>Rating if numbered<input type="number" id="condition-rating" min="1" max="99" value="1"></label>
        <label class="radio"><input id="condition-persistent" type="checkbox"> Persistent or maintained</label>`,
        { label: "Add condition", action: "confirm-condition", id: "" }); return;
    case "confirm-condition": {
      const name = app.querySelector("#condition-name").value;
      const definition = catalog.conditions.find(x => x.name === name);
      const rating = definition.numbered ? app.querySelector("#condition-rating").valueAsNumber : 0;
      if (!Number.isInteger(rating) || (definition.numbered && (rating < 1 || rating > 99))) return;
      play.conditions = [...play.conditions.filter(x => x.name !== name),
        { name, rating, persistent: app.querySelector("#condition-persistent").checked }];
      popup = null; break;
    }
    case "condition-read": {
      const condition = play.conditions[Number(id)];
      const definition = catalog.conditions.find(x => x.name === condition.name);
      if (definition) open(definition.name, facts([["Effect", definition.effect], ["Removal", definition.removal]]));
      return;
    }
    case "condition-remove": play.conditions.splice(Number(id), 1); break;
    case "item-read":
    case "item-add": {
      const item = byId(catalog.equipment, action === "item-add" ? app.querySelector("#sheet-item").value : id);
      if (!item) return;
      open(item.name, facts([["Bulk", item.bulk], ["Hands", item.hands]])
        + (item.requiredAbility ? `<p>Training: ${button(cardName(item.requiredAbility), "detail", item.requiredAbility, 'class="reference-link"')}</p>` : "")
        + `<pre>${rulesMarkup(item.text)}</pre>`,
        action === "item-add" && equipmentEligibility(item, dev.known) ? { label: "Record item", action: "confirm-item", id: item.id } : undefined); return;
    }
    case "confirm-item": {
      const item = byId(catalog.equipment, id);
      if (item && equipmentEligibility(item, dev.known)) play.items.push(id);
      popup = null; break;
    }
    case "item-remove": removeItem(play, Number(id)); break;
    case "dose": {
      const index = Number(id);
      const item = byId(catalog.equipment, play.items[index]);
      const eligible = play.state === "active" && play.hp < model.hp && play.hands.filter(Boolean).length < 2;
      open(item.name, `<p>Spend a Maneuver and use a free hand to restore ${MEDICAL_DOSES[item.id]} HP before Life resistance.
        The dose checks its inventory d4 after healing.</p>
        ${eligible ? '<label>Life resistance<input id="life-resistance" type="number" min="0" max="3" value="0"></label>'
          : "<p>This explorer needs missing HP, a free hand, and the ability to act.</p>"}`,
        eligible ? { label: "Use dose on self", action: "confirm-dose", id } : undefined);
      return;
    }
    case "confirm-dose": {
      const resistance = Math.max(0, Math.min(3, Math.trunc(Number(app.querySelector("#life-resistance").value) || 0)));
      const result = useMedicalDose(play, Number(id), model.hp, resistance);
      if (result) open("Medical dose used", facts([["HP restored", result.amount], ["Inventory d4", result.face],
        ["Supply", result.face === 1 ? "Empty after this use" : "Still available"]]));
      return;
    }
    case "language-add": {
      const language = app.querySelector("#extra-language").value.trim();
      if (language && !play.languages.includes(language)) play.languages.push(language);
      break;
    }
    case "wound": {
      const w = play.wounds[Number(id)];
      open(`${w.family} wound · ${w.code}`, facts([["Injury", w.injury], ["Effects", w.effects], ["Remedy", w.remedy],
        ["RV", w.rv], ["Progress", w.progress]]) + (Number(w.rv) > 0 ? `<p>Record a completed treatment attempt with the matching capability. Use at most one attempt per wound per day.</p>
        <div class="fields"><label>Campaign day<input id="treatment-day" type="number" min="1" value="${(w.treatmentDay ?? 0) + 1}"></label>
        <label>Treatment outcome<select id="treatment-result"><option value="1">Weak · 1</option><option value="2">Standard · 2</option><option value="3">Strong · 3</option></select></label></div>` : ""),
        Number(w.rv) > w.progress ? { label: "Record treatment", action: "treat-wound", id } : undefined); return;
    }
    case "treat-wound": {
      const w = play.wounds[Number(id)];
      const day = app.querySelector("#treatment-day").valueAsNumber;
      if (!Number.isInteger(day) || day <= (w.treatmentDay ?? 0)) return;
      w.progress = Math.min(Number(w.rv), w.progress + Number(app.querySelector("#treatment-result").value));
      w.treatmentDay = day; popup = null; break;
    }
    case "level-up": {
      const level = dev.level + 1;
      open(`Advance to level ${level}`, `<p>Gain ${8 + level + Number(level === 3 && model.traits.some(t => t.level0DP))} DP. HP stays the same.
        ${[3, 7].includes(level) ? "Gain one Grit and choose a milestone signature." : ""}</p>`,
        { label: "Advance", action: "confirm-level", id: "" }); return;
    }
    case "confirm-level": play.levels.push({ signature: "", purchases: [] }); popup = null; break;
    case "milestone": {
      const card = byId(catalog.cards, id);
      open(card.name, `<p>Choose this as your free level-${dev.level} class signature.</p><pre>${rulesMarkup(card.text)}</pre>`,
        { label: "Choose signature", action: "confirm-milestone", id }); return;
    }
    case "confirm-milestone": play.levels.at(-1).signature = id; popup = null; break;
    case "remove-advancement": {
      const [level, index] = id.split(":").map(Number);
      play.levels[level - 2].purchases.splice(index, 1); break;
    }
    case "export": {
      if (model.errors.length) return;
      const data = portable(draft, play);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "gol-explorer.json"; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    case "reset":
      if (!confirm("Replace the saved draft?")) return;
      draft = createDraft(); play = null; saveId = null; mode = "builder"; step = 0; popup = null; render("h1"); return;
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
