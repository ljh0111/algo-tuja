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
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-line bg-paper-raised p-3 text-xs leading-relaxed text-ink-soft shadow-lg">
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
        <div key={i} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
              style={{
                background: i === steps.length - 1 ? "#C98A2E" : "#F3E3C8",
                color: i === steps.length - 1 ? "#fff" : "#C98A2E",
              }}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && <div className="my-0.5 h-6 w-px bg-line" />}
          </div>
          <div
            className="pb-4 pt-0.5 text-sm"
            style={{ color: i === steps.length - 1 ? "#16233F" : "#4B5670", fontWeight: i === steps.length - 1 ? 600 : 500 }}
          >
            {s}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SectionLabel({ eyebrow, title }) {
  return (
    <div className="mb-5">
      <div className="text-xs font-semibold tracking-wide text-amber">{eyebrow}</div>
      <h2 className="mt-1 font-serif text-xl font-semibold text-ink">{title}</h2>
    </div>
  );
}
