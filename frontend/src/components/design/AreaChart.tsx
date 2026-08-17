"use client";

import { useId, useMemo, useRef, useState } from "react";
import { formatNaira } from "./Amount";

export interface AreaChartPoint {
  label: string;
  amount: number;
}

/**
 * Hand-rolled single-series area chart per the design spec.
 * One series → no legend (the section title names it). Green brand line,
 * gradient area fill, recessive gridlines, crosshair + tooltip on hover,
 * direct end-point marker. A visually-hidden data table backs it up.
 */
export function AreaChart({
  data,
  height = 190,
  valuePrefix,
}: {
  data: AreaChartPoint[];
  height?: number;
  valuePrefix?: string; // e.g. "₦" — tooltip prefix; default naira
}) {
  const W = 620;
  const H = 190;
  const PAD_B = 26; // x-label gutter
  const PAD_T = 14;
  const PAD_X = 6;
  const gradientId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const points = useMemo(() => {
    const max = Math.max(...data.map((d) => d.amount), 1);
    return data.map((d, i) => {
      const x = PAD_X + (i / Math.max(data.length - 1, 1)) * (W - PAD_X * 2);
      const y = PAD_T + (1 - d.amount / max) * (H - PAD_T - PAD_B);
      return { ...d, x, y };
    });
  }, [data]);

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? 0},${H - PAD_B} L${points[0]?.x ?? 0},${H - PAD_B} Z`;

  const handleMove = (e: React.MouseEvent<SVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHover(best);
  };

  const last = points[points.length - 1];
  const hasActivity = data.some((d) => d.amount > 0);

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height }}
        role="img"
        aria-label={`Trend chart: ${data.map((d) => `${d.label} ${d.amount}`).join(", ")}`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0}
            y1={PAD_T + f * (H - PAD_T - PAD_B)}
            x2={W}
            y2={PAD_T + f * (H - PAD_T - PAD_B)}
            className="stroke-[#E9ECEF] dark:stroke-[#1C2E48]"
            strokeWidth={1}
          />
        ))}

        {/* area + line */}
        {hasActivity && <path d={areaPath} fill={`url(#${gradientId})`} />}
        <path
          d={linePath}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* end-point marker (direct label anchor) */}
        {hasActivity && last && (
          <>
            <circle cx={last.x} cy={last.y} r={5.5} fill="#fff" stroke="var(--primary)" strokeWidth={2.5} />
            <text
              x={last.x}
              y={last.y - 12}
              textAnchor="middle"
              className="fill-[#495057] dark:fill-[#ADB5BD]"
              fontFamily="var(--font-plex-mono)"
              fontSize={10}
              fontWeight={600}
            >
              {formatNaira(last.amount, { decimals: false })}
            </text>
          </>
        )}

        {/* x labels — every other point, always include last */}
        {points.map((p, i) => {
          const show = i % 2 === 0 || i === points.length - 1;
          if (!show) return null;
          return (
            <text
              key={i}
              x={p.x}
              y={H - 8}
              textAnchor={i === points.length - 1 ? "end" : i === 0 ? "start" : "middle"}
              className="fill-[#ADB5BD]"
              fontFamily="var(--font-plex-mono)"
              fontSize={10}
            >
              {p.label}
            </text>
          );
        })}

        {/* hover crosshair */}
        {hover !== null && (
          <line
            x1={points[hover].x}
            y1={PAD_T}
            x2={points[hover].x}
            y2={H - PAD_B}
            className="stroke-[#CED4DA] dark:stroke-[#253A58]"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        {/* wide invisible hit area */}
        <rect
          x={0}
          y={0}
          width={W}
          height={H - PAD_B}
          fill="transparent"
          pointerEvents="all"
          style={{ cursor: "crosshair" }}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-[10px] border border-[#E9ECEF] bg-white px-2.5 py-1.5 text-center shadow-md dark:border-[#253A58] dark:bg-[#0A1628]"
          style={{
            left: `${(points[hover].x / W) * 100}%`,
            top: `${(points[hover].y / H) * 100}%`,
            transform: "translate(-50%, -110%)",
          }}
        >
          <div className="eg-amt text-[11px] text-[#0A1628] dark:text-[#F8F9FA]">
            {valuePrefix ?? "₦"}
            {points[hover].amount.toLocaleString("en-NG")}
          </div>
          <div className="text-[10px] text-[#6C757D]">{points[hover].label}</div>
        </div>
      )}

      {!hasActivity && (
        <p className="absolute inset-0 flex items-center justify-center text-[12px] text-[#ADB5BD]">
          No activity yet
        </p>
      )}

      {/* sr-only data table */}
      <table className="sr-only">
        <caption>Chart data</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th scope="row">{d.label}</th>
              <td>{d.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
