import test from "node:test";
import assert from "node:assert/strict";
import { computeFearGreed, computeStockFearGreed, labelFor } from "./fearGreed.mjs";

// 합성 데이터: 평온한 상승장 뒤에 급락 구간을 붙여 점수 방향을 확인합니다.
function series(days, f) {
  const out = [];
  for (let i = 0; i < days; i++) out.push({ date: String(20240101 + i), value: f(i) });
  return out;
}

const DAYS = 450;
const crashAt = 430;
const kospiUp = (i) => 2500 + i * 2 + Math.sin(i) * 3;
const kospiCrash = (i) => (i < crashAt ? kospiUp(i) : kospiUp(crashAt) * (1 - 0.03 * (i - crashAt)) + (i % 2 ? 40 : -40));

test("returns null when history is too short", () => {
  const s = series(100, kospiUp);
  assert.equal(computeFearGreed({ kospi: s, foreign: s, ktb3: s, bbb: s }), null);
});

test("steady rally scores greedier than a crash", () => {
  const ktb3 = series(DAYS, () => 3.0);
  const bbbCalm = series(DAYS, () => 9.0);
  const bbbStress = series(DAYS, (i) => (i < crashAt ? 9.0 : 9.0 + (i - crashAt) * 0.05));
  const calm = computeFearGreed({
    kospi: series(DAYS, kospiUp),
    foreign: series(DAYS, () => 500),
    ktb3,
    bbb: bbbCalm,
  });
  const crash = computeFearGreed({
    kospi: series(DAYS, kospiCrash),
    foreign: series(DAYS, (i) => (i < crashAt ? 500 : -3000)),
    ktb3,
    bbb: bbbStress,
  });
  assert.ok(calm && crash);
  assert.ok(crash.score < 25, `crash should be extreme fear, got ${crash.score}`);
  assert.ok(calm.score > crash.score + 30, `calm ${calm.score} vs crash ${crash.score}`);
  assert.equal(crash.label, labelFor(crash.score));
  assert.equal(crash.components.length, 5);
  assert.ok(crash.history.length > 0 && crash.history.length <= 180);
  assert.ok(crash.history.every((h) => typeof h.value === "number")); // 추이마다 실제 지수 값
  for (const c of crash.components) assert.ok(c.score >= 0 && c.score <= 100);
});

test("label boundaries", () => {
  assert.equal(labelFor(0), "극단적 공포");
  assert.equal(labelFor(25), "공포");
  assert.equal(labelFor(50), "중립");
  assert.equal(labelFor(70), "탐욕");
  assert.equal(labelFor(90), "극단적 탐욕");
});

test("stock index: rally beats crash, drops relative strength without KOSPI", () => {
  const bars = (f) => series(DAYS, f).map((r, i) => ({ date: r.date, close: r.value, high: r.value * 1.01, low: r.value * 0.99, volume: 1000 + (i % 3) * 100 }));
  const kospi = series(DAYS, kospiUp);
  const rally = computeStockFearGreed({ prices: bars(kospiUp), kospi });
  const crash = computeStockFearGreed({ prices: bars(kospiCrash), kospi });
  assert.ok(rally && crash);
  assert.ok(crash.score < 25, `crash ${crash.score}`);
  assert.ok(rally.score > crash.score + 30, `rally ${rally.score} vs crash ${crash.score}`);
  assert.equal(rally.components.length, 5);
  assert.deepEqual(crash.compare.map((c) => c.label), ["전일", "1주 전", "1개월 전"]);
  const noKospi = computeStockFearGreed({ prices: bars(kospiUp) });
  assert.equal(noKospi.components.length, 4);
  assert.equal(computeStockFearGreed({ prices: bars(kospiUp).slice(0, 100) }), null);
});

test("rsi: rising series is overbought, falling is oversold", async () => {
  const { rsi } = await import("./fearGreed.mjs");
  const up = Array.from({ length: 60 }, (_, i) => 100 + i + (i % 3 === 0 ? -0.5 : 0));
  const down = up.map((v) => 300 - v);
  assert.ok(rsi(up) > 70, `up ${rsi(up)}`);
  assert.ok(rsi(down) < 30, `down ${rsi(down)}`);
  assert.equal(rsi(up.slice(0, 10)), null);
});

test("market summary levels follow risk points", async () => {
  const { summarizeMarket } = await import("./marketSummary.mjs");
  assert.equal(summarizeMarket({}), null);
  const calm = summarizeMarket({ fearGreed: { score: 50 }, kospiRsi: { value: 50 }, us: { vix: { value: 14 }, hy: { value: 3 }, t10y2y: { value: 0.5 } } });
  assert.equal(calm.level, "good");
  assert.equal(calm.partial, false);
  const storm = summarizeMarket({ fearGreed: { score: 10 }, kospiRsi: { value: 25 }, us: { vix: { value: 35 }, hy: { value: 8 }, t10y2y: { value: -0.3 } } });
  assert.equal(storm.level, "risk");
  assert.equal(storm.reasons[0].risk, 2); // 위험이 큰 이유부터
  const usOnly = summarizeMarket({ us: { vix: { value: 24 }, hy: { value: 3.5 } } });
  assert.equal(usOnly.partial, true);
  assert.equal(usOnly.level, "neutral"); // VIX 주의(1) + 스프레드 양호(0) → 평균 0.5
});

