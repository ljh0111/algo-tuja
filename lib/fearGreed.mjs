// 코스피 공포탐욕지수 — CNN Fear & Greed 방식을 한국은행 ECOS 일별 데이터로 재현합니다.
// 각 지표의 오늘 값을 "최근 1년(250거래일) 중 몇 번째 위치인지"(백분위)로 0~100점으로 바꾼 뒤 평균합니다.
// 하루 등락률이 아니라 지난 1년 대비 위치를 보기 때문에 점수가 하루 만에 크게 튀지 않습니다.

const WINDOW = 250; // 백분위 비교 기간 (약 1년)
const MA = 125; // 모멘텀 이동평균 기간 (CNN과 동일)
const N = 20; // 단기 비교 기간 (약 1개월)
const HISTORY = 180; // 추이 그래프 기간 (약 9개월)
const KTB3_DURATION = 2.8; // 국고채 3년 수정듀레이션 근사치: 금리 변화 → 채권 수익률 환산용

export const COMPONENTS = [
  { key: "momentum", label: "시장 모멘텀", desc: "코스피가 125일 이동평균보다 얼마나 위에 있는지" },
  { key: "volatility", label: "변동성", desc: "코스피 20일 실현변동성 (높을수록 공포)" },
  { key: "foreign", label: "외국인 수급", desc: "외국인 20일 누적 순매수 (코스피)" },
  { key: "safeHaven", label: "안전자산 수요", desc: "주식과 국고채의 20일 수익률 차이" },
  { key: "credit", label: "신용 스프레드", desc: "회사채 BBB-와 국고채 3년 금리 차이 (클수록 공포)" },
];

export function labelFor(score) {
  if (score < 25) return "극단적 공포";
  if (score < 45) return "공포";
  if (score <= 55) return "중립";
  if (score <= 75) return "탐욕";
  return "극단적 탐욕";
}

// 같은 날짜 기준으로 맞추고, 채권처럼 발표일이 다른 시리즈는 직전 값으로 채웁니다.
function align(base, other) {
  const map = new Map(other.map((r) => [r.date, r.value]));
  let last = null;
  return base.map((r) => {
    if (map.has(r.date)) last = map.get(r.date);
    return last;
  });
}

export function percentile(values, i) {
  if (values[i] === null || !Number.isFinite(values[i])) return null; // 기준값이 없으면 계산 불가
  const from = Math.max(0, i - WINDOW + 1);
  let below = 0, count = 0;
  for (let j = from; j <= i; j++) {
    if (values[j] === null) continue;
    count++;
    if (values[j] < values[i]) below++;
    else if (values[j] === values[i] && j !== i) below += 0.5;
  }
  return count < 2 ? null : (below / (count - 1)) * 100;
}

/**
 * @param {{kospi:{date,value}[], foreign:{date,value}[], ktb3:{date,value}[], bbb:{date,value}[]}} s 날짜 오름차순 일별 시리즈
 * @param {number} historyDays 추이로 돌려줄 일수
 */
export function computeFearGreed(s, historyDays = HISTORY) {
  const k = s.kospi.map((r) => r.value);
  const foreign = align(s.kospi, s.foreign);
  const lastForeignDate = s.foreign.length ? s.foreign[s.foreign.length - 1].date : null;
  const ktb3 = align(s.kospi, s.ktb3);
  const bbb = align(s.kospi, s.bbb);
  // 신용 스프레드는 BBB-와 같은 날 국고채로 빼야 해서, 장중 국고채가 붙어 있으면 공식 일별 값(ktb3Official)을 씀
  const ktb3Credit = s.ktb3Official ? align(s.kospi, s.ktb3Official) : ktb3;
  const n = k.length;
  if (n < MA + WINDOW) return null; // 1년 비교에 필요한 데이터가 부족

  const raw = { momentum: [], volatility: [], foreign: [], safeHaven: [], credit: [] };
  for (let i = 0; i < n; i++) {
    const ok = i >= MA;
    let ma = 0;
    if (ok) for (let j = i - MA + 1; j <= i; j++) ma += k[j];
    raw.momentum.push(ok ? k[i] / (ma / MA) - 1 : null);

    let vol = null;
    if (i >= N) {
      const rets = [];
      for (let j = i - N + 1; j <= i; j++) rets.push(Math.log(k[j] / k[j - 1]));
      const mean = rets.reduce((a, b) => a + b, 0) / N;
      vol = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (N - 1)) * Math.sqrt(252);
    }
    raw.volatility.push(vol === null ? null : -vol); // 부호를 뒤집어 "높을수록 탐욕"으로 통일

    let f = null;
    // 공식 외국인 수급이 아직 없는 날(장중 값으로 붙인 날)은 마지막 20일 합계를 유지.
    // 하루 순매수를 앞날 값으로 채우면 같은 매수가 두 번 더해지므로 금액을 반복하지 않음
    if (lastForeignDate && s.kospi[i].date > lastForeignDate) f = i > 0 ? raw.foreign[i - 1] : null;
    else if (i >= N - 1 && foreign.slice(i - N + 1, i + 1).every((v) => v !== null)) {
      f = foreign.slice(i - N + 1, i + 1).reduce((a, b) => a + b, 0);
    }
    raw.foreign.push(f);

    const canSafe = i >= N && ktb3[i] !== null && ktb3[i - N] !== null;
    const stockRet = canSafe ? k[i] / k[i - N] - 1 : 0;
    const bondRet = canSafe ? (-(ktb3[i] - ktb3[i - N]) / 100) * KTB3_DURATION : 0;
    raw.safeHaven.push(canSafe ? stockRet - bondRet : null);

    raw.credit.push(bbb[i] !== null && ktb3Credit[i] !== null ? -(bbb[i] - ktb3Credit[i]) : null);
  }

  return summarize(raw, COMPONENTS, s.kospi.map((r) => r.date), historyDays, k);
}

