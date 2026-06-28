/**
 * Central permission maps — the single source of truth for "which permission
 * key gates which thing". Imported by both API routes (server) and the
 * client-side RouteGuard / Sidebar. Pure data + pure functions only — no
 * server-only imports so it is safe in the browser bundle.
 *
 * Permission keys mirror the roles editor (app/dashboard/moderateurs/roles).
 */

// ── tracking_status → the "orders.<section>" prefix used in permission keys ──
export const STATUS_SECTION: Record<string, string> = {
  en_confirmation: 'en_confirmation',
  en_preparation:  'en_preparation',
  en_dispatch:     'en_dispatch',
  en_livraison:    'en_livraison',
  livree:          'livrees',
  en_retour:       'en_retour',
  encaissee:       'archive_encaissees',
  retournee:       'archive_retournees',
  annulee:         'archive_annulees',
}

/** Orders LIST endpoint: status query param → required `*.view` permission. */
export function listViewPermForStatus(status: string): string {
  if (status === 'corbeille') return 'orders.corbeille.view'
  const section = STATUS_SECTION[status] ?? status
  return `orders.${section}.view`
}

/** Detail view of a single order → required `*.view` permission for its stage. */
export function detailViewPermForStatus(trackingStatus: string): string {
  const section = STATUS_SECTION[trackingStatus] ?? trackingStatus
  return `orders.${section}.view`
}

/** Full-edit (PUT) of an order → required `*.edit` permission for its stage. */
export function editPermForStatus(trackingStatus: string): string {
  const section = STATUS_SECTION[trackingStatus] ?? trackingStatus
  return `orders.${section}.edit`
}

/** Hard delete of an order → `*.delete` permission for its current stage. */
export function deletePermForStatus(trackingStatus: string): string {
  const section = STATUS_SECTION[trackingStatus] ?? trackingStatus
  return `orders.${section}.delete`
}

/**
 * PATCH single-order action → required permission key.
 * Some actions are fixed to a pipeline stage; others depend on the order's
 * current tracking_status (cancel / go_back / change_carrier / sync / fee).
 * Returns null when the action is unknown (caller should 400, not 403).
 */
export function actionPerm(action: string, currentStatus: string): string | null {
  const section = STATUS_SECTION[currentStatus] ?? currentStatus
  switch (action) {
    // ── fixed-stage actions ──────────────────────────────────────────────
    case 'confirm':                 return 'orders.en_confirmation.confirm'
    case 'assign_confirmer':        return 'orders.en_confirmation.assign_confirmer'
    case 'set_confirmation_status': return 'orders.en_confirmation.confirm'
    case 'dispatch':                return 'orders.en_preparation.dispatch'
    case 'ship':                    return 'orders.en_dispatch.ship'
    case 'deliver':                 return 'orders.en_livraison.validate_delivery'
    case 'request_return':          return 'orders.en_livraison.request_return'
    case 'set_delivery_status':     return 'orders.en_livraison.track'
    case 'validate_return':         return 'orders.en_retour.validate_return'
    case 'restore':                 return 'orders.archive_annulees.restore'
    case 'undo_delete':             return 'orders.corbeille.undo_delete'
    case 'go_back_to_confirmation': return 'orders.en_preparation.go_back'
    case 'go_back_to_preparation':  return 'orders.en_dispatch.go_back'
    // ── stage-dependent actions ──────────────────────────────────────────
    case 'cancel':                  return `orders.${section}.cancel`
    case 'assign_carrier':          return `orders.${section}.change_carrier`
    case 'toggle_sync':             return `orders.${section}.disable_sync`
    case 'set_carrier_fee':         return `orders.${section}.edit_carrier_fee`
    case 'go_back_to_livraison':    return `orders.${section}.go_back`
    default:                        return null
  }
}

/**
 * BULK action → required permission key. Bulk also implies the section's
 * `bulk_action` flag, but we gate on the concrete action permission here so a
 * user can never bulk-do something they can't do singly.
 * `currentStatus` is the common status of the selected orders (best-effort).
 */
