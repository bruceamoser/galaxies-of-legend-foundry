import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createDraft } from "../src/rules/creation.mjs";
import { advancement, createPlay, deathRoll, restoreHP, roll, takeDamage } from "../src/rules/play.mjs";
import { portable, readPortable } from "../src/rules/portable.mjs";

const catalog = JSON.parse(readFileSync(new URL("../web/data/catalog.json", import.meta.url)));
const model = { hp: 16, equipment: [], coins: 59, cost: 0, ranks: { Science: 1 }, owned: [],
  profession: catalog.classes.find(x => x.id === "technician"), traits: [], grit: 2 };

test("retains correct dice after cancellation and respects natural bands", () => {
  const faces = [1, 2, 3, 6];
  assert.deepEqual(roll(1, 1, () => faces.shift()).kept, [6, 3, 2]);
  const low = [1, 2, 3, 6];
  assert.deepEqual(roll(1, -1, () => low.shift()).kept, [1, 2, 3]);
  assert.equal(roll(-20, 0, () => 6).band, "Strong");
});

test("Dying records the wound once and healing preserves scars and spent Grit", () => {
  const play = createPlay(model);
  takeDamage(play, 16, "Physical", catalog.wounds, () => 1);
  assert.equal(play.state, "dying");
  assert.equal(play.wounds[0].code, "111");
  takeDamage(play, 1, "Physical", catalog.wounds, () => 1);
  assert.equal(play.wounds.length, 1);
  assert.equal(play.marks, 1);
  deathRoll(play, { band: "Strong" });
  assert.equal(play.state, "stable");
  takeDamage(play, 1, "Physical", catalog.wounds, () => 2);
  assert.equal(play.wounds[1].dice.length, 4);
  assert.equal(play.marks, 1);
  play.spentGrit = 1;
  restoreHP(play, 20, model.hp);
  assert.equal(play.hp, 16);
  assert.equal(play.spentGrit, 1);
  assert.equal(play.wounds.length, 2);
});

test("advancement carries DP, grants milestone Grit, and preserves the chosen signature", () => {
  const play = createPlay(model);
  play.levels = [{ signature: "", purchases: [] }, {
    signature: "signature-technician-remote-hands", purchases: [{ kind: "rank", id: "Science" }],
  }];
  const result = advancement(play, model, catalog);
  assert.equal(result.level, 3);
  assert.equal(result.total, 21);
  assert.equal(result.remaining, 17);
  assert.equal(result.grit, 3);
  assert.equal(result.ranks.Science, 2);
  assert.ok(result.known.includes("signature-technician-remote-hands"));
  assert.deepEqual(result.issues, []);
});

test("portable records preserve play and reject malformed choices", () => {
  const draft = createDraft();
  const play = createPlay(model);
  const json = JSON.parse(JSON.stringify(portable(draft, play)));
  assert.deepEqual(readPortable(json), { draft, play });
  assert.throws(() => readPortable({ ...json, choices: { ...draft, level0: [null] } }));
});

test("the final dose heals before its inventory die empties", async () => {
  const { useMedicalDose } = await import("../src/rules/play.mjs");
  const play = createPlay(model);
  play.hp = 6;
  play.items = ["basic-medical-dose", "toolkit"];
  play.hands = ["2", ""];
  assert.deepEqual(useMedicalDose(play, 0, model.hp, 1, () => 1), { amount: 5, face: 1 });
  assert.deepEqual(play.items, ["toolkit"]);
  assert.deepEqual(play.hands, ["1", ""]);
  assert.equal(play.hp, 11);
});
