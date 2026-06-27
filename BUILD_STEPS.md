# ECOMANAGER — Build Steps (Copy-paste prompts)

> Paste each prompt **one at a time** in order. Wait for it to finish before moving to the next.
> The stack is already configured: Next.js 15 App Router, Supabase (via `db` from `lib/db.ts`),
> JWT auth (`requireAuth` / `signToken` from `lib/auth.ts`), Tailwind v4, Lucide icons,
> CSS classes in `globals.css`, design tokens in `lib/tokens.ts`.
> All UI must follow the design system: CSS classes from globals.css + inline styles using `colors`/`fonts` from `lib/tokens.ts`.

---

## ✅ Already done

- Login page + JWT auth (`/api/auth/login`, `/api/auth/me`)
- Dashboard layout: Topbar, Sidebar with dropdowns, StatusBar
- `lib/db.ts`, `lib/auth.ts`, `lib/types.ts`, `lib/tokens.ts`
- Supabase connection, seed user created
- Sidebar nav from PDF plan (all 14 sections with sub-items)

---

## Step 1 — Shared UI components

```
Build shared reusable UI components in `components/ui/` for use across all pages.
Use CSS classes from globals.css and design tokens from lib/tokens.ts. All inline styles use colors/fonts from lib/tokens.ts.

Create these files:

1. `components/ui/PageHeader.tsx` — props: title (string), subtitle? (string), actions? (ReactNode)
   Style: white bg, border-bottom border, padding 12px 16px, title font-size 15px font-weight 600, subtitle font-size 12px color textMd

2. `components/ui/Table.tsx` — generic table component
   Props: columns (Array<{ key: string, label: string, width?: number, render?: (row) => ReactNode }>), data (any[]), loading? (boolean), emptyText? (string)
   Style: full width, white bg, border border-border, border-radius 4px. Header: bg #f5f5f5, font-size 12px, font-weight 600, color textMd, padding 8px 12px, text-align left. Rows: font-size 12.5px, padding 8px 12px, border-bottom border-border, hover bg #FAFAFA. Loading: show 5 skeleton rows. Empty: centered text.

3. `components/ui/Pagination.tsx` — props: page (number), total (number), limit (number), onChange (fn)
   Show "Affichage X-Y sur Z résultats" on left. Buttons: Précédent / Suivant + page numbers. Active page: bg primary color white. Style matches design system.

4. `components/ui/Modal.tsx` — props: open (boolean), onClose (fn), title (string), children, size? ('sm'|'md'|'lg')
   Overlay: rgba(0,0,0,0.4). Card: white, border-radius 6px, max-width sm=400 md=600 lg=900. Header: padding 14px 16px, title font-size 14px font-weight 600, X close button top-right. Body: padding 16px.

5. `components/ui/Button.tsx` — props: variant ('primary'|'secondary'|'danger'|'ghost'), size? ('sm'|'md'), children, onClick?, disabled?, type?, loading?
   primary: bg primary text white. secondary: bg white border border-border. danger: bg #dc3545 text white. ghost: transparent. sm: padding 5px 10px font-size 12px. md: padding 7px 14px font-size 13px.

6. `components/ui/Input.tsx` — props: label? (string), value, onChange, type?, placeholder?, error? (string), icon? (ReactNode), required?
   Style: label font-size 12.5px color textMd mb 4px. Input: border border-border border-radius 4px padding 7px 10px font-size 13px width 100%. Focus: border-color primary. Error: border-color #dc3545 + error message below in red font-size 11px.

7. `components/ui/Select.tsx` — props: label? (string), value, onChange, options (Array<{value:string, label:string}>), placeholder?, error?
   Same style as Input but rendered as <select>.

8. `components/ui/Badge.tsx` — props: color ('green'|'red'|'orange'|'blue'|'purple'|'gray'), children
   Pill shape, padding 2px 8px, border-radius 10px, font-size 11px, font-weight 600. Colors map to soft bg + dark text.

9. `components/ui/SearchInput.tsx` — props: value, onChange, placeholder?
   Input with Search icon (lucide) on left. border border-border, border-radius 4px, padding 6px 10px 6px 32px.

10. `components/ui/ConfirmDialog.tsx` — props: open, onClose, onConfirm, title, message, confirmLabel?, danger?
    Uses Modal sm. Shows title + message. Two buttons: Annuler (secondary) + confirmLabel (primary or danger).

Export all from `components/ui/index.ts`.
```

---

## Step 2 — Boutique selector (Topbar)

```
Update the Topbar in `app/dashboard/page.tsx` to show a boutique selector dropdown next to the logo.

API: Create `app/api/boutiques/route.ts` — GET, requireAuth, returns boutiques the user has access to via user_boutiques join, filtered by tenant_id from auth token. Returns array of { id, name, prefix }.

Topbar UI: After the COMANAGER logo, add a boutique dropdown button showing the selected boutique name with a ChevronDown icon. On click, show a small dropdown list of boutiques (white card, shadow, z-index 200). Clicking a boutique stores its id in localStorage as 'boutiqueId' and updates state. Style: button bg rgba(255,255,255,0.15) color white border-radius 4px padding 4px 10px font-size 12px.

Store selected boutique id in localStorage('boutiqueId') and selected boutique name in state. Pass boutiqueId down via a React context (create `contexts/BoutiqueContext.tsx` — export BoutiqueProvider and useBoutique hook returning { boutiqueId, boutiqueName, setBoutique }).

Wrap the dashboard layout in BoutiqueProvider. Fetch boutiques from /api/boutiques on mount using the JWT token from localStorage.
```

---

## Step 3 — Dashboard home page (real data)

```
Replace the static chart data in `app/dashboard/page.tsx` with real data from the database.

Create API route `app/api/dashboard/stats/route.ts` — GET, requireAuth:
- Reads boutiqueId from query param ?boutiqueId=
- Queries orders table: COUNT grouped by tracking_status where boutique_id = boutiqueId AND deleted_at IS NULL
- Returns { counts: { en_confirmation, en_preparation, en_dispatch, en_livraison, livree, en_retour, encaissee, retournee, annulee } }
- Also returns chart data: last 7 days order counts grouped by date and tracking_status (created_at::date)

In `app/dashboard/page.tsx`:
- On mount (after boutiqueId is set), fetch from /api/dashboard/stats?boutiqueId=X with Authorization header
- Update statusCounts in the StatusBar with real counts from API
- Update chartData and donutData with real values
- Show loading skeleton while fetching (replace charts with gray placeholder divs)

Keep the same 3-panel chart layout (Performance, Analyse, Anomalie).
```

---

## Step 4 — Clients list page

```
Create the clients list page at `app/dashboard/clients/page.tsx`.

API: `app/api/clients/route.ts` — GET + POST
GET: requireAuth, query params: ?page=1&limit=25&search=&wilaya_id=
  SELECT c.*, w.name as wilaya_name FROM clients c LEFT JOIN wilayas w ON w.id = c.wilaya_id
  WHERE c.tenant_id = $1 AND ($2 = '' OR c.full_name ILIKE '%'||$2||'%' OR c.phone ILIKE '%'||$2||'%')
  ORDER BY c.created_at DESC LIMIT $3 OFFSET $4
  Also return total count for pagination.
POST: requireAuth, create client, body: { full_name, phone, phone2, email, wilaya_id, commune_id, address }
  INSERT INTO clients (id, tenant_id, full_name, phone, phone2, email, wilaya_id, commune_id, address)

Page UI (client component):
- PageHeader: title "Clients", subtitle "Gestion de la base clients", actions: Button primary "Ajouter un client" (opens add modal)
- SearchInput for search (debounced 300ms)
- Table columns: Nom complet, Téléphone, Wilaya, Livrés, Retournés, Annulés, Actions (Modifier / Supprimer)
  - "Livrés/Retournés/Annulés" as small colored badges (green/red/orange)
- Pagination below table
- Add/Edit Modal (ConfirmDialog for delete)

Use shared components from components/ui/. Fetch with JWT token from localStorage('token').
Clicking "Clients" sidebar item navigates here. Update sidebar activeItem when on this page.
```

---

## Step 5 — Client edit + delete

