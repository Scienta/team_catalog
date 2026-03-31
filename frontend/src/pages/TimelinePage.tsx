import { useState, useEffect, useRef, useCallback } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useNavigate } from 'react-router-dom'

type Consultant = {
  id: string
  name: string
  contractStart?: string
  contractEnd?: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1)
  return Math.floor((date.getTime() - start.getTime()) / 86400000) + 1
}

function daysInYear(year: number): number {
  return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365
}

function getBarPosition(consultant: Consultant, year: number) {
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)
  const total = daysInYear(year)

  if (!consultant.contractStart && !consultant.contractEnd) return null

  const start = consultant.contractStart ? new Date(consultant.contractStart) : yearStart
  const end = consultant.contractEnd ? new Date(consultant.contractEnd) : yearEnd

  if (end < yearStart || start > yearEnd) return null

  const clampedStart = start < yearStart ? yearStart : start
  const clampedEnd = end > yearEnd ? yearEnd : end

  const leftDay = dayOfYear(clampedStart) - 1
  const rightDay = dayOfYear(clampedEnd)

  return {
    left: (leftDay / total) * 100,
    width: ((rightDay - leftDay) / total) * 100,
    extendsLeft: start < yearStart,
    extendsRight: end > yearEnd,
  }
}

function getDaysLeft(consultant: Consultant): number | null {
  if (!consultant.contractEnd) return null
  const now = new Date()
  const end = new Date(consultant.contractEnd)
  return Math.ceil((end.getTime() - now.getTime()) / 86400000)
}

function getBarColor(consultant: Consultant): string {
  const daysLeft = getDaysLeft(consultant)
  if (daysLeft === null) return 'bg-gray-400 dark:bg-gray-600'
  if (daysLeft < 0) return 'bg-red-400 dark:bg-red-500'
  if (daysLeft <= 30) return 'bg-amber-400 dark:bg-amber-500'
  return 'bg-emerald-400 dark:bg-emerald-500'
}

function formatDaysLeft(daysLeft: number | null): string {
  if (daysLeft === null) return 'Ukjent'
  if (daysLeft < 0) return `${Math.abs(daysLeft)}d siden`
  if (daysLeft === 0) return 'I dag'
  if (daysLeft <= 90) return `${daysLeft}d`
  const months = Math.round(daysLeft / 30)
  return `${months}mnd`
}

export function TimelinePage() {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [availableHeight, setAvailableHeight] = useState(0)
  const timelineRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const measure = useCallback(() => {
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    // available = viewport bottom minus timeline top minus some padding for legend
    setAvailableHeight(window.innerHeight - rect.top - 60)
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  useEffect(() => {
    return onSnapshot(collection(db, 'consultants'), (s) =>
      setConsultants(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Consultant)),
    )
  }, [])

  const today = new Date()
  const isCurrentYear = today.getFullYear() === year
  const todayPercent = isCurrentYear ? ((dayOfYear(today) - 1) / daysInYear(year)) * 100 : null

  const sorted = consultants
    .filter((c) => c.contractEnd)
    .sort((a, b) => b.contractEnd!.localeCompare(a.contractEnd!))

  const monthPositions = MONTHS.map((_, i) => {
    const monthStart = new Date(year, i, 1)
    return ((dayOfYear(monthStart) - 1) / daysInYear(year)) * 100
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Tidslinje</h1>
          <span className="text-xs text-gray-400 dark:text-gray-500">{sorted.length} konsulenter</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums w-12 text-center">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div ref={timelineRef} className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col" style={{ height: availableHeight > 100 ? availableHeight : undefined }}>
        {/* Month header */}
        <div className="relative h-8 border-b border-gray-200 dark:border-gray-800 shrink-0">
          {MONTHS.map((m, i) => (
            <div
              key={m}
              className="absolute top-0 h-full flex items-center border-l border-gray-100 dark:border-gray-800"
              style={{ left: `${monthPositions[i]}%` }}
            >
              <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 pl-1.5">{m}</span>
            </div>
          ))}
          {todayPercent !== null && (
            <div className="absolute top-0 h-full flex items-start" style={{ left: `${todayPercent}%` }}>
              <div className="w-px h-full bg-red-400 dark:bg-red-500 opacity-60" />
            </div>
          )}
        </div>

        {/* Rows */}
        <div className="flex-1 min-h-0 flex flex-col">
          {sorted.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
              Ingen konsulenter funnet
            </div>
          )}
          {sorted.map((c) => {
            const bar = getBarPosition(c, year)
            const daysLeft = getDaysLeft(c)
            const daysLabel = formatDaysLeft(daysLeft)
            const isHovered = hoveredId === c.id
            const barPad = 1 // px top/bottom padding inside row for the bar
            return (
              <div
                key={c.id}
                className="relative flex-1 min-h-[4px] border-b border-gray-50 dark:border-gray-800/30 last:border-b-0 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-[#222]"
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => navigate(`/consultant/${c.id}`)}
              >
                {/* Month grid lines */}
                {monthPositions.map((pos, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full border-l border-gray-50 dark:border-gray-800/30"
                    style={{ left: `${pos}%` }}
                  />
                ))}
                {/* Contract bar */}
                {bar && (
                  <div
                    className={`absolute ${getBarColor(c)} ${isHovered ? 'opacity-100' : 'opacity-70'} transition-opacity ${
                      bar.extendsLeft && bar.extendsRight ? 'rounded-none' :
                      bar.extendsLeft ? 'rounded-r' :
                      bar.extendsRight ? 'rounded-l' : 'rounded'
                    }`}
                    style={{ left: `${bar.left}%`, width: `${Math.max(bar.width, 0.3)}%`, top: barPad, bottom: barPad }}
                  />
                )}
                {/* Today marker */}
                {todayPercent !== null && (
                  <div
                    className="absolute top-0 h-full w-px bg-red-400 dark:bg-red-500 opacity-40"
                    style={{ left: `${todayPercent}%` }}
                  />
                )}
                {/* Hover tooltip */}
                {isHovered && (
                  <div className="absolute left-2 -top-8 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                    {c.name}
                    {c.contractEnd && (
                      <span className="opacity-70 ml-1.5">· {c.contractEnd} ({daysLabel})</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-4 text-[11px] text-gray-400 dark:text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-500 opacity-70" />
          <span>Aktiv (&gt;30d)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-400 dark:bg-amber-500 opacity-70" />
          <span>Utløper snart (&le;30d)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-400 dark:bg-red-500 opacity-70" />
          <span>Utløpt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-gray-400 dark:bg-gray-600 opacity-70" />
          <span>Ingen sluttdato</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-px h-3 bg-red-400 dark:bg-red-500" />
          <span>I dag</span>
        </div>
      </div>
    </div>
  )
}
