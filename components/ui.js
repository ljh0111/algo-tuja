"use client";

import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";

export function SourceBadge({ label }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full bg-brand-blue-soft px-2.5 py-1 text-xs font-medium text-brand-blue"
      >
        <BadgeCheck size={12} /> 출처 확인
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-64 animate-pop rounded-xl border border-line bg-paper-raised p-3 text-xs leading-relaxed text-ink-soft shadow-lg">
          {label}
        </div>
      )}
    </span>
  );
}

// 기업 로고: 네이버 증권 로고 이미지를 쓰고, 없거나(404) 막히면 첫 글자 상자로 대체
// shortcut: 비공식 이미지 주소라 언제든 막힐 수 있음, 그때는 로고 파일을 직접 두는 방식으로 바꿀 것
export function CompanyLogo({ ticker, name, size = 44 }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [ticker]);
  const box = { width: size, height: size };
  if (failed || !/^\d{6}$/.test(ticker)) {
    return (
      <div style={{ ...box, fontSize: size * 0.4 }} className="flex shrink-0 items-center justify-center rounded-xl bg-ink font-bold text-white" aria-hidden="true">
        {name?.slice(0, 1)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 외부 SVG를 작게 그대로 표시
    <img
      src={`https://ssl.pstatic.net/imgstock/fn/real/logo/stock/Stock${ticker}.svg`}
      alt=""
      style={box}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-xl border border-line bg-white object-contain"
    />
  );
}

export function FlowChain({ steps }) {
  return (
    <div className="flex flex-col">
      {steps.map((s, i) => (
        <div key={i} className="flex animate-fade-up items-start gap-3" style={{ animationDelay: `${360 + i * 60}ms` }}>
          <div className="flex flex-col items-center">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded border text-[11px] font-semibold"
              style={{
                background: i === steps.length - 1 ? "#191F28" : "#FFFFFF",
                borderColor: i === steps.length - 1 ? "#191F28" : "#E5E8EB",
                color: i === steps.length - 1 ? "#fff" : "#4E5968",
              }}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && <div className="my-0.5 h-6 w-px bg-line" />}
          </div>
          <div
            className="pb-4 pt-0.5 text-sm"
            style={{ color: i === steps.length - 1 ? "#191F28" : "#4E5968", fontWeight: i === steps.length - 1 ? 600 : 500 }}
          >
            {s}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SectionLabel({ eyebrow, title, icon: Icon, id }) {
  return (
    <div className="mb-3 px-1">
      <h2 id={id} className="flex items-start gap-2 font-serif text-lg font-bold leading-snug tracking-tight text-ink lg:text-xl">
        {Icon && <Icon size={20} className="mt-0.5 shrink-0 text-ink-soft" aria-hidden="true" />}
        <span className="min-w-0">
          {eyebrow && <span className="mr-2 text-xs font-medium text-ink-faint">{eyebrow}</span>}
          {title}
        </span>
      </h2>
    </div>
  );
}
