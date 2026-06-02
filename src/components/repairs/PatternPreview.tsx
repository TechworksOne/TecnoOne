// Read-only visual display of an Android-style unlock pattern.
// Receives a value string like "1-2-5-8" and renders a 3×3 SVG grid.
//
// Dot layout:
//   1 2 3
//   4 5 6
//   7 8 9

import React from 'react';

const SIZE    = 90;
const PADDING = 18;
const COLS    = 3;
const SPACING = (SIZE - 2 * PADDING) / (COLS - 1);

function getDotPos(dot: number) {
  const i = dot - 1;
  return {
    x: PADDING + (i % COLS) * SPACING,
    y: PADDING + Math.floor(i / COLS) * SPACING,
  };
}

interface PatternPreviewProps {
  /** Pattern sequence as a dash-separated string, e.g. "1-2-5-8" */
  value: string;
  /** Rendered size in px (width = height). Defaults to 80. */
  size?: number;
}

export default function PatternPreview({ value, size = 80 }: PatternPreviewProps) {
  const pattern = value
    .split('-')
    .map(Number)
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 9);

  if (pattern.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      height={size}
      style={{ display: 'block', flexShrink: 0 }}
      aria-label={`Patrón de acceso: ${value}`}
    >
      {/* Connection lines */}
      {pattern.slice(1).map((dot, i) => {
        const from = getDotPos(pattern[i]);
        const to   = getDotPos(dot);
        return (
          <line
            key={i}
            x1={from.x} y1={from.y}
            x2={to.x}   y2={to.y}
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.55"
          />
        );
      })}

      {/* All 9 dots */}
      {Array.from({ length: 9 }, (_, i) => i + 1).map(dot => {
        const { x, y } = getDotPos(dot);
        const sel = pattern.includes(dot);
        return (
          <g key={dot}>
            {/* Outer ring on selected dots */}
            {sel && (
              <circle
                cx={x} cy={y} r={8}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="1"
                opacity="0.25"
              />
            )}
            {/* Core dot */}
            <circle
              cx={x} cy={y}
              r={sel ? 4.5 : 3}
              fill={sel ? '#3b82f6' : '#94a3b8'}
              opacity={sel ? 1 : 0.45}
            />
          </g>
        );
      })}
    </svg>
  );
}