test("technical: moving averages and chart reading", async () => {
  const { withMovingAverages, analyzeChart } = await import("./technical.mjs");
  const day = (i) => String(20250101 + i);
  const rising = Array.from({ length: 300 }, (_, i) => ({ date: day(i), close: 100 + i }));
  const rows = withMovingAverages(rising);
  assert.equal(rows[18].ma20, null);
  assert.equal(rows[19].ma20, 109.5); // 100..119 평균
  const up = analyzeChart(rows);
  assert.equal(up.points.find((p) => p.key === "align").label, "정배열");
  assert.equal(up.tone, "up");
  const falling = withMovingAverages(rising.map((r, i) => ({ ...r, close: 500 - i })));
  assert.equal(analyzeChart(falling).points.find((p) => p.key === "align").label, "역배열");
  // 오래 내리다 최근 반등 → 20일선이 60일선을 위로 뚫음
  const vshape = withMovingAverages(Array.from({ length: 300 }, (_, i) => ({ date: day(i), close: i < 270 ? 400 - i : 130 + (i - 270) * 8 })));
  assert.equal(analyzeChart(vshape).points.find((p) => p.key === "cross")?.label, "골든크로스");
  assert.equal(analyzeChart(rows.slice(0, 30)), null);
});

test("us fear-greed: calm rally beats a VIX spike crash", async () => {
  const { computeUsFearGreed } = await import("./fearGreed.mjs");
  const flat = (v) => series(DAYS, () => v);
  const calm = computeUsFearGreed({ sp500: series(DAYS, kospiUp), vix: flat(14), hy: flat(3), ust10: flat(4) });
  const crash = computeUsFearGreed({
    sp500: series(DAYS, kospiCrash),
    vix: series(DAYS, (i) => (i < crashAt ? 14 : 14 + (i - crashAt) * 2)),
    hy: series(DAYS, (i) => (i < crashAt ? 3 : 3 + (i - crashAt) * 0.2)),
    ust10: series(DAYS, (i) => (i < crashAt ? 4 : 4 - (i - crashAt) * 0.03)),
  });
  assert.ok(calm && crash);
  assert.ok(crash.score < 25, `crash ${crash.score}`);
  assert.ok(calm.score > crash.score + 25, `calm ${calm.score} vs crash ${crash.score}`);
  assert.equal(crash.components.length, 5);
});

test("correlation", async () => {
  const { correlation } = await import("./fearGreed.mjs");
  assert.equal(Math.round(correlation([1, 2, 3, 4], [10, 20, 30, 40]) * 100) / 100, 1);
  assert.equal(Math.round(correlation([1, 2, 3, 4], [40, 30, 20, 10]) * 100) / 100, -1);
  assert.equal(correlation([1, 2], [3, 4]), null);
});

test("market mood escalates when two indicators are at the extreme", async () => {
  const { summarizeMarket } = await import("./marketSummary.mjs");
  // 극단 2개(2점) + 평온 6개(0점) → 평균 0.5(보통)이지만 한 단계 올라 '출렁임'
  const d = { fearGreed: { score: 10 }, usFearGreed: { score: 10 }, kospiRsi: { value: 50 }, nasdaqRsi: { value: 50 }, us: { vix: { value: 14 }, vxn: { value: 18 }, hy: { value: 3 }, t10y2y: { value: 0.5 } } };
  assert.equal(summarizeMarket(d).level, "caution");
});

test("percentile returns null when the current value is missing", async () => {
  const { percentile } = await import("./fearGreed.mjs");
  assert.equal(percentile([1, 2, null], 2), null);
  assert.equal(percentile([1, 2, NaN], 2), null);
});

test("rsi is neutral (50) for a flat series", async () => {
  const { rsi } = await import("./fearGreed.mjs");
  assert.equal(rsi(new Array(40).fill(100)), 50);
});

test("withLive appends a newer day, replaces the same day, ignores an older day", async () => {
  const { withLive } = await import("./fearGreed.mjs");
  const s = [{ date: "20261120", value: 1 }, { date: "20261121", value: 2 }];
  assert.deepEqual(withLive(s, { date: "20261124", value: 3 }).map((r) => r.value), [1, 2, 3]);
  assert.deepEqual(withLive(s, { date: "20261121", value: 9 }).map((r) => r.value), [1, 9]);
  assert.deepEqual(withLive(s, { date: "20261119", value: 9 }), s);
  assert.equal(withLive(s, null), s);
});

test("withLive fills days the official data is still missing, then adds today", async () => {
  const { withLive } = await import("./fearGreed.mjs");
  const s = [{ date: "20261118", value: 1 }, { date: "20261119", value: 2 }];
  const live = { date: "20261123", value: 5, history: [{ date: "20261119", value: 2 }, { date: "20261120", value: 4 }] };
  assert.deepEqual(withLive(s, live).map((r) => r.date), ["20261118", "20261119", "20261120", "20261123"]);
  assert.deepEqual(withLive(s, live).map((r) => r.value), [1, 2, 4, 5]);
});