```
Extend the clients system from Step 4.

API: 
- `app/api/clients/[id]/route.ts` — GET, PUT, DELETE
  GET: SELECT * FROM clients WHERE id=$1 AND tenant_id=$2
  PUT: UPDATE clients SET full_name=$1, phone=$2, ... WHERE id=$X AND tenant_id=$Y
  DELETE: soft delete? clients table has no deleted_at — hard delete: DELETE FROM clients WHERE id=$1 AND tenant_id=$2

Also create `app/api/wilayas/route.ts` — GET (no auth needed):
  SELECT id, name, code FROM wilayas ORDER BY id

And `app/api/communes/route.ts` — GET, query param ?wilaya_id=:
  SELECT id, name FROM communes WHERE wilaya_id=$1 ORDER BY name

Client Add/Edit Modal (reuse one modal for both):
Fields: Nom complet*, Téléphone*, Téléphone 2, Email, Wilaya (select — loads from /api/wilayas), Commune (select — loads dynamically when wilaya changes from /api/communes?wilaya_id=X), Adresse
Use Select component for wilaya and commune. Commune select is disabled until wilaya is selected.
On save: POST /api/clients (add) or PUT /api/clients/[id] (edit). Refresh list after.
Delete: ConfirmDialog "Supprimer ce client ?" then DELETE /api/clients/[id].
```

---

## Step 6 — Clients bulk import

```
Create the bulk client import at `app/dashboard/clients/import/page.tsx`.

UI steps (wizard):
1. Upload step: drag-and-drop or click to upload XLS/XLSX/CSV file. Show accepted formats. Button "Parcourir" opens file picker. Accept .xls, .xlsx, .csv.
2. Preview step: parse the file client-side using the `xlsx` package (install it). Show first 5 rows in a table. Show column mapping UI: for each required column (Client*, Téléphone*, Wilaya*, Commune*) show a <select> where user picks which uploaded column maps to it. Also optional: Email, Adresse, Téléphone 2.
3. Import step: POST /api/clients/import with mapped data as JSON array. API validates each row, inserts valid ones, returns { imported: N, failed: M, errors: [{row, reason}] }.
4. Result step: show summary "N clients importés, M erreurs" + collapsible error list.

API: `app/api/clients/import/route.ts` — POST, requireAuth
Body: { rows: Array<{ full_name, phone, phone2?, email?, wilaya_name, commune_name, address? }> }
For each row: look up wilaya by name (SELECT id FROM wilayas WHERE LOWER(name) = LOWER($1)), look up commune by wilaya_id + name, insert client. Collect errors. Return summary.

Install: npm install xlsx
```

---

## Step 7 — Produits list page

```
Create the products list page at `app/dashboard/products/page.tsx`.

API: `app/api/products/route.ts` — GET
requireAuth, query params: ?page=1&limit=25&search=&is_active=&boutique_id=
SELECT p.*, b.name as brand_name,
  COALESCE((SELECT SUM(sb.quantity) FROM stock_batches sb WHERE sb.product_id = p.id AND sb.is_active = true), 0) as stock_total
FROM products p
LEFT JOIN brands b ON b.id = p.brand_id
JOIN product_boutiques pb ON pb.product_id = p.id
WHERE p.tenant_id = $1 AND pb.boutique_id = $2 AND p.deleted_at IS NULL
AND ($3 = '' OR p.name ILIKE '%'||$3||'%' OR p.sku ILIKE '%'||$3||'%')
ORDER BY p.created_at DESC LIMIT $4 OFFSET $5

Page UI:
- PageHeader: "Produits", actions: Button "Ajouter un produit" (→ /dashboard/products/new), Button secondary "Importer"
- Filter bar: SearchInput, Select "Statut" (Tous/Actif/Inactif), Select "Boutique"
- Table columns: [image placeholder 32px], Nom, SKU, Prix de vente, Stock total, Marque, Statut (Badge green/red), Actions (Modifier → /dashboard/products/[id]/edit, Corbeille icon)
- Trash action: move to deleted_at (soft delete) — PUT /api/products/[id] { deleted_at: new Date() }
- Pagination

Clicking "Liste des produits" in sidebar navigates here.
```

---

## Step 8 — Produit create/edit form

```
Create the product form pages:
- `app/dashboard/products/new/page.tsx` — create
- `app/dashboard/products/[id]/edit/page.tsx` — edit (loads existing data)

Both use a shared `components/products/ProductForm.tsx`.

APIs needed:
- `app/api/products/route.ts` POST — create product
- `app/api/products/[id]/route.ts` GET + PUT
- `app/api/brands/route.ts` GET — SELECT id, name FROM brands WHERE tenant_id=$1 ORDER BY name
- `app/api/boutiques/route.ts` GET — already done in Step 2
- `app/api/wilayas/route.ts` GET — already done in Step 5

ProductForm sections (use card panels with gray header like the chart panels in dashboard):

**Section 1 — Informations générales**
Fields: Boutique(s) cible (multi-select checkboxes), Nom du produit*, SKU*, Code à barres, Marque (select + "Créer une marque" link), Statut (toggle Actif/Inactif)

**Section 2 — Tarification**
Fields: Prix de vente* (number), Prix de comparaison (number, must be > prix de vente)

**Section 3 — Stock**
Fields: Comportement si rupture (radio: Autoriser / Refuser), Alerte de rupture (toggle Yes/No), Stock minimum d'alerte (number, shown if alert=Yes), Stratégie de sortie (select: FIFO/LIFO/FEFO/Aléatoire)

**Section 4 — Notes confirmateur**
Fields: Lien externe (url input), Notes pour confirmateur (textarea)

**Section 5 — Poids & Dimensions**
Fields in one row: Poids (g), Longueur (cm), Largeur (cm), Hauteur (cm)

**Section 6 — Frais de livraison par wilaya**
Table with columns: Wilaya, Règle tarifaire (Standard/Spécifique), Frais livraison, Frais stop desk.
First row always: "Toutes les wilayas" (global default). Then "Ajouter une surcharge wilaya" button that adds a row with wilaya select.
These rows are saved in product_delivery_fees table.

API for save: POST/PUT to /api/products/[id]:
Body: { name, sku, barcode, brand_id, boutique_ids[], price, compare_price, out_of_stock_behavior, stock_alert_enabled, stock_alert_min, stock_strategy, external_link, confirmer_notes, weight_g, length_cm, width_cm, height_cm, is_active, delivery_fees[] }

In the API: INSERT into products, then product_boutiques, then product_delivery_fees.
```

---

## Step 9 — Produit variants & options

```
Extend the product form (from Step 8) with variants and option management.

Create `app/api/option-types/route.ts` — GET + POST (CRUD for option types)
  GET: SELECT ot.*, json_agg(ov ORDER BY ov.sort_order) as values FROM option_types ot LEFT JOIN option_values ov ON ov.option_type_id = ot.id WHERE ot.tenant_id=$1 GROUP BY ot.id ORDER BY ot.sort_order
  POST: INSERT INTO option_types (id, tenant_id, name, sort_order)

Create `app/api/option-types/[id]/route.ts` — PUT + DELETE (+ option values CRUD within)
Create `app/api/option-types/[id]/values/route.ts` — POST (add value), DELETE by value id

Add **Section 7 — Attributs & Variantes** to ProductForm:
1. "Ajouter un attribut" button opens a selector showing existing option types (Couleur, Taille, Pointure...) + "Créer un nouveau type".
2. For each selected attribute type, show the available values as checkboxes (e.g. Couleur: ☐ Noir ☐ Blanc ☐ Rouge).
3. When values are selected, auto-generate the variants matrix (combinaisons). Show a table of generated variants: SKU (auto = product.sku + "-" + values), Prix override (empty = uses product price), Actif toggle.
4. User can edit variant SKU and price individually.

On save: 
  DELETE existing product_variants and variant_options for this product, then re-insert all.
  API: PUT /api/products/[id] accepts variants: [{ sku, price?, is_active, option_value_ids[] }]

Also add page `app/dashboard/products/options/page.tsx` for managing option types & values globally (CRUD interface in a table with inline editing).
```

---

## Step 10 — Commandes : Créer manuellement

