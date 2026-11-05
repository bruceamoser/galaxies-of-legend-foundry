import { ATTRIBUTES, createDraft } from "./creation.mjs";

export const portable = (choices, play) => ({ format: "gol-workshop-v2", choices, play });
export function readPortable(value) {
  if (!["gol-workshop-v1", "gol-workshop-v2"].includes(value?.format)) {
    throw new Error("Choose a GoL workshop JSON export.");
  }
  const draft = { ...createDraft(), ...value.choices };
  const text = ["name", "pronouns", "ancestry", "culture", "background", "language", "classId", "signature"];
  const list = ["traits", "startingRanks", "gear", "hands"];
  const purchases = rows => Array.isArray(rows) && rows.length <= 200 && rows.every(row =>
    row && ["card", "rank"].includes(row.kind) && typeof row.id === "string");
  if (!text.every(key => typeof draft[key] === "string") ||
      !ATTRIBUTES.every(key => Number.isInteger(draft.attributes?.[key]) && Math.abs(draft.attributes[key]) <= 2) ||
      !list.every(key => Array.isArray(draft[key]) && draft[key].length <= 200 && draft[key].every(x => typeof x === "string")) ||
      draft.hands.length !== 2 || !purchases(draft.level0) || !purchases(draft.level1)) {
    throw new Error("The character file contains invalid creation choices.");
  }
  const play = value.play ?? null;
  if (play && (!Array.isArray(play.levels) || play.levels.length > 9 ||
      !play.levels.every(row => row && typeof row.signature === "string" && purchases(row.purchases)) ||
      !["active", "stable", "dying", "last-words", "dead"].includes(play.state) ||
      !Number.isInteger(play.hp) || play.hp < 0 || !Number.isInteger(play.spentGrit) || play.spentGrit < 0 ||
      !Number.isInteger(play.marks) || play.marks < 0 || play.marks > 4 ||
      !["wounds", "conditions", "items", "hands", "languages", "favorites"].every(key => Array.isArray(play[key])) ||
      !Number.isInteger(play.coins) || play.coins < 0 || typeof play.notes !== "string" ||
      !play.wounds.every(w => w && typeof w.injury === "string" && typeof w.code === "string") ||
      !play.conditions.every(c => c && typeof c.name === "string" && Number.isInteger(c.rating)) ||
      !["items", "hands", "languages", "favorites"].every(key => play[key].every(x => typeof x === "string")))) {
    throw new Error("The character file contains an invalid play record.");
  }
  return { draft, play };
}
