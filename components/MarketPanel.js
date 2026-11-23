"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ChevronDown, ArrowUp, ArrowDown, Gauge as GaugeIcon, MessageSquareText, BarChart3 } from "lucide-react";
import { summarizeMarket } from "@/lib/marketSummary.mjs";
import TermLookup from "@/components/TermLookup";
import { FearGreedCard, Gauge, BANDS, bandOf } from "@/components/FearGreed";

const TILES = [
  { group: "kr", key: "kospi", label: "코스피", hint: "국내 대형주 전체 흐름", fmt: "index" },
  { group: "kr", key: "kosdaq", label: "코스닥", hint: "중소·성장주 흐름", fmt: "index" },
  { group: "kr", key: "usdkrw", label: "원/달러 환율", hint: "1달러를 사는 데 드는 원화", fmt: "won" },
  { group: "kr", key: "foreign", label: "외국인 순매수", hint: "외국인이 코스피에서 산 금액 − 판 금액", fmt: "flow" },
  { group: "kr", key: "ktb3", label: "국고채 3년", hint: "정부가 3년간 돈을 빌릴 때의 이자", fmt: "rate" },
  { group: "kr", key: "bbb", label: "회사채 3년 BBB-", hint: "신용이 낮은 회사가 3년간 돈을 빌릴 때의 이자", fmt: "rate" },
  { group: "us", key: "nasdaq", label: "나스닥", hint: "미국 기술주 중심 지수", fmt: "index" },
  { group: "us", key: "sp500", label: "S&P 500", hint: "밤사이 미국 대형주", fmt: "index" },
  { group: "us", key: "ust10", label: "미 국채 10년", hint: "미국 정부가 10년간 빌릴 때의 이자", fmt: "rate" },
  { group: "us", key: "t10y2y", label: "장단기 금리차", hint: "10년 금리 − 2년 금리, 음수면 경기 우려 신호", fmt: "rate" },
  { group: "us", key: "hy", label: "하이일드 스프레드", hint: "빚 갚을 힘이 약한 미국 기업이 정부보다 더 얹어 주는 이자. 커지면 불안 신호", fmt: "rate" },
  { group: "us", key: "wti", label: "WTI 유가", hint: "미국 원유 1배럴 가격", fmt: "usd" },
];

const num = (v, d = 2) => v.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const sign = (v) => (v > 0 ? "+" : "");
const tone = (v) => (v > 0 ? "text-up" : v < 0 ? "text-down" : "text-ink-faint");
const shortDate = (d) => (d ? `${Number(d.slice(4, 6))}월 ${Number(d.slice(6, 8))}일` : "");
// 국내와 미국 장 마감일이 다르면 둘 다 보여줍니다 (시차 때문에 미국이 하루 늦는 날이 많음)
function closeDates(d) {
  const kr = d.kr.kospi?.date, us = d.us.sp500?.date;
  return !us || us === kr ? `${shortDate(kr)} 종가` : `국내 ${shortDate(kr)} · 미국 ${shortDate(us)} 종가`;
}

// 등락: 색(상승 자홍·하락 파랑)과 화살표를 함께
function Delta({ v, children }) {
  const Icon = v > 0 ? ArrowUp : v < 0 ? ArrowDown : null;
  return (
    <span className={`inline-flex items-center gap-0.5 ${tone(v)}`}>
      {Icon && <Icon size={12} strokeWidth={2.5} aria-label={v > 0 ? "상승" : "하락"} />}
      {children}
    </span>
  );
}

// 지표 종류별 표시 형식: 값과 변화(색 포함)
function format(t, d) {
  if (t.fmt === "flow") {
    return { value: <span className={tone(d.value)}>{sign(d.value)}{num(d.value, 0)}억</span>, change: d.value >= 0 ? "순매수" : "순매도" };
  }
  if (t.fmt === "rate") {
    return { value: `${num(d.value, 2)}%`, change: d.change === null ? "" : <Delta v={d.change}>{sign(d.change)}{num(d.change, 2)}%p</Delta> };
  }
  return {
    value: t.fmt === "won" ? `${num(d.value, 1)}원` : t.fmt === "usd" ? `$${num(d.value, 2)}` : num(d.value, 2),
    change: d.changePct === null ? "" : <Delta v={d.changePct}>{sign(d.changePct)}{num(d.changePct, 2)}%</Delta>,
  };
}

