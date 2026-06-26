'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import {
  Globe, MessageSquare, Bell, BookOpen, User, LogOut,
  Plus, DollarSign, Undo2, X, Trash2, Search, Send, ChevronDown,
} from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import { useBoutique } from '@/contexts/BoutiqueContext'

// ── Types ──────────────────────────────────────────────────────────────────

interface BoutiqueOption { id: string; name: string; prefix: string }

interface StatusCounts {
  en_confirmation: number
  en_preparation:  number
  en_dispatch:     number
  en_livraison:    number
  livree:          number
  en_retour:       number
  encaissee:       number
  retournee:       number
  annulee:         number
}

interface ChartRow {
  day:         string
  Créées:      number
  Confirmées:  number
  Annulées:    number
  Livrées:     number
  'En retour': number
  Encaissées:  number
  Retournées:  number
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
  active?: boolean
  payload?: { name: string; value: number }[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      {payload.map(p => (
        <div key={p.name}>{p.name}: <b>{p.value}</b></div>
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div style={{
      flex: 1, borderRadius: 4,
      background: 'linear-gradient(90deg, #ececec 25%, #f5f5f5 50%, #ececec 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

function MiniBar({ title, dataKey, color, data, loading }: {
  title:   string
  dataKey: string | string[]
  color:   string | string[]
  data:    ChartRow[]
  loading: boolean
}) {
  const keys   = Array.isArray(dataKey) ? dataKey : [dataKey]
  const colors = Array.isArray(color)   ? color   : [color]

  return (
    <div className="mini-chart">
      <div className="mini-chart-title">{title}</div>
      {loading ? (
        <ChartSkeleton />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 2, right: 4, left: -28, bottom: 0 }} barSize={8}>
            <CartesianGrid strokeDasharray="2 2" stroke="#eee" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {keys.map((k, i) => (
              <Bar key={k} dataKey={k} fill={colors[i]} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const { boutiqueId, boutiqueName, setBoutique } = useBoutique()

  const [activeItem,       setActiveItem]      = useState('Liste des clients')
  const [ready,            setReady]           = useState(false)
  const [boutiques,        setBoutiques]       = useState<BoutiqueOption[]>([])
  const [showBoutiqueMenu, setShowBoutiqueMenu] = useState(false)
  const [statsLoading,     setStatsLoading]    = useState(false)
  const [chartData,        setChartData]       = useState<ChartRow[]>([])
  const [counts,           setCounts]          = useState<StatusCounts>(ZERO_COUNTS)

  const boutiqueMenuRef = useRef<HTMLDivElement>(null)

  // ── Auth + boutique list ──────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.replace('/login'); return }
    setReady(true)

    fetch('/api/boutiques', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: BoutiqueOption[]) => {
        if (!Array.isArray(data)) return
        setBoutiques(data)
        if (data.length > 0 && !localStorage.getItem('boutiqueId')) {
          setBoutique(data[0].id, data[0].name)
        }
      })
      .catch(() => {})
  }, [router, setBoutique])

  // ── Stats — refetch whenever boutiqueId changes ───────────────────────
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

  // ── Close boutique dropdown on outside click ──────────────────────────
  useEffect(() => {
    if (!showBoutiqueMenu) return
    function handleOutside(e: MouseEvent) {
      if (boutiqueMenuRef.current && !boutiqueMenuRef.current.contains(e.target as Node)) {
        setShowBoutiqueMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showBoutiqueMenu])

  if (!ready) return null

  // ── Derived display data ──────────────────────────────────────────────

  const donutData = DONUT_DEFS.map(d => ({ name: d.name, value: counts[d.key], color: d.color }))

  const statusBarCounts: Record<string, number> = {
    'En confirmation': counts.en_confirmation,
    'En préparation':  counts.en_preparation,
    'En dispatch':     counts.en_dispatch,
    'En livraison':    counts.en_livraison,
    'Livrées':         counts.livree,
    'En retour':       counts.en_retour,
  }

  const displayName = boutiqueName || (boutiques[0]?.name ?? '…')

  function handleLogout() {
    localStorage.removeItem('token')
    router.push('/login')
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="dash-wrap">

      {/* ── Topbar ────────────────────────────────────────────────────── */}
      <div className="topbar">
        <div className="topbar-logo">
          <span className="e-bracket" />
          COMANAGER
        </div>

        {/* Boutique selector */}
        <div ref={boutiqueMenuRef} style={{ position: 'relative', marginLeft: 12 }}>
          <button
            onClick={() => setShowBoutiqueMenu(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.15)', border: 'none',
              borderRadius: 4, padding: '4px 10px', fontSize: 12,
              color: '#fff', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
            }}
          >
            {displayName}
            <ChevronDown size={12} />
          </button>

          {showBoutiqueMenu && boutiques.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4,
              background: '#fff', borderRadius: 4,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              zIndex: 200, minWidth: 180, overflow: 'hidden',
            }}>
              {boutiques.map(b => (
                <button
                  key={b.id}
                  onClick={() => { setBoutique(b.id, b.name); setShowBoutiqueMenu(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 14px', fontSize: 12.5,
                    fontFamily: "'Inter', sans-serif", border: 'none',
                    background: b.id === boutiqueId ? '#F5E0EF' : '#fff',
                    color:      b.id === boutiqueId ? '#BF4C98' : '#2D2D2D',
                    fontWeight: b.id === boutiqueId ? 600 : 400,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => {
                    if (b.id !== boutiqueId)
                      (e.currentTarget as HTMLButtonElement).style.background = '#fafafa'
                  }}
                  onMouseLeave={e => {
                    if (b.id !== boutiqueId)
                      (e.currentTarget as HTMLButtonElement).style.background = '#fff'
                  }}
                >
                  {b.name}
                  {b.prefix && (
                    <span style={{ color: '#999', fontSize: 11, marginLeft: 6 }}>
                      [{b.prefix}]
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="topbar-spacer" />
        <div className="topbar-actions">
          <span title="Langue"><Globe size={14} /></span>
          <span title="Feedback"><MessageSquare size={14} /> Feedback</span>
          <span title="Mises à jour"><Bell size={14} /> Mises à jour</span>
          <span title="Tutoriels"><BookOpen size={14} /> Tutoriels</span>
          <div className="user-chip" onClick={handleLogout} title="Se déconnecter">
            <User size={13} />
            <span>Admin</span>
            <LogOut size={11} style={{ opacity: 0.7 }} />
          </div>
        </div>
      </div>

      {/* ── Status bar ────────────────────────────────────────────────── */}
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
        <button className="status-icon-btn" title="Encaisser" style={{ color: '#28a745' }}>
          <DollarSign size={14} />
        </button>
        <button className="status-icon-btn" title="Retour" style={{ color: '#ff9800' }}>
          <Undo2 size={14} />
        </button>
        <button className="status-icon-btn" title="Annuler" style={{ color: '#dc3545' }}>
          <X size={14} />
        </button>
        <button className="status-icon-btn" title="Supprimer" style={{ color: '#888' }}>
          <Trash2 size={14} />
        </button>
        <button className="sav-btn">
          <Send size={12} /> SAV
        </button>
        <div className="status-divider" />
        <button className="status-icon-btn" title="Rechercher">
          <Search size={14} style={{ color: '#666' }} />
        </button>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="dash-body">
        <Sidebar activeItem={activeItem} onItemClick={setActiveItem} />

        <main className="main-content">
          <div className="charts-grid">

            {/* COL 1 — Performance */}
            <div className="chart-col">
              <div className="chart-panel">
                <div className="chart-panel-header">Performance</div>
                <div className="chart-inner">
                  <MiniBar
                    title="Commandes créées"
                    dataKey="Créées"
                    color="#4472C4"
                    data={chartData}
                    loading={statsLoading}
                  />
                  <MiniBar
                    title="Livrées / En retour"
                    dataKey={['Livrées', 'En retour']}
                    color={['#4472C4', '#F5A623']}
                    data={chartData}
                    loading={statsLoading}
                  />
                </div>
              </div>
            </div>

            {/* COL 2 — Analyse */}
            <div className="chart-col">
              <div className="chart-panel">
                <div className="chart-panel-header light">Analyse</div>
                <div className="chart-inner">
                  <MiniBar
                    title="Confirmées / Annulées"
                    dataKey={['Confirmées', 'Annulées']}
                    color={['#4472C4', '#F5A623']}
                    data={chartData}
                    loading={statsLoading}
                  />
                  <MiniBar
                    title="Encaissées / Retournées"
                    dataKey={['Encaissées', 'Retournées']}
                    color={['#4472C4', '#F5A623']}
                    data={chartData}
                    loading={statsLoading}
                  />
                </div>
              </div>
            </div>

            {/* COL 3 — Anomalie (donut) */}
            <div className="chart-col">
              <div className="chart-panel">
                <div className="chart-panel-header light">Anomalie</div>
                <div className="donut-col">
                  {statsLoading ? (
                    <div style={{
                      width: 200, height: 200, borderRadius: '50%',
                      background: 'linear-gradient(90deg, #ececec 25%, #f5f5f5 50%, #ececec 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.4s infinite',
                    }} />
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%" cy="50%"
                          innerRadius={60} outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {donutData.map(entry => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="custom-tooltip">
                              {payload[0].name}: <b>{payload[0].value}</b>
                            </div>
                          ) : null
                        } />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  <div className="donut-legend">
                    {donutData.map(d => (
                      <div key={d.name} className="legend-item">
                        <div className="legend-dot" style={{ background: d.color }} />
                        {d.name}
                        {!statsLoading && d.value > 0 && (
                          <span style={{ color: '#999', fontSize: 10 }}>({d.value})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
