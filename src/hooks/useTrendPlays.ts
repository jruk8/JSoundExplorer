import { useEffect, useState } from 'react'
import type { DayPoint, HourPoint, MonthPoint } from '../lib/hourly.ts'
import { normalizeDaily, normalizeHourly, normalizeMonthly } from '../lib/hourly.ts'
import type { DayBucket, HourlyBucket, MonthBucket } from '../lib/playcounts.ts'
import {
  REFRESH_MS,
  fetchDailyPlays,
  fetchHourlyPlays,
  fetchMonthlyPlays,
} from '../lib/playcounts.ts'

/** Polled trend series with an empty-series initial state. */
function useTrendSeries<Bucket, Point>(
  fetcher: () => Promise<Bucket[]>,
  normalize: (buckets: Bucket[]) => Point[],
  initial: () => Point[],
): Point[] {
  const [points, setPoints] = useState<Point[]>(initial)

  useEffect(() => {
    let live = true
    async function refresh() {
      try {
        const buckets = await fetcher()
        if (live) setPoints(normalize(buckets))
      } catch {
        // API unreachable: keep the last known series.
      }
    }
    void refresh()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, REFRESH_MS)
    return () => {
      live = false
      window.clearInterval(timer)
    }
  }, [])

  return points
}

/** Hourly series: last-8-hours play totals from the API, polled. */
export function useHourlyPlays(): HourPoint[] {
  return useTrendSeries<HourlyBucket, HourPoint>(fetchHourlyPlays, normalizeHourly, () =>
    normalizeHourly([]),
  )
}

/** Daily series: last-7-days play totals from the API, polled. */
export function useDailyPlays(): DayPoint[] {
  return useTrendSeries<DayBucket, DayPoint>(fetchDailyPlays, normalizeDaily, () =>
    normalizeDaily([]),
  )
}

/** Monthly series: last-12-months play totals from the API, polled. */
export function useMonthlyPlays(): MonthPoint[] {
  return useTrendSeries<MonthBucket, MonthPoint>(fetchMonthlyPlays, normalizeMonthly, () =>
    normalizeMonthly([]),
  )
}
