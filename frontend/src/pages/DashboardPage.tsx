import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { db } from '../firebase'

type Consultant = { id: string; name: string; photoUrl?: string; contractEnd?: string; contractStart?: string; isInternal?: boolean; sykemeldt?: boolean; permittert?: boolean; clientId?: string }
type Project = { id: string; name: string; clientId: string; consultantIds?: string[] }
type Client = { id: string; name: string }

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const end = new Date(dateStr); end.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function DashboardPage() {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'consultants'), (s) => setConsultants(s.docs.map((d) => ({ id: d.id, ...d.data() } as Consultant))))
    const u2 = onSnapshot(collection(db, 'projects'), (s) => setProjects(s.docs.map((d) => ({ id: d.id, ...d.data() } as Project))))
    const u3 = onSnapshot(collection(db, 'clients'), (s) => setClients(s.docs.map((d) => ({ id: d.id, ...d.data() } as Client))))
    return () => { u1(); u2(); u3() }
  }, [])

  // Exclude internal employees from all stats
  const externalConsultants = consultants.filter((c) => !c.isInternal)
  const sykemeldte = externalConsultants.filter((c) => c.sykemeldt).sort((a, b) => a.name.localeCompare(b.name))
  const permitterte = externalConsultants.filter((c) => c.permittert).sort((a, b) => a.name.localeCompare(b.name))

  const inAnyProject = new Set(projects.flatMap((p) => p.consultantIds ?? []))

  // Derived stats
  const withProject = externalConsultants.filter((c) => inAnyProject.has(c.id))
  // "Uten prosjekt" = not in any project (includes client-only assigned — they still have no project)
  const withoutProject = externalConsultants.filter((c) => !inAnyProject.has(c.id)).sort((a, b) => a.name.localeCompare(b.name))

  const withContract = withProject.filter((c) => c.contractEnd)
  const expiringSoon = withContract.filter((c) => { const d = daysUntil(c.contractEnd!); return d >= 0 && d <= 30 }).sort((a, b) => daysUntil(a.contractEnd!) - daysUntil(b.contractEnd!))
  const expired = withContract.filter((c) => daysUntil(c.contractEnd!) < 0)
  const activeOk = withContract.filter((c) => daysUntil(c.contractEnd!) > 30)
  const upcoming60 = withContract.filter((c) => { const d = daysUntil(c.contractEnd!); return d >= 0 && d <= 60 }).sort((a, b) => daysUntil(a.contractEnd!) - daysUntil(b.contractEnd!))

  // Consultants per client: project-assigned + direct clientId (not in any project)
  const consultantsPerClient = clients.map((client) => {
    const clientProjects = projects.filter((p) => p.clientId === client.id)
    const projectConsultantIds = new Set(clientProjects.flatMap((p) => p.consultantIds ?? []))
    const directCount = externalConsultants.filter((c) => c.clientId === client.id && !inAnyProject.has(c.id)).length
    const count = projectConsultantIds.size + directCount
    return { client, count, projects: clientProjects }
  }).filter((x) => x.count > 0).sort((a, b) => b.count - a.count)

  // Pie chart data
  const noContractWithProject = withProject.filter((c) => !c.contractEnd)
  const pieData = [
    { name: 'Uten prosjekt', value: withoutProject.length, color: '#ef4444' },
    { name: 'Utløpt kontrakt', value: expired.length, color: '#f97316' },
    { name: 'Utløper ≤7 dager', value: withContract.filter((c) => { const d = daysUntil(c.contractEnd!); return d >= 0 && d <= 7 }).length, color: '#fbbf24' },
    { name: 'Utløper ≤30 dager', value: expiringSoon.filter((c) => daysUntil(c.contractEnd!) > 7).length, color: '#facc15' },
    { name: 'Aktiv kontrakt', value: activeOk.length, color: '#10b981' },
    { name: 'Ingen kontrakt', value: noContractWithProject.length, color: '#9ca3af' },
  ].filter((d) => d.value > 0)

  const statCards = [
    {
      label: 'Konsulenter totalt',
      value: externalConsultants.length,
      sub: `${withProject.length} på prosjekt`,
      color: 'bg-white dark:bg-[#1a1a1a]',
      valueColor: 'text-gray-900 dark:text-white',
    },
    {
      label: 'Uten prosjekt',
      value: withoutProject.length,
      sub: withoutProject.length === 0 ? 'Ingen kriser' : withoutProject.length === 1 ? '1 konsulent' : `${withoutProject.length} konsulenter`,
      color: withoutProject.length > 0 ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800' : 'bg-white dark:bg-[#1a1a1a]',
      valueColor: withoutProject.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white',
    },
    {
      label: 'Utløper snart',
      value: expiringSoon.length,
      sub: expiringSoon.length > 0 ? `Innen 30 dager` : 'Ingen innen 30 dager',
      color: expiringSoon.length > 0 ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-[#1a1a1a]',
      valueColor: expiringSoon.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white',
    },
    {
      label: 'Utløpt kontrakt',
      value: expired.length,
      sub: expired.length === 0 ? 'Ingen utløpte' : 'Bør følges opp',
      color: expired.length > 0 ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800' : 'bg-white dark:bg-[#1a1a1a]',
      valueColor: expired.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white',
    },
    {
      label: 'Aktive kontrakter',
      value: activeOk.length,
      sub: `Mer enn 30 dager igjen`,
      color: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',
      valueColor: 'text-emerald-600 dark:text-emerald-500',
    },
    {
      label: 'Sykemeldte',
      value: sykemeldte.length,
      sub: sykemeldte.length === 0 ? 'Ingen sykemeldte' : sykemeldte.length === 1 ? '1 konsulent' : `${sykemeldte.length} konsulenter`,
      color: sykemeldte.length > 0 ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-[#1a1a1a]',
      valueColor: sykemeldte.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white',
    },
    {
      label: 'Permitterte',
      value: permitterte.length,
      sub: permitterte.length === 0 ? 'Ingen permitterte' : permitterte.length === 1 ? '1 konsulent' : `${permitterte.length} konsulenter`,
      color: permitterte.length > 0 ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-[#1a1a1a]',
      valueColor: permitterte.length > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white',
    },
    {
      label: 'Kunder',
      value: clients.length,
      sub: `${projects.length} prosjekter`,
      color: 'bg-white dark:bg-[#1a1a1a]',
      valueColor: 'text-gray-900 dark:text-white',
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Oversikt over konsulenter og kontrakter</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className={`rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex flex-col gap-1 transition-colors ${card.color}`}>
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 leading-tight">{card.label}</p>
            <p className={`text-3xl font-bold tabular-nums ${card.valueColor}`}>{card.value}</p>
            <p className="text-xs text-gray-400 dark:text-gray-600">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Pie chart */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 transition-colors">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-6">Statusfordeling</h2>
        {externalConsultants.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-400 dark:text-gray-600">Ingen data</div>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-full md:w-64 h-64 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value} konsulenter`]}
                    contentStyle={{
                      backgroundColor: 'var(--tooltip-bg, #fff)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      fontSize: '12px',
                      padding: '8px 12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-col gap-3 flex-1">
              {pieData.map((entry) => {
                const pct = Math.round((entry.value / externalConsultants.length) * 100)
                return (
                  <div key={entry.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{entry.name}</span>
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-xs text-gray-400 dark:text-gray-600">{pct}%</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums w-5 text-right">{entry.value}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: entry.color }} />
                      </div>
                    </div>
                  </div>
                )
              })}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-400 dark:text-gray-600">Totalt</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{externalConsultants.length} konsulenter</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Upcoming expirations */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Kontrakter — neste 60 dager
            {upcoming60.length > 0 && <span className="ml-2 text-xs font-medium text-gray-400 dark:text-gray-600 normal-case tracking-normal">{upcoming60.length} stk</span>}
          </h2>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            {upcoming60.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-600">Ingen kontrakter utløper de neste 60 dagene</div>
            ) : (
              upcoming60.map((c, i) => {
                const days = daysUntil(c.contractEnd!)
                const isRed = days <= 7
                const isAmber = days <= 30 && days > 7
                return (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/consultant/${c.id}`)}
                    className={`flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors ${i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {c.photoUrl ? (
                        <img src={c.photoUrl} alt={c.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs font-semibold flex-shrink-0">{c.name?.charAt(0)}</div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-600">{formatDate(c.contractEnd!)}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                      isRed ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                      : isAmber ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                    }`}>
                      {days === 0 ? 'I dag' : `${days}d`}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Without project */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
              Uten prosjekt
              {withoutProject.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-2 py-0.5 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  {withoutProject.length}
                </span>
              )}
            </h2>
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
              {withoutProject.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-600">
                  Alle konsulenter er på prosjekt ✓
                </div>
              ) : (
                withoutProject.map((c, i) => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/consultant/${c.id}`)}
                    className={`flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-red-50/60 dark:hover:bg-red-950/20 transition-colors ${i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}`}
                  >
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt={c.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400 text-xs font-semibold flex-shrink-0">{c.name?.charAt(0)}</div>
                    )}
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sykemeldte */}
          {sykemeldte.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                Sykemeldte
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-0.5 rounded-md">
                  {sykemeldte.length}
                </span>
              </h2>
              <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                {sykemeldte.map((c, i) => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/consultant/${c.id}`)}
                    className={`flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-amber-50/60 dark:hover:bg-amber-950/20 transition-colors ${i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}`}
                  >
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt={c.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0 opacity-70" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-700 dark:text-amber-400 text-xs font-semibold flex-shrink-0">{c.name?.charAt(0)}</div>
                    )}
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Permitterte */}
          {permitterte.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                Permitterte
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 px-2 py-0.5 rounded-md">
                  {permitterte.length}
                </span>
              </h2>
              <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                {permitterte.map((c, i) => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/consultant/${c.id}`)}
                    className={`flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-950/20 transition-colors ${i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}`}
                  >
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt={c.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0 opacity-70" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-400 text-xs font-semibold flex-shrink-0">{c.name?.charAt(0)}</div>
                    )}
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Consultants per client */}
          {consultantsPerClient.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Fordeling per kunde</h2>
              <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                {consultantsPerClient.map(({ client, count, projects: cProjects }, i) => {
                  const max = consultantsPerClient[0].count
                  const pct = Math.round((count / max) * 100)
                  return (
                    <div
                      key={client.id}
                      onClick={() => navigate(`/clients/${client.id}`)}
                      className={`px-5 py-3.5 cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors ${i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{client.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 dark:text-gray-600">{cProjects.length} prosjekt{cProjects.length !== 1 ? 'er' : ''}</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{count}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-900 dark:bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