```
Create the manual order creation page at `app/dashboard/orders/new/page.tsx`.

API: `app/api/orders/route.ts` — POST (create order)
Steps in API:
1. requireAuth
2. Get boutique's tenant check: SELECT id FROM boutiques WHERE id=$boutiqueId AND tenant_id=$tenantId
3. Upsert client (find by phone OR create new): look up by phone in clients table, insert if not found
4. Generate reference: SELECT generate_order_reference($boutiqueId)
5. INSERT into orders: { id, boutique_id, client_id, reference, tracking_status: 'en_confirmation', subtotal, delivery_fee, discount, total, delivery_method, wilaya_id, commune_id, address, phone, phone2, referrer, remark, source_type: 'manual' }
6. INSERT each item into order_items: { order_id, product_id, variant_id, product_name, sku, quantity, unit_price, unit_cost, line_total }
7. INSERT into order_logs: { order_id, user_id: auth.sub, action: 'created', new_values: order }
8. Return created order

Page UI (3-column layout on wide screen, stacked on narrow):

**Left panel — Client:**
  Phone input with search button: on search, GET /api/clients?phone=X → prefill fields if found
  Fields: Nom complet*, Téléphone*, Téléphone 2, Email, Wilaya (select), Commune (select, dynamic), Adresse, Référent (select: Facebook/Instagram/TikTok/Autre), Remarque (textarea)

**Center panel — Produits:**
  Search product by name/SKU (autocomplete from /api/products?search=X&boutique_id=)
  On select: show variant selector (if variants exist), quantity input, unit_price input (pre-filled), unit_cost (hidden unless permission)
  Table of added items: Produit, Variante, Qté, Prix unitaire, Total ligne, remove button
  Subtotal shown below

**Right panel — Livraison & Récap:**
  Méthode de livraison (radio: Domicile / Stop Desk)
  Frais de livraison (pre-filled from product_delivery_fees for selected wilaya, editable)
  Remise (number input)
  Total = subtotal + delivery_fee - discount (computed, displayed large)
  Button "Créer la commande" (primary, full width)

On submit: POST /api/orders, redirect to /dashboard/orders/en-confirmation on success.
```

---

## Step 11 — Commandes : En confirmation

```
Create the orders pipeline page starting with "En confirmation" at `app/dashboard/orders/en-confirmation/page.tsx`.

This is the most complex page — build it as the template for all other pipeline pages.

API: `app/api/orders/route.ts` — GET
requireAuth, query params: ?status=en_confirmation&boutique_id=&page=1&limit=25&search=&assigned_to=
SELECT o.*, c.full_name as client_name, c.phone as client_phone,
  w.name as wilaya_name, u.name as confirmer_name,
  (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as items_count
FROM orders o
JOIN boutiques b ON b.id = o.boutique_id
LEFT JOIN clients c ON c.id = o.client_id
LEFT JOIN wilayas w ON w.id = o.wilaya_id
LEFT JOIN users u ON u.id = o.assigned_confirmer_id
WHERE b.tenant_id = $1 AND o.boutique_id = $2
  AND o.tracking_status = $3 AND o.deleted_at IS NULL
ORDER BY o.created_at DESC LIMIT $4 OFFSET $5

Page UI:
- PageHeader: "En confirmation" with count badge, action: Button "Nouvelle commande"
- Filter bar: SearchInput (ref/phone/name), Select "Confirmateur" (list of users), date range De/À
- Table columns: ☐ (checkbox), Référence, Statut confirmation (Badge), Téléphone, Client, Wilaya, Commune, Risque retour (%), Articles, Total, Créée le, Affectée à, Actions
- Actions column: eye icon (voir détail), edit icon
- Bulk action bar (appears when checkboxes selected): shows N sélectionnés + buttons: Confirmer, Annuler, Supprimer, Affecter à, Modifier statut confirmation
- Row click → opens order detail panel (slide-in from right, 420px wide — next step)
- Pagination

Bulk action APIs:
- `app/api/orders/bulk/route.ts` — POST, body: { ids[], action: 'confirm'|'cancel'|'delete'|'assign', value? }
  confirm: UPDATE orders SET tracking_status='en_preparation', confirmed_at=NOW() WHERE id IN (...)
  cancel: UPDATE orders SET tracking_status='annulee', cancelled_at=NOW()
  delete: UPDATE orders SET deleted_at=NOW()
  assign: UPDATE orders SET assigned_confirmer_id=$value

This page becomes the template. Copy its structure for steps 12-17.
```

---

## Step 12 — Order detail panel (slide-in)

```
Create a reusable order detail slide panel `components/orders/OrderDetailPanel.tsx`.

Props: orderId (string|null), onClose (fn), onStatusChange (fn — refreshes the list)

API: `app/api/orders/[id]/route.ts` — GET
SELECT o.*, c.*, w.name as wilaya_name, com.name as commune_name,
  u_conf.name as confirmer_name, u_carrier.name as carrier_name,
  json_agg(DISTINCT jsonb_build_object('id', oi.id, 'product_name', oi.product_name, 'sku', oi.sku, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'line_total', oi.line_total)) as items
FROM orders o
LEFT JOIN clients c ON c.id = o.client_id
LEFT JOIN wilayas w ON w.id = o.wilaya_id  
LEFT JOIN communes com ON com.id = o.commune_id
LEFT JOIN users u_conf ON u_conf.id = o.assigned_confirmer_id
LEFT JOIN carriers u_carrier ON u_carrier.id = o.assigned_carrier_id
WHERE o.id = $1

Panel UI (slide from right, 420px, white bg, shadow -4px 0 20px rgba(0,0,0,0.12)):
Header: Référence + tracking_status Badge + X close button
Sections (accordion or stacked):
  1. Client — nom, téléphone, wilaya, commune, adresse, email
  2. Articles — table: produit, qté, prix unit, total ligne. Subtotal shown.
  3. Livraison — méthode, frais livraison, frais livreur, remise
  4. Totaux — subtotal, delivery_fee, carrier_fee, discount, TOTAL (large, primary color)
  5. Historique — list from order_logs (GET /api/orders/[id]/logs): date, action, user

Action buttons at bottom (depends on tracking_status):
  en_confirmation: "Confirmer" (primary), "Annuler" (danger ghost), "Affecter à"
  Others will be added per step.

PUT /api/orders/[id]/route.ts — PATCH for status transitions
Body: { action: 'confirm'|'cancel'|'assign_confirmer'|... }
Each action updates the right fields + timestamp + inserts order_log entry.
```

---

## Step 13 — Commandes : En préparation

```
Create `app/dashboard/orders/en-preparation/page.tsx` — copy the en-confirmation page structure (Step 11) and adapt.

Table columns for En préparation: ☐, Référence, Client, Téléphone, Wilaya, Articles, Total, Confirmée le, Livreur affecté, Actions

Status bar actions for this status: Dispatcher, Changer livreur, Annuler, Imprimer étiquettes, Exporter

Bulk actions: Dispatcher (→ en_dispatch), Changer livreur, Annuler, Imprimer étiquettes

In OrderDetailPanel: for en_preparation status show buttons:
  "Dispatcher" (moves to en_dispatch, sets dispatched_at=NOW(), requires carrier assignment)
  "Changer livreur" (select carrier modal)
  "Annuler"
  "Retour en confirmation" (go_back permission)

API for dispatch: PATCH /api/orders/[id] { action: 'dispatch', carrier_id }
  UPDATE orders SET tracking_status='en_dispatch', assigned_carrier_id=$carrier_id, dispatched_at=NOW()

API to get carriers: `app/api/carriers/route.ts` GET
  SELECT c.* FROM carriers c JOIN carrier_boutiques cb ON cb.carrier_id=c.id WHERE cb.boutique_id=$1 AND c.is_active=true
```

---

## Step 14 — Commandes : En dispatch

```
Create `app/dashboard/orders/en-dispatch/page.tsx`.

Table columns: ☐, Référence, Client, Téléphone, Wilaya, Livreur, Dispatchée le, Sync, Articles, Total, Actions

Sync column: show icon — green if sync_enabled=true, gray if false.

Bulk actions: Expédier (→ en_livraison), Annuler, Imprimer étiquettes, Imprimer feuille de route, Désactiver sync

In OrderDetailPanel for en_dispatch: 
  "Expédier" button → PATCH { action: 'ship' } → tracking_status='en_livraison', shipped_at=NOW()
  "Désactiver sync" toggle → PATCH { action: 'toggle_sync' } → sync_enabled=!sync_enabled
  "Retour en préparation"

Feuille de route print: `app/api/orders/print-route/route.ts` — POST { order_ids[] }
Returns JSON with orders data formatted for print (client name, phone, wilaya, commune, address, reference, total). Frontend opens a print-friendly window.
```

---

## Step 15 — Commandes : En livraison

