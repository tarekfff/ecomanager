import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import frCommon    from '@/locales/fr/common.json'
import frLayout    from '@/locales/fr/layout.json'
import frStatuses  from '@/locales/fr/statuses.json'
import frClients   from '@/locales/fr/clients.json'
import frDashboard from '@/locales/fr/dashboard.json'
import frOrders    from '@/locales/fr/orders.json'
import frProducts  from '@/locales/fr/products.json'
import frStock     from '@/locales/fr/stock.json'
import frStats     from '@/locales/fr/stats.json'
import frConfig    from '@/locales/fr/config.json'
import frAccounting from '@/locales/fr/accounting.json'
import frBrands    from '@/locales/fr/brands.json'
import frSuppliers from '@/locales/fr/suppliers.json'
import frCarriers  from '@/locales/fr/carriers.json'
import frBoutiques from '@/locales/fr/boutiques.json'
import frWebhooks  from '@/locales/fr/webhooks.json'

import enCommon    from '@/locales/en/common.json'
import enLayout    from '@/locales/en/layout.json'
import enStatuses  from '@/locales/en/statuses.json'
import enClients   from '@/locales/en/clients.json'
import enDashboard from '@/locales/en/dashboard.json'
import enOrders    from '@/locales/en/orders.json'
import enProducts  from '@/locales/en/products.json'
import enStock     from '@/locales/en/stock.json'
import enStats     from '@/locales/en/stats.json'
import enConfig    from '@/locales/en/config.json'
import enAccounting from '@/locales/en/accounting.json'
import enBrands    from '@/locales/en/brands.json'
import enSuppliers from '@/locales/en/suppliers.json'
import enCarriers  from '@/locales/en/carriers.json'
import enBoutiques from '@/locales/en/boutiques.json'
import enWebhooks  from '@/locales/en/webhooks.json'

import arCommon    from '@/locales/ar/common.json'
import arLayout    from '@/locales/ar/layout.json'
import arStatuses  from '@/locales/ar/statuses.json'
import arClients   from '@/locales/ar/clients.json'
import arDashboard from '@/locales/ar/dashboard.json'
import arOrders    from '@/locales/ar/orders.json'
import arProducts  from '@/locales/ar/products.json'
import arStock     from '@/locales/ar/stock.json'
import arStats     from '@/locales/ar/stats.json'
import arConfig    from '@/locales/ar/config.json'
import arAccounting from '@/locales/ar/accounting.json'
import arBrands    from '@/locales/ar/brands.json'
import arSuppliers from '@/locales/ar/suppliers.json'
import arCarriers  from '@/locales/ar/carriers.json'
import arBoutiques from '@/locales/ar/boutiques.json'
import arWebhooks  from '@/locales/ar/webhooks.json'

export const LANGS = ['fr', 'en', 'ar'] as const
export type Lang = (typeof LANGS)[number]

export const LANG_LABELS: Record<Lang, string> = {
  fr: 'Français',
  en: 'English',
  ar: 'العربية',
}

const RTL_LANGS: Lang[] = ['ar']
export function isRtl(lang: string): boolean {
  return RTL_LANGS.includes(lang as Lang)
}

export function isLang(value: unknown): value is Lang {
  return value === 'fr' || value === 'en' || value === 'ar'
}

const resources = {
  fr: { common: frCommon, layout: frLayout, statuses: frStatuses, clients: frClients, dashboard: frDashboard, orders: frOrders, products: frProducts, stock: frStock, stats: frStats, config: frConfig, accounting: frAccounting, brands: frBrands, suppliers: frSuppliers, carriers: frCarriers, boutiques: frBoutiques, webhooks: frWebhooks },
  en: { common: enCommon, layout: enLayout, statuses: enStatuses, clients: enClients, dashboard: enDashboard, orders: enOrders, products: enProducts, stock: enStock, stats: enStats, config: enConfig, accounting: enAccounting, brands: enBrands, suppliers: enSuppliers, carriers: enCarriers, boutiques: enBoutiques, webhooks: enWebhooks },
  ar: { common: arCommon, layout: arLayout, statuses: arStatuses, clients: arClients, dashboard: arDashboard, orders: arOrders, products: arProducts, stock: arStock, stats: arStats, config: arConfig, accounting: arAccounting, brands: arBrands, suppliers: arSuppliers, carriers: arCarriers, boutiques: arBoutiques, webhooks: arWebhooks },
}

// Initialise once. We always boot in French so the server-rendered markup and
// the first client render match; LanguageProvider switches to the saved
// language inside an effect after mount (same pattern as BoutiqueContext).
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: 'fr',
    fallbackLng: 'fr',
    supportedLngs: LANGS as unknown as string[],
    ns: ['common', 'layout', 'statuses', 'clients', 'dashboard', 'orders', 'products', 'stock', 'stats', 'config', 'accounting', 'brands', 'suppliers', 'carriers', 'boutiques', 'webhooks'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
}

export default i18n
