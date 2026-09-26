"use client";

import { useCallback, useRef, useState } from "react";
import type { MonthPoint } from "@/lib/mortgage";
import { formatCurrency } from "./format";

type Props = {
  schedule: MonthPoint[];
  monthlyPI: number;
  termYears: number;
};

const WIDTH = 720;
const HEIGHT = 300;
const MARGIN = { top: 14, right: 12, bottom: 34, left: 64 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;

/**
 * Stacked area of the principal and interest portions of each month's payment across the whole
 * loan. The stack always sums to the monthly payment, so the two areas trade places over time —
 * interest dominates early, principal late.
 *
 * Hovering reads out the exact month; the chart is also focusable and the same readout follows
 * the arrow keys, so nothing on it requires a pointer.
 */
export function AmortizationChart({ schedule, monthlyPI, termYears }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const count = schedule.length;
  const max = Math.max(monthlyPI, 1);
  const x = (index: number) => MARGIN.left + (count <= 1 ? PLOT_W / 2 : (index / (count - 1)) * PLOT_W);
  const y = (value: number) => MARGIN.top + PLOT_H * (1 - value / max);

  const principalLine = schedule.map((point, index) => `${x(index).toFixed(2)},${y(point.principal).toFixed(2)}`);
  const topLine = schedule.map(
    (point, index) => `${x(index).toFixed(2)},${y(point.principal + point.interest).toFixed(2)}`,
  );
  const baseY = y(0).toFixed(2);
  const principalArea = `M ${x(0).toFixed(2)},${baseY} L ${principalLine.join(" L ")} L ${x(count - 1).toFixed(2)},${baseY} Z`;
  const interestArea = `M ${principalLine.join(" L ")} L ${[...topLine].reverse().join(" L ")} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => fraction * max);
  const xTickYears = yearsFor(termYears);

  const indexFromClientX = useCallback(
    (clientX: number): number | null => {
      const svg = svgRef.current;
      if (!svg || count === 0) return null;
      const rect = svg.getBoundingClientRect();
      const value = ((clientX - rect.left) / rect.width) * WIDTH;
      const ratio = (value - MARGIN.left) / PLOT_W;
      const index = Math.round(ratio * (count - 1));
      return Math.min(count - 1, Math.max(0, index));
    },
    [count],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (count === 0) return;
    if (event.key === "Escape") {
      setHover(null);
      return;
    }
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    setHover((current) => Math.min(count - 1, Math.max(0, (current ?? Math.floor(count / 2)) + step)));
  };

  const hovered = hover === null ? null : schedule[hover];
  const tooltipX = hover === null ? 0 : x(hover);

  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-4 text-sm">
        <LegendSwatch className="bg-chart-2" label="Principal" />
        <LegendSwatch className="bg-chart-1" label="Interest" />
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        tabIndex={0}
        aria-label={`Stacked area chart of monthly principal and interest over ${termYears} years. Use the arrow keys to read out a month.`}
        onPointerMove={(event) => setHover(indexFromClientX(event.clientX))}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKeyDown}
        onFocus={() => setHover((current) => current ?? Math.floor(count / 2))}
        onBlur={() => setHover(null)}
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {formatCurrency(tick)}
            </text>
          </g>
        ))}
        {xTickYears.map((year) => {
          const index = Math.min(count - 1, year * 12);
          return (
            <text
              key={year}
              x={x(index)}
              y={HEIGHT - MARGIN.bottom + 16}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {year === 0 ? "0" : `${year}y`}
            </text>
          );
        })}
        <text
          x={MARGIN.left + PLOT_W / 2}
          y={HEIGHT - 6}
          textAnchor="middle"
          className="fill-muted-foreground text-[11px] font-medium"
        >
          Year of loan
        </text>
        <text
          x={MARGIN.left - 56}
          y={MARGIN.top - 2}
          className="fill-muted-foreground text-[11px] font-medium"
        >
          $ / month
        </text>
        <path d={interestArea} className="fill-chart-1" fillOpacity={0.85} />
        <path d={principalArea} className="fill-chart-2" fillOpacity={0.9} />
        {hovered && (
          <g>
            <line
              x1={tooltipX}
              x2={tooltipX}
              y1={MARGIN.top}
              y2={y(0)}
              className="stroke-foreground/40"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <circle
              cx={tooltipX}
              cy={y(hovered.principal + hovered.interest)}
              r={3.5}
              className="fill-chart-1 stroke-background"
              strokeWidth={1.5}
            />
            <circle cx={tooltipX} cy={y(hovered.principal)} r={3.5} className="fill-chart-2 stroke-background" strokeWidth={1.5} />
          </g>
        )}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-3 py-2 text-xs shadow-md"
          style={{
            left: `${(tooltipX / WIDTH) * 100}%`,
            top: `${((hover === null ? 0 : y(hovered.principal + hovered.interest)) / HEIGHT) * 100}%`,
          }}
        >
          <p className="font-semibold">
            {monthLabel(hovered.month, termYears)}
          </p>
          <p className="mt-1 flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-chart-2" aria-hidden />
            Principal {formatCurrency(hovered.principal, true)}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-chart-1" aria-hidden />
            Interest {formatCurrency(hovered.interest, true)}
          </p>
        </div>
      )}
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className={`inline-block size-3 rounded-sm ${className}`} aria-hidden />
      {label}
    </span>
  );
}

function yearsFor(termYears: number): number[] {
  const ticks: number[] = [];
  for (let year = 0; year <= termYears; year += 5) ticks.push(year);
  if (ticks[ticks.length - 1] !== termYears) ticks.push(termYears);
  return ticks;
}

function monthLabel(month: number, termYears: number): string {
  const year = Math.ceil(month / 12);
  const monthInYear = ((month - 1) % 12) + 1;
  return `Year ${year} of ${termYears}, month ${monthInYear}`;
}