```
Create `app/dashboard/orders/en-livraison/page.tsx`.

Table columns: ☐, Référence, Téléphone, Client, Wilaya, Expédiée le, Livreur, Statut livraison (Badge), Sync, Actions

"Statut livraison" is the delivery_status (sub-status set by carrier/user). Show as Badge.

Bulk actions: Valider livraison (→ livree), Demander retour (→ en_retour), Modifier frais livreur, Désactiver sync

In OrderDetailPanel for en_livraison:
  "Valider livraison" → PATCH { action: 'deliver' } → tracking_status='livree', delivered_at=NOW()
  "Demander retour" → PATCH { action: 'request_return' } → tracking_status='en_retour'
  "Modifier statut livraison" → select from delivery_statuses list → PATCH { action: 'set_delivery_status', delivery_status }
  "Modifier frais livreur" → inline edit carrier_fee
  
API: `app/api/delivery-statuses/route.ts` GET → SELECT * FROM delivery_statuses WHERE tenant_id=$1 AND is_active=true ORDER BY sort_order
```

---

## Step 16 — Commandes : Livrées + En retour

```
Create two pages:
- `app/dashboard/orders/livrees/page.tsx`
- `app/dashboard/orders/en-retour/page.tsx`

**Livrées:**
Table columns: ☐, Référence, Client, Téléphone, Wilaya, Livrée le, Livreur, Total, Frais livreur, Actions
Bulk actions: Préparer bon encaissement, Modifier frais livreur, Retour en livraison

In OrderDetailPanel for livrees:
  "Préparer bon" → creates receipt: INSERT INTO receipts { order_id, carrier_id, type:'encaissement', status:'pending', amount: o.total - o.carrier_fee }
  "Retour en livraison" (go_back)

**En retour:**
Table columns: ☐, Référence, Client, Téléphone, Wilaya, En retour depuis, Livreur, Total, Actions
Bulk actions: Valider retour (→ retournee), Préparer bon retour, Retour en livraison

In OrderDetailPanel for en_retour:
  "Valider retour" → PATCH { action: 'validate_return' } → tracking_status='retournee', returned_at=NOW()
  "Préparer bon retour" → INSERT INTO receipts { type:'retour', status:'pending' }

API for receipts: `app/api/receipts/route.ts` POST
```

---

## Step 17 — Archives (Encaissées, Retournées, Annulées, Corbeille)

```
Create 4 archive pages with simplified read-mostly UI:

- `app/dashboard/orders/archives/encaissees/page.tsx` — tracking_status = 'encaissee'
- `app/dashboard/orders/archives/retournees/page.tsx` — tracking_status = 'retournee'  
- `app/dashboard/orders/archives/annulees/page.tsx` — tracking_status = 'annulee'
- `app/dashboard/orders/corbeille/page.tsx` — deleted_at IS NOT NULL

All 4 share the same table structure and use /api/orders route with different status params.

Annulées extra actions: Restaurer (→ en_confirmation, set deleted_at=NULL), Supprimer définitivement (hard DELETE)
Corbeille extra actions: Annuler la suppression (restore, set deleted_at=NULL), Supprimer définitivement

PATCH /api/orders/[id] { action: 'restore' } → tracking_status='en_confirmation', deleted_at=NULL, cancelled_at=NULL
DELETE /api/orders/[id] — hard delete (also deletes order_items, order_logs for this order)

Create a shared `components/orders/OrdersPage.tsx` component that all pipeline pages use.
It accepts: title, status, columns[], availableBulkActions[], availableDetailActions[]
This reduces code duplication across the 10+ order list pages.
```

---

## Step 18 — Bons (Encaissement + Retour)

```
Create two bon management pages:
- `app/dashboard/orders/bons/encaissement/page.tsx`
- `app/dashboard/orders/bons/retour/page.tsx`

These show receipts grouped by carrier, ready to be confirmed.

API: `app/api/receipts/route.ts` — GET
query params: ?type=encaissement|retour&boutique_id=&status=pending
SELECT r.*, o.reference, o.total, o.carrier_fee, c.full_name as client_name,
  car.name as carrier_name
FROM receipts r
JOIN orders o ON o.id = r.order_id
JOIN boutiques b ON b.id = o.boutique_id
LEFT JOIN clients c ON c.id = o.client_id
LEFT JOIN carriers car ON car.id = r.carrier_id
WHERE b.tenant_id=$1 AND o.boutique_id=$2 AND r.type=$3 AND r.status=$4
ORDER BY car.name, r.created_at

Page UI:
- Group receipts by carrier (accordion sections with carrier name as header + total amount)
- Each row: order reference, client name, amount
- "Confirmer le bon" button per carrier group → confirms all pending receipts for that carrier
  PATCH /api/receipts/bulk-confirm { carrier_id, type, order_ids[] }
  UPDATE receipts SET status='confirmed', confirmed_by=$userId, confirmed_at=NOW()
  Also for encaissement: UPDATE orders SET tracking_status='encaissee', paid_at=NOW()
  Also for retour: UPDATE orders SET tracking_status='retournee', returned_at=NOW()
- "Retour en livraison/retour" button per row (go_back)
```

---

## Step 19 — Pickups pipeline

```
Create the pickups pipeline (5 statuses):
- `app/dashboard/orders/pickups/en-collecte/page.tsx`
- `app/dashboard/orders/pickups/collecte/page.tsx`
- `app/dashboard/orders/pickups/recus/page.tsx`
- `app/dashboard/orders/pickups/traites/page.tsx`
- `app/dashboard/orders/pickups/annules/page.tsx`

API: `app/api/pickups/route.ts` GET — query params: ?status=&boutique_id=&page=&limit=
SELECT p.*, o.reference, o.total, c.full_name as client_name,
  car.name as carrier_name, w.name as wilaya_name
FROM pickups p
JOIN orders o ON o.id = p.order_id
JOIN boutiques b ON b.id = o.boutique_id
LEFT JOIN clients c ON c.id = o.client_id
LEFT JOIN carriers car ON car.id = p.carrier_id
LEFT JOIN wilayas w ON w.id = o.wilaya_id
WHERE b.tenant_id=$1 AND o.boutique_id=$2 AND p.status=$3
ORDER BY p.created_at DESC

API: `app/api/pickups/[id]/route.ts` PATCH — status transitions
en_collecte → collecte: { action:'validate_collect' } collected_at=NOW(), status='collecte'
collecte → recus: { action:'validate_reception' } received_at=NOW(), status='recu'
recus → traites: { action:'validate_processing' } processed_at=NOW(), status='traite'
Any → annule: { action:'cancel' } cancelled_at=NOW(), status='annule'

Table columns (all statuses): ☐, Commande ref, Client, Livreur, Wilaya, Date, Sync, Actions
Use OrdersPage shared component adapted for pickups.
```

---

## Step 20 — Import Google Sheet

```
Create Google Sheet import at `app/dashboard/orders/import/google-sheet/page.tsx`.

This feature requires Google OAuth. Steps:

1. Install packages: npm install googleapis

2. Create Google OAuth flow:
   - `app/api/auth/google/route.ts` GET — redirects to Google OAuth consent screen
     Scopes: https://www.googleapis.com/auth/spreadsheets.readonly
     Redirect URI: /api/auth/google/callback
   - `app/api/auth/google/callback/route.ts` GET — exchanges code for tokens, stores in localStorage via redirect

3. Page wizard (4 steps):
   Step 1 - Connexion Google: Button "Connecter mon compte Google" → triggers OAuth. Shows connected account email if already connected.
   Step 2 - Sélection fichier: Input for Google Sheet URL or ID. Select sheet/tab name. Input "Séparateur produits" (default: |). Button "Charger la feuille"
   Step 3 - Mapping colonnes: Show first 3 rows of sheet as preview. For each field (N° commande, Client*, Téléphone*, Email, Tél 2, Wilaya*, Commune*, Adresse, Remarque, Méthode livraison, Produit (SKU)*, Quantité*, Prix unitaire, Adresse IP, Référent) — show a select to pick the column.
   Step 4 - Import: POST /api/orders/import/google-sheet { sheet_id, sheet_name, mapping, separator, boutique_id }
   API reads last 30 days from the sheet (max 1000 rows), maps columns, creates orders (skip duplicates by reference), returns import summary.

API: `app/api/orders/import/google-sheet/route.ts` POST
Use googleapis to read sheet data with user's OAuth token. Map rows to orders. Call generate_order_reference for each new order. Return { imported, skipped, failed, errors }.
```

---

## Step 21 — Gestion de stock : Ajustement

