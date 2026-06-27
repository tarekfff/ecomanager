'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock, ArrowRight, Eye, EyeOff, ShoppingBag, TrendingUp, Package, Users } from 'lucide-react'
import { isLoggedIn } from '@/lib/client-auth'

const PRIMARY   = '#BF4C98'
const PRIMARY_DK = '#A03A80'
const BG        = '#FFF7F2'

export default function LoginPage() {
  const router = useRouter()
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [remember,     setRemember]     = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [emailFocus,   setEmailFocus]   = useState(false)
  const [passFocus,    setPassFocus]    = useState(false)
  const [checking,     setChecking]     = useState(true)

  // Already logged in with a valid (non-expired) token? Skip straight to the
  // dashboard so reopening the site doesn't force a re-login.
  useEffect(() => {
    if (isLoggedIn()) {
      router.replace('/dashboard')
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount session check
      setChecking(false)
    }
  }, [router])

  async function handleLogin() {
    if (!email || !password) { setError('Veuillez remplir tous les champs'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur de connexion'); return }
      localStorage.setItem('token', data.token)
      router.push('/dashboard')
    } catch {
      setError('Impossible de se connecter au serveur')
    } finally {
      setLoading(false)
    }
  }

  if (checking) return null   // avoid flashing the form while checking the session

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: "'Inter', sans-serif",
      background: '#fff',
    }}>

      {/* ── Left brand panel ─────────────────────────────────── */}
      <div style={{
        width: '44%',
        background: `linear-gradient(150deg, ${PRIMARY} 0%, #8B1E6B 55%, #4E0E3C 100%)`,
        display: 'flex',
        flexDirection: 'column',
        padding: '44px 48px',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* decorative blobs */}
        <div style={{
          position: 'absolute', top: -100, right: -100,
          width: 320, height: 320, borderRadius: '50%',
          background: 'rgba(255,255,255,0.07)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -140, left: -80,
          width: 420, height: 420, borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '40%', right: -60,
          width: 180, height: 180, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <div style={{
            width: 40, height: 40,
            background: 'rgba(255,255,255,0.18)',
            borderRadius: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.25)',
            backdropFilter: 'blur(8px)',
          }}>
            <ShoppingBag size={21} color="#fff" strokeWidth={1.8} />
          </div>
          <span style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.8px' }}>
            chic<span style={{ color: 'rgba(255,220,245,0.9)' }}>N</span>
          </span>
        </div>

        {/* Hero text */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 20, padding: '4px 12px',
            fontSize: 11.5, color: 'rgba(255,255,255,0.85)',
            marginBottom: 20, alignSelf: 'flex-start',
            letterSpacing: '0.3px', fontWeight: 500,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#7DFFD4', flexShrink: 0,
            }} />
            Plateforme COD · Algérie
          </div>

          <h1 style={{
            fontSize: 30, fontWeight: 800, color: '#fff',
            lineHeight: 1.22, marginBottom: 16,
            letterSpacing: '-0.5px',
          }}>
            Gérez votre e-commerce<br />
            avec intelligence
          </h1>
          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.68)',
            lineHeight: 1.65, maxWidth: 310,
          }}>
            Commandes, produits, livraison et statistiques — tout ce dont vous avez besoin pour vendre en Algérie.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 30 }}>
            {[
              { icon: TrendingUp, label: 'Statistiques avancées' },
              { icon: Package,    label: 'Gestion de stock' },
              { icon: Users,      label: 'Multi-boutique' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 20, padding: '6px 14px',
                fontSize: 12.5, color: 'rgba(255,255,255,0.88)',
                border: '1px solid rgba(255,255,255,0.15)',
                backdropFilter: 'blur(4px)',
              }}>
                <Icon size={13} strokeWidth={1.8} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', position: 'relative' }}>
          © 2026 chicN · V2.41 · Développé par Tarek Benziada
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 48px',
        background: BG,
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Brand mark (shown on the form side too) */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 44,
          }}>
            <div style={{
              width: 34, height: 34,
              background: PRIMARY,
              borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 14px ${PRIMARY}44`,
            }}>
              <ShoppingBag size={17} color="#fff" strokeWidth={1.8} />
            </div>
            <span style={{
              fontSize: 21, fontWeight: 800, color: '#2D2D2D', letterSpacing: '-0.5px',
            }}>
              chic<span style={{ color: PRIMARY }}>N</span>
            </span>
          </div>

          <h2 style={{
            fontSize: 27, fontWeight: 800, color: '#1A1A1A',
            marginBottom: 6, letterSpacing: '-0.4px',
          }}>
            Connexion
          </h2>
          <p style={{ fontSize: 13.5, color: '#999', marginBottom: 30, lineHeight: 1.5 }}>
            Bienvenue ! Entrez vos identifiants pour accéder au dashboard.
          </p>

          {/* Email field */}
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block', fontSize: 13, fontWeight: 600,
              color: '#444', marginBottom: 7,
            }}>
              Adresse email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} strokeWidth={1.8} style={{
                position: 'absolute', left: 13, top: '50%',
                transform: 'translateY(-50%)',
                color: emailFocus ? PRIMARY : '#bbb',
                transition: 'color .2s',
                pointerEvents: 'none',
              }} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                onFocus={() => setEmailFocus(true)}
                onBlur={() => setEmailFocus(false)}
                placeholder="exemple@email.com"
                autoComplete="email"
                style={{
                  width: '100%',
                  paddingLeft: 40, paddingRight: 14,
                  paddingTop: 11, paddingBottom: 11,
                  border: `1.5px solid ${emailFocus ? PRIMARY : '#E2D8E2'}`,
                  borderRadius: 9, fontSize: 13.5,
                  fontFamily: "'Inter', sans-serif",
                  color: '#1A1A1A', outline: 'none',
                  transition: 'border-color .2s, box-shadow .2s',
                  background: '#fff',
                  boxShadow: emailFocus ? `0 0 0 3px ${PRIMARY}18` : 'none',
                }}
              />
            </div>
          </div>

          {/* Password field */}
          <div style={{ marginBottom: 8 }}>
            <label style={{
              display: 'block', fontSize: 13, fontWeight: 600,
              color: '#444', marginBottom: 7,
            }}>
              Mot de passe
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} strokeWidth={1.8} style={{
                position: 'absolute', left: 13, top: '50%',
                transform: 'translateY(-50%)',
                color: passFocus ? PRIMARY : '#bbb',
                transition: 'color .2s',
                pointerEvents: 'none',
              }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                onFocus={() => setPassFocus(true)}
                onBlur={() => setPassFocus(false)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  width: '100%',
                  paddingLeft: 40, paddingRight: 44,
                  paddingTop: 11, paddingBottom: 11,
                  border: `1.5px solid ${passFocus ? PRIMARY : '#E2D8E2'}`,
                  borderRadius: 9, fontSize: 13.5,
                  fontFamily: "'Inter', sans-serif",
                  color: '#1A1A1A', outline: 'none',
                  transition: 'border-color .2s, box-shadow .2s',
                  background: '#fff',
                  boxShadow: passFocus ? `0 0 0 3px ${PRIMARY}18` : 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  cursor: 'pointer', color: '#bbb', padding: 2,
                  display: 'flex', alignItems: 'center',
                }}
              >
                {showPassword
                  ? <EyeOff size={15} strokeWidth={1.8} />
                  : <Eye    size={15} strokeWidth={1.8} />
                }
              </button>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              background: '#FFF0F2',
              border: '1px solid #FFCDD2',
              borderRadius: 7,
              padding: '9px 13px',
              fontSize: 12.5, color: '#C62828',
              marginTop: 10,
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <span style={{ fontSize: 14 }}>⚠</span>
              {error}
            </div>
          )}

          {/* Remember + forgot */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginTop: 16, marginBottom: 22,
          }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 7,
              fontSize: 12.5, color: '#666', cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                style={{ accentColor: PRIMARY, width: 14, height: 14 }}
              />
              Se souvenir de moi
            </label>
            <span style={{
              fontSize: 12.5, color: PRIMARY,
              cursor: 'pointer', fontWeight: 600,
            }}>
              Mot de passe oublié ?
            </span>
          </div>

          {/* Submit button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#D4A8C8' : PRIMARY,
              color: '#fff',
              border: 'none',
              borderRadius: 9,
              padding: '12px 20px',
              fontSize: 14, fontWeight: 700,
              fontFamily: "'Inter', sans-serif",
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
              boxShadow: loading ? 'none' : `0 4px 18px ${PRIMARY}40`,
              transition: 'background .15s, box-shadow .15s, transform .1s',
              letterSpacing: '0.1px',
            }}
            onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.background = PRIMARY_DK; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 22px ${PRIMARY}55` } }}
            onMouseLeave={e => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.background = PRIMARY; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 18px ${PRIMARY}40` } }}
            onMouseDown={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)' }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
          >
            {loading
              ? 'Connexion en cours…'
              : <><span>Se connecter</span><ArrowRight size={16} strokeWidth={2.2} /></>
            }
          </button>

          <div style={{ textAlign: 'center', marginTop: 28, fontSize: 12, color: '#bbb' }}>
            © 2026 chicN — Tous droits réservés
          </div>
        </div>
      </div>
    </div>
  )
}