function Tile({ t, d }) {
  if (!d) {
    return (
      <div className="rounded-xl bg-paper p-3">
        <div className="text-xs text-ink-faint">{t.label}</div>
        <div className="mt-1 text-sm text-ink-faint">불러오지 못함</div>
      </div>
    );
  }
  const { value, change } = format(t, d);
  return (
    <div className="rounded-xl bg-paper p-3">
      <div className="text-xs text-ink-soft">{t.label}</div>
      <div className="mt-0.5 text-base font-bold tracking-tight text-ink">{value}</div>
      <div className="text-xs font-medium text-ink-faint">{change}</div>
      <div className="mt-1 text-xs leading-snug text-ink-faint">{t.hint}</div>
    </div>
  );
}

// 상단 요약과 아래 상세 패널이 요청 하나를 나눠 씁니다. 실패하면 retry()로 둘 다 다시 받습니다.
let marketPromise = null;
let marketAt = 0;
const MARKET_TTL = 60 * 60 * 1000; // 1시간 지나면 다시 받음
const listeners = new Set();
function loadMarket() {
  if (marketPromise && Date.now() - marketAt > MARKET_TTL) marketPromise = null;
  if (!marketPromise) marketAt = Date.now();
  marketPromise ??= fetch("/api/market")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d) => (d.error ? Promise.reject(new Error(d.error)) : d))
    .catch((e) => {
      marketPromise = null;
      throw e;
    });
  return marketPromise;
}
function useMarket() {
  const [state, setState] = useState({ data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const bump = () => setAttempt((n) => n + 1);
    listeners.add(bump);
    return () => listeners.delete(bump);
  }, []);
  useEffect(() => {
    let alive = true;
    setState((s) => (s.error ? { data: null, error: null } : s));
    loadMarket().then((data) => alive && setState({ data, error: null }), (e) => alive && setState({ data: null, error: e.message }));
    return () => {
      alive = false;
    };
  }, [attempt]);
  return { ...state, retry: () => listeners.forEach((f) => f()) };
}

function LoadError({ onRetry }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl bg-paper px-4 py-4">
      <p className="text-sm text-ink-soft">시장 지표를 지금은 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
      <button onClick={onRetry} className="min-h-11 rounded-full bg-paper-raised px-4 text-sm font-semibold text-ink shadow-sm hover:bg-[#E9ECEF]">
        다시 시도
      </button>
    </div>
  );
}

// 값 → 게이지 위치(0~100). lo~hi 밖은 양 끝에 붙입니다.
const scale = (v, lo, hi) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
const zone = (from, to, label, color, text) => ({ from, to, label: [label], color, text });
// 출렁임 정도를 한 방향 단계로: 평온(청회색) → 보통(회색) → 불안(주황) → 공포(빨강). 좋음/나쁨 초록은 쓰지 않음
const CALM = ["#9DB7D5", "#3D5A80"], GRAY = ["#B0B8C1", "#4E5968"], ORANGE = ["#FF8A5B", "#B54708"], RED = ["#E5303C", "#C81E2A"];

