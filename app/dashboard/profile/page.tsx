'use client'

import { useEffect, useState, ReactNode } from 'react'
import { User, Lock, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react'
import { PageHeader, Button, Input } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'
import { getStoredToken } from '@/lib/client-auth'

type Msg = { kind: 'ok' | 'err'; text: string } | null

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getStoredToken()}`,
    'Content-Type': 'application/json',
  }
}

function Section({ icon, title, desc, children }: {
  icon: ReactNode; title: string; desc?: string; children: ReactNode
}) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${colors.border}`,
      borderRadius: 10,
      padding: 20,
      maxWidth: 560,
      fontFamily: fonts.sans,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: desc ? 4 : 16 }}>
        <span style={{
          width: 30, height: 30, borderRadius: 7,
          background: colors.primaryLt, color: colors.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{icon}</span>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: colors.text, margin: 0 }}>{title}</h2>
      </div>
      {desc && <p style={{ fontSize: 12, color: colors.textMd, margin: '0 0 16px 40px' }}>{desc}</p>}
      {children}
    </div>
  )
}

function Banner({ msg }: { msg: Msg }) {
  if (!msg) return null
  const ok = msg.kind === 'ok'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      background: ok ? '#eafaf0' : '#fdf0f2',
      border: `1px solid ${ok ? '#bfe8cf' : '#f4c7ce'}`,
      color: ok ? colors.green : colors.red,
      borderRadius: 6, padding: '8px 11px', fontSize: 12.5, marginBottom: 14,
      fontFamily: fonts.sans,
    }}>
      {ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
      {msg.text}
    </div>
  )
}

