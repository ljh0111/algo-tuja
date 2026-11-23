// 네이버 증권 장중 시세. 공식 일별 데이터(ECOS·FRED·공공데이터포털)는 하루 늦게 올라오므로,
// 오늘 값 한 점만 여기서 받아 일별 시계열 끝에 붙여 공포탐욕지수를 장중에 다시 계산합니다.
// 실패하면 null을 돌려주고, 호출부는 일별 데이터만으로 계산합니다(= 전날 종가 기준으로 자동 복귀).
// shortcut: 비공식 주소라 언제든 막힐 수 있음, 그때는 증권사 공식 API(예: 한국투자증권 KIS)로 교체할 것

const HEADERS = { "User-Agent": "Mozilla/5.0" };
const LIVE_REVALIDATE = 60; // 네이버도 약 1분 간격으로 갱신

async function get(url) {
  try {
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: LIVE_REVALIDATE }, signal: AbortSignal.timeout(5000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// 빈 값은 0이 아니라 null (Number("")가 0이라 그대로 쓰면 저가 0원 같은 값이 들어감)
export const num = (s) => {
  const t = String(s ?? "").replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

// localTradedAt("2026-11-23T10:22:59-05:00")의 앞 10자리가 그 시장의 현지 날짜
function point(value, tradedAt, status) {
  if (!(value > 0) || !tradedAt) return null;
  return { date: tradedAt.slice(0, 10).replace(/-/g, ""), value, at: tradedAt, open: status === "OPEN" };
}

const day = (iso) => iso?.slice(0, 10).replace(/-/g, "");
// 최근 며칠 일별 종가(오래된 날 → 최근 날). 공식 데이터가 하루 이틀 늦어 빠진 날을 채우는 데 씀
async function recent(url, toRow) {
  const d = await get(url);
  return (Array.isArray(d) ? d : []).map(toRow).filter(Boolean).reverse();
}

const index = async (basicUrl, priceUrl) => {
  const [d, history] = await Promise.all([
    get(basicUrl),
    recent(priceUrl, (r) => {
      const v = num(r.closePrice);
      return v > 0 && r.localTradedAt ? { date: day(r.localTradedAt), value: v } : null;
    }),
  ]);
  const p = d && point(num(d.closePrice), d.localTradedAt, d.marketStatus);
  return p && { ...p, history };
};
const bond = async (code) => {
  const d = (await get(`https://m.stock.naver.com/front-api/marketIndex/productDetail?category=bond&reutersCode=${code}`))?.result;
  return d && point(num(d.closePrice), d.localTradedAt, d.marketStatus);
};

/** 코스피·국고채 3년 / S&P 500·VIX·미 국채 10년의 오늘 값. 각 항목은 {date, value, at, open, history?} 또는 null */
export async function getLiveMarket() {
  const [kospi, ktb3, sp500, vix, ust10] = await Promise.all([
    index("https://m.stock.naver.com/api/index/KOSPI/basic", "https://m.stock.naver.com/api/index/KOSPI/price?pageSize=5&page=1"),
    bond("KR3YT=RR"), // 채권은 일별 목록이 없어 오늘 값만
    index("https://api.stock.naver.com/index/.INX/basic", "https://api.stock.naver.com/index/.INX/price?pageSize=5&page=1"),
    index("https://api.stock.naver.com/index/.VIX/basic", "https://api.stock.naver.com/index/.VIX/price?pageSize=5&page=1"),
    bond("US10YT=RR"),
  ]);
  return { kospi, ktb3, sp500, vix, ust10 };
}

/** 개별 종목 오늘 시세: {date, close, high, low, volume, change, changePct, at, open, history} 또는 null */
export async function getLiveStock(ticker) {
  const [basic, integ, history] = await Promise.all([
    get(`https://m.stock.naver.com/api/stock/${ticker}/basic`),
    get(`https://m.stock.naver.com/api/stock/${ticker}/integration`),
    recent(`https://m.stock.naver.com/api/stock/${ticker}/price?pageSize=5&page=1`, (r) => {
      const close = num(r.closePrice);
      return close > 0 && r.localTradedAt
        ? { date: day(r.localTradedAt), close, high: num(r.highPrice) ?? close, low: num(r.lowPrice) ?? close, volume: num(r.accumulatedTradingVolume) ?? 0 }
        : null;
    }),
  ]);
  const p = basic && point(num(basic.closePrice), basic.localTradedAt, basic.marketStatus);
  if (!p) return null;
  const info = Object.fromEntries((integ?.totalInfos ?? []).map((t) => [t.code, num(t.value)]));
  return {
    date: p.date,
    close: p.value,
    // 고가·저가·거래량을 못 받으면 현재가·0으로 채워 계산이 깨지지 않게 함
    high: info.highPrice ?? p.value,
    low: info.lowPrice ?? p.value,
    volume: info.accumulatedTradingVolume ?? 0,
    change: num(basic.compareToPreviousClosePrice),
    changePct: num(basic.fluctuationsRatio),
    at: p.at,
    open: p.open,
    history,
  };
}