```
Create `app/dashboard/stock/ajustement/page.tsx`.

This page allows adjusting stock levels.

API: `app/api/stock/adjust/route.ts` POST — requireAuth
Body: { warehouse_id, product_id, variant_id?, operation_type: 'add'|'remove'|'correct', target_type: 'new_batch'|'global'|'existing_batch', quantity, unit_cost?, batch_id?, batch_number?, expiry_date?, comment? }

Action:
1. INSERT INTO stock_movements (id, tenant_id, product_id, variant_id, warehouse_id, batch_id, user_id, operation_type, target_type, quantity, unit_cost, comment)
2. If target_type='new_batch' and operation_type='add': INSERT INTO stock_batches
3. If target_type='existing_batch': UPDATE stock_batches SET quantity=quantity+$delta WHERE id=$batch_id
4. For 'correct': UPDATE stock_batches SET quantity=$quantity (replace, not add)

Page UI:
Step 1 — Sélection:
  Entrepôt (select from /api/warehouses): SELECT id, name FROM warehouses WHERE tenant_id=$1 AND is_active=true
  Produit (autocomplete search): /api/products?search=X
  Variante (select, appears if product has variants)
  Type d'opération: radio — Ajouter / Retirer / Corriger

Step 2 — Détails (conditional on operation + target):
  For Ajouter → Nouveau lot: Quantité*, Prix achat unitaire, N° de lot, Date d'expiration, Commentaire
  For Ajouter → Lot existant: select lot (dropdown shows batch_number, qty, date) + Quantité
  For Retirer → Stock global: Quantité only
  For Retirer → Lot existant: select lot + Quantité
  For Corriger → Stock global: Quantité, Prix achat, N° lot, Date expiration, Commentaire
  For Corriger → Lot existant: select lot + Quantité

Button "Valider l'ajustement" → POST /api/stock/adjust → success toast → reset form

Get lots API: `app/api/stock/batches/route.ts` GET ?product_id=&warehouse_id=
SELECT * FROM stock_batches WHERE product_id=$1 AND warehouse_id=$2 AND is_active=true ORDER BY created_at
```

---

## Step 22 — Stock : Mouvements, Lots, Alertes

```
Create three stock report pages:

**1. `app/dashboard/stock/mouvements/page.tsx`**
API: `app/api/stock/movements/route.ts` GET ?product_id=&warehouse_id=&operation_type=&page=&limit=
SELECT sm.*, p.name as product_name, v.sku as variant_sku, w.name as warehouse_name, u.name as user_name
FROM stock_movements sm
JOIN products p ON p.id = sm.product_id
LEFT JOIN product_variants v ON v.id = sm.variant_id
LEFT JOIN warehouses w ON w.id = sm.warehouse_id
LEFT JOIN users u ON u.id = sm.user_id
WHERE sm.tenant_id=$1 ORDER BY sm.created_at DESC LIMIT $2 OFFSET $3

Table: Date, Produit, Variante, Entrepôt, Opération (Badge: add=green remove=red correct=blue), Cible, Quantité (+/-), Prix achat, Lot, Commentaire, Utilisateur
Filters: product search, warehouse select, operation type select, date range

**2. `app/dashboard/stock/lots/page.tsx`**
API: `app/api/stock/batches/route.ts` GET (extend for listing with filters)
SELECT sb.*, p.name as product_name, v.sku as variant_sku, w.name as warehouse_name
FROM stock_batches sb JOIN products p... WHERE sb.tenant_id=$1 AND sb.is_active=true
Table: Produit, Variante, Entrepôt, N° lot, Quantité, Prix achat, Date expiration, Actif
Highlight expiring batches (expiry_date within 30 days) in orange.

**3. `app/dashboard/stock/alertes/page.tsx`**
Use the view: SELECT * FROM v_stock_alerts WHERE tenant_id=$1
API: `app/api/stock/alerts/route.ts` GET
Table: Produit, SKU, Stock actuel (red), Stock minimum (gray), Écart, Actions (lien vers ajustement)
```

---

## Step 23 — Stock : Inventaire

```
Create `app/dashboard/stock/inventaire/page.tsx` and `app/dashboard/stock/mega-inventaire/page.tsx`.

Both use inventory_sessions and inventory_session_items tables.

**Inventaire (one warehouse):**
Flow:
1. Check for open session: SELECT * FROM inventory_sessions WHERE tenant_id=$1 AND status='open' AND mode='inventory'
2. If none: show "Démarrer un inventaire" button with warehouse select → POST /api/inventory/sessions { warehouse_id, mode:'inventory' }
3. If open: show inventory sheet

API: `app/api/inventory/sessions/route.ts` POST — creates new session
  INSERT INTO inventory_sessions (id, tenant_id, boutique_id, warehouse_id, created_by, mode, status)
  Then INSERT INTO inventory_session_items for all active products in that warehouse (from stock_batches):
    SELECT product_id, variant_id, SUM(quantity) as expected_qty FROM stock_batches WHERE warehouse_id=$1 AND is_active=true GROUP BY product_id, variant_id
  Insert each as { session_id, product_id, variant_id, expected_qty, counted_qty: 0, unit_cost }

Inventory sheet UI (open session):
Table: Produit, SKU, Variante, Qté attendue, Qté comptée (editable input, highlighted), Écart (colored: green=0, red=negative, orange=positive)
Each row auto-saves counted_qty on change (debounced PATCH /api/inventory/items/[id] { counted_qty })
Bottom: "Confirmer l'inventaire" button → PATCH /api/inventory/sessions/[id] { action:'confirm' }
  Sets status='confirmed', confirmed_by=userId, confirmed_at=NOW()
  Then adjusts stock: for each item where counted_qty != expected_qty → INSERT stock_movement (type:'correct')

**Méga inventaire:** Same as above but mode='mega_inventory' — covers all warehouses at once.
```

---

## Step 24 — Marques + Fournisseurs CRUD

```
Create simple CRUD pages for reference data:

**Marques: `app/dashboard/marques/page.tsx`**
API: `app/api/brands/route.ts` GET + POST
  GET: SELECT * FROM brands WHERE tenant_id=$1 ORDER BY name
  POST: INSERT INTO brands (id, tenant_id, name)
`app/api/brands/[id]/route.ts` PUT + DELETE

UI: PageHeader "Marques", Button "Ajouter une marque" (opens modal with just a name field).
Table: Nom, Actions (modifier / supprimer)
Inline edit: click name to edit in-place (contenteditable or inline input).
Delete: ConfirmDialog (warn if brand has products).

**Fournisseurs: `app/dashboard/fournisseurs/page.tsx`**
API: `app/api/suppliers/route.ts` GET + POST
  GET: SELECT * FROM suppliers WHERE tenant_id=$1 ORDER BY name
  POST: INSERT INTO suppliers (id, tenant_id, name, phone, email, address)
`app/api/suppliers/[id]/route.ts` PUT + DELETE

UI: PageHeader "Fournisseurs", Button "Ajouter un fournisseur".
Table: Nom, Téléphone, Email, Adresse, Actions
Add/Edit Modal fields: Nom*, Téléphone, Email, Adresse (textarea)
```
aplay stock add and remove in command flow 
---

## Step 25 — Livreurs CRUD

```
Create livreurs management at `app/dashboard/livraison/livreurs/page.tsx`.

API: `app/api/carriers/route.ts` — GET + POST (extend existing)
  GET: SELECT c.*, array_agg(cb.boutique_id) as boutique_ids FROM carriers c LEFT JOIN carrier_boutiques cb ON cb.carrier_id=c.id WHERE c.tenant_id=$1 GROUP BY c.id ORDER BY c.name
  POST: INSERT INTO carriers (id, tenant_id, name, phone, platform, wilaya_ids, manages_stock, is_active)
        Then INSERT INTO carrier_boutiques for selected boutiques
`app/api/carriers/[id]/route.ts` GET + PUT + DELETE

Table columns: Nom, Téléphone, Plateforme, Wilayas couvertes (count badge), Boutiques (count), Gère stock (toggle), Statut (toggle), Actions

Add/Edit Modal fields:
  Nom*, Téléphone
  Boutiques associées: multi-select checkboxes of user's boutiques
  Wilayas couvertes: multi-select of wilayas (show all 58, with search filter inside modal)
  Gère le stock: toggle (manages_stock)
  Plateforme: select (or text input — e.g. Procolis, Maystro, Yalidin...)
  Statut: toggle Actif/Inactif
```

---

## Step 26 — Statistiques V2 (5 rapports)

