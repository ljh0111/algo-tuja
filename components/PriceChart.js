"use client";

import { useState } from "react";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useStockSentiment } from "@/components/StockSentiment";

// 이동평균선 색: 국내 증권 앱에서 흔히 쓰는 조합
const LINES = [
  { key: "ma20", label: "20일", color: "#F04452" },
  { key: "ma60", label: "60일", color: "#FF9F1C" },
  { key: "ma120", label: "120일", color: "#16A34A" },
  { key: "ma240", label: "240일", color: "#7C3AED" },
];
const RANGES = [
  ["3개월", 63],
  ["6개월", 125],
  ["1년", 250],
];
const TONE = {
  up: { icon: TrendingUp, color: "#D22030", bg: "#FDECEE" },
  down: { icon: TrendingDown, color: "#1B64DA", bg: "#E8F3FF" },
  flat: { icon: Minus, color: "#4E5968", bg: "#F2F4F6" },
};

const won = (v) => (v == null ? "-" : `${Math.round(v).toLocaleString("ko-KR")}원`);
const md = (d) => `${Number(d.slice(4, 6))}/${Number(d.slice(6, 8))}`;
// 세로축: 1만 원 이상은 "19.7만"처럼 만 원 단위로
const axisWon = (v) => (v >= 10000 ? `${(v / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만` : v.toLocaleString("ko-KR"));

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg bg-ink px-3 py-2 text-xs text-white shadow-lg">
      <div className="font-semibold">{`${row.date.slice(0, 4)}.${row.date.slice(4, 6)}.${row.date.slice(6, 8)}`}</div>
      <div className="mt-1">종가 <b>{won(row.close)}</b></div>
      {LINES.map((l) => row[l.key] != null && (
        <div key={l.key} style={{ color: l.color === "#7C3AED" ? "#C4B5FD" : l.color }}>{l.label}선 {won(row[l.key])}</div>
      ))}
    </div>
  );
}

export default function PriceChart({ ticker }) {
  const data = useStockSentiment(ticker);
  const [range, setRange] = useState(125);
  const [shown, setShown] = useState({ ma20: true, ma60: true, ma120: false, ma240: false }); // 기본은 2개만: 선이 겹쳐 읽기 어렵지 않게;

  if (!data) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-paper-raised px-5 py-4 text-xs text-ink-faint">
        <Loader2 size={14} className="animate-spin" /> 주가 차트를 불러오는 중...
      </div>
    );
  }
  if (data.error || !data.chart?.length) {
    return <p className="rounded-2xl bg-paper-raised px-5 py-3 text-xs text-ink-faint">{data.error || "차트 데이터가 없어요."}</p>;
  }

  const rows = data.chart.slice(-range);
  const t = data.technical;
  const tone = t ? TONE[t.tone] : null;
  // 선택한 기간의 시작 종가 대비 변화: 차트에서 가장 먼저 읽을 숫자
  const first = rows.find((r) => r.close != null)?.close;
  const last = rows[rows.length - 1]?.close;
  const pct = first && last != null ? ((last - first) / first) * 100 : null;
  const rangeLabel = RANGES.find((r) => r[1] === range)[0];
  return (
    <div className="rounded-2xl bg-paper-raised p-5">
      {pct != null && (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm text-ink-soft">최근 {rangeLabel} 동안</span>
          <span className={`text-xl font-bold tracking-tight ${pct > 0 ? "text-up" : pct < 0 ? "text-down" : "text-ink"}`}>
            {pct > 0 ? "▲ +" : pct < 0 ? "▼ −" : ""}{Math.abs(pct).toFixed(1)}%
          </span>
          <span className="text-xs text-ink-faint">{won(first)} → {won(last)}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full bg-paper p-1" role="group" aria-label="기간">
          {RANGES.map(([label, n]) => (
            <button
              key={n}
              onClick={() => setRange(n)}
              aria-pressed={range === n}
              className={`min-h-9 rounded-full px-3.5 text-sm font-semibold ${range === n ? "bg-paper-raised text-ink shadow-sm" : "text-ink-faint"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="이동평균선 표시">
          {LINES.map((l) => (
            <button
              key={l.key}
              onClick={() => setShown((s) => ({ ...s, [l.key]: !s[l.key] }))}
              aria-pressed={shown[l.key]}
              className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${shown[l.key] ? "border-transparent bg-paper text-ink" : "border-line text-ink-faint"}`}
            >
              <span className="h-1 w-3.5 rounded" style={{ background: shown[l.key] ? l.color : "#D1D6DB" }} />
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-64 sm:h-80" role="img" aria-label={`최근 ${rangeLabel} 주가와 이동평균선 차트`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="closeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4E5968" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#4E5968" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#EEF0F3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={md} tick={{ fontSize: 12, fill: "#5B6573" }} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis
              domain={["auto", "auto"]}
              tickFormatter={axisWon}
              tick={{ fontSize: 12, fill: "#5B6573" }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#B0B8C1", strokeDasharray: "3 3" }} />
            {/* 종가가 주인공: 면을 채운 굵은 선(파랑은 하락색이라 피함), 이동평균선은 가늘게 */}
            <Area type="monotone" dataKey="close" stroke="#191F28" strokeWidth={2.2} fill="url(#closeFill)" dot={false} isAnimationActive={false} />
            {LINES.map((l) => shown[l.key] && (
              <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={1.3} strokeOpacity={0.9} dot={false} connectNulls={false} isAnimationActive={false} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {t && (
        <div className="mt-4 rounded-xl px-4 py-3.5" style={{ background: tone.bg }}>
          <div className="flex items-center gap-2 text-sm font-bold" style={{ color: tone.color }}>
            <tone.icon size={16} aria-hidden="true" /> {t.headline}
          </div>
          <ul className="mt-2.5 space-y-2">
            {t.points.map((p) => (
              <li key={p.key} className="text-sm leading-relaxed text-ink">
                <span className="mr-1.5 rounded-md bg-paper-raised px-1.5 py-0.5 text-xs font-bold" style={{ color: TONE[p.tone].color }}>{p.label}</span>
                {p.text}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            이동평균선은 지난 주가의 평균이라 앞으로의 방향을 보장하지 않아요. 흔히 쓰는 해석을 정리한 참고 정보이며, 매수·매도 권유가 아니에요.
          </p>
        </div>
      )}
    </div>
  );
}
