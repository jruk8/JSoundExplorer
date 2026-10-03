import { useMemo, useState } from 'react'
import type { DayPoint, HourPoint, MonthPoint } from '../lib/hourly.ts'
import {
  detectHourCycle,
  formatDayLabel,
  formatHourLabel,
  formatMonthLabel,
} from '../lib/hourly.ts'
import { formatPlays } from '../lib/playcounts.ts'
import { en, formatString } from '../locales/en.ts'

const W = 300
const H = 132
const PAD_L = 36
const PAD_R = 8
const PAD_T = 8
const PAD_B = 22

export interface TrendChartProps {
  points: Array<{ date: Date; plays: number }>
  testId: string
  formatLabel: (date: Date) => string
  describeTotal: (total: number) => string
}

/** Line chart: accent line, compact play-count ticks, exact-count hover. */
export function TrendChart({ points, testId, formatLabel, describeTotal }: TrendChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  if (points.length === 0) return null
  const max = Math.max(0, ...points.map((p) => p.plays))
  const span = Math.max(1, max)
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B
  const x = (i: number) => PAD_L + (i / Math.max(1, points.length - 1)) * plotW
  const y = (v: number) => PAD_T + plotH * (1 - v / span)
  const ticks = max >= 2 ? [0, Math.round(max / 2), max] : [0, max]
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.plays).toFixed(1)}`).join(' ')
  const area = `${x(0).toFixed(1)},${y(0).toFixed(1)} ${line} ${x(points.length - 1).toFixed(1)},${y(0).toFixed(1)}`
  const total = points.reduce((s, p) => s + p.plays, 0)
  // Hover tooltip: local label plus the exact unformatted count.
  const tipPoint = hover === null ? undefined : points[hover]
  const tipText = tipPoint === undefined ? '' : `${formatLabel(tipPoint.date)} · ${tipPoint.plays}`
  const tipW = tipText.length * 7 + 18
  const tipH = 26
  const tipCx =
    hover === null
      ? 0
      : Math.min(Math.max(x(hover), tipW / 2 + 2), W - tipW / 2 - 2)
  const tipTop = hover === null ? 0 : y(points[hover].plays) - 12 - tipH
  const tipY = tipTop < 2 && hover !== null ? y(points[hover].plays) + 12 : tipTop

  return (
    <svg
      data-testid={`${testId}-chart`}
      className="trend-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={describeTotal(total)}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} className="trend-grid" />
          <text x={PAD_L - 5} y={y(t) + 3} textAnchor="end" className="trend-tick">
            {formatPlays(t)}
          </text>
        </g>
      ))}
      <polygon points={area} className="trend-area" />
      <polyline points={line} className="trend-line" />
      {points.map((p, i) => (
        <g key={p.date.getTime()}>
          <circle
            data-testid={`${testId}-point`}
            cx={x(i)}
            cy={y(p.plays)}
            r={2.5}
            className="trend-dot"
          />
          <circle
            cx={x(i)}
            cy={y(p.plays)}
            r={9}
            className="trend-hit"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        </g>
      ))}
      {points.map((p, i) => (
        <text
          key={`x-${p.date.getTime()}`}
          x={x(i)}
          y={H - 6}
          textAnchor={i === points.length - 1 ? 'end' : 'middle'}
          className="trend-tick"
        >
          {formatLabel(p.date)}
        </text>
      ))}
      {tipPoint !== undefined && (
        <g data-testid={`${testId}-tip`} pointerEvents="none">
          <rect
            x={tipCx - tipW / 2}
            y={tipY}
            width={tipW}
            height={tipH}
            className="trend-tip-box"
          />
          <text x={tipCx} y={tipY + 17} textAnchor="middle" className="trend-tip-text">
            {tipText}
          </text>
        </g>
      )}
    </svg>
  )
}

/** Last-8-hours line chart: accent line, compact play-count ticks. */
export function HourlyChart({ points }: { points: HourPoint[] }) {
  const cycle = useMemo(detectHourCycle, [])
  return (
    <TrendChart
      points={points}
      testId="hourly"
      formatLabel={(date) => formatHourLabel(date, cycle)}
      describeTotal={(total) => formatString(en.options.hourlyChartLabel, { total })}
    />
  )
}

/** Last-7-days line chart in the same color scheme. */
export function DailyChart({ points }: { points: DayPoint[] }) {
  return (
    <TrendChart
      points={points}
      testId="daily"
      formatLabel={formatDayLabel}
      describeTotal={(total) => formatString(en.options.dailyChartLabel, { total })}
    />
  )
}

/** Last-12-months line chart in the same color scheme. */
export function MonthlyChart({ points }: { points: MonthPoint[] }) {
  return (
    <TrendChart
      points={points}
      testId="monthly"
      formatLabel={formatMonthLabel}
      describeTotal={(total) => formatString(en.options.monthlyChartLabel, { total })}
    />
  )
}