// 게이지 지표. strip: 메인 상단 "오늘의 시장 온도"에 보일지, market: 아래 상세 탭 중 어디에 속하는지.
// 구간 기준은 흔히 쓰는 참고선이며 매수·매도 신호가 아닙니다.
const GAUGES = [
  {
    key: "fg",
    market: "kr",
    strip: true,
    title: "코스피 공포탐욕",
    hint: "한국 시장 투자 심리",
    pick: (d) => d.fearGreed && { pos: d.fearGreed.score, value: d.fearGreed.score },
    bands: BANDS,
    needsKey: true,
  },
  {
    key: "usfg",
    market: "us",
    strip: true,
    title: "미국 공포탐욕",
    hint: "미국 시장 투자 심리",
    pick: (d) => d.usFearGreed && { pos: d.usFearGreed.score, value: d.usFearGreed.score },
    bands: BANDS,
  },
  {
    key: "rsi",
    market: "kr",
    title: "코스피 RSI",
    hint: "최근 2주 오른 힘의 비율 (70↑ 과열)",
    pick: (d) => d.kospiRsi && { pos: d.kospiRsi.value, value: Math.round(d.kospiRsi.value) },
    bands: [zone(0, 30, "과매도", ...ORANGE), zone(30, 70, "보통", ...GRAY), zone(70, 100, "과매수", ...ORANGE)],
    needsKey: true,
  },
  {
    key: "nasdaqRsi",
    market: "us",
    title: "나스닥 RSI",
    hint: "미국 기술주가 최근 2주 오른 힘의 비율",
    pick: (d) => d.nasdaqRsi && { pos: d.nasdaqRsi.value, value: Math.round(d.nasdaqRsi.value) },
    bands: [zone(0, 30, "과매도", ...ORANGE), zone(30, 70, "보통", ...GRAY), zone(70, 100, "과매수", ...ORANGE)],
  },
  {
    key: "vix",
    market: "us",
    title: "VIX",
    hint: "앞으로 한 달 미국 주가 출렁임 예상",
    pick: (d) => d.us.vix && { pos: scale(d.us.vix.value, 10, 40), value: d.us.vix.value.toFixed(2) },
    // 10~40을 게이지 폭으로: 15↓ 안정, 15~20 보통, 20~30 불안, 30↑ 공포
    bands: [zone(0, 16.7, "잔잔", ...CALM), zone(16.7, 33.3, "보통", ...GRAY), zone(33.3, 66.7, "출렁", ...ORANGE), zone(66.7, 100, "크게 출렁", ...RED)],
  },
  {
    key: "vxn",
    market: "us",
    title: "VXN",
    hint: "앞으로 한 달 나스닥 기술주 출렁임 예상",
    pick: (d) => d.us.vxn && { pos: scale(d.us.vxn.value, 12, 45), value: d.us.vxn.value.toFixed(2) },
    // 12~45를 게이지 폭으로: 20↓ 안정, 20~25 보통, 25~35 불안, 35↑ 공포 (VIX보다 평소 수준이 높음)
    bands: [zone(0, 24.2, "잔잔", ...CALM), zone(24.2, 39.4, "보통", ...GRAY), zone(39.4, 69.7, "출렁", ...ORANGE), zone(69.7, 100, "크게 출렁", ...RED)],
  },
];

// 요약의 각 지표가 아래 어느 탭에 있는지
const US_LABELS = new Set([...GAUGES.filter((g) => g.market === "us").map((g) => g.title), "하이일드 스프레드", "장단기 금리차"]);

// 위쪽 게이지·요약에서 아래 상세 탭을 열고 그 자리로 이동 (#market-kr / #market-us 주소로도 바로 열림)
function openMarket(e, key) {
  e.preventDefault();
  history.replaceState(null, "", `#market-${key}`);
  window.dispatchEvent(new Event("market-tab"));
}

function GaugeTile({ g, data, link }) {
  const r = data ? g.pick(data) : null;
  const band = r ? (g.bands === BANDS ? bandOf(r.pos) : g.bands.find((b) => r.pos >= b.from && r.pos <= b.to) ?? g.bands[0]) : null;
  const Box = link ? "a" : "div";
  return (
    <li>
    <Box
      {...(link && { href: `#market-${g.market}`, onClick: (e) => openMarket(e, g.market) })}
      className={`flex h-full flex-col items-center justify-center rounded-xl bg-paper px-2 pb-3 pt-2.5 text-center ${link ? "transition-colors hover:bg-[#E9ECEF]" : ""}`}
    >
      <div className="text-xs font-semibold text-ink">{g.title}</div>
      <div className="mt-1.5 w-full max-w-[120px]">
        <Gauge score={r ? r.pos : null} bands={r ? g.bands : g.bands.map((b) => ({ ...b, color: "#EEF0F3" }))} mini ariaLabel={r ? `${g.title} ${r.value}, ${band.label.join(" ")}` : `${g.title} 준비 중`} />
      </div>
      {r ? (
        <>
          <div className="mt-1 text-xl font-bold leading-none tracking-tight text-ink">{r.value}</div>
          <div className="mt-1 text-xs font-bold" style={{ color: band.text }}>{band.label.join(" ")}</div>
        </>
      ) : (
        <div className="mt-1 text-xs text-ink-faint">{data ? "잠시 후 다시 확인해 주세요" : "불러오는 중"}</div>
      )}
      <div className="mt-1 text-xs leading-snug text-ink-faint">{g.hint}</div>
    </Box>
    </li>
  );
}

