"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { FearGreedCard } from "@/components/FearGreed";

const won = (v) => `${Math.round(v).toLocaleString("ko-KR")}원`;
const shortDate = (d) => (d ? `${Number(d.slice(4, 6))}월 ${Number(d.slice(6, 8))}일` : "");
const jo = (v) => (v >= 1e12 ? `${(v / 1e12).toFixed(1)}조원` : `${Math.round(v / 1e8).toLocaleString("ko-KR")}억원`);

// 같은 종목 응답을 요약 카드와 차트가 나눠 씁니다 (요청 1번).
const cache = new Map();
export function useStockSentiment(ticker) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    if (!cache.has(ticker)) {
      cache.set(
        ticker,
        fetch(`/api/company/${ticker}/sentiment`)
          .then((r) => r.json())
          .catch((e) => ({ error: e.message }))
          .then((d) => {
            if (d.error) cache.delete(ticker); // 실패는 다음에 다시 시도
            return d;
          })
      );
    }
    cache.get(ticker).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [ticker]);
  return data;
}

// 종목 시세 요약(종가·52주 범위)과 종목 전용 공포탐욕지수
export default function StockSentiment({ ticker, name }) {
  const data = useStockSentiment(ticker);

  if (!data) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-paper-raised px-5 py-4 text-xs text-ink-faint">
        <Loader2 size={14} className="animate-spin" /> 시세와 투자 심리를 불러오는 중...
      </div>
    );
  }
  if (data.error) {
    return <p className="rounded-2xl bg-paper-raised px-5 py-3 text-xs text-ink-faint">{data.error}</p>;
  }

  const { price, fearGreed } = data;
  const up = price.change > 0, down = price.change < 0;
  const pos = price.high52 > price.low52 ? ((price.close - price.low52) / (price.high52 - price.low52)) * 100 : 50;
  return (
    <div className="rounded-2xl bg-paper-raised p-5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-2xl font-bold tracking-tight text-ink">{won(price.close)}</span>
        <span className={`text-sm font-semibold ${up ? "text-up" : down ? "text-down" : "text-ink-faint"}`}>
          {up ? "+" : ""}{price.change.toLocaleString("ko-KR")}원 ({up ? "+" : ""}{price.changePct.toFixed(2)}%)
        </span>
      </div>
      <div className="mt-0.5 text-xs text-ink-faint">
        {shortDate(price.date)} 종가 · 시가총액 {jo(price.marketCap)}
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs text-ink-faint">
          <span>52주 최저</span>
          <span>52주 최고</span>
        </div>
        <div className="relative mt-1 h-1.5 rounded-full bg-line" role="img" aria-label={`52주 범위 중 ${Math.round(pos)}% 위치`}>
          <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper-raised bg-ink" style={{ left: `${pos}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-xs font-semibold text-ink">
          <span>{won(price.low52)}</span>
          <span>{won(price.high52)}</span>
        </div>
      </div>

      {fearGreed ? (
        <div className="mt-5">
          <FearGreedCard
            fg={fearGreed}
            title={`${name} 공포탐욕지수`}
            indexLabel="주가"
            explain="이 종목의 주가 모멘텀·52주 위치·변동성·거래량 쏠림·시장 대비 강도가 최근 1년 중 어디쯤인지(백분위)를 0~100점으로 바꿔 평균했어요. 이 종목을 둘러싼 투자 심리를 보여주는 참고 지표이며, 매수·매도 시점을 알려주지 않아요."
          />
        </div>
      ) : (
        <p className="mt-4 text-xs text-ink-faint">상장 기간이 짧아 1년 비교가 필요한 공포탐욕지수는 아직 계산할 수 없어요.</p>
      )}
      <p className="mt-3 text-xs text-ink-faint">{data.source}</p>
    </div>
  );
}
