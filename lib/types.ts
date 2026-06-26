// ── Shared TypeScript types ───────────────────────────────────

export interface AuthUser {
  sub:      string   // user UUID
  tenantId: string   // tenant UUID
  email:    string
}

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  is_active: boolean
  trial_ends_at: string | null
  created_at: string
}

export interface Boutique {
  id: string
  tenant_id: string
  name: string
  prefix: string
  domain: string | null
  order_seq: number
  is_active: boolean
  created_at: string
}

export interface User {
  id: string
  tenant_id: string
  name: string
  email: string
  email_verified: boolean
  two_fa_enabled: boolean
  is_online: boolean
  last_seen_at: string | null
  is_active: boolean
  created_at: string
}

export interface Role {
  id: string
  tenant_id: string
  name: string
  permissions: Record<string, boolean>
  is_system: boolean
}

export interface Client {
  id: string
  tenant_id: string
  full_name: string
  phone: string
  phone2: string | null
  email: string | null
  wilaya_id: number | null
  commune_id: number | null
  address: string | null
  orders_delivered: number
  orders_returned: number
  orders_cancelled: number
  created_at: string
}

export interface Product {
  id: string
  tenant_id: string
  brand_id: string | null
  name: string
  sku: string
  barcode: string | null
  price: number
  compare_price: number | null
  out_of_stock_behavior: 'allow' | 'deny'
  stock_alert_enabled: boolean
  stock_alert_min: number
  stock_strategy: 'fifo' | 'lifo' | 'fefo' | 'random'
  external_link: string | null
  confirmer_notes: string | null
  weight_g: number | null
  length_cm: number | null
  width_cm: number | null
  height_cm: number | null
  is_active: boolean
  deleted_at: string | null
  created_at: string
}

export type TrackingStatus =
  | 'en_confirmation'
  | 'en_preparation'
  | 'en_dispatch'
  | 'en_livraison'
  | 'livree'
  | 'en_retour'
  | 'encaissee'
  | 'retournee'
  | 'annulee'

export interface Order {
  id: string
  boutique_id: string
  client_id: string | null
  assigned_confirmer_id: string | null
  assigned_carrier_id: string | null
  reference: string
  tracking_status: TrackingStatus
  confirmation_status: string | null
  delivery_status: string | null
  subtotal: number
  delivery_fee: number
  carrier_fee: number
  discount: number
  total: number
  delivery_method: string | null
  wilaya_id: number | null
  commune_id: number | null
  address: string | null
  phone: string
  phone2: string | null
  referrer: string | null
  remark: string | null
  source_type: 'manual' | 'google_sheet' | 'shopify' | 'furulue' | 'api'
  return_risk_score: number | null
  sync_enabled: boolean
  confirmed_at: string | null
  assigned_at: string | null
  dispatched_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  failed_at: string | null
  paid_at: string | null
  returned_at: string | null
  cancelled_at: string | null
  deleted_at: string | null
  created_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  variant_id: string | null
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  unit_cost: number
  line_total: number
}

export interface OrderCounts {
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

export interface Carrier {
  id: string
  tenant_id: string
  name: string
  phone: string | null
  platform: string | null
  wilaya_ids: number[]
  manages_stock: boolean
  is_active: boolean
}

export interface Wilaya {
  id: number
  name: string
  code: string
}

export interface Commune {
  id: number
  wilaya_id: number
  name: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// ── RBAC helper ──────────────────────────────────────────────
export function hasPermission(
  permissions: Record<string, boolean>,
  key: string
): boolean {
  return permissions['*'] === true || permissions[key] === true
}
