'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import {
  Globe, MessageSquare, Bell, BookOpen, User, LogOut,
  Plus, DollarSign, Undo2, X, Trash2, Search, Send,
} from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'

const days = ['19-Jun','20-Jun','21-Jun','22-Jun','23-Jun','24-Jun','25-Jun']
const chartData = days.map((day, i) => ({
  day,
  Créées:      [4,1,0,2,0,0,0][i],
  Confirmées:  [0,3,2,2,0,2,0][i],
  Annulées:    [0,2,2,2,0,0,0][i],
  Livrées:     [0,1,1,0,2,0,1][i],
  'En retour': [0,1,0,1,0,0,0][i],
  Encaissées:  [0,0,0,0,0,1,0][i],
  Retournées:  [0,0,0,0,0,0,0][i],
}))

const donutData = [
  { name: 'En confirmation', value: 7,  color: '#4472C4' },
  { name: 'En préparation',  value: 1,  color: '#9966CC' },
  { name: 'En dispatch',     value: 0,  color: '#E6B800' },
  { name: 'En livraison',    value: 3,  color: '#888888' },
  { name: 'Livrées',         value: 12, color: '#00B0A0' },
  { name: 'En retour',       value: 7,  color: '#E84B6A' },
]

const statusCounts: Record<string, number> = {
  'En confirmation': 7,
  'En préparation':  0,
  'En dispatch':     0,
  'En livraison':    3,
  'Livrées':         12,
  'En retour':       7,
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      {payload.map(p => (
        <div key={p.name}>{p.name}: <b>{p.value}</b></div>
      ))}
    </div>
  )
}

function MiniBar({ title, dataKey, color }: {
  title: string
  dataKey: string | string[]
  color: string | string[]
}) {
  const keys   = Array.isArray(dataKey) ? dataKey : [dataKey]
  const colors = Array.isArray(color)   ? color   : [color]
  return (
    <div className="mini-chart">
      <div className="mini-chart-title">{title}</div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 2, right: 4, left: -28, bottom: 0 }} barSize={8}>
          <CartesianGrid strokeDasharray="2 2" stroke="#eee" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={colors[i]} radius={[2,2,0,0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [activeItem, setActiveItem] = useState('Liste des clients')
  const [username, setUsername]     = useState('Admin')
  const [ready, setReady]           = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.replace('/login')
    } else {
      setReady(true)
    }
  }, [router])

  if (!ready) return null

  function handleLogout() {
    localStorage.removeItem('token')
    router.push('/login')
  }

  return (
    <div className="dash-wrap">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-logo">
          <span className="e-bracket" />
          COMANAGER
        </div>
        <div className="topbar-spacer" />
        <div className="topbar-actions">
          <span title="Langue"><Globe size={14} /></span>
          <span title="Feedback"><MessageSquare size={14} /> Feedback</span>
          <span title="Mises à jour"><Bell size={14} /> Mises à jour</span>
          <span title="Tutoriels"><BookOpen size={14} /> Tutoriels</span>
          <div className="user-chip" onClick={handleLogout} title="Se déconnecter">
            <User size={13} />
            <span>{username}</span>
            <LogOut size={11} style={{ opacity: 0.7 }} />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="statusbar">
        <button className="status-btn add">
          <Plus size={12} /> Ajouter <span className="status-new">new</span>
        </button>
        <div className="status-divider" />
        {Object.entries(statusCounts).map(([label, count]) => (
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

      <div className="dash-body">
        <Sidebar activeItem={activeItem} onItemClick={setActiveItem} />

        <main className="main-content">
          <div className="charts-grid">

            {/* COL 1 — Performance */}
            <div className="chart-col">
              <div className="chart-panel">
                <div className="chart-panel-header">Performance</div>
                <div className="chart-inner">
                  <MiniBar title="Commandes créés" dataKey="Créées" color="#4472C4" />
                  <MiniBar
                    title="Livrées / En retour"
                    dataKey={['Livrées', 'En retour']}
                    color={['#4472C4', '#F5A623']}
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
                  />
                  <MiniBar
                    title="Encaissées / Retournées"
                    dataKey={['Encaissées', 'Retournées']}
                    color={['#4472C4', '#F5A623']}
                  />
                </div>
              </div>
            </div>

            {/* COL 3 — Anomalie (donut) */}
            <div className="chart-col">
              <div className="chart-panel">
                <div className="chart-panel-header light">Anomalie</div>
                <div className="donut-col">
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
                  <div className="donut-legend">
                    {donutData.map(d => (
                      <div key={d.name} className="legend-item">
                        <div className="legend-dot" style={{ background: d.color }} />
                        {d.name}
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
