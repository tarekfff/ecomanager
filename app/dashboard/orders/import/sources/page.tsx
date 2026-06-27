'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw, Trash2, Wifi, WifiOff, AlertCircle,
  ArrowLeft, Plus, Loader2, CheckCircle, Clock, Zap,
} from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'
import { useBoutique } from '@/contexts/BoutiqueContext'

interface ImportSource {
  id:              string
  name:            string
  sheet_id:        string
  sheet_name:      string
  separator:       string
  is_active:       boolean
  last_synced_at:  string | null
  google_email:    string
  last_row:        number
  has_live_trigger: boolean
}

interface SyncStatus {
  loading:   boolean
  result:    { imported: number; skipped: number; failed: number } | null
  error:     string
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

function fmtDate(iso: string | null) {
  if (!iso) return 'Jamais'
  const d = new Date(iso)
  return d.toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })
}

export default function ImportSourcesPage() {
  const router       = useRouter()
  const { boutiqueId } = useBoutique()

  const [sources,  setSources]  = useState<ImportSource[]>([])
  const [loading,  setLoading]  = useState(false)
  const [syncing,  setSyncing]  = useState<Record<string, SyncStatus>>({})
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})

  const fetchSources = useCallback(() => {
    if (!boutiqueId) return
    setLoading(true)
    fetch(`/api/import-sources?boutique_id=${boutiqueId}`, { headers: authHeader() })
      .then(r => r.json())
      .then((d: ImportSource[]) => setSources(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [boutiqueId])

  useEffect(() => { if (boutiqueId) fetchSources() }, [boutiqueId, fetchSources])

  async function toggleActive(source: ImportSource) {
    await fetch(`/api/import-sources/${source.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body:    JSON.stringify({ is_active: !source.is_active }),
    })
    fetchSources()
  }

  async function syncNow(source: ImportSource) {
    setSyncing(p => ({ ...p, [source.id]: { loading: true, result: null, error: '' } }))
    try {
      const res  = await fetch(`/api/import-sources/${source.id}/sync`, {
        method: 'POST', headers: authHeader(),
      })
      const data = await res.json()
      if (!res.ok) {
        setSyncing(p => ({ ...p, [source.id]: { loading: false, result: null, error: data.error ?? 'Erreur' } }))
      } else {
        setSyncing(p => ({ ...p, [source.id]: { loading: false, result: data, error: '' } }))
        fetchSources()
      }
    } catch {
      setSyncing(p => ({ ...p, [source.id]: { loading: false, result: null, error: 'Erreur réseau' } }))
    }
  }

  async function deleteSource(id: string) {
    if (!confirm('Supprimer cette connexion ? Les commandes déjà importées ne seront pas supprimées.')) return
    setDeleting(p => ({ ...p, [id]: true }))
    await fetch(`/api/import-sources/${id}`, { method: 'DELETE', headers: authHeader() })
    setSyncing(p => { const n = { ...p }; delete n[id]; return n })
    fetchSources()
    setDeleting(p => ({ ...p, [id]: false }))
  }

  return (
    <>
      <PageHeader
        title="Sources connectées"
        subtitle="Connexions Google Sheets pour import automatique"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => router.back()}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 5, border: `1px solid ${colors.border}`,
                background: '#fff', color: colors.textMd, fontSize: 12.5,
                fontFamily: fonts.sans, cursor: 'pointer',
              }}
            >
              <ArrowLeft size={13} /> Retour
            </button>
            <button
              onClick={() => router.push('/dashboard/orders/import/google-sheet')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 5, border: 'none',
                background: colors.primary, color: '#fff', fontSize: 12.5, fontWeight: 600,
                fontFamily: fonts.sans, cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = colors.primaryDk}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = colors.primary}
            >
              <Plus size={13} /> Ajouter une source
            </button>
          </div>
        }
      />

      <div style={{
        flex: 1, overflowY: 'auto', padding: 24,
        fontFamily: fonts.sans, background: colors.bg,
      }}>
        {!boutiqueId && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#fff8e1', border: '1px solid #ffe082',
            borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#795548', marginBottom: 16,
          }}>
            <AlertCircle size={15} />
            Sélectionnez une boutique dans la barre de navigation.
          </div>
        )}

        {/* Info banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#EEF2FF', border: '1px solid #C7D2FE',
          borderRadius: 6, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#3730A3',
        }}>
          <Zap size={14} />
          Les nouvelles lignes ajoutées à Google Sheet apparaissent ici en quelques secondes via le déclencheur instantané. Le sync nocturne (2h) ne sert que de filet de sécurité.
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.textLt, fontSize: 13 }}>
            <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
            Chargement…
          </div>
        ) : sources.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 0',
            background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 8,
          }}>
            <RefreshCw size={32} color={colors.border} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14, color: colors.textMd, marginBottom: 6 }}>
              Aucune connexion Google Sheet
            </div>
            <div style={{ fontSize: 12, color: colors.textLt, marginBottom: 20 }}>
              Importez une feuille et sauvegardez la connexion pour activer le sync automatique.
            </div>
            <button
              onClick={() => router.push('/dashboard/orders/import/google-sheet')}
              style={{
                padding: '8px 18px', borderRadius: 6, border: 'none',
                background: colors.primary, color: '#fff', fontSize: 13, fontWeight: 600,
                fontFamily: fonts.sans, cursor: 'pointer',
              }}
            >
              + Connecter une feuille
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sources.map(source => {
              const status = syncing[source.id]
              return (
                <div
                  key={source.id}
                  style={{
                    background: '#fff', border: `1px solid ${colors.border}`,
                    borderRadius: 8, padding: '16px 20px',
                    opacity: source.is_active ? 1 : 0.65,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>

                    {/* Status dot */}
                    <div style={{ paddingTop: 3 }}>
                      {source.is_active
                        ? <Wifi size={16} color={colors.green} />
                        : <WifiOff size={16} color={colors.textLt} />
                      }
                    </div>

                    {/* Main info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>
                          {source.name}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 12,
                          background: source.is_active ? '#DCFCE7' : '#F3F4F6',
                          color: source.is_active ? '#166534' : colors.textLt,
                          textTransform: 'uppercase', letterSpacing: '0.5px',
                        }}>
                          {source.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, color: colors.textMd, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span>
                          Feuille : <strong style={{ fontFamily: 'monospace', fontSize: 11 }}>
                            {source.sheet_id.slice(0, 20)}…
                          </strong> / {source.sheet_name || 'Sheet1'}
                        </span>
                        <span>Compte : {source.google_email || '—'}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} />
                          Dernier sync : {fmtDate(source.last_synced_at)}
                        </span>
                        {source.last_row > 1 && (
                          <span style={{ color: colors.textLt }}>
                            {source.last_row - 1} ligne{source.last_row > 2 ? 's' : ''} traitée{source.last_row > 2 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Sync result feedback */}
                      {status?.result && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
                          fontSize: 12, color: '#166534',
                        }}>
                          <CheckCircle size={13} />
                          {status.result.imported} importée{status.result.imported !== 1 ? 's' : ''},
                          {' '}{status.result.skipped} ignorée{status.result.skipped !== 1 ? 's' : ''},
                          {' '}{status.result.failed} échouée{status.result.failed !== 1 ? 's' : ''}
                        </div>
                      )}
                      {status?.error && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
                          fontSize: 12, color: colors.red,
                        }}>
                          <AlertCircle size={12} />
                          {status.error}
                        </div>
                      )}
                      {/* ── Live trigger badge ── */}
                      <div style={{ marginTop: 8 }}>
                        {source.has_live_trigger ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 11, fontWeight: 600, color: '#7C3AED',
                            background: '#F5F3FF', border: '1px solid #DDD6FE',
                            borderRadius: 20, padding: '3px 8px',
                          }}>
                            <Zap size={10} fill="#7C3AED" />
                            Déclencheur instantané actif
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 11, color: colors.textLt,
                            background: '#F9FAFB', border: `1px solid ${colors.border}`,
                            borderRadius: 20, padding: '3px 8px',
                          }}>
                            <Zap size={10} />
                            Sync quotidien (fallback)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {/* Sync now */}
                      <button
                        onClick={() => syncNow(source)}
                        disabled={!!status?.loading}
                        title="Synchroniser maintenant"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '6px 12px', borderRadius: 5, fontSize: 12, fontFamily: fonts.sans,
                          border: `1px solid ${colors.border}`, background: '#fff',
                          color: colors.textMd, cursor: status?.loading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {status?.loading
                          ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                          : <RefreshCw size={12} />
                        }
                        {status?.loading ? 'Sync…' : 'Sync'}
                      </button>

                      {/* Toggle active */}
                      <button
                        onClick={() => toggleActive(source)}
                        title={source.is_active ? 'Désactiver' : 'Activer'}
                        style={{
                          padding: '6px 12px', borderRadius: 5, fontSize: 12, fontFamily: fonts.sans,
                          border: `1px solid ${colors.border}`, background: '#fff',
                          color: source.is_active ? colors.orange : colors.green,
                          cursor: 'pointer',
                        }}
                      >
                        {source.is_active ? 'Désactiver' : 'Activer'}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteSource(source.id)}
                        disabled={deleting[source.id]}
                        title="Supprimer"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 30, height: 30, borderRadius: 5,
                          border: `1px solid ${colors.border}`, background: '#fff',
                          color: colors.textLt, cursor: deleting[source.id] ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={e => {
                          ;(e.currentTarget as HTMLButtonElement).style.borderColor = colors.red
                          ;(e.currentTarget as HTMLButtonElement).style.color = colors.red
                        }}
                        onMouseLeave={e => {
                          ;(e.currentTarget as HTMLButtonElement).style.borderColor = colors.border
                          ;(e.currentTarget as HTMLButtonElement).style.color = colors.textLt
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </>
  )
}
