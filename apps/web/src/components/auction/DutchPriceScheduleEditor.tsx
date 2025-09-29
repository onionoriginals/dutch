import React, { useMemo, useRef, useState } from 'react';
import type { DecayType } from '@originals/dutch/browser';
import { validateScheduleInput, generateSchedulePoints, computePriceAt, normalizeSchedule } from '@originals/dutch/browser';
import type { NormalizedSchedule } from '@originals/dutch/browser';

export type DutchScheduleValue = {
  startPrice: number;
  floorPrice: number;
  durationMs: number;
  intervalMs: number;
  decay: DecayType;
};

export interface DutchPriceScheduleEditorProps {
  value: DutchScheduleValue;
  onChange: (next: DutchScheduleValue) => void;
  onValidSchedule?: (schedule: NormalizedSchedule) => void;
  width?: number;
  height?: number;
}

function formatCurrency(n: number): string {
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(n);
}

export function DutchPriceScheduleEditor(props: DutchPriceScheduleEditorProps) {
  const { value, onChange, onValidSchedule, width = 300, height = 80 } = props;

  const errors = useMemo(() => validateScheduleInput(value as any), [value]);
  const hasErrors = errors.length > 0;

  const points = useMemo(() => {
    if (hasErrors) return [] as { tMs: number; price: number }[];
    const pts = generateSchedulePoints(value as any);
    if (onValidSchedule) {
      onValidSchedule(normalizeSchedule(value as any));
    }
    return pts;
  }, [hasErrors, onValidSchedule, value]);

  // Sparkline mapping
  const padding = 8;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const maxPrice = useMemo(() => (points.length ? Math.max(...points.map(p => p.price)) : value.startPrice), [points, value.startPrice]);
  const minPrice = useMemo(() => (points.length ? Math.min(...points.map(p => p.price)) : value.floorPrice), [points, value.floorPrice]);
  const range = Math.max(1e-9, maxPrice - minPrice);

  const pathD = useMemo(() => {
    if (!points.length) return '';
    const d: string[] = [];
    const lastT = points[points.length - 1].tMs || 1;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x = padding + (p.tMs / lastT) * innerW;
      const y = padding + (1 - (p.price - minPrice) / range) * innerH;
      d.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
    }
    return d.join(' ');
  }, [points, innerW, innerH, padding, minPrice, range]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; tMs: number; price: number } | null>(null);

  const onMouseMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
    if (!svgRef.current || hasErrors) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - padding;
    const clampedX = Math.max(0, Math.min(innerW, x));
    const progress = clampedX / Math.max(1, innerW);
    const tMs = Math.round(progress * value.durationMs);
    const price = computePriceAt(value as any, tMs);
    const y = padding + (1 - (price - minPrice) / range) * innerH;
    setHover({ x: padding + clampedX, y, tMs, price });
  };

  const onMouseLeave = () => setHover(null);

  return (
    <div style={{ display: 'grid', gap: '8px', maxWidth: width }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Start price</span>
          <input type="number" value={value.startPrice} onChange={(e) => onChange({ ...value, startPrice: Number(e.target.value) })} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Floor price</span>
          <input type="number" value={value.floorPrice} onChange={(e) => onChange({ ...value, floorPrice: Number(e.target.value) })} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Duration (sec)</span>
          <input type="number" value={Math.round(value.durationMs / 1000)} onChange={(e) => onChange({ ...value, durationMs: Number(e.target.value) * 1000 })} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Interval (sec)</span>
          <input type="number" value={Math.round(value.intervalMs / 1000)} onChange={(e) => onChange({ ...value, intervalMs: Number(e.target.value) * 1000 })} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Decay</span>
          <select value={value.decay} onChange={(e) => onChange({ ...value, decay: e.target.value as DecayType })}>
            <option value="linear">Linear</option>
            <option value="exponential">Exponential</option>
          </select>
        </label>
      </div>

      {hasErrors ? (
        <ul style={{ color: 'crimson', margin: 0, paddingLeft: 16 }}>
          {errors.map((er, i) => (
            <li key={i}>{er.message}</li>
          ))}
        </ul>
      ) : null}

      <div style={{ position: 'relative', width, height }}>
        <svg ref={svgRef} width={width} height={height} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
          <rect x={0} y={0} width={width} height={height} fill="#0b0f14" rx={6} />
          <path d={pathD} stroke="#7dd3fc" fill="none" strokeWidth={2} />
          {hover ? (
            <g>
              <line x1={hover.x} x2={hover.x} y1={padding} y2={height - padding} stroke="#94a3b8" strokeDasharray="4 4" />
              <circle cx={hover.x} cy={hover.y} r={3} fill="#38bdf8" />
            </g>
          ) : null}
        </svg>
        {hover ? (
          <div style={{ position: 'absolute', left: Math.max(0, Math.min(width - 140, hover.x + 8)), top: Math.max(0, hover.y - 24), background: '#111827', color: 'white', padding: '4px 6px', fontSize: 12, borderRadius: 4, border: '1px solid #374151' }}>
            t={Math.round(hover.tMs / 1000)}s · price={formatCurrency(hover.price)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default DutchPriceScheduleEditor;

