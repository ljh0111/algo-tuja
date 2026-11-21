import { computeStockFearGreed } from "@/lib/fearGreed.mjs";
import { withMovingAverages, analyzeChart } from "@/lib/technical.mjs";
import { ecos, ECOS_ITEMS } from "@/lib/market";

// 금융위원회_주식시세정보 (공공데이터포털, 무료 키). 전 영업일 종가가 다음 영업일 오후에 올라옵니다.
const URL = "https://apis.data.go.kr/1160100/GetStockSecuritiesInfoService_V2/getStockPriceInfo_V2";
const DAYS = 820; // 180거래일 추이 각각에 125일 이동평균 + 1년 비교 ≈ 555거래일

async function fetchPrices(ticker, key) {
  const begin = new Date(Date.now() - DAYS * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
  // 포털이 주는 "Encoding" 키(이미 %로 인코딩됨)와 "Decoding" 키 둘 다 받아줍니다.
  const serviceKey = key.includes("%") ? key : encodeURIComponent(key);
  const url = `${URL}?serviceKey=${serviceKey}&resultType=json&numOfRows=1000&pageNo=1&likeSrtnCd=${encodeURIComponent(ticker)}&beginBasDt=${begin}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`공공데이터포털 응답 오류 (HTTP ${res.status})`);
  }
  const err = json.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (err) throw new Error(`공공데이터포털: ${err.returnAuthMsg || err.errMsg}`);
  const items = json.response?.body?.items?.item ?? [];
  return (Array.isArray(items) ? items : [items])
    .filter((r) => r.srtnCd === ticker) // likeSrtnCd는 앞자리 일치라 정확히 거릅니다
    .map((r) => ({
      date: r.basDt,
      close: Number(r.clpr),
      high: Number(r.hipr),
      low: Number(r.lopr),
      volume: Number(r.trqu),
      change: Number(r.vs),
      changePct: Number(r.fltRt),
      marketCap: Number(r.mrktTotAmt),
    }))
    .filter((r) => r.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getStockSentiment(ticker) {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) return { error: "DATA_GO_KR_KEY가 없어 종목 시세와 공포탐욕지수를 표시하지 않아요." };
  if (!/^\d{6}$/.test(ticker)) return { error: "종목코드 형식이 아니에요." };

  const ecosKey = process.env.ECOS_API_KEY;
  const [prices, kospi] = await Promise.all([
    fetchPrices(ticker, key),
    ecosKey ? ecos(ecosKey, ECOS_ITEMS.kospi, DAYS).catch(() => null) : null, // 없으면 시장 대비 강도만 빠짐
  ]);
  if (!prices.length) return { error: "이 종목의 시세를 찾지 못했어요." };

  const last = prices[prices.length - 1];
  const year = prices.slice(-250);
  return {
    price: {
      date: last.date,
      close: last.close,
      change: last.change,
      changePct: last.changePct,
      marketCap: last.marketCap,
      high52: Math.max(...year.map((p) => p.high)),
      low52: Math.min(...year.map((p) => p.low)),
    },
    fearGreed: computeStockFearGreed({ prices, kospi }),
    // 최근 1년(250거래일)만 화면에 보내고, 240일선은 그 이전 데이터까지 써서 계산
    chart: withMovingAverages(prices).slice(-250),
    technical: analyzeChart(withMovingAverages(prices)),
    source: "시세: 금융위원회 주식시세정보(공공데이터포털)" + (kospi ? " · 코스피: 한국은행 ECOS" : ""),
  };
}
