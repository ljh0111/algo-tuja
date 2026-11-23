"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight, Loader2, Heart, Clock, Newspaper, Building2, BarChart3, LineChart, Workflow } from "lucide-react";
import { COMPANY_LIST } from "@/lib/companies";
import MarketPanel, { MarketStrip } from "@/components/MarketPanel";
import AdSlot from "@/components/AdSlot";
import { CompanyLogo } from "@/components/ui";
import { getFavorites, getRecent } from "@/lib/watchlist";

export default function Home() {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle"); // idle → done | error
  const [open, setOpen] = useState(true);
  const boxRef = useRef(null);
  const [saved, setSaved] = useState({ favorites: [], recent: [] });
  const inputRef = useRef(null);
  const router = useRouter();

  // 저장 목록은 브라우저에만 있으니 마운트 후에 읽습니다 (서버 렌더와 어긋나지 않게).
  useEffect(() => setSaved({ favorites: getFavorites(), recent: getRecent() }), []);

  // "/" 키로 어디서든 검색창에 바로 입력
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.target.closest?.("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 입력할 때마다 바로 요청하지 않고 400ms 정도 기다렸다가 검색합니다 (디바운스).
  useEffect(() => {
    setStatus("idle");
    setOpen(true);
    let active = true; // 오래된 응답이 새 결과를 덮어쓰지 않게
    const ctrl = new AbortController();
    if (!q.trim()) {
      setMatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/search-companies?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((data) => {
          if (!active) return;
          setMatches(data.results || []);
          setStatus("done");
        })
        .catch((e) => {
          if (!active || e?.name === "AbortError") return;
          setMatches([]);
          setStatus("error");
        })
        .finally(() => active && setLoading(false));
    }, 400);
    return () => {
      active = false;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [q]);

  // 검색 결과 창 바깥을 누르면 닫기
  useEffect(() => {
    const onDown = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const go = (ticker) => router.push(`/company/${ticker}`);

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 lg:pb-12 pt-4 sm:px-6 sm:pt-6 lg:max-w-6xl lg:px-8 lg:pt-10">
      {/* 서비스가 무엇인지(제목·검색)를 먼저, 시장 지표는 그 옆·아래에. 두 칸은 서로 높이에 영향을 주지 않습니다. */}
      <div className="lg:grid lg:grid-cols-[7fr_5fr] lg:items-start lg:gap-10">
        <div>
          <div className="px-2 sm:px-0">
            <h1 className="animate-fade-up font-serif text-2xl font-bold leading-snug tracking-tight text-ink sm:text-3xl sm:leading-[1.3]">
              내가 투자하려는 회사,<br />정말 알고 투자하고 있나요?
            </h1>
            {/* 모바일은 한 줄 설명, 넓은 화면에선 점검 문장까지 */}
            <p className="mt-2 animate-fade-up text-sm leading-relaxed text-ink-soft [animation-delay:60ms] sm:mt-3 sm:text-[15px]">
              <strong className="font-semibold">AI</strong>가 공시와 뉴스를 분석해 쉬운 말로 풀어 드려요
              <span className="hidden sm:inline">. 내 투자 근거도 <strong className="font-semibold">AI</strong>와 함께 점검해 보세요</span>
            </p>
          </div>

          <div className="mt-4 rounded-3xl bg-amber-soft sm:mt-5 px-4 pb-4 pt-4 lg:px-6 lg:pt-5">
      <div ref={boxRef} className="relative z-20 w-full animate-fade-up">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          ref={inputRef}
          id="company-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          aria-label="기업 검색"
          placeholder="회사 이름이나 종목코드로 검색"
          className="w-full rounded-2xl border border-transparent bg-paper-raised py-4 pl-11 pr-4 text-sm text-ink shadow-sm outline-none placeholder:text-ink-faint transition-shadow duration-150 ease-brand focus:border-amber focus:shadow-md focus-visible:outline-none"
        />
        {loading ? (
          <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-ink-faint" />
        ) : (
          !q && <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-xs font-medium text-ink-faint sm:block" aria-hidden="true">/</kbd>
        )}
        {open && q.trim() && status !== "idle" && !loading && matches.length === 0 && (
          <p role="status" className="absolute z-10 mt-2 w-full rounded-2xl bg-paper-raised px-4 py-3 text-sm text-ink-soft shadow-lg">
            {status === "error" ? "검색이 잠시 안 되고 있어요. 잠시 후 다시 시도해 주세요." : "검색 결과가 없어요 · 종목코드 6자리로도 찾을 수 있어요"}
          </p>
        )}
        {open && matches.length > 0 && (
          <div className="absolute z-10 mt-2 w-full animate-pop overflow-hidden rounded-2xl bg-paper-raised text-left shadow-lg">
            {matches.map((c) => (
              <button key={c.ticker} onClick={() => go(c.ticker)} className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-black/5 [&>svg]:transition-transform hover:[&>svg]:translate-x-0.5">
                <span className="flex items-center gap-2.5 text-ink"><CompanyLogo ticker={c.ticker} name={c.name} size={28} />{c.name} <span className="text-ink-faint">· {c.ticker}</span></span>
                <ChevronRight size={15} className="text-ink-faint" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 animate-fade-up space-y-1 [animation-delay:60ms]">
        {[
          [Heart, "즐겨찾기", saved.favorites, "종목 화면의 하트를 누르면 여기에 모여요"],
          [Clock, "최근 본", saved.recent, null],
          [null, "추천 검색", COMPANY_LIST, null],
        ].map(([Icon, label, list, empty]) =>
          list.length || empty ? (
            // 한 줄로: 넘치면 가로로 밀어서 봅니다
            <div key={label} className="no-scrollbar flex items-center gap-2 overflow-x-auto px-1 max-sm:[mask-image:linear-gradient(to_right,black_85%,transparent)]">
              <span className="flex w-20 shrink-0 items-center gap-1 text-xs text-ink-faint">
                {Icon && <Icon size={12} aria-hidden="true" />}{label}
              </span>
              {list.length ? (
                list.map((c) => (
                  <button key={c.ticker} onClick={() => go(c.ticker)} className="min-h-11 shrink-0 whitespace-nowrap rounded-full bg-paper-raised px-4 py-2 text-xs font-medium text-ink-soft shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:text-ink">
                    {c.name}
                  </button>
                ))
              ) : (
                <span className="flex min-h-11 items-center whitespace-nowrap text-xs text-ink-faint">{empty}</span>
              )}
            </div>
          ) : null
        )}
      </div>
          </div>

        </div>

        <div className="mt-6 lg:mt-0">
          <MarketStrip />
        </div>
      </div>


      <div className="mt-6 w-full">
        <MarketPanel />
      </div>

      <section className="mt-6 w-full rounded-2xl bg-paper-raised p-5 lg:mt-10 lg:p-8" aria-labelledby="how-title">
        <h2 id="how-title" className="flex items-center gap-2 text-left text-lg font-bold text-ink"><Workflow size={20} className="shrink-0 text-ink-soft" aria-hidden="true" />뉴스 하나를 이렇게 풀어 드려요</h2>
        <ol className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            [Newspaper, "최신 뉴스 발생"],
            [Building2, "관련 사업부에 미치는 영향"],
            [BarChart3, "매출·이익 구조 변화 가능성"],
            [LineChart, "실적에 미치는 영향"],
          ].map(([Icon, label], i) => (
            <li key={label} className="flex flex-col rounded-3xl bg-paper px-3.5 pb-4 pt-3.5">
              <div className="flex items-start gap-1.5 text-sm font-semibold leading-snug text-ink">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper-raised text-xs font-bold text-amber">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="pt-0.5">{label}</span>
              </div>
              <div className="mx-auto mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-paper-raised">
                <Icon size={30} className="text-amber" aria-hidden="true" />
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 광고는 서비스 설명을 가로막지 않도록 맨 아래 */}
      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME} className="mt-6" />
    </main>
  );
}
