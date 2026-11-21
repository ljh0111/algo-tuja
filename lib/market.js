import { computeFearGreed, computeUsFearGreed, rsi } from "@/lib/fearGreed.mjs";

// 한국: 한국은행 ECOS (무료 키), 미국: FRED (키 불필요). 둘 다 일별 종가 기준이라 1시간 캐시로 충분합니다.
const REVALIDATE = 3600;

export const ECOS_ITEMS = {
  kospi: ["802Y001", "0001000"],
  kosdaq: ["802Y001", "0089000"],
  foreign: ["802Y001", "0030000"], // 외국인 순매수(유가증권시장), 억원
  ktb3: ["817Y002", "010200000"], // 국고채 3년, 연%
  bbb: ["817Y002", "010320000"], // 회사채 3년 BBB-, 연%
  usdkrw: ["731Y001", "0000001"], // 원/달러 매매기준율
};

const FRED_IDS = {
  vix: "VIXCLS",
  vxn: "VXNCLS", // 나스닥100 변동성지수
  sp500: "SP500",
  nasdaq: "NASDAQCOM",
  ust10: "DGS10",
  t10y2y: "T10Y2Y", // 장단기 금리차 10년-2년, %p
  hy: "BAMLH0A0HYM2", // 하이일드 신용스프레드(OAS), %p
  wti: "DCOILWTICO",
};

// 미국 공포탐욕지수(125일선 + 1년 비교)용은 약 600일, 나스닥 RSI용은 120일
const FRED_DAYS = { sp500: 820, vix: 820, hy: 820, ust10: 820, nasdaq: 120 };

function ymd(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function ecos(key, [stat, item], days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  // sample 키는 요청당 10행까지만 줍니다 — 최신값 표시용으로만 씁니다.
  const rows = key === "sample" ? 10 : 2000;
  const url = `https://ecos.bok.or.kr/api/StatisticSearch/${encodeURIComponent(key)}/json/kr/1/${rows}/${stat}/D/${ymd(start)}/${ymd(end)}/${item}`;
  const res = await fetch(url, { next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`ECOS ${stat}/${item} HTTP ${res.status}`);
  const json = await res.json();
  if (!json.StatisticSearch) throw new Error(`ECOS ${stat}/${item}: ${json.RESULT?.MESSAGE || "응답 없음"}`);
  return json.StatisticSearch.row
    .map((r) => ({ date: r.TIME, value: Number(r.DATA_VALUE) }))
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function fred(id, days = 30) {
  const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`, { next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`FRED ${id} HTTP ${res.status}`);
  return (await res.text())
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const [date, v] = line.split(",");
      return { date: date.replace(/-/g, ""), value: v && v.trim() !== "." ? Number(v) : NaN }; // 휴장일은 빈칸이나 "."
    })
    .filter((r) => Number.isFinite(r.value)); // 휴장일은 "." 으로 와서 제외
}

// 마지막 값과 직전 거래일 대비 변화
function latest(rows) {
  if (!rows?.length) return null;
  const last = rows[rows.length - 1];
  const prev = rows.length > 1 ? rows[rows.length - 2] : null;
  return {
    value: last.value,
    date: last.date,
    change: prev ? last.value - prev.value : null,
    changePct: prev && prev.value ? ((last.value - prev.value) / Math.abs(prev.value)) * 100 : null,
  };
}

export async function getMarketOverview() {
  const envKey = process.env.ECOS_API_KEY;
  const key = envKey || "sample";
  const errors = [];
  const settle = async (label, p) => {
    try {
      return await p;
    } catch (e) {
      errors.push(`${label}: ${e.message}`);
      return null;
    }
  };

  // 공포탐욕지수는 125일 이동평균 + 1년 비교가 필요해 약 600일치를 받습니다.
  const longDays = envKey ? 820 : 12; // sample 키는 10행 제한이라 12일(영업일 9일 이하)만 요청
  const [kospi, kosdaq, foreign, ktb3, bbb, usdkrw, ...us] = await Promise.all([
    settle("KOSPI", ecos(key, ECOS_ITEMS.kospi, longDays)),
    settle("KOSDAQ", ecos(key, ECOS_ITEMS.kosdaq, 12)),
    settle("외국인 순매수", ecos(key, ECOS_ITEMS.foreign, longDays)),
    settle("국고채 3년", ecos(key, ECOS_ITEMS.ktb3, longDays)),
    settle("회사채 BBB-", ecos(key, ECOS_ITEMS.bbb, longDays)),
    settle("원/달러", ecos(key, ECOS_ITEMS.usdkrw, 12)),
    ...Object.entries(FRED_IDS).map(([k, id]) => settle(k, fred(id, FRED_DAYS[k] ?? 30))),
  ]);

  let fearGreed = null;
  if (!envKey) errors.push("ECOS_API_KEY가 없어 공포탐욕지수를 계산하지 않았어요 (지수 최신값은 ECOS 공개 샘플 키로 표시).");
  else if (kospi && foreign && ktb3 && bbb) fearGreed = computeFearGreed({ kospi, foreign, ktb3, bbb });

  const usLatest = Object.fromEntries(Object.keys(FRED_IDS).map((k, i) => [k, latest(us[i])]));
  const kospiRsi = envKey && kospi ? rsi(kospi.map((r) => r.value)) : null;
  const nq = us[Object.keys(FRED_IDS).indexOf("nasdaq")];
  const nasdaqRsi = nq ? rsi(nq.map((r) => r.value)) : null;
  const pickUs = (k) => us[Object.keys(FRED_IDS).indexOf(k)];
  const usSeries = { sp500: pickUs("sp500"), vix: pickUs("vix"), hy: pickUs("hy"), ust10: pickUs("ust10") };
  const usFearGreed = Object.values(usSeries).every(Boolean) ? computeUsFearGreed(usSeries) : null;
  return {
    kospiRsi: kospiRsi === null ? null : { value: kospiRsi, date: kospi[kospi.length - 1].date },
    nasdaqRsi: nasdaqRsi === null ? null : { value: nasdaqRsi, date: nq[nq.length - 1].date },
    kr: {
      kospi: latest(kospi),
      kosdaq: latest(kosdaq),
      usdkrw: latest(usdkrw),
      foreign: latest(foreign),
      ktb3: latest(ktb3),
      bbb: latest(bbb),
    },
    us: usLatest,
    fearGreed,
    usFearGreed,
    sources: "한국: 한국은행 경제통계시스템(ECOS) · 미국: 세인트루이스 연준 FRED (모두 일별 종가 기준)",
    errors,
  };
}