/** 메인 화면 맨 위: 오늘 꼭 볼 지표를 게이지로 한눈에 */
// 출렁임 단계: 청회색(잔잔) → 회색 → 주황 → 빨강. 좋음/나쁨 초록은 쓰지 않습니다.
const TONE = {
  good: { text: "#3D5A80", bg: "#EEF3F8" },
  neutral: { text: "#4E5968", bg: "#F2F4F6" },
  caution: { text: "#B54708", bg: "#FFF1EA" },
  risk: { text: "#C81E2A", bg: "#FDECEE" },
};

// 게이지 지표를 합친 오늘의 시장 분위기(출렁임 정도). 누르면 지표별 이유가 펼쳐집니다.
function MarketVerdict({ data }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const sum = data ? summarizeMarket(data) : null;
  if (!sum) return null;
  const t = TONE[sum.level];
  // 단계를 끌어올린 지표(주의·경계)를 최대 3개 먼저, 나머지는 접어 둡니다
  const key = sum.reasons.filter((r) => r.risk >= 1).slice(0, 3);
  const top = key.length ? key : sum.reasons.slice(0, 3);
  const rest = sum.reasons.filter((r) => !top.includes(r));
  const shown = showAll ? sum.reasons : top;
  const toSearch = () => {
    const el = document.getElementById("company-search");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  };
  return (
    <div className="mt-3 rounded-xl bg-paper">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="mood-detail" className="flex min-h-11 w-full items-center gap-3 px-4 pt-3.5 text-left">
        <span className="shrink-0 rounded-md px-2 py-1 text-xs font-bold" style={{ color: t.text, background: t.bg }}>{sum.label}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-xs font-medium text-ink-soft"><MessageSquareText size={14} className="shrink-0 text-ink-soft" aria-hidden="true" />시장 온도 한 줄 요약</span>
          <span className="block text-sm font-bold text-ink">{sum.title}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {/* 닫혀 있어도 보이게: 핵심 기능(내 회사 확인)으로 가는 길 */}
      <div className="px-4 pb-3.5 pt-2.5">
        <button onClick={toSearch} className="min-h-11 w-full rounded-full bg-amber px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#1557C0]">
          내 회사 확인하기
        </button>
      </div>
      {open && (
        <div id="mood-detail" className="animate-pop px-4 pb-4">
          <p className="text-sm leading-relaxed text-ink">{sum.note}</p>
          <ul className="mt-3 space-y-2">
            {shown.map((r) => {
              const rt = r.risk >= 2 ? TONE.risk : r.risk === 1 ? TONE.caution : TONE.neutral;
              return (
                <li key={r.label} className="rounded-lg bg-paper-raised px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
                    <span className="font-semibold text-ink">
                      {r.label}
                      {(() => {
                        const m = US_LABELS.has(r.label) ? "us" : "kr";
                        return <a href={`#market-${m}`} onClick={(e) => openMarket(e, m)} className="font-normal text-ink-faint underline underline-offset-2"> · 아래에서 보기</a>;
                      })()}
                    </span>
                    <span className="font-bold" style={{ color: rt.text }}>{r.value} · {r.state}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">{r.text}</p>
                </li>
              );
            })}
          </ul>
          {rest.length > 0 && (
            <button onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="mt-2 flex min-h-11 w-full items-center justify-center gap-1 rounded-lg text-xs font-medium text-ink-soft hover:bg-[#E9ECEF]">
              {showAll ? "핵심 지표만 보기" : `나머지 지표 ${rest.length}개 보기`} <ChevronDown size={14} className={`transition-transform ${showAll ? "rotate-180" : ""}`} />
            </button>
          )}
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            {sum.partial && "국내 지표(공포탐욕·RSI)가 빠진 상태의 요약이에요. "}
            지표마다 출렁임 정도를 점수로 매겨 평균한 단순 규칙이에요.
          </p>
        </div>
      )}
    </div>
  );
}

