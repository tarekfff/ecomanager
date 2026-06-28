'use client'
import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Eye } from 'lucide-react'
import {
  PageHeader, Table, Modal, Button, Badge, Pagination,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

const LIMIT = 25

// ── Types ──────────────────────────────────────────────────────────────────

interface WebhookLog {
  id:              string
  webhook_id:      string
  order_id:        string | null
  order_ref:       string | null
  event:           string
  http_status:     number | null
  request_payload: unknown
  response_body:   unknown
  attempt:         number | null
  duration_ms:     number | null
  created_at:      string
}

interface WebhookMeta {
  id:    string
  name:  string
  event: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

function statusColor(status: number | null): 'green' | 'orange' | 'red' | 'gray' {
  if (status == null) return 'gray'
  if (status >= 200 && status < 300) return 'green'
  if (status >= 400 && status < 500) return 'orange'
  if (status >= 500) return 'red'
  return 'gray'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function prettyJson(value: unknown): string {
  if (value == null) return '—'
  try {
    const obj = typeof value === 'string' ? JSON.parse(value) : value
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(value)
  }
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function WebhookLogsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [logs,    setLogs]    = useState<WebhookLog[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [meta,    setMeta]    = useState<WebhookMeta | null>(null)

  const [detail, setDetail] = useState<WebhookLog | null>(null)

  const fetchLogs = useCallback(() => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    fetch(`/api/webhooks/${id}/logs?${qs}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => {
        setLogs(d.items ?? [])
        setTotal(d.total ?? 0)
        if (d.webhook) setMeta(d.webhook)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id, page])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: Column<WebhookLog>[] = [
    {
      key: 'created_at', label: 'Date', width: 150,
      render: row => <span style={{ color: colors.textMd, fontSize: 12 }}>{formatDate(row.created_at)}</span>,
    },
    {
      key: 'event', label: 'Événement', width: 200,
      render: row => <Badge color="purple">{row.event}</Badge>,
    },
    {
      key: 'order_ref', label: 'Commande', width: 130,
      render: row => row.order_ref
        ? <span style={{ fontWeight: 500, color: colors.text }}>{row.order_ref}</span>
        : <span style={{ color: colors.textLt }}>—</span>,
    },
    {
      key: 'http_status', label: 'HTTP', width: 90,
      render: row => (
        <Badge color={statusColor(row.http_status)}>
          {row.http_status ?? '—'}
        </Badge>
      ),
    },
    {
      key: 'attempt', label: 'Tentative', width: 90,
      render: row => <span style={{ color: colors.textMd }}>{row.attempt ?? '—'}</span>,
    },
    {
      key: 'duration_ms', label: 'Durée', width: 90,
      render: row => <span style={{ color: colors.textMd }}>{row.duration_ms != null ? `${row.duration_ms} ms` : '—'}</span>,
    },
    {
      key: 'actions', label: 'Actions', width: 130,
      render: row => (
        <button
          onClick={() => setDetail(row)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11.5, padding: '3px 8px', borderRadius: 3,
            border: `1px solid ${colors.border}`, background: '#fff',
            color: colors.textMd, cursor: 'pointer', fontFamily: fonts.sans,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
        >
          <Eye size={11} /> Voir payload
        </button>
      ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title={meta ? `Logs — ${meta.name}` : 'Logs du webhook'}
        subtitle={meta ? meta.event : 'Historique des envois'}
        actions={
          <Link href="/dashboard/webhooks" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="sm">
              <ArrowLeft size={13} /> Retour
            </Button>
          </Link>
        }
      />

      <div style={{
        flex: 1, overflow: 'auto', padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <Table<WebhookLog>
          columns={columns}
          data={logs}
          loading={loading}
          emptyText="Aucun log"
        />

        {total > LIMIT && (
          <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
        )}
      </div>

      {/* ── Detail modal ──────────────────────────────────────────────────── */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Détail du log"
        size="lg"
      >
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: fonts.sans }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12.5, color: colors.textMd }}>
              <span><strong style={{ color: colors.text }}>Date :</strong> {formatDate(detail.created_at)}</span>
              <span><strong style={{ color: colors.text }}>Événement :</strong> {detail.event}</span>
              {detail.order_ref && <span><strong style={{ color: colors.text }}>Commande :</strong> {detail.order_ref}</span>}
              <span><strong style={{ color: colors.text }}>HTTP :</strong> {detail.http_status ?? '—'}</span>
              <span><strong style={{ color: colors.text }}>Tentative :</strong> {detail.attempt ?? '—'}</span>
              <span><strong style={{ color: colors.text }}>Durée :</strong> {detail.duration_ms != null ? `${detail.duration_ms} ms` : '—'}</span>
            </div>

            <JsonBlock label="Request payload" value={detail.request_payload} />
            <JsonBlock label="Response body" value={detail.response_body} />
          </div>
        )}
      </Modal>
    </>
  )
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: colors.text }}>{label}</span>
      <pre style={{
        margin: 0, padding: 12, background: '#1e1e1e', color: '#d4d4d4',
        borderRadius: 4, fontSize: 12, fontFamily: 'monospace',
        overflowX: 'auto', maxHeight: 280, lineHeight: 1.5,
      }}>
        {prettyJson(value)}
      </pre>
    </div>
  )
}
