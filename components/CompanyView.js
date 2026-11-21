"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChevronDown, ChevronRight, ExternalLink, X, ArrowRight,
  Info, Check, AlertCircle, Loader2, ArrowLeft, TrendingUp, Heart,
} from "lucide-react";
import { addRecent, isFavorite, toggleFavorite } from "@/lib/watchlist";

const TABS = [
  ["overview", "기업 이해"],
  ["chart", "차트"],
  ["financials", "실적"],
  ["issues", "이슈"],
  ["checkpoints", "체크포인트"],
  ["thesis", "투자 논리"],
];
import { SourceBadge, FlowChain, SectionLabel } from "@/components/ui";
import TermLookup from "@/components/TermLookup";
import StockSentiment from "@/components/StockSentiment";
import PriceChart from "@/components/PriceChart";
import AdSlot from "@/components/AdSlot";

const PIE_COLORS = ["#3182F6", "#3DC3A6", "#79C6F2", "#FFC342", "#F79A3B"]; // single blue scale: segments are categories, not good/bad
const METRIC_KEY_MAP = { "매출액": "revenue", "영업이익": "operatingProfit", "당기순이익": "netIncome" };

function formatWon(n) {
  if (n === null || n === undefined) return "-";
  const eok = n / 100_000_000; // 억원 단위
  return `${eok.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}억원`;
}

// 전년 대비 증감: 한국 시장 관례대로 상승=빨강, 하락=파랑
function YoY({ now, prev }) {
  if (!prev) return <div className="mt-0.5 text-xs text-ink-faint">전년 {formatWon(prev)}</div>;
  const pct = ((now - prev) / Math.abs(prev)) * 100;
  const up = pct >= 0;
  return (
    <div className="mt-0.5 text-xs text-ink-faint">
      전년 대비 <span className={`font-semibold ${up ? "text-up" : "text-down"}`}>{up ? "+" : ""}{pct.toFixed(1)}%</span>
    </div>
  );
}

