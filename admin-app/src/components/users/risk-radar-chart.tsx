"use client";

import type { RiskFactorEntry } from "@/types/user";

const SIGNAL_VALUE: Record<string, number> = { GREEN: 1, YELLOW: 0.5, RED: 0.15, MISSING: 0.65 };
const SIGNAL_COLOR: Record<string, string> = { GREEN: "#22C55E", YELLOW: "#F59E0B", RED: "#EF4444", MISSING: "#6B7280" };

interface Props {
  factors: RiskFactorEntry[];
  size?: number;
}

export function RiskRadarChart({ factors, size = 260 }: Props) {
  if (factors.length === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - 36;
  const n = factors.length;
  const angleStep = (2 * Math.PI) / n;

  function polarToXY(angle: number, radius: number) {
    return {
      x: cx + radius * Math.cos(angle - Math.PI / 2),
      y: cy + radius * Math.sin(angle - Math.PI / 2),
    };
  }

  // Concentric rings
  const rings = [0.33, 0.66, 1.0];
  const ringPaths = rings.map((r) => {
    const radius = maxRadius * r;
    const points = Array.from({ length: n }, (_, i) => {
      const { x, y } = polarToXY(i * angleStep, radius);
      return `${x},${y}`;
    });
    return points.join(" ");
  });

  // Spoke lines
  const spokes = Array.from({ length: n }, (_, i) => {
    const { x, y } = polarToXY(i * angleStep, maxRadius);
    return { x1: cx, y1: cy, x2: x, y2: y };
  });

  // Data polygon
  const dataPoints = factors.map((f, i) => {
    const val = SIGNAL_VALUE[f.signal] || 0.15;
    const { x, y } = polarToXY(i * angleStep, maxRadius * val);
    return { x, y, signal: f.signal };
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Labels
  const labels = factors.map((f, i) => {
    const { x, y } = polarToXY(i * angleStep, maxRadius + 22);
    const shortLabel = f.factor
      .replace(/_/g, " ")
      .replace(/verification/gi, "")
      .replace(/agreement/gi, "agr.")
      .trim();
    return { x, y, label: shortLabel.length > 12 ? shortLabel.slice(0, 12) : shortLabel, signal: f.signal };
  });

  // Summary counts
  const green = factors.filter((f) => f.signal === "GREEN").length;
  const yellow = factors.filter((f) => f.signal === "YELLOW").length;
  const red = factors.filter((f) => f.signal === "RED").length;
  const missing = factors.filter((f) => f.signal === "MISSING").length;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {/* Rings */}
      {ringPaths.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="#1F1F1F"
          strokeWidth={i === 2 ? 1 : 0.5}
        />
      ))}

      {/* Spokes */}
      {spokes.map((s, i) => (
        <line
          key={i}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke="#1F1F1F"
          strokeWidth={0.5}
        />
      ))}

      {/* Data fill */}
      <polygon
        points={dataPolygon}
        fill="#FF9A6D"
        fillOpacity={0.12}
        stroke="#FF9A6D"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Data points with signal colors */}
      {dataPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3.5}
          fill={SIGNAL_COLOR[p.signal] || "#525252"}
          stroke="#0A0A0A"
          strokeWidth={1.5}
        />
      ))}

      {/* Labels */}
      {labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={SIGNAL_COLOR[l.signal] || "#525252"}
          fontFamily="Plus Jakarta Sans, sans-serif"
          fontSize={8}
          fontWeight={500}
        >
          {l.label}
        </text>
      ))}

      {/* Center score */}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fill="#E8E8E8"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontSize={20}
        fontWeight={700}
      >
        {green}/{factors.length}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        fill="#525252"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontSize={8}
      >
        {green}G {yellow}Y {red}R{missing > 0 ? ` ${missing}?` : ""}
      </text>
    </svg>
  );
}
