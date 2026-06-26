'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock, LogIn } from 'lucide-react'

function LoginIllustration() {
  return (
    <svg width="110" height="150" viewBox="0 0 110 150" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="42" cy="130" rx="22" ry="10" fill="#D0D8E8" />
      <rect x="28" y="85" width="28" height="48" rx="4" fill="#4A6FA5" />
      <rect x="30" y="118" width="10" height="22" rx="3" fill="#3A5A8A" />
      <rect x="46" y="118" width="10" height="22" rx="3" fill="#3A5A8A" />
      <rect x="30" y="70" width="24" height="30" rx="3" fill="#E8EEF8" />
      <polygon points="42,72 44,90 42,94 40,90" fill="#BF4C98" />
      <ellipse cx="42" cy="58" rx="16" ry="18" fill="#FDDBB4" />
      <ellipse cx="42" cy="43" rx="16" ry="8" fill="#3A2A1A" />
      <rect x="14" y="72" width="16" height="8" rx="4" fill="#E8EEF8" />
      <rect x="54" y="72" width="16" height="8" rx="4" fill="#E8EEF8" />
      <rect x="76" y="55" width="26" height="22" rx="4" fill="#E84B6A" />
      <rect x="76" y="83" width="26" height="22" rx="4" fill="#00B89C" />
      <rect x="76" y="111" width="26" height="22" rx="4" fill="#F5A623" />
      <line x1="70" y1="66" x2="76" y2="66" stroke="#aaa" strokeWidth="1.5" />
      <line x1="70" y1="94" x2="76" y2="94" stroke="#aaa" strokeWidth="1.5" />
      <line x1="70" y1="122" x2="76" y2="122" stroke="#aaa" strokeWidth="1.5" />
      <line x1="70" y1="66" x2="70" y2="122" stroke="#aaa" strokeWidth="1.5" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erreur de connexion')
        return
      }
      localStorage.setItem('token', data.token)
      router.push('/dashboard')
    } catch {
      setError('Impossible de se connecter au serveur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-card-header">Accès dashboard</div>
        <div className="login-card-body">
          <div className="login-illustration">
            <LoginIllustration />
          </div>
          <div className="login-form">
            <div className="login-logo">
              <span className="e-bracket" />
              COMANAGER
            </div>

            <div className="login-field">
              <label>Adresse Email</label>
              <div style={{ flex: 1, position: 'relative' }}>
                <Mail size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#aaa', pointerEvents: 'none' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  style={{ paddingLeft: 28, width: '100%' }}
                />
              </div>
            </div>

            <div className="login-field">
              <label>Mot de passe</label>
              <div style={{ flex: 1, position: 'relative' }}>
                <Lock size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#aaa', pointerEvents: 'none' }} />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  style={{ paddingLeft: 28, width: '100%' }}
                />
              </div>
            </div>

            {error && (
              <p style={{ color: '#dc3545', fontSize: 12, alignSelf: 'flex-end', marginBottom: 8 }}>
                {error}
              </p>
            )}

            <label className="login-remember" style={{ alignSelf: 'flex-end' }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
              />
              Se souvenir de moi
            </label>

            <div className="login-actions">
              <button className="btn-primary" onClick={handleLogin} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <LogIn size={13} />
                {loading ? 'Connexion…' : 'Se connecter'}
              </button>
              <span className="login-forgot">Mot de passe oublié ?</span>
            </div>
          </div>
        </div>
      </div>

      <div className="login-footer">
        © 2026 - V2.41 - Développé par{' '}
        <a href="#" onClick={e => e.preventDefault()}>Tarek cchaouki Benziada</a>.
      </div>
    </div>
  )
}