// 지표별 원시값 → 백분위 → 평균 점수, 최근 추이와 비교 시점(전일·1주·1개월 전)까지 계산
function summarize(raw, components, dates, historyDays, values) {
  const n = dates.length;
  const scoreAt = (i) => {
    // direct: 이미 0~1 위치값인 지표(52주 위치)는 백분위를 한 번 더 씌우지 않고 그대로 점수로
    const parts = components.map((c) => ({ ...c, score: c.direct ? (raw[c.key][i] == null ? null : raw[c.key][i] * 100) : percentile(raw[c.key], i) }));
    const valid = parts.filter((p) => p.score !== null);
    if (!valid.length) return null;
    return { score: Math.round(valid.reduce((a, p) => a + p.score, 0) / valid.length), parts };
  };

  const last = scoreAt(n - 1);
  if (!last) return null;
  const history = [];
  for (let i = Math.max(0, n - Math.max(historyDays, 22)); i < n; i++) {
    const r = scoreAt(i);
    if (r) history.push({ date: dates[i], score: r.score, value: values[i] });
  }
  const ago = (k) => (history.length > k ? history[history.length - 1 - k].score : null);
  const prev = ago(1);
  return {
    score: last.score,
    label: labelFor(last.score),
    change: prev === null ? null : last.score - prev,
    date: dates[n - 1],
    compare: [
      { label: "전일", score: prev },
      { label: "1주 전", score: ago(5) },
      { label: "1개월 전", score: ago(21) },
    ].filter((c) => c.score !== null),
    components: last.parts.map((p) => ({ key: p.key, label: p.label, desc: p.desc, score: p.score === null ? null : Math.round(p.score) })),
    history: history.slice(-historyDays),
  };
}

export const STOCK_COMPONENTS = [
  { key: "momentum", label: "주가 모멘텀", desc: "주가가 125일 이동평균보다 얼마나 위에 있는지" },
  { key: "range52", label: "52주 위치", desc: "52주 최저가~최고가 사이에서 지금 주가의 위치", direct: true },
  { key: "volatility", label: "변동성", desc: "20일 주가 변동성 (높을수록 공포)" },
  { key: "volumeFlow", label: "거래량 쏠림", desc: "최근 20일 거래량 중 오른 날 거래량의 비중" },
  { key: "relative", label: "시장 대비 강도", desc: "최근 20일 수익률 − 코스피 20일 수익률" },
];

/**
 * 종목 전용 공포탐욕지수.
 * @param {{prices:{date,close,high,low,volume}[], kospi?:{date,value}[]}} s 날짜 오름차순 일별 시세
 */
export function computeStockFearGreed({ prices, kospi = null }, historyDays = HISTORY) {
  const n = prices.length;
  if (n < MA + WINDOW) return null;
  const c = prices.map((p) => p.close);
  const k = kospi ? align(prices, kospi) : null;
  const raw = { momentum: [], range52: [], volatility: [], volumeFlow: [], relative: [] };
  for (let i = 0; i < n; i++) {
    let ma = null;
    if (i >= MA) {
      ma = 0;
      for (let j = i - MA + 1; j <= i; j++) ma += c[j];
      ma /= MA;
    }
    raw.momentum.push(ma === null ? null : c[i] / ma - 1);

    let pos = null;
    if (i >= WINDOW - 1) {
      let hi = -Infinity, lo = Infinity;
      for (let j = i - WINDOW + 1; j <= i; j++) {
        hi = Math.max(hi, prices[j].high);
        lo = Math.min(lo, prices[j].low);
      }
      pos = hi > lo ? (c[i] - lo) / (hi - lo) : 0.5;
    }
    raw.range52.push(pos);

    let vol = null, flow = null, rel = null;
    if (i >= N) {
      const rets = [];
      let upVol = 0, allVol = 0;
      for (let j = i - N + 1; j <= i; j++) {
        rets.push(Math.log(c[j] / c[j - 1]));
        allVol += prices[j].volume;
        if (c[j] > c[j - 1]) upVol += prices[j].volume;
      }
      const mean = rets.reduce((a, b) => a + b, 0) / N;
      vol = -Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (N - 1));
      flow = allVol ? upVol / allVol : null;
      if (k && k[i] !== null && k[i - N] !== null) rel = c[i] / c[i - N] - k[i] / k[i - N];
    }
    raw.volatility.push(vol);
    raw.volumeFlow.push(flow);
    raw.relative.push(rel);
  }
  const comps = k ? STOCK_COMPONENTS : STOCK_COMPONENTS.filter((x) => x.key !== "relative");
  return summarize(raw, comps, prices.map((p) => p.date), historyDays, c);
}