/** 메인 화면: 국내·미국 투자 심리 게이지 2개와 한 줄 요약. 나머지 지표는 아래 상세 탭에 있습니다. */
export function MarketStrip() {
  const { data, error, retry } = useMarket();
  return (
    <section className="w-full rounded-2xl bg-paper-raised p-4" aria-labelledby="strip-title">
      <h2 id="strip-title" className="mb-3 flex items-center gap-2 px-1 text-[15px] font-bold text-ink"><GaugeIcon size={18} className="shrink-0 text-ink-soft" aria-hidden="true" />오늘의 시장 온도</h2>
      {error ? (
        <LoadError onRetry={retry} />
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {GAUGES.filter((g) => g.strip).map((g) => <GaugeTile key={g.key} g={g} data={data} link />)}
        </ul>
      )}
      <div className="mt-1 flex justify-end px-1">
        <a href="#market-kr" onClick={(e) => openMarket(e, "kr")} className="flex min-h-11 items-center text-xs font-medium text-ink-faint hover:text-ink">
          {data?.kr.kospi ? `${closeDates(data)} · RSI·VIX 등 자세히` : "불러오는 중"}
        </a>
      </div>
      {!error && <MarketVerdict data={data} />}
    </section>
  );
}

function FearGreedSlot({ fg }) {
  if (!fg) {
    return (
      <div className="rounded-xl bg-paper px-4 py-4 text-sm text-ink-soft">
        <div className="font-semibold text-ink">코스피 공포탐욕지수</div>
        <p className="mt-1 text-xs leading-relaxed text-ink-faint">
          국내 투자 심리 지표를 지금은 불러오지 못했어요. 잠시 후 다시 확인해 주세요.
        </p>
      </div>
    );
  }
  return (
    <FearGreedCard
      fg={fg}
      compact
      title="코스피 공포탐욕지수"
      indexLabel="코스피"
      explain="CNN Fear & Greed 방식처럼 각 지표의 오늘 값이 최근 1년 중 어디쯤인지(백분위)를 0~100점으로 바꿔 평균했어요. 시장 심리를 보여주는 참고 지표이며, 매수·매도 시점을 알려주지 않아요."
    />
  );
}

const MARKET_TABS = [
  { key: "kr", label: "국내" },
  { key: "us", label: "미국" },
];

