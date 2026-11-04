import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createDraft, evaluate } from "../src/rules/creation.mjs";

const catalog = JSON.parse(readFileSync(new URL("../web/data/catalog.json", import.meta.url)));
const iona = () => ({
  ...createDraft(), name: "Iona", ancestry: "human", traits: ["human-4", "human-5"],
  culture: "culture-service-cooperative", background: "background-ship-mechanic",
  language: "Junction Portspeech", classId: "technician", startingRanks: ["Robotics", "Computing"],
  signature: "signature-technician-diagnostic-pass",
  level0: [{ kind: "card", id: "keep-it-running" }, { kind: "card", id: "quick-study" }],
  level1: [{ kind: "rank", id: "Science" }, { kind: "card", id: "sensor-sweep" }],
  gear: ["toolkit"],
});
test("reproduces the worked explorer", () => {
  const result = evaluate(iona(), catalog);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.pools, [13, 12]);
  assert.deepEqual(result.remaining, [10, 8]);
  assert.equal(result.hp, 16);
  assert.equal(result.speed, 7);
  assert.equal(result.grit, 2);
  assert.equal(result.coins - result.cost, 19);
  assert.equal(result.ranks.Engineering, 1);
});
test("a purchase cannot use a future rank or spend a different pool", () => {
  const draft = iona();
  draft.level1.reverse();
  const result = evaluate(draft, catalog);
  assert.ok(result.errors.some(x => x.message.includes("Sensor Sweep")));
  assert.ok(!result.owned.includes("sensor-sweep"));
});
test("all classes have three level-one signature choices", () => {
  for (const profession of catalog.classes) {
    assert.equal(catalog.cards.filter(card => card.level === "1" && profession.signatures.includes(card.id)).length, 3);
    for (const d of catalog.disciplines) assert.equal(profession.prices[d].length, 3);
  }
});

test("ancestry and origin validation route to separate builder steps", async () => {
  const { STEP } = await import("../src/rules/creation.mjs");
  const draft = { ...iona(), language: "", culture: "" };
  const result = evaluate(draft, catalog);
  assert.ok(result.errors.some(x => x.stage === STEP.ancestry && x.message.includes("language")));
  assert.ok(result.errors.some(x => x.stage === STEP.origins && x.message.includes("culture")));
  assert.equal(result.earlyRanks.Engineering, 1);
  assert.equal(result.earlyRanks.Science, undefined);
});