/* ----------------------------- 재무 추이 그래프 모달 ----------------------------- */
function TrendModal({ metricLabel, loading, error, trend, onClose }) {
  const field = METRIC_KEY_MAP[metricLabel];
  const chartData = (trend || [])
    .filter((d) => d[field] !== null && d[field] !== undefined)
    .map((d) => ({ year: `${d.year}`, value: Math.round(d[field] / 100_000_000) }));

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/40 px-0 sm:items-center sm:px-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full animate-sheet-up overflow-y-auto rounded-t-xl bg-paper-raised sm:max-w-lg sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-paper-raised px-6 py-4">
          <span className="text-sm font-semibold text-ink">{metricLabel} 추이</span>
          <button onClick={onClose} aria-label="닫기" className="rounded-full p-2.5 hover:bg-black/5"><X size={18} className="text-ink-faint" /></button>
        </div>

        <div className="px-6 py-6">
          {loading && (
            <div className="flex flex-col items-center gap-2 py-10 text-ink-faint">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-xs">DART에서 연도별 데이터를 불러오는 중...</span>
            </div>
          )}
          {!loading && error && (
            <div className="py-6 text-center text-xs text-red">추이 데이터를 불러오지 못했어요: {error}</div>
          )}
          {!loading && !error && chartData.length === 0 && (
            <div className="py-6 text-center text-xs text-ink-faint">공시된 연도별 데이터가 충분하지 않아요.</div>
          )}
          {!loading && !error && chartData.length > 0 && (
            <>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#E5E8EB" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#5B6573" }} axisLine={{ stroke: "#E5E8EB" }} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#5B6573" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v.toLocaleString("ko-KR")}억`}
                      width={64}
                    />
                    <RTooltip formatter={(v) => [`${v.toLocaleString("ko-KR")}억원`, metricLabel]} />
                    <Line type="monotone" dataKey="value" stroke="#3182F6" strokeWidth={2.5} dot={{ r: 3, fill: "#3182F6" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 text-center text-xs text-ink-faint">출처: DART 오픈API 사업보고서(연결재무제표) 기준</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- 투자 논리 점검 모달 ----------------------------- */
function InvestmentCheck({ company, businesses, issues, initialReason, onClose }) {
  const [input, setInput] = useState(initialReason || "");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);

  const context = useMemo(() => {
    const issuesText = (issues || []).map((i) => `- ${i.title}: ${i.explain}`).join("\n");
    return `기업명: ${company.name} (${company.ticker})\n산업: ${company.industry}\n한 줄 요약: ${company.oneLiner}\n사업 구조: ${businesses.map((b) => `${b.name} ${b.pct}%`).join(", ")}\n최근 핵심 이슈:\n${issuesText}`;
  }, [company, businesses, issues]);

  const runCheck = useCallback(async () => {
    if (!input.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/investment-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: company.name, context, userReason: input }),
      });
      if (!res.ok) throw new Error("분석 실패");
      const data = await res.json();
      setResult(data);
      setStatus("done");
    } catch (e) {
      setStatus("error");
    }
  }, [input, company.name, context]);

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/40 px-0 sm:items-center sm:px-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full animate-sheet-up overflow-y-auto rounded-t-xl bg-paper-raised sm:max-w-xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-paper-raised px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">투자 논리 점검 · {company.name}</span>
          </div>
          <button onClick={onClose} aria-label="닫기" className="rounded-full p-2.5 hover:bg-black/5"><X size={18} className="text-ink-faint" /></button>
        </div>

        <div className="px-6 py-5">
          {status !== "done" && (
            <>
              <label className="mb-2 block text-sm font-medium text-ink">왜 {company.name}에 투자하려고 하시나요?</label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="예: 요즘 관련 뉴스가 잘된다고 해서요 / 친구가 추천해서요"
                rows={3}
                className="w-full resize-none rounded-lg border border-line bg-paper px-4 py-3 text-sm text-ink outline-none"
              />
              <button
                onClick={runCheck}
                disabled={!input.trim() || status === "loading"}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber py-3.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {status === "loading" ? (<><Loader2 size={16} className="animate-spin" /> 투자 논리 분석 중...</>) : (<>투자 논리 점검하기 <ArrowRight size={15} aria-hidden="true" /></>)}
              </button>
              {status === "error" && (
                <div className="mt-3 flex items-center gap-2 text-xs text-red"><AlertCircle size={14} /> 분석에 실패했어요. 다시 시도해주세요.</div>
              )}
            </>
          )}

          {status === "done" && result && (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-medium text-ink-faint">내가 입력한 투자 이유</div>
                <div className="mt-1 rounded-xl bg-paper px-3.5 py-2.5 text-sm text-ink-soft">{input}</div>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight size={14} className="text-ink-faint" />
                <span className="rounded-full bg-amber-soft px-2.5 py-1 text-xs font-semibold text-amber">근거 유형 · {result.reasonType}</span>
              </div>
              <div>
                <div className="text-xs font-medium text-ink-faint">AI가 이해한 투자 논리</div>
                <div className="mt-1 text-sm leading-relaxed text-ink">{result.understood}</div>
              </div>
              {result.confirmed?.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-green"><Check size={13} /> 잘 확인한 부분</div>
                  <ul className="space-y-1.5">
                    {result.confirmed.map((c, i) => <li key={i} className="rounded-xl bg-green-soft px-3.5 py-2 text-sm text-ink">{c}</li>)}
                  </ul>
                </div>
              )}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand-blue"><Info size={13} /> 추가로 확인이 필요한 부분</div>
                <ul className="space-y-1.5">
                  {result.needsCheck?.map((c, i) => <li key={i} className="rounded-xl bg-brand-blue-soft px-3.5 py-2 text-sm text-ink">{c}</li>)}
                </ul>
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold text-ink">투자 판단 전 확인해야 할 핵심 정보</div>
                <ul className="space-y-1.5">
                  {result.checklist?.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink-soft">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />{c}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-line bg-paper p-4 text-sm leading-relaxed text-ink-soft">{result.guidance}</div>
              <div className="text-center text-xs text-ink-faint">최종 투자 판단은 본인의 몫입니다. 이 분석은 판단을 대신하지 않습니다.</div>
              <button onClick={() => { setStatus("idle"); setInput(""); setResult(null); }} className="w-full rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft">
                다시 입력하기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- 기업 상세 메인 ----------------------------- */
export default function CompanyView({ ticker }) {
  const router = useRouter();
  const contentRef = useRef(null);
  const [openIssue, setOpenIssue] = useState(0);
  const [openCheckpoint, setOpenCheckpoint] = useState(null);
  const [checkOpen, setCheckOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [issuesData, setIssuesData] = useState(null); // { news, newsError, issues, issuesError }
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [trend, setTrend] = useState(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState(null);
  const [activeMetric, setActiveMetric] = useState(null); // "매출액" | "영업이익" | "당기순이익" | null
  const [fav, setFav] = useState(false);
  const [activeTab, setActiveTab] = useState(TABS[0][0]);

  // STEP 1·2(빠른 부분)를 먼저 불러옵니다.
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetch(`/api/company/${ticker}`)
      .then((res) => res.json())
      .then((json) => { if (!cancelled) setData(json); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [ticker]);

  // STEP 1·2가 뜬 뒤, 시간이 걸리는 STEP 3(뉴스·이슈 분석)를 별도로 불러옵니다.
  useEffect(() => {
    if (!data || data.error) return;
    let cancelled = false;
    setIssuesData(null);
    setIssuesLoading(true);
    fetch(`/api/company/${ticker}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: data.company.name,
        oneLiner: data.company.oneLiner,
        businesses: data.company.businesses,
      }),
    })
      .then((res) => res.json())
      .then((json) => { if (!cancelled) setIssuesData(json); })
      .catch((e) => { if (!cancelled) setIssuesData({ issuesError: e.message, issues: [], news: [] }); })
      .finally(() => { if (!cancelled) setIssuesLoading(false); });
    return () => { cancelled = true; };
  }, [ticker, data]);

  // 기업 정보가 뜨면 최근 본 종목에 기록하고 관심 여부를 읽습니다.
  useEffect(() => {
    if (!data?.company) return;
    addRecent(data.company);
    setFav(isFavorite(data.company.ticker));
  }, [data]);

  // 스크롤 위치에 맞춰 상단 탭 강조
  useEffect(() => {
    if (!data?.company) return;
    const els = TABS.map(([id]) => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActiveTab(e.target.id)),
      { rootMargin: "-130px 0px -60% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [data]);

  if (error) {
    return <div className="mx-auto max-w-lg px-6 py-20 text-center text-sm text-red">데이터를 불러오지 못했습니다: {error}</div>;
  }
  if (!data) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
        <Loader2 size={22} className="animate-spin text-amber" />
        <div className="mt-3 text-sm text-ink-soft">기업 정보와 재무 데이터를 불러오는 중...</div>
      </div>
    );
  }
  if (data.error) {
    return <div className="mx-auto max-w-lg px-6 py-20 text-center text-sm text-red">{data.error}</div>;
  }

  const { company, aiGenerated, financials, financialsError } = data;
  const issues = issuesData?.issues || [];
  const issuesError = issuesData?.issuesError || null;

  const openTrend = (metricLabel) => {
    setActiveMetric(metricLabel);
    if (trend === null && !trendLoading) {
      setTrendLoading(true);
      setTrendError(null);
      fetch(`/api/company/${ticker}/trend?corpCode=${company.corpCode}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.error) setTrendError(json.error);
          else setTrend(json.trend);
        })
        .catch((e) => setTrendError(e.message))
        .finally(() => setTrendLoading(false));
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-5 pb-28 pt-6 sm:px-6 lg:max-w-6xl lg:px-8" ref={contentRef}>
      <TermLookup containerRef={contentRef} context={`${company.name} 기업 설명 페이지`} />
      <div className="mb-5">
        <button onClick={() => router.push("/")} className="flex items-center gap-1.5 text-sm font-medium text-ink-soft">
          <ArrowLeft size={15} /> 검색으로
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-10">
      <aside className="no-scrollbar lg:sticky lg:top-[64px] lg:max-h-[calc(100vh-80px)] lg:overflow-y-auto lg:pb-4">
      {/* Section 1 */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-lg font-bold text-white" aria-hidden="true">{company.name.slice(0, 1)}</div>
          <div>
            <h1 className="font-serif text-2xl font-bold leading-tight tracking-tight text-ink">
              {company.name} <span className="text-sm font-medium text-ink-faint">{company.ticker}</span>
            </h1>
            <div className="mt-0.5 text-xs text-ink-faint">{company.industry}</div>
          </div>
          <button
            onClick={() => setFav(toggleFavorite(company))}
            aria-pressed={fav}
            aria-label={fav ? "즐겨찾기에서 빼기" : "즐겨찾기에 추가"}
            className="ml-auto rounded-full p-2.5 hover:bg-black/5"
          >
            <Heart size={22} className={fav ? "fill-up text-up" : "text-ink-faint"} />
          </button>
        </div>
        {aiGenerated && (
          <div className="mt-3 flex items-start gap-1.5 border-l-2 border-amber bg-amber-soft/50 px-3 py-2 text-xs leading-relaxed text-ink-soft">
            <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber" aria-hidden="true" /> AI가 생성한 기업 정보입니다 — 참고용으로만 확인하고, 투자 전 실제 공시자료로 검증하세요.
          </div>
        )}
      </div>

      <div className="mb-6">
        <StockSentiment ticker={company.ticker} name={company.name} />
      </div>

      </aside>

      <main className="min-w-0">
      <nav className="sticky top-0 z-20 lg:top-[45px] -mx-5 mb-6 flex gap-1 overflow-x-auto bg-paper/95 px-5 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0" aria-label="섹션 이동">
        {TABS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={activeTab === id ? "true" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ${activeTab === id ? "bg-paper-raised text-ink shadow-sm" : "text-ink-faint hover:text-ink"}`}
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Section 2 — 10초 이해 */}
      <section id="overview" className="mb-10 scroll-mt-32 animate-fade-up" style={{ animationDelay: "0ms" }}>
        <SectionLabel eyebrow="01" title="10초 만에 기업 이해하기" />
        <div className="rounded-2xl bg-paper-raised p-5">
          <p className="text-sm leading-relaxed text-ink">{company.oneLiner}</p>
          <dl className="mt-4 space-y-3 border-t border-line pt-4 text-sm">
            {[["대표 제품", company.products], ["주요 고객", company.customers], ["주요 경쟁사", company.competitors]].map(([label, val]) => (
              <div key={label} className="flex gap-4">
                <dt className="w-20 shrink-0 text-ink-faint">{label}</dt>
                <dd className="leading-relaxed text-ink">{val}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Section 3 — 실시간 재무 실적 (DART) */}
      <section id="chart" className="mb-10 scroll-mt-32">
        <SectionLabel eyebrow="02" title="주가 흐름은 어떤가요?" />
        <PriceChart ticker={company.ticker} />
      </section>

      <section id="financials" className="mb-10 scroll-mt-32 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <SectionLabel eyebrow="03" title="최근 실적은 어떤가요?" />
        <div className="rounded-2xl bg-paper-raised p-5">
          {financials ? (
            <>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-faint">
                <TrendingUp size={13} /> {financials.fiscalYear}년 사업보고서 기준 ({financials.reportBasis})
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {["매출액", "영업이익", "당기순이익"].map((key) => {
                  const acc = financials.accounts[key];
                  if (!acc) return null;
                  return (
                    <button
                      key={key}
                      onClick={() => openTrend(key)}
                      className="rounded-xl bg-paper px-4 py-3 text-left transition-colors hover:bg-[#E9ECEF]"
                    >
                      <div className="flex items-center justify-between text-xs font-medium text-ink-faint">
                        {key}
                        <TrendingUp size={12} className="text-ink-faint" />
                      </div>
                      <div className="mt-1 font-mono text-lg font-bold tracking-tight text-ink">{formatWon(acc.thisYear)}</div>
                      {acc.lastYear !== null && <YoY now={acc.thisYear} prev={acc.lastYear} />}
                      <div className="mt-1 text-[10px] font-medium text-amber">추이 그래프 보기</div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3"><SourceBadge label={financials.source} /></div>
            </>
          ) : (
            <div className="text-xs text-ink-faint">
              {financialsError
                ? `실시간 재무 데이터를 불러오지 못했어요 (${financialsError})`
                : "이 기업의 사업보고서 재무 데이터를 DART에서 찾지 못했어요. 최근 공시가 없거나 계정 구조가 다를 수 있어요."}
            </div>
          )}

          <div className="mt-5 border-t border-line pt-5">
            <div className="mb-3 flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={company.businesses} dataKey="pct" nameKey="name" innerRadius={40} outerRadius={65} paddingAngle={2}>
                      {company.businesses.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <RTooltip formatter={(v) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full flex-1 space-y-2">
                {company.businesses.map((b, i) => (
                  <div key={b.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-ink-soft">
                      <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {b.name}
                    </span>
                    <span className="font-mono font-medium text-ink">{b.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-sm leading-relaxed text-ink-soft">{company.businessExplain}</p>
            <div className="mt-3"><SourceBadge label={company.businessSource} /></div>
          </div>
        </div>
      </section>

      {/* Section 4+5 — 실시간 뉴스 기반 이슈 */}
      <section id="issues" className="mb-10 scroll-mt-32 animate-fade-up" style={{ animationDelay: "160ms" }}>
        <SectionLabel eyebrow="04" title="요즘 이 회사에 무슨 일이 있나요?" />
        {issuesLoading && (
          <div className="flex items-center gap-2 rounded-2xl bg-paper-raised px-4 py-4 text-xs text-ink-faint">
            <Loader2 size={14} className="animate-spin" /> 최신 뉴스를 분석해서 핵심 이슈를 정리하는 중이에요...
          </div>
        )}
        {!issuesLoading && issuesError && (
          <div className="mb-3 flex items-center gap-2 text-xs text-red"><AlertCircle size={13} /> 이슈 분석 실패: {issuesError}</div>
        )}
        {!issuesLoading && issues.length === 0 && !issuesError && (
          <div className="text-xs text-ink-faint">최근 관련 뉴스를 찾지 못했어요.</div>
        )}
        <div className="space-y-3">
          {issues.map((issue, i) => {
            const open = openIssue === i;
            return (
              <div key={issue.title} className="overflow-hidden rounded-2xl bg-paper-raised">
                <button onClick={() => setOpenIssue(open ? null : i)} className="flex w-full items-center justify-between px-5 py-4 text-left">
                  <span className="text-sm font-semibold text-ink">{i + 1}. {issue.title}</span>
                  <ChevronDown size={16} className="text-ink-faint" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                </button>
                {open && (
                  <div className="border-t border-line px-5 py-4">
                    <div className="mb-4 text-xs font-semibold text-amber">이 뉴스가 왜 중요할까요?</div>
                    <FlowChain steps={issue.chain} />
                    <p className="text-sm leading-relaxed text-ink-soft">{issue.explain}</p>
                    {issue.relatedNews?.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {issue.relatedNews.map((n, ni) => (
                          <a key={ni} href={n.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-brand-blue hover:underline">
                            <ExternalLink size={11} /> {n.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 6 — 체크포인트 */}
      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_COMPANY} className="mb-10" />

      <section id="checkpoints" className="mb-10 scroll-mt-32 animate-fade-up" style={{ animationDelay: "240ms" }}>
        <SectionLabel eyebrow="05" title="앞으로 무엇을 봐야 할까요?" />
        <div className="space-y-2.5">
          {company.checkpoints.map((cp, i) => {
            const open = openCheckpoint === i;
            return (
              <div key={cp.title} className="overflow-hidden rounded-2xl bg-paper-raised">
                <button onClick={() => setOpenCheckpoint(open ? null : i)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line text-xs font-semibold text-ink-soft">{i + 1}</span>
                  <span className="flex-1 text-sm font-medium text-ink">{cp.title}</span>
                  <ChevronRight size={14} className="text-ink-faint" style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
                </button>
                {open && <div className="px-4 pb-3.5 pl-13 text-xs leading-relaxed text-ink-soft" style={{ paddingLeft: "3.25rem" }}>{cp.why}</div>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 7 — 투자 논리 점검 */}
      <section id="thesis" className="scroll-mt-32 animate-fade-up" style={{ animationDelay: "320ms" }}>
        <SectionLabel eyebrow="06" title="왜 이 회사에 투자하려고 하시나요?" />
        <div className="rounded-2xl bg-paper-raised p-5">
          <p className="mb-3 text-sm leading-relaxed text-ink-soft">
            AI가 투자 여부를 판단해주지 않아요. 대신 당신이 가진 투자 논리를 함께 점검해드립니다.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={`예: 요즘 ${company.name} 관련 뉴스가 잘된다고 해서요`}
            rows={2}
            className="w-full resize-none rounded-xl bg-paper px-4 py-3 text-sm text-ink placeholder:text-ink-faint outline-none focus:ring-2 focus:ring-amber"
          />
          <button
            onClick={() => setCheckOpen(true)}
            disabled={!reason.trim()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber py-3.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            투자 논리 점검하기 <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </section>

      </main>
      </div>

      {checkOpen && (
        <InvestmentCheck
          company={company}
          businesses={company.businesses}
          issues={issues}
          initialReason={reason}
          onClose={() => setCheckOpen(false)}
        />
      )}

      {activeMetric && (
        <TrendModal
          metricLabel={activeMetric}
          loading={trendLoading}
          error={trendError}
          trend={trend}
          onClose={() => setActiveMetric(null)}
        />
      )}
    </div>
  );
}