export default function MarketPanel() {
  const { data, error, retry } = useMarket();
  const [tab, setTab] = useState("kr");
  const [allTiles, setAllTiles] = useState(false);
  const ref = useRef(null);
  const tabRefs = useRef({});

  const pick = (key) => {
    setTab(key);
    setAllTiles(false); // 펼침 상태는 탭마다 새로
    try {
      localStorage.setItem("market-tab", key); // 다음 방문 때 같은 탭으로
    } catch {}
  };

  // #market-kr / #market-us 로 들어오거나 위쪽 게이지·요약 링크를 누르면 그 탭을 열고 이동
  useEffect(() => {
    const sync = () => {
      const m = location.hash.match(/^#market-(kr|us)$/);
      if (!m) return;
      pick(m[1]);
      setAllTiles(true); // 지표를 보러 온 진입은 전체 지표도 펼침
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    // 주소에 탭이 없으면 지난번에 본 탭을 엽니다 (스크롤은 하지 않음)
    if (!location.hash.startsWith("#market-")) {
      try {
        const saved = localStorage.getItem("market-tab");
        if (saved === "kr" || saved === "us") setTab(saved);
      } catch {}
    }
    sync();
    window.addEventListener("market-tab", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("market-tab", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  // 탭 목록에서 ←/→ 로 옮겨 다니기 (WAI-ARIA 탭 패턴)
  const onTabKey = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const n = MARKET_TABS.length;
    const next = MARKET_TABS[(MARKET_TABS.findIndex((t) => t.key === tab) + (e.key === "ArrowRight" ? 1 : -1) + n) % n].key;
    pick(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section ref={ref} id="market" className="w-full scroll-mt-20 rounded-2xl bg-paper-raised p-4 lg:p-5" aria-labelledby="market-title">
      <TermLookup containerRef={ref} context="메인 화면 시장 지표 설명" />
      <h2 id="market-title" className="flex items-center gap-2 text-lg font-bold tracking-tight text-ink"><BarChart3 size={20} className="shrink-0 text-ink-soft" aria-hidden="true" />시장 지표 자세히</h2>
      <p className="mb-2 mt-1 text-xs text-ink-faint">모르는 용어는 손가락이나 마우스로 선택하면 뜻을 볼 수 있어요.</p>
      {error && <LoadError onRetry={retry} />}
      {!data && !error && (
        <div className="flex items-center gap-2 py-6 text-sm text-ink-faint">
          <Loader2 size={15} className="animate-spin" /> 시장 지표를 불러오는 중...
        </div>
      )}
      {data && (
        <>
          <div role="tablist" aria-label="시장 선택" onKeyDown={onTabKey} className="mb-3 inline-flex rounded-xl bg-paper p-1">
            {MARKET_TABS.map((t) => (
              <button
                key={t.key}
                ref={(el) => (tabRefs.current[t.key] = el)}
                role="tab"
                id={`market-tab-${t.key}`}
                aria-selected={tab === t.key}
                aria-controls="market-tabpanel"
                tabIndex={tab === t.key ? 0 : -1}
                onClick={() => pick(t.key)}
                className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition-colors ${tab === t.key ? "bg-paper-raised text-ink shadow-sm" : "text-ink-faint hover:text-ink"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* PC: 공포탐욕 카드와 지표 타일을 나란히 · 모바일: 카드 아래 타일은 눌러서 펼침 */}
          <div id="market-tabpanel" role="tabpanel" aria-labelledby={`market-tab-${tab}`} className="lg:grid lg:grid-cols-2 lg:gap-4">
            {tab === "kr" ? (
              <FearGreedSlot fg={data.fearGreed} />
            ) : data.usFearGreed ? (
              <FearGreedCard
                fg={data.usFearGreed}
                compact
                title="미국 공포탐욕지수"
                indexLabel="S&P 500"
                explain="CNN Fear & Greed와 같은 방식으로, 7개 지표 중 공식 무료 데이터(미국 연준 FRED)로 구할 수 있는 5개(모멘텀·주가 강도·VIX·정크본드 수요·안전자산 수요)를 써서 직접 계산했어요. CNN 발표 값과는 조금 다를 수 있어요. 매수·매도 시점을 알려주지 않아요."
              />
            ) : (
              <div className="rounded-xl bg-paper px-4 py-4 text-sm text-ink-soft">미국 투자 심리 지표를 지금은 불러오지 못했어요.</div>
            )}
            {/* PC: 게이지 칸을 왼쪽 카드 높이만큼 늘려 빈칸을 없앰. 왼쪽 비교·추이를 펼쳐도 너무 커지지 않게 상한을 둠 */}
            <div className="mt-4 lg:mt-0 lg:flex lg:flex-col">
              {(() => {
                const gs = GAUGES.filter((g) => g.market === tab && !g.strip);
                // 국내 1개는 한 칸, 미국 3개는 sm 이상에서 3열
                return (
                  <ul className={`grid grid-cols-1 gap-2 lg:max-h-[320px] lg:flex-1 ${gs.length === 1 ? "sm:grid-cols-1" : "sm:grid-cols-3"}`}>
                    {gs.map((g) => <GaugeTile key={g.key} g={g} data={data} />)}
                  </ul>
                );
              })()}
              <button
                onClick={() => setAllTiles((v) => !v)}
                aria-expanded={allTiles}
                aria-controls="market-tiles"
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-1 rounded-lg text-xs font-medium text-ink-soft hover:bg-[#E9ECEF]"
              >
                {allTiles ? "지표 접기" : `${tab === "kr" ? "국내" : "미국"} 지표 전체 보기`} <ChevronDown size={14} className={`transition-transform ${allTiles ? "rotate-180" : ""}`} />
              </button>
              <div id="market-tiles" className={`mt-3 ${allTiles ? "" : "hidden"}`}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TILES.filter((t) => t.group === tab).map((t) => <Tile key={t.key} t={t} d={data[tab][t.key]} />)}
                </div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-faint">{closeDates(data)} 기준 · {data.sources}</p>
        </>
      )}
    </section>
  );
}
