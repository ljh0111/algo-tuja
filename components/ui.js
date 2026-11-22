"use client";

import { useState } from "react";
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