export function bulkActionPerm(action: string, currentStatus: string): string | null {
  const section = STATUS_SECTION[currentStatus] ?? currentStatus
  switch (action) {
    case 'confirm':                 return 'orders.en_confirmation.confirm'
    case 'assign':                  return 'orders.en_confirmation.assign_confirmer'
    case 'set_confirmation_status': return 'orders.en_confirmation.confirm'
    case 'dispatch':                return 'orders.en_preparation.dispatch'
    case 'ship':                    return 'orders.en_dispatch.ship'
    case 'deliver':                 return 'orders.en_livraison.validate_delivery'
    case 'request_return':          return 'orders.en_livraison.request_return'
    case 'validate_return':         return 'orders.en_retour.validate_return'
    case 'prepare_encaissement':    return 'orders.livrees.prepare_bon'
    case 'prepare_retour':          return 'orders.en_retour.prepare_bon'
    case 'restore':                 return 'orders.archive_annulees.restore'
    case 'undo_delete':             return 'orders.corbeille.undo_delete'
    case 'hard_delete':             return 'orders.archive_annulees.delete'
    case 'delete':                  return `orders.${section}.cancel`
    case 'cancel':                  return `orders.${section}.cancel`
    case 'assign_carrier':          return `orders.${section}.change_carrier`
    case 'disable_sync':            return `orders.${section}.disable_sync`
    case 'set_carrier_fee':         return `orders.${section}.edit_carrier_fee`
    case 'go_back_to_livraison':    return `orders.${section}.go_back`
    default:                        return null
  }
}

/** Pickups LIST: status param → required pickups `*.view` permission. */
export function pickupViewPermForStatus(status: string): string {
  const map: Record<string, string> = {
    en_collecte: 'orders.pickups_en_collecte.view',
    collecte:    'orders.pickups_collecte.view',
    recu:        'orders.pickups_recus.view',
    traite:      'orders.pickups_traites.view',
    annule:      'orders.pickups_annules.view',
  }
  return map[status] ?? 'orders.pickups_en_collecte.view'
}

/** Receipts (bons) LIST: type → required bon `*.view` permission. */
export function receiptViewPermForType(type: string): string {
  return type === 'retour'
    ? 'orders.bon_retour.view'
    : 'orders.bon_encaissement.view'
}

// pickup status → the "orders.pickups_<section>" prefix
export const PICKUP_STATUS_SECTION: Record<string, string> = {
  en_collecte: 'pickups_en_collecte',
  collecte:    'pickups_collecte',
  recu:        'pickups_recus',
  traite:      'pickups_traites',
  annule:      'pickups_annules',
}

/** Pickup PATCH action → required permission, based on the pickup's status. */
export function pickupActionPerm(action: string, currentStatus: string): string | null {
  const section = PICKUP_STATUS_SECTION[currentStatus] ?? 'pickups_en_collecte'
  switch (action) {
    case 'validate_collect':    return 'orders.pickups_en_collecte.validate_collect'
    case 'validate_reception':  return 'orders.pickups_collecte.validate_reception'
    case 'validate_processing': return 'orders.pickups_recus.validate_processing'
    case 'cancel':              return `orders.${section}.cancel`
    case 'go_back':             return `orders.${section}.go_back`
    case 'toggle_sync':         return `orders.${section}.disable_sync`
    default:                    return null
  }
}

/** Receipt (bon) confirm action → required permission, based on receipt type. */
export function receiptActionPerm(action: string, type: string): string | null {
  const section = type === 'retour' ? 'bon_retour' : 'bon_encaissement'
  switch (action) {
    case 'confirm': return `orders.${section}.confirm`
    case 'go_back': return `orders.${section}.go_back`
    default:        return null
  }
}

// ── Page route → required permission ────────────────────────────────────────
// Used by the client RouteGuard. Longest matching prefix wins. A value may be a
// single key (exact) or an array (user needs ANY). Bare prefixes like 'orders'
// or 'config' match any sub-key via canAny().
export interface RoutePerm { prefix: string; perm: string | string[] }

