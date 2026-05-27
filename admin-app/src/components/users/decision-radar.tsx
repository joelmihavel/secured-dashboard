"use client";

import type { Issue } from "@/lib/decision";

interface CategoryScore {
  label: string;
  passed: number;
  total: number;
  score: number; // 0–1
}

interface CategoryDef {
  label: string;
  checks: string[];
}

const CATEGORIES: CategoryDef[] = [
  {
    label: "Agreement",
    checks: [
      "Agreement not extracted",
      "No rent amount",
      "No property address",
      "No lease dates",
      "Lease expired",
      "Low confidence",
    ],
  },
  {
    label: "Landlord",
    checks: [
      "No landlord info",
      "Landlord bank not verified",
      "Landlord PAN not verified",
      "Landlord not confirmed",
    ],
  },
  {
    label: "Identity",
    checks: ["M360 not verified", "High risk level"],
  },
  {
    label: "Tenant",
    checks: ["Tenant bank not verified", "Utility not verified"],
  },
  {
    label: "Document",
    checks: ["Stamp not verified"],
  },
];

function issueMatches(issueLabel: string, check: string): boolean {
  return issueLabel === check || issueLabel.startsWith(check);
}

function computeCategories(issues: Issue[]): CategoryScore[] {
  return CATEGORIES.map(({ label, checks }) => {
    let passed = 0;
    for (const check of checks) {
      const match = issues.find((i) => issueMatches(i.label, check));
      if (!match) {
        passed += 1;
      } else if (match.severity === "warning") {
        passed += 0.5;
      }
    }
    return {
      label,
      passed,
      total: checks.length,
      score: checks.length > 0 ? passed / checks.length : 1,
    };
  });
}

function overallRisk(categories: CategoryScore[]): {
  level: "LOW" | "MEDIUM" | "HIGH";
  score: number;
  color: string;
  bgColor: string;
} {
  const avg =
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length;
  if (avg >= 0.85)
    return { level: "LOW", score: avg, color: "#22C55E", bgColor: "rgba(34,197,94,0.1)" };
  if (avg >= 0.5)
    return { level: "MEDIUM", score: avg, color: "#F59E0B", bgColor: "rgba(245,158,11,0.1)" };
  return { level: "HIGH", score: avg, color: "#EF4444", bgColor: "rgba(239,68,68,0.1)" };
}

interface Props {
  issues: Issue[];
  size?: number;
}

export function DecisionRadar({ issues, size = 200 }: Props) {
  const categories = computeCategories(issues);
  const risk = overallRisk(categories);
  const n = categories.length;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 32;
  const step = (2 * Math.PI) / n;

  function polar(angle: number, r: number) {
    return {
      x: cx + r * Math.cos(angle - Math.PI / 2),
      y: cy + r * Math.sin(angle - Math.PI / 2),
    };
  }

  const rings = [0.33, 0.66, 1.0];

  const ringPolygons = rings.map((r) => {
    const radius = maxR * r;
    return Array.from({ length: n }, (_, i) => {
      const { x, y } = polar(i * step, radius);
      return `${x},${y}`;
    }).join(" ");
  });

  const spokes = Array.from({ length: n }, (_, i) => {
    const { x, y } = polar(i * step, maxR);
    return { x1: cx, y1: cy, x2: x, y2: y };
  });

  const dataPoints = categories.map((c, i) => {
    const r = Math.max(c.score, 0.08) * maxR;
    const { x, y } = polar(i * step, r);
    return { x, y, score: c.score };
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  const labels = categories.map((c, i) => {
    const { x, y } = polar(i * step, maxR + 20);
    return { x, y, label: c.label, score: c.score };
  });

  function dotColor(score: number) {
    if (score >= 0.85) return "#22C55E";
    if (score >= 0.5) return "#F59E0B";
    return "#EF4444";
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {/* Rings */}
        {ringPolygons.map((points, i) => (
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
          fill={risk.color}
          fillOpacity={0.1}
          stroke={risk.color}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Data dots */}
        {dataPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={dotColor(p.score)}
            stroke="#0A0A0A"
            strokeWidth={1.5}
          />
        ))}

        {/* Axis labels */}
        {labels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={dotColor(l.score)}
            fontFamily="Plus Jakarta Sans, sans-serif"
            fontSize={8}
            fontWeight={600}
          >
            {l.label}
          </text>
        ))}

        {/* Center risk level */}
        <text
          x={cx}
          y={cy - 5}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={risk.color}
          fontFamily="Plus Jakarta Sans, sans-serif"
          fontSize={16}
          fontWeight={800}
        >
          {risk.level}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#525252"
          fontFamily="Plus Jakarta Sans, sans-serif"
          fontSize={8}
        >
          {Math.round(risk.score * 100)}% clear
        </text>
      </svg>
    </div>
  );
}
