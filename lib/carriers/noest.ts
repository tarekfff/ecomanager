import {
  noestCreateOrder,
  noestValidateOrder,
  noestDeleteOrder,
  noestRequestReturn,
  noestUpdateOrder,
  noestUpdateOrderBeforeExpedition,
  noestPing,
  normalizePhone,
  type NoestCreds,
  type NoestCreatePayload,
  type NoestUpdatePayload,
} from '@/lib/noest'
import type { CarrierAdapter, CarrierCreds, ShipmentInput } from './types'

const DEFAULT_BASE = 'https://app.noest-dz.com'

function toNoestCreds(c: CarrierCreds): NoestCreds {
  return { token: c.token, guid: c.guid, baseUrl: c.baseUrl || DEFAULT_BASE }
}

function toCreatePayload(input: ShipmentInput): NoestCreatePayload {
  return {
    reference: input.reference,
    client:    input.clientName || input.phone,
    phone:     normalizePhone(input.phone),
    phone_2:   input.phone2 ? normalizePhone(input.phone2) : undefined,
    adresse:   input.address?.trim() || input.commune || 'Adresse non renseignée',
    wilaya_id: input.wilayaId || 16,
    commune:   input.commune,
    montant:   input.amount ?? 0,
    remarque:  input.remark || undefined,
    produit:   input.products || 'Produit',
    type_id:   1,
    stop_desk: input.stopDesk ? 1 : 0,
    poids:     input.weightG ? Math.max(1, Math.round(input.weightG / 1000)) : undefined,
  }
}

function toUpdatePayload(input: ShipmentInput, tracking: string): NoestUpdatePayload {
  return {
    tracking,
    client:    input.clientName || undefined,
    reference: input.reference,
    tel:       input.phone ? normalizePhone(input.phone) : undefined,
    tel2:      input.phone2 ? normalizePhone(input.phone2) : undefined,
    adresse:   input.address?.trim() || input.commune || undefined,
    commune:   input.commune || undefined,
    montant:   input.amount ?? undefined,
    remarque:  input.remark || undefined,
    product:   input.products || undefined,
    stop_desk: input.stopDesk ? 1 : 0,
  }
}

export const noestAdapter: CarrierAdapter = {
  provider: 'noest',
  label:    'NOEST Express',
  baseUrl:  DEFAULT_BASE,
  supportsValidate: true,
  credentialFields: [
    { key: 'token', label: 'token',   required: true, placeholder: 'API token' },
    { key: 'guid',  label: 'guid',    required: true, placeholder: 'user_guid' },
  ],

  async createShipment(creds, input) {
    const payload = toCreatePayload(input)
    const res = await noestCreateOrder(payload, toNoestCreds(creds))
    return {
      ok:       !!(res.success && res.tracking),
      tracking: res.tracking ?? null,
      message:  res.success ? undefined : 'NOEST create failed',
      raw:      { request: payload, response: res },
    }
  },

  async validateShipment(creds, tracking) {
    const res = await noestValidateOrder(tracking, toNoestCreds(creds))
    return { ok: !!res.success, tracking, raw: res }
  },

  async updateShipment(creds, tracking, input, beforeExpedition) {
    const payload = toUpdatePayload(input, tracking)
    const res = beforeExpedition
      ? await noestUpdateOrderBeforeExpedition(payload, toNoestCreds(creds))
      : await noestUpdateOrder(payload, toNoestCreds(creds))
    return { ok: !!res.success, tracking, message: res.message, raw: { request: payload, response: res } }
  },

  async cancelShipment(creds, tracking) {
    const res = await noestDeleteOrder(tracking, toNoestCreds(creds))
    return { ok: !!res.success, tracking, raw: res }
  },

  async requestReturn(creds, tracking) {
    const res = await noestRequestReturn(tracking, toNoestCreds(creds))
    return { ok: !!res.success, tracking, raw: res }
  },

  async ping(creds) {
    const res = await noestPing(toNoestCreds(creds))
    return {
      ok:      res.ok,
      message: res.ok
        ? `OK${res.wilayas != null ? ` — ${res.wilayas} wilayas` : ''}`
        : `HTTP ${res.status}${res.body ? ` — ${res.body.slice(0, 120)}` : ''}`,
    }
  },
}