export const ROUTE_PERMS: RoutePerm[] = [
  // Orders pipeline
  { prefix: '/dashboard/orders/en-confirmation',     perm: 'orders.en_confirmation.view' },
  { prefix: '/dashboard/orders/en-preparation',      perm: 'orders.en_preparation.view' },
  { prefix: '/dashboard/orders/en-dispatch',         perm: 'orders.en_dispatch.view' },
  { prefix: '/dashboard/orders/en-livraison',        perm: 'orders.en_livraison.view' },
  { prefix: '/dashboard/orders/livrees',             perm: 'orders.livrees.view' },
  { prefix: '/dashboard/orders/en-retour',           perm: 'orders.en_retour.view' },
  { prefix: '/dashboard/orders/archives/encaissees', perm: 'orders.archive_encaissees.view' },
  { prefix: '/dashboard/orders/archives/retournees', perm: 'orders.archive_retournees.view' },
  { prefix: '/dashboard/orders/archives/annulees',   perm: 'orders.archive_annulees.view' },
  { prefix: '/dashboard/orders/corbeille',           perm: 'orders.corbeille.view' },
  { prefix: '/dashboard/orders/bons/encaissement',   perm: 'orders.bon_encaissement.view' },
  { prefix: '/dashboard/orders/bons/retour',         perm: 'orders.bon_retour.view' },
  { prefix: '/dashboard/orders/pickups/en-collecte', perm: 'orders.pickups_en_collecte.view' },
  { prefix: '/dashboard/orders/pickups/collecte',    perm: 'orders.pickups_collecte.view' },
  { prefix: '/dashboard/orders/pickups/recus',       perm: 'orders.pickups_recus.view' },
  { prefix: '/dashboard/orders/pickups/traites',     perm: 'orders.pickups_traites.view' },
  { prefix: '/dashboard/orders/pickups/annules',     perm: 'orders.pickups_annules.view' },
  { prefix: '/dashboard/orders/import',              perm: 'config.sources' },
  // bare fallback — covers /orders/new and /orders/<id>/edit
  { prefix: '/dashboard/orders',                     perm: 'orders' },

  // Catalog
  { prefix: '/dashboard/products',                   perm: 'products.view' },
  { prefix: '/dashboard/marques',                    perm: 'brands' },
  { prefix: '/dashboard/fournisseurs',               perm: 'suppliers' },

  // Stock
  { prefix: '/dashboard/stock/ajustement',           perm: 'stock.adjust' },
  { prefix: '/dashboard/stock/mouvements',           perm: 'stock.movements' },
  { prefix: '/dashboard/stock/lots',                 perm: 'stock.batches' },
  { prefix: '/dashboard/stock/alertes',              perm: 'stock.alerts' },
  { prefix: '/dashboard/stock/inventaire',           perm: 'stock.inventory' },
  { prefix: '/dashboard/stock/mega-inventaire',      perm: 'stock.mega_inventory' },
  { prefix: '/dashboard/stock',                      perm: 'stock' },

  // Delivery (carriers / livreurs)
  { prefix: '/dashboard/livraison',                  perm: 'config.delivery' },

  // Analysis
  { prefix: '/dashboard/stats/boutique',             perm: 'stats.boutique' },
  { prefix: '/dashboard/stats/produit',              perm: 'stats.product' },
  { prefix: '/dashboard/stats/confirmateur',         perm: 'stats.confirmation' },
  { prefix: '/dashboard/stats/livreur',              perm: 'stats.delivery' },
  { prefix: '/dashboard/stats/wilaya',               perm: 'stats.boutique' },
  { prefix: '/dashboard/stats',                      perm: 'stats' },
  { prefix: '/dashboard/comptabilite/bilan',         perm: 'accounting.bilan' },
  { prefix: '/dashboard/comptabilite/rentabilite',   perm: 'accounting.product_profitability' },
  { prefix: '/dashboard/comptabilite/depenses',      perm: 'accounting.enter_expenses' },
  { prefix: '/dashboard/comptabilite/publicite',     perm: 'accounting.enter_expenses' },
  { prefix: '/dashboard/comptabilite',               perm: 'accounting' },
  { prefix: '/dashboard/donnees/export',             perm: 'data.export' },
  { prefix: '/dashboard/donnees/rapports',           perm: 'data.reports' },
  { prefix: '/dashboard/donnees',                    perm: 'data' },

  // System
  { prefix: '/dashboard/webhooks',                   perm: 'webhooks' },
  { prefix: '/dashboard/moderateurs/utilisateurs',   perm: 'config.users' },
  { prefix: '/dashboard/moderateurs/roles',          perm: 'config.roles' },
  { prefix: '/dashboard/boutiques',                  perm: 'config.boutiques' },
  { prefix: '/dashboard/config/sources',             perm: 'config.sources' },
  { prefix: '/dashboard/config/livraison',           perm: 'config.delivery' },
  { prefix: '/dashboard/config/clients',             perm: 'config.clients' },
  { prefix: '/dashboard/config/abonnement',          perm: 'config.subscription' },
  { prefix: '/dashboard/config/avance',              perm: 'config.advanced' },
  { prefix: '/dashboard/config/statuts',             perm: ['config.statuses', 'config.delivery'] },
  { prefix: '/dashboard/config',                     perm: 'config' },

  // Clients
  { prefix: '/dashboard/clients',                    perm: 'config.clients' },
]

/** Resolve the required permission for a dashboard path (longest prefix wins).
 *  Returns null for pages with no guard (e.g. the dashboard home). */
export function requiredPermForPath(pathname: string): string | string[] | null {
  let best: RoutePerm | null = null
  for (const r of ROUTE_PERMS) {
    if (pathname === r.prefix || pathname.startsWith(r.prefix + '/')) {
      if (!best || r.prefix.length > best.prefix.length) best = r
    }
  }
  return best ? best.perm : null
}
