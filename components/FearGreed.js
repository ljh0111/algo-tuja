"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { correlation, labelFor } from "@/lib/fearGreed.mjs";
import { asOfLabel } from "@/components/ui";

// CNN처럼 공포일수록 붉게, 탐욕일수록 초록으로. 구간 경계도 CNN과 동일.
export const BANDS = [
  { from: 0, to: 25, label: ["극단적", "공포"], color: "#E5303C", text: "#C81E2A" },
  { from: 25, to: 45, label: ["공포"], color: "#FF8A5B", text: "#B54708", onDark: false },
  { from: 45, to: 55, label: ["중립"], color: "#8B95A1", text: "#4E5968" },
  { from: 55, to: 75, label: ["탐욕"], color: "#5FD49A", text: "#177245", onDark: false },
  { from: 75, to: 100, label: ["극단적", "탐욕"], color: "#16A34A", text: "#116B32" },
];
// 서버 labelFor와 같은 경계(25·45는 위 구간)를 쓰도록 라벨로 고릅니다.
export const bandOf = (s) => BANDS.find((b) => b.label.join(" ") === labelFor(s)) ?? BANDS[2];

const CX = 160, CY = 160, R_OUT = 132, R_IN = 92;
const polar = (r, t) => {
  const a = Math.PI * (1 - t / 100);
  // 서버·브라우저의 부동소수점 끝자리 차이로 hydration 경고가 나지 않게 반올림
  return [Math.round((CX + r * Math.cos(a)) * 100) / 100, Math.round((CY - r * Math.sin(a)) * 100) / 100];
};
const sector = (from, to) => {
  const [a1, b1] = polar(R_OUT, from), [a2, b2] = polar(R_OUT, to);
  const [c1, d1] = polar(R_IN, to), [c2, d2] = polar(R_IN, from);
  return `M${a1} ${b1} A${R_OUT} ${R_OUT} 0 0 1 ${a2} ${b2} L${c1} ${d1} A${R_IN} ${R_IN} 0 0 0 ${c2} ${d2} Z`;
};

// CNN 공포탐욕지수처럼: 구간별 반원, 현재 구간만 색칠, 눈금 숫자와 바늘.
// score는 0~100 위치. bands를 바꾸면 VIX·1년 위치 같은 다른 지표에도 씁니다. mini는 글자 없이 작게.
export function Gauge({ score, bands = BANDS, mini = false, ariaLabel }) {
  const active = bands.find((b) => score >= b.from && score <= b.to) ?? bands[0];
  const [nx, ny] = polar(mini ? R_IN - 8 : R_IN - 26, score ?? 50);
  return (
    <svg viewBox="0 0 320 172" className={mini ? "w-full" : "w-full max-w-[340px]"} role="img" aria-label={ariaLabel ?? `공포탐욕지수 ${score}점, ${active.label.join(" ")}`}>
      {bands.map((b) => {
        const on = b === active;
        const mid = (b.from + b.to) / 2;
        const [lx, ly] = polar((R_OUT + R_IN) / 2, mid);
        return (
          <g key={b.from}>
            <path d={sector(b.from + 0.6, b.to - 0.6)} fill={on ? b.color : "#EEF0F3"} className="transition-colors duration-500" />
            {!mini && (
              <text x={lx} y={ly - (b.label.length - 1) * 7} textAnchor="middle" dominantBaseline="middle" fontSize="12.5" fontWeight="700" fill={on ? (b.onDark === false || b.from === 45 ? "#191F28" : "#FFFFFF") : "#5B6573"}>
                {b.label.map((l, i) => <tspan key={l} x={lx} dy={i ? 14 : 0}>{l}</tspan>)}
              </text>
            )}
          </g>
        );
      })}
      {!mini && [0, 25, 50, 75, 100].map((t) => {
        const [x, y] = polar(R_IN - 13, t);
        return <text key={t} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="#5B6573">{t}</text>;
      })}
      {score !== null && (
        <>
          <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="#191F28" strokeWidth={mini ? 10 : 4} strokeLinecap="round" />
          <circle cx={CX} cy={CY} r={mini ? 16 : 9} fill="#191F28" />
        </>
      )}
    </svg>
  );
}

const md = (d) => `${Number(d.slice(4, 6))}/${Number(d.slice(6, 8))}`;

// 최근 추이: 세로축을 그 지수의 실제 값 범위에 맞춰 움직임이 잘 보이게 합니다.
// 그래프를 누르거나 손가락·마우스를 올리면 그 날짜의 점수를 보여줍니다.
function niceAxis(values) {
  const min = Math.min(...values), max = Math.max(...values);
  const step = max - min <= 15 ? 5 : max - min <= 40 ? 10 : 20;
  let lo = Math.max(0, Math.floor((min - 2) / step) * step);
  let hi = Math.min(100, Math.ceil((max + 2) / step) * step);
  if (hi - lo < step * 2) hi = Math.min(100, lo + step * 2);
  if (hi - lo < step * 2) lo = Math.max(0, hi - step * 2);
  const ticks = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);
  return { lo, hi, ticks };
}

