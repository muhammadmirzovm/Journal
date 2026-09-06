import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Code2, Loader2, ArrowRight } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useDocumentMeta } from '../hooks/useDocumentMeta'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { show } = useToast()
  const { t } = useTranslation()
  useDocumentMeta(t('meta.login_title'), t('meta.login_description'))

  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [form, setForm]         = useState({ username: '', password: '' })
  const [errors, setErrors]     = useState({})

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '', general: '' })) }

  const submit = async e => {
    e.preventDefault()
    const errs = {}
    if (!form.username) errs.username = t('auth.err_username_required')
    if (!form.password) errs.password = t('auth.err_password_required')
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const { data: tokens } = await api.post('/auth/login/', form)
      const { data: user }   = await api.get('/auth/me/', { headers: { Authorization: `Bearer ${tokens.access}` } })
      login(tokens, user)
      show(`${t('auth.welcome_back')}, ${user.first_name || user.username}!`, 'success')
      navigate('/dashboard')
    } catch (err) {
      setErrors({ general: err.response?.data?.detail || t('auth.err_invalid') })
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(20,184,168,0.06) 0%, rgba(20,184,168,0.02) 100%), var(--bg)',
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px'
    }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 600, height: 350, background: 'radial-gradient(ellipse, rgba(20,184,168,0.1) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <motion.div
            animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
            style={{
              display: 'inline-flex', width: 64, height: 64, borderRadius: 18,
              background: 'linear-gradient(135deg, #14B8A8, #0D9488)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 20,
              boxShadow: '0 8px 32px rgba(20,184,168,0.35)'
            }}
          >
            <Code2 size={28} color="#fff" />
          </motion.div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{t('auth.welcome_back')}</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {t('auth.no_account')}{' '}
            <Link to="/register" style={{ color: '#14B8A8', fontWeight: 600, textDecoration: 'none' }}>
              {t('auth.create_one')}
            </Link>
          </p>
        </div>

        {/* Form card */}
        <div style={{
          borderRadius: 24, border: '1px solid var(--border)',
          background: 'var(--surface)', backdropFilter: 'blur(12px)',
          padding: 32, boxShadow: '0 24px 80px rgba(0,0,0,0.4)'
        }}>
          {errors.general && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 14 }}>
              {errors.general}
            </motion.div>
          )}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                {t('auth.username')}
              </label>
              <input
                value={form.username} onChange={e => set('username', e.target.value)}
                placeholder="johndoe" autoComplete="username" autoFocus
                style={{
                  width: '100%', padding: '13px 16px', borderRadius: 12, boxSizing: 'border-box',
                  background: 'var(--bg)',
                  border: `1px solid ${errors.username ? 'rgba(239,68,68,0.5)' : 'var(--border)'}`,
                  color: 'var(--text)', fontSize: 15, outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => !errors.username && (e.target.style.borderColor = '#14B8A8')}
                onBlur={e => !errors.username && (e.target.style.borderColor = 'var(--border)')}
              />
              {errors.username && <p style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>{errors.username}</p>}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                {t('auth.password')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password} onChange={e => set('password', e.target.value)}
                  placeholder={t('auth.your_password')} autoComplete="current-password"
                  style={{
                    width: '100%', padding: '13px 48px 13px 16px', borderRadius: 12, boxSizing: 'border-box',
                    background: 'var(--bg)',
                    border: `1px solid ${errors.password ? 'rgba(239,68,68,0.5)' : 'var(--border)'}`,
                    color: 'var(--text)', fontSize: 15, outline: 'none', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => !errors.password && (e.target.style.borderColor = '#14B8A8')}
                  onBlur={e => !errors.password && (e.target.style.borderColor = 'var(--border)')}
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>{errors.password}</p>}
            </div>

            <motion.button type="submit" disabled={loading}
              whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
              style={{
                width: '100%', padding: '14px 0', marginTop: 8, borderRadius: 14, border: 'none',
                fontWeight: 800, color: '#fff', fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #14B8A8, #0D9488)',
                boxShadow: '0 8px 24px rgba(20,184,168,0.3)',
                opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading
                ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} />{t('auth.signing_in')}</>
                : <>{t('auth.sign_in_btn')} <ArrowRight size={16} /></>
              }
            </motion.button>

            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <Link to="/forgot-password" style={{ fontSize: 13, color: '#14B8A8', fontWeight: 600, textDecoration: 'none' }}>
                {t('auth.forgot_password', 'Forgot password?')}
              </Link>
            </div>
          </form>

        </div>
      </motion.div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}