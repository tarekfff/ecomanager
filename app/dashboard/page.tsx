'use client'
import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import { Plus, DollarSign, Undo2, X, Trash2, Search, Send } from 'lucide-react'
import { useBoutique } from '@/contexts/BoutiqueContext'

// ── Types ──────────────────────────────────────────────────────────────────

interface StatusCounts {
  en_confirmation: number; en_preparation: number; en_dispatch: number
  en_livraison:    number; livree:          number; en_retour:   number
  encaissee:       number; retournee:       number; annulee:     number
}

interface ChartRow {
  day:         string
  Créées:      number; Confirmées:  number; Annulées:    number
  Livrées:     number; 'En retour': number; Encaissées:  number; Retournées: number
}

// ── Constants ──────────────────────────────────────────────────────────────

const ZERO_COUNTS: StatusCounts = {
  en_confirmation: 0, en_preparation: 0, en_dispatch: 0,
  en_livraison: 0, livree: 0, en_retour: 0,
  encaissee: 0, retournee: 0, annulee: 0,
}

const DONUT_DEFS = [
  { key: 'en_confirmation' as const, name: 'En confirmation', color: '#4472C4' },
  { key: 'en_preparation'  as const, name: 'En préparation',  color: '#9966CC' },
  { key: 'en_dispatch'     as const, name: 'En dispatch',     color: '#E6B800' },
  { key: 'en_livraison'    as const, name: 'En livraison',    color: '#888888' },
  { key: 'livree'          as const, name: 'Livrées',         color: '#00B0A0' },
  { key: 'en_retour'       as const, name: 'En retour',       color: '#E84B6A' },
]