export default function ProfilePage() {
  const [email, setEmail] = useState('')
  const [name,  setName]  = useState('')
  const [twoFaEnabled, setTwoFaEnabled] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Section 1
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<Msg>(null)

  // Section 2
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<Msg>(null)

  // Section 3
  const [twoFaMsg, setTwoFaMsg] = useState<Msg>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [twoFaBusy, setTwoFaBusy] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { user?: { name?: string; email?: string; two_fa_enabled?: boolean } }) => {
        setName(d.user?.name ?? '')
        setEmail(d.user?.email ?? '')
        setTwoFaEnabled(!!d.user?.two_fa_enabled)
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  async function saveProfile() {
    setProfileMsg(null)
    if (!name.trim()) { setProfileMsg({ kind: 'err', text: 'Le nom est requis' }); return }
    setSavingProfile(true)
    try {
      const r = await fetch('/api/auth/profile', {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ name: name.trim() }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erreur')
      setProfileMsg({ kind: 'ok', text: 'Profil mis à jour' })
    } catch (e) {
      setProfileMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword() {
    setPwdMsg(null)
    if (!oldPwd || !newPwd) { setPwdMsg({ kind: 'err', text: 'Tous les champs sont requis' }); return }
    if (newPwd.length < 6)  { setPwdMsg({ kind: 'err', text: 'Le nouveau mot de passe doit contenir au moins 6 caractères' }); return }
    if (newPwd !== confirmPwd) { setPwdMsg({ kind: 'err', text: 'Les mots de passe ne correspondent pas' }); return }
    setSavingPwd(true)
    try {
      const r = await fetch('/api/auth/password', {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ old: oldPwd, new: newPwd }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erreur')
      setPwdMsg({ kind: 'ok', text: 'Mot de passe modifié' })
      setOldPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch (e) {
      setPwdMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setSavingPwd(false)
    }
  }

  async function startEnable2fa() {
    setTwoFaMsg(null); setTwoFaBusy(true)
    try {
      const r = await fetch('/api/auth/2fa', { method: 'POST', headers: authHeaders(), body: '{}' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erreur')
      setQr(d.qr)
    } catch (e) {
      setTwoFaMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setTwoFaBusy(false)
    }
  }

  async function confirm2fa() {
    setTwoFaMsg(null)
    if (code.trim().length !== 6) { setTwoFaMsg({ kind: 'err', text: 'Entrez le code à 6 chiffres' }); return }
    setTwoFaBusy(true)
    try {
      const r = await fetch('/api/auth/2fa', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ code: code.trim() }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Code invalide')
      setTwoFaEnabled(true); setQr(null); setCode('')
      setTwoFaMsg({ kind: 'ok', text: 'Double authentification activée' })
    } catch (e) {
      setTwoFaMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setTwoFaBusy(false)
    }
  }

  async function disable2fa() {
    setTwoFaMsg(null); setTwoFaBusy(true)
    try {
      const r = await fetch('/api/auth/2fa', { method: 'DELETE', headers: authHeaders() })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erreur')
      setTwoFaEnabled(false); setQr(null); setCode('')
      setTwoFaMsg({ kind: 'ok', text: 'Double authentification désactivée' })
    } catch (e) {
      setTwoFaMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setTwoFaBusy(false)
    }
  }

  if (!loaded) return null

  return (
    <div>
      <PageHeader title="Mon profil" subtitle="Gérez vos informations personnelles et la sécurité de votre compte" />

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Section 1 — Informations */}
        <Section icon={<User size={16} strokeWidth={2} />} title="Informations">
          <Banner msg={profileMsg} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Nom complet" value={name} onChange={setName} required />
            <div>
              <label style={{ fontSize: 12.5, color: colors.textMd, marginBottom: 4, fontWeight: 500, display: 'block' }}>
                Email
              </label>
              <input
                value={email}
                disabled
                style={{
                  width: '100%', border: `1px solid ${colors.border}`, borderRadius: 4,
                  padding: '7px 10px', fontSize: 13, color: colors.textLt,
                  fontFamily: fonts.sans, background: '#f7f4f7', boxSizing: 'border-box',
                  cursor: 'not-allowed',
                }}
              />
            </div>
            <div>
              <Button onClick={saveProfile} loading={savingProfile}>Enregistrer</Button>
            </div>
          </div>
        </Section>

        {/* Section 2 — Mot de passe */}
        <Section icon={<Lock size={16} strokeWidth={2} />} title="Changer le mot de passe">
          <Banner msg={pwdMsg} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Ancien mot de passe"  value={oldPwd}     onChange={setOldPwd}     type="password" required />
            <Input label="Nouveau mot de passe" value={newPwd}     onChange={setNewPwd}     type="password" required />
            <Input label="Confirmer le mot de passe" value={confirmPwd} onChange={setConfirmPwd} type="password" required />
            <div>
              <Button onClick={savePassword} loading={savingPwd}>Modifier le mot de passe</Button>
            </div>
          </div>
        </Section>

        {/* Section 3 — 2FA */}
        <Section
          icon={<ShieldCheck size={16} strokeWidth={2} />}
          title="Double authentification (2FA)"
          desc="Ajoutez une couche de sécurité avec une application d'authentification (Google Authenticator, Authy…)."
        >
          <Banner msg={twoFaMsg} />

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 9, height: 9, borderRadius: '50%',
                background: twoFaEnabled ? colors.green : colors.textLt,
              }} />
              <span style={{ fontSize: 13, color: colors.text, fontWeight: 500 }}>
                {twoFaEnabled ? 'Activée' : 'Désactivée'}
              </span>
            </div>

            {twoFaEnabled ? (
              <Button variant="danger" onClick={disable2fa} loading={twoFaBusy}>Désactiver</Button>
            ) : !qr ? (
              <Button onClick={startEnable2fa} loading={twoFaBusy}>Activer</Button>
            ) : null}
          </div>

          {/* Enrolment flow */}
          {!twoFaEnabled && qr && (
            <div style={{
              marginTop: 8, paddingTop: 16, borderTop: `1px solid ${colors.border}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            }}>
              <p style={{ fontSize: 12.5, color: colors.textMd, margin: 0, textAlign: 'center', maxWidth: 380 }}>
                Scannez ce QR code avec votre application d&apos;authentification, puis entrez le code à 6 chiffres généré.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code 2FA" width={180} height={180} style={{ border: `1px solid ${colors.border}`, borderRadius: 8 }} />
              <div style={{ width: 200 }}>
                <Input label="Code de vérification" value={code} onChange={v => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="123456" />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={confirm2fa} loading={twoFaBusy}>Confirmer l&apos;activation</Button>
                <Button variant="secondary" onClick={() => { setQr(null); setCode(''); setTwoFaMsg(null) }}>Annuler</Button>
              </div>
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}