```
Create the statistics module. All 5 reports share the same filter bar and layout.

Create shared `components/stats/StatsFilters.tsx`:
Props: onChange(filters)
Fields: 
  Boutique (select: all or specific), 
  Basé sur (select: Toutes commandes / Confirmées uniquement),
  Filtrer selon (select: date création/affectation/confirmation/dispatch/expédition/livraison/échec/encaissement/retour/annulation),
  Période De (date) / À (date),
  Résultat par (radio: Nombre commandes / Quantité vendue),
  Affichage (radio: En nombre / En pourcentage)

Create shared `components/stats/StatsTable.tsx`:
Shows a table with tracking_status columns (En confirmation, En préparation, En dispatch, En livraison, Livrées, En retour, Encaissées, Retournées, Annulées) + Total.
Rows are grouped by the "trier par" dimension.
Color code: each status has its donut color from tokens.ts.

Create `app/api/stats/route.ts` — GET, requireAuth
query: ?dimension=wilaya|commune|carrier|confirmer|product|variant|boutique&boutique_id=&from=&to=&base=all|confirmed&date_field=created_at&result_by=count|quantity
Use the appropriate v_stat_by_* view based on dimension.
Example for dimension=wilaya: SELECT * FROM v_stat_by_wilaya WHERE tenant_id=$1 AND created_at BETWEEN $2 AND $3

Pages (all use shared components):
- `app/dashboard/stats/boutique/page.tsx` — dimension selector: Wilaya/Commune/Livreur/Produit/Variante/Confirmateur
- `app/dashboard/stats/produit/page.tsx` — extra filter: product + variant, dimensions: Confirmateur/Livreur/Wilaya/Commune/Variante/Boutique
- `app/dashboard/stats/confirmateur/page.tsx` — extra filter: confirmer user, dimensions: Produit/Variante/Livreur/Wilaya/Commune/Boutique
- `app/dashboard/stats/livreur/page.tsx` — extra filter: carrier, dimensions: Wilaya/Commune/Produit/Variante/Confirmateur/Boutique
- `app/dashboard/stats/wilaya/page.tsx` — extra filters: wilaya + commune, dimensions: Livreur/Produit/Variante/Confirmateur/Commune/Boutique

Each page has a BarChart (recharts) showing the top 10 rows visually below the table.
```

---

## Step 27 — Comptabilité : Bilan général

```
Create `app/dashboard/comptabilite/bilan/page.tsx`.

API: `app/api/comptabilite/bilan/route.ts` GET
query: ?boutique_id=&from=&to=&date_basis=created_at|delivered_at&base=confirmed|delivered
Use view v_bilan_facts: SELECT * FROM v_bilan_facts WHERE tenant_id=$1 AND boutique_id=$2 AND [date_basis] BETWEEN $3 AND $4

Also fetch cost configs:
  SELECT * FROM confirmation_cost_configs WHERE boutique_id=$1
  SELECT * FROM packaging_cost_configs WHERE boutique_id=$1
  SELECT SUM(amount) FROM advertising_costs WHERE boutique_id=$1 AND period_start <= $to AND (period_end IS NULL OR period_end >= $from)
  SELECT SUM(amount) FROM expenses WHERE boutique_id=$1 AND (period_start BETWEEN $from AND $to OR period_type='monthly')

Calculate and return:
  vente: { ca, valeur_achat, remise, marge_brute }
  livraison: { frais_recolt, frais_livreurs, marge_livraison }
  charges: { pub, confirmation, emballage, autres_charges }
  resultat: { net }

Filters UI:
  Boutique, Calculer selon (date création / livraison), Période De/À
  Frais pub (manual override or use from DB)
  Frais confirmation: cost_amount + apply_to + based_on (from confirmation_cost_configs)
  Frais emballage: cost_amount + apply_per + based_on (from packaging_cost_configs)

Results table (4 color-coded sections matching PDF):
  🔵 Vente: CA (total), Valeur achat, Remise, Marge brute
  🟡 Livraison: Frais collectés, Frais livreurs, Marge livraison
  ⚫ Charges: Pub, Confirmation, Emballage, Autres
  🟢 Résultat net (large, green)
```

---

## Step 28 — Comptabilité : Rentabilité produit + Dépenses

```
**Rentabilité produit: `app/dashboard/comptabilite/rentabilite/page.tsx`**

API: `app/api/comptabilite/rentabilite/route.ts` GET
query: ?product_id=&variant_id=&boutique_id=&from=&to=&split_remise=true&split_livraison=true&split_livreurs=true&split_confirmation=true&split_emballage=true

Use v_bilan_facts filtered by product_id, compute per-product profit.
Return: { benefice_total, qte_livree, benefice_unitaire, cout_pub_unitaire, roi }

UI:
  Filters: Produit (autocomplete), Variante (select, dynamic), date range
  Options toggles (Oui/Non): Diviser remise / frais livraison / frais livreurs / frais confirmation / frais emballage sur la quantité produit
  Results card: Bénéfice total (large), Bénéfice unitaire, Coût pub unitaire, ROI % (with color green/red)

---

**Saisir des dépenses: `app/dashboard/comptabilite/depenses/page.tsx`**

APIs:
`app/api/expense-types/route.ts` GET+POST+DELETE — SELECT/INSERT/DELETE FROM expense_types WHERE tenant_id=$1
`app/api/expenses/route.ts` GET+POST — SELECT/INSERT FROM expenses WHERE tenant_id=$1
`app/api/advertising-costs/route.ts` GET+POST — SELECT/INSERT FROM advertising_costs WHERE tenant_id=$1

Page UI (tabbed: Dépenses | Coûts publicitaires):

Dépenses tab:
  Button "Ajouter une dépense" → Modal: Type de charge (select from expense_types + "Gérer les types" link), Boutique, Montant, Type période (Ponctuelle/Mensuelle/Période), dates, Note
  Table: Date, Type, Boutique, Montant, Période, Note, Actions

Coûts publicitaires tab:
  Button "Ajouter" → Modal: Boutique, Montant, Période De/À, Note
  Table: Boutique, Montant, Période, Note, Actions

"Gérer les types" opens a small modal with CRUD for expense_types (name field only).
```

---

## Step 29 — Configuration : Statuts personnalisables

```
Create `app/dashboard/config/statuts/page.tsx`.

Three tabs: Statuts de livraison | Statuts de confirmation | Statuts de suivi

**Statuts de livraison:**
API: `app/api/config/delivery-statuses/route.ts` GET+POST+PUT+DELETE
  SELECT * FROM delivery_statuses WHERE tenant_id=$1 ORDER BY sort_order
  POST: INSERT INTO delivery_statuses (id, tenant_id, name, slug, sms_notify, is_active, sort_order)
  PUT /[id]: UPDATE ... slug is auto-generated from name (slugify)
  DELETE /[id]: DELETE if not system

Table: Nom, SMS (toggle), Actif (toggle), Glisser (drag handle for sort_order reorder)
Add button: Modal with Name field + SMS toggle
Drag to reorder: use simple up/down arrow buttons to change sort_order (no complex DnD needed).

**Statuts de confirmation:**
Same structure targeting confirmation_statuses table.

**Statuts de suivi (système, read-only):**
List the 9 system tracking statuses (is_system=true). Show as read-only table with no edit/delete. Display the flow: en_confirmation → en_preparation → ... with arrows.
```

---

## Step 30 — Webhooks

```
Create `app/dashboard/webhooks/page.tsx` and `app/dashboard/webhooks/logs/page.tsx`.

API: `app/api/webhooks/route.ts` GET+POST
  GET: SELECT w.*, array_agg(b.name) as boutique_names FROM webhooks w LEFT JOIN boutiques b ON b.id = ANY(w.boutique_ids) WHERE w.tenant_id=$1 GROUP BY w.id ORDER BY w.created_at DESC
  POST: INSERT INTO webhooks (id, tenant_id, name, event, url, secret, boutique_ids, is_active)
`app/api/webhooks/[id]/route.ts` GET+PUT+DELETE

List page:
Table: Nom, Événement (Badge), URL, Boutiques, Actif (toggle), Actions (modifier, logs, supprimer)
"Voir les logs" links to /dashboard/webhooks/[id]/logs

Add/Edit Modal:
  Nom*, Événement* (select from 19 webhook events — show as grouped select), URL*, Code secret (auto-generated UUID, show with copy button), Boutiques (multi-select checkboxes), Actif toggle
  Show 19 events from CLAUDE.md list.

Logs page `app/dashboard/webhooks/[id]/logs/page.tsx`:
API: `app/api/webhooks/[id]/logs/route.ts` GET ?page=&limit=
  SELECT wl.*, o.reference as order_ref FROM webhook_logs wl LEFT JOIN orders o ON o.id=wl.order_id WHERE wl.webhook_id=$1 ORDER BY wl.created_at DESC

Table: Date, Événement, Commande ref, HTTP status (Badge: 200=green 4xx=orange 5xx=red), Tentative, Durée ms, Actions (voir payload)
Click row → Modal showing request_payload (JSON) + response_body (JSON).
```