// ── Sub-components ─────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: {
  active?: boolean; payload?: { name: string; value: number }[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      {payload.map(p => <div key={p.name}>{p.name}: <b>{p.value}</b></div>)}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div style={{
      flex: 1, borderRadius: 4,
      background: 'linear-gradient(90deg, #ececec 25%, #f5f5f5 50%, #ececec 75%)',
      backgroundSize: '400% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

function MiniBar({ title, dataKey, color, data, loading }: {
  title: string; dataKey: string | string[]; color: string | string[]
  data: ChartRow[]; loading: boolean
}) {
  const keys   = Array.isArray(dataKey) ? dataKey : [dataKey]
  const colors = Array.isArray(color)   ? color   : [color]
  return (
    <div className="mini-chart">
      <div className="mini-chart-title">{title}</div>
      {loading ? <ChartSkeleton /> : (
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 2, right: 4, left: -28, bottom: 0 }} barSize={8}>
              <CartesianGrid strokeDasharray="2 2" stroke="#eee" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {keys.map((k, i) => <Bar key={k} dataKey={k} fill={colors[i]} radius={[2, 2, 0, 0]} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { boutiqueId } = useBoutique()

  const [statsLoading, setStatsLoading] = useState(false)
  const [chartData,    setChartData]    = useState<ChartRow[]>([])
  const [counts,       setCounts]       = useState<StatusCounts>(ZERO_COUNTS)

  useEffect(() => {
    if (!boutiqueId) return
    const token = localStorage.getItem('token')
    if (!token) return

    setStatsLoading(true)
    fetch(`/api/dashboard/stats?boutiqueId=${boutiqueId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.counts)    setCounts(data.counts)
        if (data.chartData) setChartData(data.chartData)
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [boutiqueId])

  const donutData = DONUT_DEFS.map(d => ({ name: d.name, value: counts[d.key], color: d.color }))

  const statusBarCounts: Record<string, number> = {
    'En confirmation': counts.en_confirmation,
    'En préparation':  counts.en_preparation,
    'En dispatch':     counts.en_dispatch,
    'En livraison':    counts.en_livraison,
    'Livrées':         counts.livree,
    'En retour':       counts.en_retour,
  }

  return (
    <>
      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <div className="statusbar">
        <button className="status-btn add">
          <Plus size={12} /> Ajouter <span className="status-new">new</span>
        </button>
        <div className="status-divider" />
        {Object.entries(statusBarCounts).map(([label, count]) => (
          <button key={label} className="status-btn">
            {label}
            {count > 0 && <span className="status-badge">{count}</span>}
          </button>
        ))}
        <div className="status-divider" />
        <button className="status-icon-btn" title="Encaisser" style={{ color: '#28a745' }}><DollarSign size={14} /></button>
        <button className="status-icon-btn" title="Retour"    style={{ color: '#ff9800' }}><Undo2 size={14} /></button>
        <button className="status-icon-btn" title="Annuler"   style={{ color: '#dc3545' }}><X size={14} /></button>
        <button className="status-icon-btn" title="Supprimer" style={{ color: '#888' }}><Trash2 size={14} /></button>
        <button className="sav-btn"><Send size={12} /> SAV</button>
        <div className="status-divider" />
        <button className="status-icon-btn" title="Rechercher"><Search size={14} style={{ color: '#666' }} /></button>
      </div>

      {/* ── Charts ──────────────────────────────────────────────────────── */}
      <main className="main-content">
        <div className="charts-grid">

          {/* COL 1 — Performance */}
          <div className="chart-col">
            <div className="chart-panel">
              <div className="chart-panel-header">Performance</div>
              <div className="chart-inner">
                <MiniBar title="Commandes créées"   dataKey="Créées"                   color="#4472C4"              data={chartData} loading={statsLoading} />
                <MiniBar title="Livrées / En retour" dataKey={['Livrées', 'En retour']} color={['#4472C4', '#F5A623']} data={chartData} loading={statsLoading} />
              </div>
            </div>
          </div>

          {/* COL 2 — Analyse */}
          <div className="chart-col">
            <div className="chart-panel">
              <div className="chart-panel-header light">Analyse</div>
              <div className="chart-inner">
                <MiniBar title="Confirmées / Annulées"   dataKey={['Confirmées', 'Annulées']}   color={['#4472C4', '#F5A623']} data={chartData} loading={statsLoading} />
                <MiniBar title="Encaissées / Retournées" dataKey={['Encaissées', 'Retournées']} color={['#4472C4', '#F5A623']} data={chartData} loading={statsLoading} />
              </div>
            </div>
          </div>

          {/* COL 3 — Anomalie (donut) */}
          <div className="chart-col">
            <div className="chart-panel">
              <div className="chart-panel-header light">Anomalie</div>
              <div className="donut-col">
                <div style={{ width: '100%', height: 220, flexShrink: 0 }}>
                  {statsLoading ? (
                    <div style={{
                      margin: '10px auto', width: 180, height: 180, borderRadius: '50%',
                      background: 'linear-gradient(90deg, #ececec 25%, #f5f5f5 50%, #ececec 75%)',
                      backgroundSize: '400% 100%', animation: 'shimmer 1.4s infinite',
                    }} />
                  ) : donutData.every(d => d.value === 0) ? (
                    <svg width="100%" height="100%" viewBox="0 0 200 200">
                      <circle cx={100} cy={100} r={85} fill="none" stroke="#ececec" strokeWidth={32} />
                      <text x={100} y={104} textAnchor="middle" fontSize={11} fill="#aaa" fontFamily="Inter, sans-serif">
                        Aucune commande
                      </text>
                    </svg>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                          {donutData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                        </Pie>
                        <Tooltip content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="custom-tooltip">{payload[0].name}: <b>{payload[0].value}</b></div>
                          ) : null
                        } />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="donut-legend">
                  {donutData.map(d => (
                    <div key={d.name} className="legend-item">
                      <div className="legend-dot" style={{ background: d.color }} />
                      {d.name}
                      {!statsLoading && <span style={{ color: '#999', fontSize: 10 }}>({d.value})</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </>
  )
}