const fmtIdx = (n) => (n >= 10000 ? `${Math.round(n / 1000).toLocaleString("ko-KR")}K` : Math.round(n).toLocaleString("ko-KR"));

function corrText(r) {
  if (r == null) return null;
  const a = Math.abs(r);
  const how = a >= 0.7 ? "강하게" : a >= 0.4 ? "대체로" : null;
  if (!how) return "이 기간 두 선은 뚜렷한 관계 없이 움직였어요.";
  return `이 기간 두 선은 ${how} ${r > 0 ? "같은 방향" : "반대 방향"}으로 움직였어요.`;
}

function TrendChart({ history, indexLabel }) {
  const [active, setActive] = useState(null);
  if (history.length < 2) return null;
  const W = 320, H = 170, L = 26, R = 36, T = 30, B = 22;
  const scores = history.map((h) => h.score);
  const { lo, hi, ticks } = niceAxis(scores);
  const vals = history.map((h) => h.value).filter((x) => x != null);
  const hasIdx = indexLabel && vals.length === history.length;
  const vMin = hasIdx ? Math.min(...vals) : 0, vMax = hasIdx ? Math.max(...vals) : 1;
  const x = (i) => L + (i / (history.length - 1)) * (W - L - R);
  const y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const yv = (v) => T + ((vMax - v) / (vMax - vMin || 1)) * (H - T - B);
  const r1 = (v) => Math.round(v * 10) / 10;
  const line = history.map((h, i) => `${r1(x(i))},${r1(y(h.score))}`).join(" ");
  const idxLine = hasIdx ? history.map((h, i) => `${r1(x(i))},${r1(yv(h.value))}`).join(" ") : "";
  const idxArea = hasIdx ? `${L},${H - B} ${idxLine} ${W - R},${H - B}` : "";
  const last = history.length - 1;
  const sel = active ?? last;
  const h = history[sel];
  const sx = r1(x(sel)), sy = r1(y(h.score));
  const band = bandOf(h.score);

  // 포인터 위치 → 가장 가까운 날짜
  const pick = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * last);
    setActive(Math.max(0, Math.min(last, i)));
  };
  const step = (d) => setActive((i) => Math.max(0, Math.min(last, (i ?? last) + d)));

  const tipW = hasIdx ? 178 : band.label.length > 1 ? 118 : 92;
  const tipX = Math.max(0, Math.min(W - tipW, sx - tipW / 2));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-pan-y select-none outline-none"
      role="slider"
      tabIndex={0}
      aria-label={`최근 공포탐욕지수 추이${hasIdx ? `와 ${indexLabel}` : ""}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={h.score}
      aria-valuetext={`${md(h.date)} ${h.score}점 ${band.label.join(" ")}${hasIdx ? `, ${indexLabel} ${fmtIdx(h.value)}` : ""}`}
      onPointerDown={pick}
      onPointerMove={pick}
      onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") step(-1);
        if (e.key === "ArrowRight") step(1);
      }}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#EEF0F3" />
          <text x={L - 5} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="10.5" fill="#5B6573">{t}</text>
        </g>
      ))}
      {hasIdx && (
        <g>
          <polygon points={idxArea} fill="#3182F6" opacity="0.04" />
          <polyline points={idxLine} fill="none" stroke="#B9D4F7" strokeWidth="1" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /* 배경 지수는 연하게, 화면 폭과 상관없이 1px */ />
          <text x={W - R + 4} y={T} dominantBaseline="middle" fontSize="8.5" fill="#5B8FD9">{fmtIdx(vMax)}</text>
          <text x={W - R + 4} y={H - B} dominantBaseline="middle" fontSize="8.5" fill="#5B8FD9">{fmtIdx(vMin)}</text>
        </g>
      )}
      <polyline points={line} fill="none" stroke="#191F28" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1={sx} x2={sx} y1={T - 2} y2={H - B} stroke="#B0B8C1" strokeDasharray="2 3" />
      {hasIdx && <circle cx={sx} cy={r1(yv(h.value))} r="3" fill="#8DB8EE" stroke="#FFFFFF" strokeWidth="1.5" />}
      <circle cx={sx} cy={sy} r="5" fill={band.color} stroke="#FFFFFF" strokeWidth="2" />
      <g transform={`translate(${r1(tipX)} 2)`}>
        <rect width={tipW} height="22" rx="6" fill="#191F28" />
        <text x={tipW / 2} y="11" textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#FFFFFF">
          <tspan>{md(h.date)} </tspan>
          <tspan fontWeight="700">{h.score}</tspan>
          <tspan fill={band.color}> {band.label.join(" ")}</tspan>
          {hasIdx && <tspan fill="#9CC3FF">{` · ${fmtIdx(h.value)}`}</tspan>}
        </text>
      </g>
      <text x={L} y={H - 5} fontSize="10.5" fill="#5B6573">{md(history[0].date)}</text>
      <text x={W - R} y={H - 5} textAnchor="end" fontSize="9.5" fill="#8B95A1">{md(history[last].date)}</text>
    </svg>
  );
}


/** (compact: 게이지·점수만 먼저, 비교·추이는 접기) 게이지 + 점수 + 비교 시점 + 추이 + 구성 지표. title/explain만 바꿔 시장·종목 모두에 씁니다. */
export function FearGreedCard({ fg, title, explain, indexLabel, compact = false }) {
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const uid = useId();
  const band = bandOf(fg.score);
  // 비교·추이·계산 설명 묶음. compact에서는 버튼 뒤로 접습니다.
  const detail = (
    <>
      {fg.compare?.length > 0 && (
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {fg.compare.map((c) => (
            <div key={c.label} className="rounded-lg bg-paper-raised px-2 py-2">
              <dt className="text-xs text-ink-faint">{c.label}</dt>
              <dd className="mt-0.5 text-sm font-bold text-ink">
                {c.score}<span className="block text-xs font-medium" style={{ color: bandOf(c.score).text }}>{bandOf(c.score).label.join(" ")}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-3">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="text-xs font-semibold text-ink">최근 {fg.history.length}거래일 추이</span>
          <span className="flex items-center gap-2 text-xs text-ink-faint">
            <span className="flex items-center gap-1"><span className="h-0.5 w-3 rounded bg-ink" />공포탐욕</span>
            {indexLabel && <span className="flex items-center gap-1"><span className="h-0.5 w-3 rounded bg-[#B9D4F7]" />{indexLabel} (오른쪽 축)</span>}
          </span>
        </div>
        <TrendChart history={fg.history} indexLabel={indexLabel} />
        {indexLabel && (() => {
          const raw = correlation(fg.history.map((p) => p.score), fg.history.map((p) => p.value));
          const r = raw == null ? null : Math.round(raw * 100) / 100; // 보이는 숫자와 문구가 같은 값을 쓰게
          return r == null ? null : (
            <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
              {corrText(r)} <span className="text-ink-faint">(상관계수 {r.toFixed(2)})</span>
            </p>
          );
        })()}
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-ink-soft hover:bg-[#E9ECEF]"
      >
        어떻게 계산하나요? <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 animate-pop space-y-2.5">
          {fg.components.map((c) => (
            <div key={c.key}>
              <div className="flex justify-between text-xs">
                <span className="text-ink">{c.label}</span>
                <span className="font-semibold text-ink">{c.score ?? "-"}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full" style={{ width: `${c.score ?? 0}%`, background: bandOf(c.score ?? 50).color }} />
              </div>
              <div className="mt-0.5 text-xs text-ink-faint">{c.desc}</div>
            </div>
          ))}
          <p className="pt-1 text-xs leading-relaxed text-ink-faint">{explain}</p>
        </div>
      )}
    </>
  );
  return (
    <div className={`rounded-xl bg-paper px-4 ${compact ? "pb-3" : "pb-4"} pt-3`}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="text-xs text-ink-faint">{asOfLabel(fg.date, fg.live)}</div>
      </div>

      <div className="mt-2 flex flex-col items-center">
        <Gauge score={fg.score} />
        <div className="-mt-1 text-[40px] font-bold leading-none tracking-tight text-ink">{fg.score}</div>
        <div className="mt-1 text-sm font-bold" style={{ color: band.text }}>{fg.label}</div>
      </div>

      {compact ? (
        <>
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">시장 심리를 보여주는 참고 지표예요. 매수·매도 시점을 알려주지 않아요.</p>
          <button
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            aria-controls={`fg-more-${uid}`}
            className="mt-1 flex min-h-11 w-full items-center justify-center gap-1 rounded-lg text-sm font-medium text-ink-soft hover:bg-[#E9ECEF]"
          >
            비교·추이 보기 <ChevronDown size={14} className={`transition-transform ${more ? "rotate-180" : ""}`} />
          </button>
          <div id={`fg-more-${uid}`} className={more ? "animate-pop" : "hidden"}>{detail}</div>
        </>
      ) : (
        detail
      )}
    </div>
  );
}