// RSI(14), 와일더 방식. 70 이상 과매수·30 이하 과매도로 흔히 참고합니다. 데이터가 모자라면 null.
export function rsi(values, period = 14) {
  if (values.length <= period * 2) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (gain === 0 && loss === 0) return 50; // 가격 변동이 전혀 없으면 중립
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

export const US_COMPONENTS = [
  { key: "momentum", label: "시장 모멘텀", desc: "S&P 500이 125일 이동평균보다 얼마나 위에 있는지" },
  { key: "strength", label: "주가 강도", desc: "S&P 500의 52주 최저~최고 범위 안 위치", direct: true },
  { key: "volatility", label: "시장 변동성", desc: "VIX가 50일 평균보다 얼마나 높은지 (높을수록 공포)" },
  { key: "junk", label: "정크본드 수요", desc: "하이일드 신용스프레드 (클수록 공포)" },
  { key: "safeHaven", label: "안전자산 수요", desc: "주식과 미 국채 10년물의 20일 수익률 차이" },
];
const UST10_DURATION = 8.5; // 10년물 수정듀레이션 근사치

/**
 * 미국 공포탐욕지수 — CNN Fear & Greed의 7개 지표 중 공식 무료 데이터(FRED)로 구할 수 있는 5개로 계산.
 * @param {{sp500, vix, hy, ust10}} s 각 {date,value}[] 날짜 오름차순
 */
export function computeUsFearGreed(s, historyDays = HISTORY) {
  const k = s.sp500.map((r) => r.value);
  const n = k.length;
  if (n < MA + WINDOW) return null;
  const vix = align(s.sp500, s.vix);
  const hy = align(s.sp500, s.hy);
  const ust = align(s.sp500, s.ust10);
  const raw = { momentum: [], strength: [], volatility: [], junk: [], safeHaven: [] };
  for (let i = 0; i < n; i++) {
    let ma = null;
    if (i >= MA) {
      ma = 0;
      for (let j = i - MA + 1; j <= i; j++) ma += k[j];
      ma /= MA;
    }
    raw.momentum.push(ma === null ? null : k[i] / ma - 1);

    let pos = null;
    if (i >= WINDOW - 1) {
      const win = k.slice(i - WINDOW + 1, i + 1);
      const hi = Math.max(...win), lo = Math.min(...win);
      pos = hi > lo ? (k[i] - lo) / (hi - lo) : 0.5;
    }
    raw.strength.push(pos);

    let v = null;
    if (i >= 49 && vix[i] !== null) {
      const w = vix.slice(i - 49, i + 1).filter((x) => x !== null);
      if (w.length >= 40) v = -(vix[i] / (w.reduce((a, b) => a + b, 0) / w.length));
    }
    raw.volatility.push(v);

    raw.junk.push(hy[i] === null ? null : -hy[i]);

    const ok = i >= N && ust[i] !== null && ust[i - N] !== null;
    raw.safeHaven.push(ok ? k[i] / k[i - N] - 1 - (-(ust[i] - ust[i - N]) / 100) * UST10_DURATION : null);
  }
  return summarize(raw, US_COMPONENTS, s.sp500.map((r) => r.date), historyDays, k);
}

// 피어슨 상관계수: 1이면 완전히 같이, -1이면 정반대로 움직임
export function correlation(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : null;
}

/**
 * 일별 시계열 끝에 공식 데이터에 아직 없는 최근 날들(live.history)과 오늘 장중 값(live)을 붙입니다.
 * 같은 날짜면 그 날 값을 바꾸고, 마지막 날보다 이른 날짜는 무시합니다.
 * @param {{date:string}[]} series 날짜 오름차순
 * @param {{date:string, history?:{date:string}[]}|null} live 장중 값 (history는 날짜 오름차순)
 * @param {(point, last) => object} toRow 한 점을 시계열 한 행으로 바꾸는 함수
 */
export function withLive(series, live, toRow = (p) => ({ date: p.date, value: p.value })) {
  if (!series?.length || !live) return series;
  const out = [...series];
  for (const p of [...(live.history ?? []), live]) {
    const last = out[out.length - 1];
    if (p.date < last.date) continue;
    const row = toRow(p, last);
    if (p.date === last.date) out[out.length - 1] = row;
    else out.push(row);
  }
  return out;
}
