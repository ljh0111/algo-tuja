"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  Sparkles, ChevronDown, ChevronRight, ExternalLink, X, ArrowRight,
  Info, Check, AlertCircle, Loader2, ArrowLeft, TrendingUp,
} from "lucide-react";
import { SourceBadge, FlowChain, SectionLabel } from "@/components/ui";
import TermLookup from "@/components/TermLookup";

const PIE_COLORS = ["#16233F", "#C98A2E", "#3D5A80", "#4F7942", "#B5493A"];
const METRIC_KEY_MAP = { "매출액": "revenue", "영업이익": "operatingProfit", "당기순이익": "netIncome" };

function formatWon(n) {
  if (n === null || n === undefined) return "-";
  const eok = n / 100_000_000; // 억원 단위
  return `${eok.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}억원`;
}

/* ----------------------------- 재무 추이 그래프 모달 ----------------------------- */
function TrendModal({ metricLabel, loading, error, trend, onClose }) {
  const field = METRIC_KEY_MAP[metricLabel];
  const chartData = (trend || [])
    .filter((d) => d[field] !== null && d[field] !== undefined)
    .map((d) => ({ year: `${d.year}`, value: Math.round(d[field] / 100_000_000) }));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-0 sm:items-center sm:px-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-paper-raised sm:max-w-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-paper-raised px-6 py-4">
          <span className="text-sm font-semibold text-ink">{metricLabel} 추이</span>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-black/5"><X size={18} className="text-ink-faint" /></button>
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
                    <CartesianGrid stroke="#E4E6E1" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#8A90A0" }} axisLine={{ stroke: "#E4E6E1" }} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#8A90A0" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v.toLocaleString("ko-KR")}억`}
                      width={64}
                    />
                    <RTooltip formatter={(v) => [`${v.toLocaleString("ko-KR")}억원`, metricLabel]} />
                    <Line type="monotone" dataKey="value" stroke="#C98A2E" strokeWidth={2.5} dot={{ r: 3, fill: "#C98A2E" }} />
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-0 sm:items-center sm:px-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-paper-raised sm:max-w-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-paper-raised px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber" />
            <span className="text-sm font-semibold text-ink">AI 투자 논리 점검 · {company.name}</span>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-black/5"><X size={18} className="text-ink-faint" /></button>
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
                className="w-full resize-none rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none"
              />
              <button
                onClick={runCheck}
                disabled={!input.trim() || status === "loading"}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {status === "loading" ? (<><Loader2 size={16} className="animate-spin" /> 투자 논리 분석 중...</>) : (<><Sparkles size={15} /> AI 투자 논리 점검하기</>)}
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
              <div className="rounded-2xl border border-line bg-paper p-4 text-sm leading-relaxed text-ink-soft">{result.guidance}</div>
              <div className="text-center text-xs text-ink-faint">최종 투자 판단은 본인의 몫입니다. 이 분석은 판단을 대신하지 않습니다.</div>
              <button onClick={() => { setStatus("idle"); setInput(""); setResult(null); }} className="w-full rounded-2xl border border-line py-2.5 text-sm font-medium text-ink-soft">
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
    <div className="mx-auto max-w-2xl px-5 pb-28 pt-6 sm:px-6" ref={contentRef}>
      <TermLookup containerRef={contentRef} context={`${company.name} 기업 설명 페이지`} />
      <div className="mb-5">
        <button onClick={() => router.push("/")} className="flex items-center gap-1.5 text-sm font-medium text-ink-soft">
          <ArrowLeft size={15} /> 검색으로
        </button>
      </div>

      {/* Section 1 */}
      <div className="mb-8">
        <div className="text-xs font-medium text-ink-faint">{company.industry} · {company.ticker}</div>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-ink">{company.name}</h1>
        {aiGenerated && (
          <div className="mt-2 flex items-center gap-1.5 rounded-full bg-amber-soft px-3 py-1.5 text-xs font-medium text-amber w-fit">
            <AlertCircle size={12} /> AI가 생성한 기업 정보입니다 — 참고용으로만 확인하고, 투자 전 실제 공시자료로 검증하세요.
          </div>
        )}
      </div>

      {/* Section 2 — 10초 이해 */}
      <section className="mb-10">
        <SectionLabel eyebrow="STEP 1" title="10초 만에 기업 이해하기" />
        <div className="rounded-3xl border border-line bg-paper-raised p-5">
          <p className="text-sm leading-relaxed text-ink">{company.oneLiner}</p>
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {[["대표 제품", company.products], ["주요 고객", company.customers], ["주요 경쟁사", company.competitors]].map(([label, val]) => (
              <div key={label} className="rounded-2xl bg-paper px-3.5 py-2.5">
                <div className="text-[11px] font-medium text-ink-faint">{label}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-ink-soft">{val}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3 — 실시간 재무 실적 (DART) */}
      <section className="mb-10">
        <SectionLabel eyebrow="STEP 2" title="최근 실적은 어떤가요?" />
        <div className="rounded-3xl border border-line bg-paper-raised p-5">
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
                      className="rounded-2xl bg-paper px-4 py-3 text-left transition-colors hover:bg-amber-soft/60"
                    >
                      <div className="flex items-center justify-between text-xs font-medium text-ink-faint">
                        {key}
                        <TrendingUp size={12} className="text-ink-faint" />
                      </div>
                      <div className="mt-1 font-mono text-base font-semibold text-ink">{formatWon(acc.thisYear)}</div>
                      {acc.lastYear !== null && (
                        <div className="mt-0.5 text-[11px] text-ink-faint">전년 {formatWon(acc.lastYear)}</div>
                      )}
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
      <section className="mb-10">
        <SectionLabel eyebrow="STEP 3" title="요즘 이 회사에 무슨 일이 있나요?" />
        {issuesLoading && (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-paper-raised px-4 py-4 text-xs text-ink-faint">
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
              <div key={issue.title} className="overflow-hidden rounded-3xl border border-line bg-paper-raised">
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
      <section className="mb-10">
        <SectionLabel eyebrow="STEP 4" title="앞으로 무엇을 봐야 할까요?" />
        <div className="space-y-2.5">
          {company.checkpoints.map((cp, i) => {
            const open = openCheckpoint === i;
            return (
              <div key={cp.title} className="overflow-hidden rounded-2xl border border-line bg-paper-raised">
                <button onClick={() => setOpenCheckpoint(open ? null : i)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-soft text-xs font-semibold text-amber">{i + 1}</span>
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
      <section>
        <SectionLabel eyebrow="STEP 5" title="왜 이 회사에 투자하려고 하시나요?" />
        <div className="rounded-3xl bg-ink p-5">
          <p className="mb-3 text-sm leading-relaxed text-white/80">
            AI가 투자 여부를 판단해주지 않아요. 대신 당신이 가진 투자 논리를 함께 점검해드립니다.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={`예: 요즘 ${company.name} 관련 뉴스가 잘된다고 해서요`}
            rows={2}
            className="w-full resize-none rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none"
          />
          <button
            onClick={() => setCheckOpen(true)}
            disabled={!reason.trim()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Sparkles size={15} /> AI 투자 논리 점검하기
          </button>
        </div>
      </section>

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
