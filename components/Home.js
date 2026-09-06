"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, ChevronRight, Loader2 } from "lucide-react";
import { COMPANY_LIST } from "@/lib/companies";
import { FlowChain } from "@/components/ui";

export default function Home() {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 입력할 때마다 바로 요청하지 않고 400ms 정도 기다렸다가 검색합니다 (디바운스).
  useEffect(() => {
    if (!q.trim()) {
      setMatches([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/search-companies?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data) => setMatches(data.results || []))
        .catch(() => setMatches([]))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [q]);

  const go = (ticker) => router.push(`/company/${ticker}`);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 pb-24 pt-20 text-center">
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-3 py-1 text-xs font-semibold text-amber">
        <Sparkles size={12} /> AI 기업 이해 서비스
      </div>
      <h1 className="font-serif text-3xl font-semibold leading-snug text-ink sm:text-4xl">
        내가 투자하려는 회사,<br />정말 알고 투자하고 있나요?
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        AI가 복잡한 기업 정보와 뉴스를 이해하기 쉽게 설명하고,<br />당신의 투자 근거를 스스로 점검할 수 있도록 도와드립니다.
      </p>

      <div className="relative mt-8 w-full">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="기업명 또는 종목코드를 검색해보세요 (상장기업 전체)"
          className="w-full rounded-2xl border border-line bg-paper-raised py-4 pl-11 pr-4 text-sm text-ink shadow-sm outline-none"
        />
        {loading && (
          <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-ink-faint" />
        )}
        {matches.length > 0 && (
          <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-paper-raised text-left shadow-lg">
            {matches.map((c) => (
              <button key={c.ticker} onClick={() => go(c.ticker)} className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-black/5">
                <span className="text-ink">{c.name} <span className="text-ink-faint">· {c.ticker}</span></span>
                <ChevronRight size={15} className="text-ink-faint" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-ink-faint">추천 검색</span>
        {COMPANY_LIST.map((c) => (
          <button key={c.ticker} onClick={() => go(c.ticker)} className="rounded-full border border-line bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink-soft">
            {c.name}
          </button>
        ))}
      </div>

      <div className="mt-16 w-full rounded-3xl border border-line bg-paper-raised p-6 text-left">
        <div className="mb-4 text-xs font-semibold text-amber">이렇게 연결해서 설명해드려요</div>
        <FlowChain steps={["최신 뉴스 발생", "관련 사업부에 미치는 영향", "매출·이익 구조 변화 가능성", "실적에 미치는 영향"]} />
      </div>
    </div>
  );
}
