import test from "node:test";
import assert from "node:assert/strict";
import { scoreGrowth, GROWTH_FACTORS } from "./growth.mjs";

const docs = { N0: { title: "수주 기사" }, D0: { title: "공급계약 공시" } };
const resolve = (id) => docs[id] ?? null;

test("score is computed from signals, not from the AI", () => {
  const r = scoreGrowth({ score: 99, factors: [{ key: "orders", signal: 2, summary: "수주", evidence: ["D0"] }, { key: "demand", signal: 1, summary: "수요", evidence: ["N0"] }] }, resolve);
  assert.equal(r.factors.length, GROWTH_FACTORS.length);
  assert.equal(r.score, Math.round(50 + (3 / 6) * 25)); // 63, AI가 준 99는 무시
  assert.equal(r.basedOn, 2);
});

test("a signal without real evidence is forced to neutral", () => {
  const r = scoreGrowth({ factors: [{ key: "policy", signal: -2, summary: "규제", evidence: ["N9"] }] }, resolve);
  assert.equal(r.factors.find((f) => f.key === "policy").signal, 0);
  assert.equal(r.score, null);
  assert.equal(r.label, "판단 근거 부족");
});

test("signals are clamped to -2..2 and unknown keys are dropped", () => {
  const r = scoreGrowth({ factors: [{ key: "headwind", signal: -7, evidence: ["N0"] }, { key: "rocket", signal: 2, evidence: ["N0"] }] }, resolve);
  assert.equal(r.factors.find((f) => f.key === "headwind").signal, -2);
  assert.ok(!r.factors.some((f) => f.key === "rocket"));
  assert.equal(r.score, Math.round(50 + (-2 / 6) * 25));
});
