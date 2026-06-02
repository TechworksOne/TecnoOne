import React, { useRef, useState, useCallback } from 'react';

// Dot layout (1-based):
//  1 2 3
//  4 5 6
//  7 8 9

const SIZE = 192;
const PADDING = 38;
const COLS = 3;
const SPACING = (SIZE - 2 * PADDING) / (COLS - 1);
const HIT_RADIUS = 22;

function getDotPos(dot: number): { x: number; y: number } {
  const i = dot - 1;
  return {
    x: PADDING + (i % COLS) * SPACING,
    y: PADDING + Math.floor(i / COLS) * SPACING,
  };
}

interface PatternLockProps {
  pattern: number[];
  onChange: (pattern: number[]) => void;
  minPoints?: number;
}

export default function PatternLock({ pattern, onChange, minPoints = 4 }: PatternLockProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const toSVGCoords = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * SIZE,
      y: ((clientY - rect.top) / rect.height) * SIZE,
    };
  }, []);

  const hitDot = useCallback((x: number, y: number): number | null => {
    for (let d = 1; d <= 9; d++) {
      const p = getDotPos(d);
      if (Math.hypot(x - p.x, y - p.y) <= HIT_RADIUS) return d;
    }
    return null;
  }, []);

  const onStart = useCallback((clientX: number, clientY: number) => {
    const pos = toSVGCoords(clientX, clientY);
    if (!pos) return;
    const dot = hitDot(pos.x, pos.y);
    if (dot !== null) {
      onChange([dot]);
      setDragging(true);
      setCursor(pos);
    }
  }, [toSVGCoords, hitDot, onChange]);

  const onMove = useCallback((clientX: number, clientY: number) => {
    if (!dragging) return;
    const pos = toSVGCoords(clientX, clientY);
    if (!pos) return;
    setCursor(pos);
    const dot = hitDot(pos.x, pos.y);
    if (dot !== null && !pattern.includes(dot)) {
      onChange([...pattern, dot]);
    }
  }, [dragging, toSVGCoords, hitDot, pattern, onChange]);

  const onEnd = useCallback(() => {
    setDragging(false);
    setCursor(null);
  }, []);

  const isValid = pattern.length >= minPoints;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-44 h-44 touch-none select-none cursor-pointer"
        style={{ userSelect: 'none' }}
        onMouseDown={e => { e.preventDefault(); onStart(e.clientX, e.clientY); }}
        onMouseMove={e => { e.preventDefault(); onMove(e.clientX, e.clientY); }}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchStart={e => { e.preventDefault(); const t = e.touches[0]; onStart(t.clientX, t.clientY); }}
        onTouchMove={e => { e.preventDefault(); const t = e.touches[0]; onMove(t.clientX, t.clientY); }}
        onTouchEnd={onEnd}
      >
        {/* Connection lines between selected dots */}
        {pattern.slice(1).map((dot, i) => {
          const from = getDotPos(pattern[i]);
          const to = getDotPos(dot);
          return (
            <line
              key={i}
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.65"
            />
          );
        })}

        {/* Trailing line while dragging */}
        {dragging && cursor && pattern.length > 0 && (() => {
          const last = getDotPos(pattern[pattern.length - 1]);
          return (
            <line
              x1={last.x} y1={last.y}
              x2={cursor.x} y2={cursor.y}
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.3"
              strokeDasharray="4 3"
            />
          );
        })()}

        {/* Dots */}
        {Array.from({ length: 9 }, (_, i) => i + 1).map(dot => {
          const { x, y } = getDotPos(dot);
          const sel = pattern.includes(dot);
          const order = pattern.indexOf(dot);
          return (
            <g key={dot}>
              {/* Invisible hit area */}
              <circle cx={x} cy={y} r={HIT_RADIUS} fill="transparent" />
              {/* Outer glow (selected) */}
              {sel && (
                <circle cx={x} cy={y} r={17} fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.3" />
              )}
              {/* Main dot */}
              <circle
                cx={x} cy={y}
                r={sel ? 9 : 7}
                fill={sel ? '#3b82f6' : 'none'}
                stroke={sel ? '#2563eb' : '#94a3b8'}
                strokeWidth={sel ? 0 : 2}
                className="transition-all duration-100"
              />
              {/* Order number inside selected dot */}
              {sel && (
                <text
                  x={x} y={y + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="7.5"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  {order + 1}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Status text */}
      {pattern.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
          Presiona y arrastra para dibujar el patrón
        </p>
      ) : (
        <p className="text-xs text-center leading-5">
          <span className="text-slate-500 dark:text-slate-400">Secuencia: </span>
          <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
            {pattern.join('-')}
          </span>
          {!isValid ? (
            <span className="text-amber-500 dark:text-amber-400 ml-1.5">
              ({minPoints - pattern.length} punto{minPoints - pattern.length !== 1 ? 's' : ''} más)
            </span>
          ) : (
            <span className="text-emerald-500 dark:text-emerald-400 ml-1.5">✓</span>
          )}
        </p>
      )}
    </div>
  );
}
