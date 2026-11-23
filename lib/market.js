import { computeFearGreed, computeUsFearGreed, rsi, withLive } from "@/lib/fearGreed.mjs";
import { unstable_cache } from "next/cache";
import { getLiveMarket } from "@/lib/live";

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

// ECOS·FRED는 오류도 HTTP 200으로 보낼 때가 있어, fetch 캐시에 맡기면 일시 오류가 1시간 동안 굳습니다.
// 그래서 요청은 캐시하지 않고, 성공한 결과만 1시간 저장합니다(unstable_cache는 throw한 결과를 저장하지 않음).
const TIMEOUT = 10000; // 느린 응답 하나가 API 전체를 30초 제한까지 붙잡지 않게

async function ecosOnce(key, [stat, item], days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  // sample 키는 요청당 10행까지만 줍니다 — 최신값 표시용으로만 씁니다.
  const rows = key === "sample" ? 10 : 2000;
  const url = `https://ecos.bok.or.kr/api/StatisticSearch/${encodeURIComponent(key)}/json/kr/1/${rows}/${stat}/D/${ymd(start)}/${ymd(end)}/${item}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`ECOS ${stat}/${item} HTTP ${res.status}`);
  const json = await res.json();
  if (!json.StatisticSearch) throw new Error(`ECOS ${stat}/${item}: ${json.RESULT?.MESSAGE || "응답 없음"}`);
  const series = json.StatisticSearch.row
    .map((r) => ({ date: r.TIME, value: Number(r.DATA_VALUE) }))
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!series.length) throw new Error(`ECOS ${stat}/${item}: 빈 응답`);
  return series;
}
export const ecos = unstable_cache(ecosOnce, ["ecos-v1"], { revalidate: REVALIDATE });

async function fredOnce(id, days = 30) {
  const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`FRED ${id} HTTP ${res.status}`);
  const rows = (await res.text())
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const [date, v] = line.split(",");
      return { date: date.replace(/-/g, ""), value: v && v.trim() !== "." ? Number(v) : NaN }; // 휴장일은 빈칸이나 "."
    })
    .filter((r) => Number.isFinite(r.value)); // 휴장일은 "." 으로 와서 제외
  if (!rows.length) throw new Error(`FRED ${id}: 빈 응답`);
  return rows;
}
const fred = unstable_cache(fredOnce, ["fred-v1"], { revalidate: REVALIDATE });

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
  const [live, kospiDaily, kosdaq, foreign, ktb3Daily, bbb, usdkrw, ...usDaily] = await Promise.all([
    getLiveMarket(), // 실패해도 throw하지 않고 항목별 null
    settle("KOSPI", ecos(key, ECOS_ITEMS.kospi, longDays)),
    settle("KOSDAQ", ecos(key, ECOS_ITEMS.kosdaq, 12)),
    settle("외국인 순매수", ecos(key, ECOS_ITEMS.foreign, longDays)),
    settle("국고채 3년", ecos(key, ECOS_ITEMS.ktb3, longDays)),
    settle("회사채 BBB-", ecos(key, ECOS_ITEMS.bbb, longDays)),
    settle("원/달러", ecos(key, ECOS_ITEMS.usdkrw, 12)),
    ...Object.entries(FRED_IDS).map(([k, id]) => settle(k, fred(id, FRED_DAYS[k] ?? 30))),
  ]);

  // 오늘 장중 값을 일별 시계열 끝에 붙임(네이버). 못 받으면 일별 데이터 그대로 = 전날 종가 기준
  // ECOS가 실패해도 코스피 타일은 네이버 최근 며칠 시세로 표시 (공포탐욕은 1년치가 필요해 이때는 비어 있음)
  const kospi = kospiDaily ? withLive(kospiDaily, live.kospi) : live.kospi?.history?.length ? withLive(live.kospi.history.slice(0, 1), live.kospi) : null;
  const ktb3 = withLive(ktb3Daily, live.ktb3);
  const us = Object.keys(FRED_IDS).map((k, i) => (live[k] ? withLive(usDaily[i], live[k]) : usDaily[i]));
  // 붙인 장중 값이 계산의 마지막 날이 됐으면, 그 시각과 장 운영 여부를 화면에 알림
  const liveInfo = (series, p) => (p && series?.length && series[series.length - 1].date === p.date ? { at: p.at, open: p.open } : null);

  let fearGreed = null;
  if (!envKey) errors.push("ECOS_API_KEY가 없어 공포탐욕지수를 계산하지 않았어요 (지수 최신값은 ECOS 공개 샘플 키로 표시).");
  else if (kospi && foreign && ktb3 && bbb) {
    fearGreed = computeFearGreed({ kospi, foreign, ktb3, bbb, ktb3Official: ktb3Daily });
    if (fearGreed) fearGreed.live = liveInfo(kospi, live.kospi);
  }

  const usLatest = Object.fromEntries(Object.keys(FRED_IDS).map((k, i) => [k, latest(us[i])]));
  const kospiRsi = envKey && kospi ? rsi(kospi.map((r) => r.value)) : null;
  const nq = us[Object.keys(FRED_IDS).indexOf("nasdaq")];
  const nasdaqRsi = nq ? rsi(nq.map((r) => r.value)) : null;
  const pickUs = (k) => us[Object.keys(FRED_IDS).indexOf(k)];
  const usSeries = { sp500: pickUs("sp500"), vix: pickUs("vix"), hy: pickUs("hy"), ust10: pickUs("ust10") };
  const usFearGreed = Object.values(usSeries).every(Boolean) ? computeUsFearGreed(usSeries) : null;
  if (usFearGreed) usFearGreed.live = liveInfo(usSeries.sp500, live.sp500);
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
    // 장중 값이 붙은 시장: 화면에서 "장중 잠정" 표시와 기준 시각에 씀
    live: { kr: fearGreed?.live ?? liveInfo(kospi, live.kospi), us: usFearGreed?.live ?? liveInfo(usSeries.sp500, live.sp500) },
    sources: "한국: 한국은행 경제통계시스템(ECOS) · 미국: 세인트루이스 연준 FRED (일별 종가) · 오늘 장중 값: 네이버 증권",
    errors,
  };
}