---

## Step 31 — Modérateurs : Utilisateurs

```
Create `app/dashboard/moderateurs/utilisateurs/page.tsx`.

API: `app/api/users/route.ts` GET+POST
  GET: SELECT u.*, array_agg(r.name) as role_names FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id WHERE u.tenant_id=$1 GROUP BY u.id ORDER BY u.created_at DESC
  POST: INSERT INTO users (id, tenant_id, name, email, password_hash) — hash password with bcrypt, then INSERT user_roles + user_boutiques
`app/api/users/[id]/route.ts` GET+PUT+DELETE

Table: Nom, Email, Rôle(s) (Badges), Email vérifié (✓/✗), 2FA (✓/✗), En ligne (green dot / gray dot), Actif (toggle), Actions

Add/Edit Modal fields:
  Nom*, Email*, Mot de passe* (only on create), Rôles (multi-select from /api/roles), Boutiques associées (multi-select), Statut (toggle)
  On edit: password field shows "Laisser vide pour ne pas changer" — only hash+update if non-empty

Delete: disable user (set is_active=false) rather than hard delete.

Also show real-time online status: is_online column updates via last_seen_at (sessions table). In the list, show green dot if last_seen_at within last 5 minutes.
```

---

## Step 32 — Modérateurs : Rôles & Permissions (RBAC)

```
Create `app/dashboard/moderateurs/roles/page.tsx`.

This is the most complex configuration page — a permission matrix editor.

API: `app/api/roles/route.ts` GET+POST
  GET: SELECT * FROM roles WHERE tenant_id=$1 ORDER BY is_system DESC, name
  POST: INSERT INTO roles (id, tenant_id, name, permissions, is_system=false)
`app/api/roles/[id]/route.ts` GET+PUT+DELETE (cannot delete is_system roles)

List: Table with columns Nom, Type (Système/Custom badge), Permissions (summary count), Actions (modifier, dupliquer, supprimer)

"Modifier" opens full-screen modal (or separate page at /dashboard/roles/[id]/edit):

Permission matrix UI:
Organized in collapsible sections matching the permission keys from CLAUDE.md:

Section "Commandes — En confirmation": checkboxes for view, confirm, cancel, delete, assign_confirmer, edit_discount, edit_price, edit_delivery_fee, bulk_action
Section "Commandes — En préparation": checkboxes for view, go_back, cancel, change_carrier, dispatch, print_labels, export, edit, edit_discount, bulk_action
... (all 21 permission sections from CLAUDE.md)
Section "Statistiques": stats.boutique, stats.product, stats.delivery, stats.confirmation, stats.order
Section "Produits": products.view, create, edit, trash, move_to_trash, restore, delete
... etc

Top of page: "Super Admin" toggle — if on, sets permissions={"*":true} and disables all checkboxes.

On save: PUT /api/roles/[id] { name, permissions: Record<string,boolean> }
```

---

## Step 33 — Boutiques CRUD

```
Create `app/dashboard/boutiques/page.tsx`.

API: `app/api/config/boutiques/route.ts` GET+POST
  GET: SELECT b.*, COUNT(DISTINCT ub.user_id) as users_count, COUNT(DISTINCT o.id) as orders_count FROM boutiques b LEFT JOIN user_boutiques ub ON ub.boutique_id=b.id LEFT JOIN orders o ON o.boutique_id=b.id WHERE b.tenant_id=$1 GROUP BY b.id ORDER BY b.name
  POST: INSERT INTO boutiques (id, tenant_id, name, prefix, domain, is_active)
`app/api/config/boutiques/[id]/route.ts` GET+PUT (no hard delete — soft disable)

Table: Nom, Préfixe, Domaine, Utilisateurs (count), Commandes (count), Statut (toggle), Actions

Add/Edit Modal:
  Nom*, Préfixe* (2-6 chars, uppercase auto, used in order references), Domaine (optional URL), Statut toggle
  Show example reference: "ex: CMD0001" using the prefix

Note: When prefix changes, warn user that existing order references are not affected.
```

---

## Step 34 — Navigation wiring (sidebar → pages)

```
Wire up all sidebar nav item clicks to actual Next.js routes.

Update `components/layout/Sidebar.tsx` to use Next.js `useRouter` and `usePathname`.
On click of any child item, instead of just updating state, navigate to the correct route.

Add `href` field to each NavChild in the sidebar NAV array:

Commandes:
  Nouvelle commande → /dashboard/orders/new
  Import Google Sheet → /dashboard/orders/import/google-sheet
  Archives Encaissées → /dashboard/orders/archives/encaissees
  Archives Retournées → /dashboard/orders/archives/retournees
  Archives Annulées → /dashboard/orders/archives/annulees
  Corbeille → /dashboard/orders/corbeille
  Bon d'encaissement → /dashboard/orders/bons/encaissement
  Bon de retour → /dashboard/orders/bons/retour
  En collecte → /dashboard/orders/pickups/en-collecte
  Collecté → /dashboard/orders/pickups/collecte
  Reçus → /dashboard/orders/pickups/recus
  Traités → /dashboard/orders/pickups/traites
  Annulés → /dashboard/orders/pickups/annules

Clients: /dashboard/clients, /dashboard/clients (with modal open), /dashboard/clients/import
Produits: /dashboard/products, /dashboard/products/new, /dashboard/products/import, /dashboard/products/options
Gestion de stock: /dashboard/stock/ajustement, /dashboard/stock/mouvements, /dashboard/stock/lots, /dashboard/stock/alertes, /dashboard/stock/inventaire, /dashboard/stock/mega-inventaire
Marques: /dashboard/marques
Fournisseurs: /dashboard/fournisseurs
Livraison: /dashboard/livraison/livreurs
Statistiques: /dashboard/stats/boutique, /dashboard/stats/produit, /dashboard/stats/confirmateur, /dashboard/stats/livreur, /dashboard/stats/wilaya
Comptabilité: /dashboard/comptabilite/bilan, /dashboard/comptabilite/rentabilite, /dashboard/comptabilite/depenses
Données: /dashboard/donnees/export, /dashboard/donnees/rapports
Webhooks: /dashboard/webhooks, /dashboard/webhooks (modal open), /dashboard/webhooks/logs
Modérateurs: /dashboard/moderateurs/utilisateurs, /dashboard/moderateurs/roles
Boutiques: /dashboard/boutiques
Configuration: /dashboard/config/statuts, /dashboard/config/sources, /dashboard/config/livraison, /dashboard/config/clients, /dashboard/config/abonnement, /dashboard/config/avance

Use usePathname to highlight the active item based on current URL (not just state).
Auto-expand the parent section if current pathname matches any child href.

Also update the StatusBar in dashboard to make the status tabs clickable:
  En confirmation → /dashboard/orders/en-confirmation
  En préparation → /dashboard/orders/en-preparation
  En dispatch → /dashboard/orders/en-dispatch
  En livraison → /dashboard/orders/en-livraison
  Livrées → /dashboard/orders/livrees
  En retour → /dashboard/orders/en-retour
```

---

## Step 35 — Dashboard layout extraction

```
Extract the dashboard shell (Topbar + Sidebar + StatusBar) into a proper layout so it's shared across all pages without duplicating.

Create `app/dashboard/layout.tsx` as a client component:
  - Import and render: Topbar, Sidebar, StatusBar
  - Wrap in BoutiqueProvider (from Step 2)
  - Auth check (localStorage token) with redirect to /login
  - The children (page content) renders in the main content area

Create `components/layout/Topbar.tsx` — extract from dashboard page
Create `components/layout/StatusBar.tsx` — extract from dashboard page, accept orderCounts as prop fetched from /api/dashboard/stats

The layout uses flex-column min-h-screen:
  Topbar (fixed height 46px)
  StatusBar (fixed height 38px)  
  Body (flex-row, flex-1):
    Sidebar (220px fixed)
    main (flex-1, overflow-y-auto, bg #FFF7F2, padding 16px)

After this step, all dashboard pages only render their own content — the shell is inherited from layout.tsx.
Remove the topbar/sidebar/statusbar JSX from `app/dashboard/page.tsx` (it's now in the layout).
```

