'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '@/lib/store';

export function Segmented<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, max, large, color }: { value: number; max: number; large?: boolean; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={large ? 'bar lg' : 'bar'}>
      <span style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Kpi({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="kpi">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      {note ? <span className="note">{note}</span> : null}
    </div>
  );
}

export function Avatar({ initials, small, style }: { initials: string; small?: boolean; style?: CSSProperties }) {
  return <span className={small ? 'avatar sm' : 'avatar'} style={style}>{initials}</span>;
}

export function Toast() {
  const { state } = useStore();
  if (!state.toast) return null;
  return <div className="toast" role="status">{state.toast}</div>;
}

export interface Column {
  key: string;
  label: string;
  value: number;
  valueText: string;
  tip: string;
  current?: boolean;
}

/** Simple column chart with an optional dashed reference line (e.g. weekly commitment). */
export function ColumnChart({
  columns, height = 180, refValue, max,
}: {
  columns: Column[];
  height?: number;
  refValue?: number;
  max?: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const top = max ?? Math.max(refValue ?? 0, ...columns.map((c) => c.value)) * 1.15;
  const px = (v: number) => (top > 0 ? Math.round((v / top) * height) : 0);
  return (
    <div>
      <div className="cols" style={{ height: height + 28 }}>
        {refValue !== undefined ? <div className="ref" style={{ bottom: px(refValue) }} aria-hidden="true" /> : null}
        {columns.map((c) => (
          <div key={c.key} className="col" onMouseEnter={() => setHover(c.key)} onMouseLeave={() => setHover(null)}>
            {hover === c.key ? <div className="tip" role="tooltip">{c.tip}</div> : null}
            <span className="v">{c.valueText}</span>
            <div className={c.current ? 'b current' : 'b'} style={{ height: px(c.value) }} />
          </div>
        ))}
      </div>
      <div className="cols-labels">
        {columns.map((c) => <span key={c.key}>{c.label}</span>)}
      </div>
    </div>
  );
}

export const Icon = {
  pulse: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 12 7 12 10 5 14 19 17 12 21 12" />
    </svg>
  ),
  sun: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  board: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" />
    </svg>
  ),
  team: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M16.5 14.2c2.8.2 5 2.2 5 5.3" />
    </svg>
  ),
  chart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" />
    </svg>
  ),
  clock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8" /><polyline points="12 9 12 13 15 15" /><line x1="10" y1="2" x2="14" y2="2" />
    </svg>
  ),
  close: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  ),
  more: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
    </svg>
  ),
  lock: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  link: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  ),
  star: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" />
    </svg>
  ),
};
