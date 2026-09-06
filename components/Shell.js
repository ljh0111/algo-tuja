"use client";

import Link from "next/link";

export default function Shell({ children }) {
  return (
    <div className="min-h-screen w-full bg-paper">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">알</div>
            <span className="font-serif text-sm font-semibold text-ink">알고투자</span>
          </Link>
          <span className="rounded-full bg-amber-soft px-2.5 py-1 text-[10px] font-semibold text-amber">
            Live · DART·뉴스 실시간 연동
          </span>
        </div>
      </header>

      {children}

      <footer className="border-t border-line px-6 py-6 text-center text-xs text-ink-faint">
        AI가 대신 투자하지 않습니다. 알고 투자할 수 있게 도와드립니다.
      </footer>
    </div>
  );
}