---

## Step 36 — Données : Export + Rapports

```
Create two pages:

**Export: `app/dashboard/donnees/export/page.tsx`**
A form-based export generator.

Fields:
  Type de données (select): Commandes / Clients / Produits / Stock / Bilan
  Boutique (select), Statut (multi-select for orders), Date De/À
  Format (radio): Excel (.xlsx) / CSV

Button "Générer l'export" → POST /api/donnees/export { type, boutique_id, filters, format }

API: `app/api/donnees/export/route.ts` POST
Uses xlsx package to generate file in memory. Returns as binary download (Content-Disposition: attachment).
For orders: SELECT all fields from v_order_facts WHERE boutique_id=$1 AND tracking_status IN (...) AND created_at BETWEEN...
For clients: SELECT * FROM clients WHERE tenant_id=$1
etc.

**Rapports: `app/dashboard/donnees/rapports/page.tsx`**
A simple placeholder page for now with 4 report cards:
- Rapport des commandes (link to stats/boutique)
- Rapport des produits (link to stats/produit) 
- Rapport des livreurs (link to stats/livreur)
- Rapport des confirmateurs (link to stats/confirmateur)
Each card: icon, title, description, Button "Voir le rapport"
```

---

## Step 37 — Sources d'import (Config)

```
Create `app/dashboard/config/sources/page.tsx`.

API: `app/api/config/sources/route.ts` GET+POST
  SELECT is.*, b.name as boutique_name FROM import_sources is JOIN boutiques b ON b.id=is.boutique_id WHERE b.tenant_id=$1 ORDER BY is.created_at DESC
  POST: INSERT INTO import_sources (id, boutique_id, type, name, sheet_id, sheet_name, separator, column_mapping, is_active)
`app/api/config/sources/[id]/route.ts` PUT+DELETE

Table: Nom, Type (Badge: google_sheet/shopify/furulue/api), Boutique, Dernière sync, Actif, Actions (tester, modifier, supprimer, sync maintenant)

Add/Edit Modal (type-specific fields):
  Google Sheet: Nom, Boutique, Google Sheet ID (from URL), Nom de la feuille, Séparateur produits
  Then: column_mapping JSON editor (map fields to column letters/names)
  Shopify: Nom, Boutique, Webhook URL (generated), API key
  API: Nom, Boutique, API token (generated UUID, copy button)

"Sync maintenant" → POST /api/config/sources/[id]/sync → triggers import run, creates import_run record, returns run_id
Show last import_run status in table: rows_total, rows_imported, rows_failed, status badge.
```

---

## Step 38 — Notifications + 2FA (polish)

```
Add two finishing features:

**1. Notifications bell (Topbar)**
Update Topbar to show notification count badge on the bell icon.
API: `app/api/notifications/route.ts` GET
  SELECT * FROM notifications WHERE user_id=$1 AND is_read=false ORDER BY created_at DESC LIMIT 10
Topbar: bell icon shows red badge with count. Click → dropdown panel showing notification list.
Each notification: title, body, time ago. Click → mark as read (PATCH /api/notifications/[id] { is_read: true }).
"Tout marquer comme lu" button → PATCH /api/notifications/bulk { is_read: true }

**2. Profile + 2FA page at `app/dashboard/profile/page.tsx`**
Accessible from user chip click menu (add dropdown: "Mon profil" + "Se déconnecter").
Profile page:
  Section 1: Informations — Nom, Email (read-only), save button
  Section 2: Changer le mot de passe — Ancien mot de passe, Nouveau, Confirmer
  Section 3: Double authentification (2FA) — toggle On/Off
    If enabling: show TOTP QR code (use speakeasy package + qrcode package)
    User enters the 6-digit code to confirm activation
    Store TOTP secret in users table (add column or use existing two_fa_enabled)
    
APIs: PUT /api/auth/profile { name }, PUT /api/auth/password { old, new }, POST/DELETE /api/auth/2fa
```

---

## Step 39 — Final polish & production-ready

```
Final round of improvements before deployment:

**1. Error handling & toasts**
Create `components/ui/Toast.tsx` — a toast notification system (success/error/warning).
Use a React context `contexts/ToastContext.tsx` with useToast() hook.
Add to dashboard layout. All API calls across the app use toast on success/error.
Show toast on: order status changes, CRUD operations, imports completed, etc.

**2. Loading skeletons**
Create `components/ui/Skeleton.tsx` — animated gray placeholder.
Apply to: Table rows while loading, stat numbers in dashboard, order counts in StatusBar.

**3. Empty states**
Each table page: when data=[] show a centered empty state illustration (simple SVG or icon) + message + action button.
Example: Clients page empty → Users icon + "Aucun client trouvé" + "Ajouter le premier client" button.

**4. Responsive layout**
The sidebar should collapse to an icon-only version on medium screens (< 1200px).
Add a hamburger button in Topbar that toggles sidebar on mobile.
Add to globals.css: @media (max-width: 1199px) responsive rules.

**5. Auth token refresh**
JWT expires in 7 days. Add to every API call: if response is 401, clear localStorage and redirect to /login.
Create `lib/api-client.ts` — a fetch wrapper that adds Authorization header and handles 401.

**6. Vercel environment variables**
Create `.env.example` with all required vars:
  NEXT_PUBLIC_SUPABASE_URL=
  SUPABASE_SERVICE_ROLE_KEY=
  JWT_SECRET=
  NEXT_PUBLIC_APP_URL=
Update README.md with deployment steps for Vercel.
```

---

## Quick reference: Files created per step

| Step | Pages | API Routes |
|------|-------|------------|
| 1 | `components/ui/*` (10 files) | — |
| 2 | Topbar boutique selector | `/api/boutiques` |
| 3 | Dashboard real data | `/api/dashboard/stats` |
| 4 | Clients list | `/api/clients` |
| 5 | Client edit/delete | `/api/clients/[id]`, `/api/wilayas`, `/api/communes` |
| 6 | Clients import | `/api/clients/import` |
| 7 | Produits list | `/api/products` |
| 8 | Produit form | `/api/products/[id]`, `/api/brands` |
| 9 | Variants & options | `/api/option-types`, `/api/option-types/[id]` |
| 10 | Nouvelle commande | `/api/orders` POST |
| 11 | En confirmation | `/api/orders` GET, `/api/orders/bulk` |
| 12 | Order detail panel | `/api/orders/[id]` |
| 13 | En préparation | `/api/carriers` |
| 14 | En dispatch | — |
| 15 | En livraison | `/api/delivery-statuses` |
| 16 | Livrées + En retour | `/api/receipts` |
| 17 | Archives + Corbeille | — |
| 18 | Bons | `/api/receipts/bulk-confirm` |
| 19 | Pickups | `/api/pickups`, `/api/pickups/[id]` |
| 20 | Import Google Sheet | `/api/orders/import/google-sheet`, OAuth |
| 21 | Ajustement stock | `/api/stock/adjust`, `/api/warehouses` |
| 22 | Mouvements/Lots/Alertes | `/api/stock/movements`, `/api/stock/batches` |
| 23 | Inventaire | `/api/inventory/sessions`, `/api/inventory/items/[id]` |
| 24 | Marques + Fournisseurs | `/api/brands`, `/api/suppliers` |
| 25 | Livreurs | `/api/carriers` extended |
| 26 | Stats 5 rapports | `/api/stats` |
| 27 | Bilan général | `/api/comptabilite/bilan` |
| 28 | Rentabilité + Dépenses | `/api/comptabilite/rentabilite`, `/api/expenses` |
| 29 | Statuts config | `/api/config/delivery-statuses` |
| 30 | Webhooks | `/api/webhooks`, `/api/webhooks/[id]/logs` |
| 31 | Utilisateurs | `/api/users`, `/api/users/[id]` |
| 32 | Rôles & RBAC | `/api/roles`, `/api/roles/[id]` |
| 33 | Boutiques config | `/api/config/boutiques` |
| 34 | Navigation wiring | — |
| 35 | Layout extraction | — |
| 36 | Export + Rapports | `/api/donnees/export` |
| 37 | Sources d'import | `/api/config/sources` |
| 38 | Notifications + 2FA | `/api/notifications`, `/api/auth/2fa` |
| 39 | Polish + prod | `lib/api-client.ts` |

---

> **Total: 39 steps · ~48 features · 5 phases**
> Start with Step 1 and paste each prompt when the previous step is complete.
