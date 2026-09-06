import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Send, KeyRound, CheckCircle2, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { passwordResetRequest, passwordResetConfirm } from '../api/users'
import { useDocumentMeta } from '../hooks/useDocumentMeta'

const inputStyle = (hasErr) => ({
  width: '100%', padding: '13px 16px', borderRadius: 12, boxSizing: 'border-box',
  background: 'var(--bg)',
  border: `1px solid ${hasErr ? 'rgba(239,68,68,0.5)' : 'var(--border)'}`,
  color: 'var(--text)', fontSize: 15, outline: 'none', transition: 'border-color 0.2s',
})

function PasswordInput({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={autoComplete}
        style={{ ...inputStyle(false), paddingRight: 44 }}
        onFocus={e => e.target.style.borderColor = '#14B8A8'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />
      <button type="button" onClick={() => setShow(s => !s)}
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

export default function ForgotPassword() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  useDocumentMeta(t('meta.forgot_title'), t('meta.forgot_description'))

  const [step, setStep]               = useState(1)
  const [username, setUsername]       = useState('')
  const [code, setCode]               = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)

  const handleRequestOTP = async e => {
    if (e?.preventDefault) e.preventDefault()
    if (!username.trim()) { setError(t('auth.err_username_required')); return }
    setLoading(true)
    setError('')
    try {
      await passwordResetRequest({ username: username.trim() })
      setStep(2)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail === 'no_telegram') {
        setError(err.response.data.message)
      } else {
        setError(detail || t('common.fail_load'))
      }
    } finally { setLoading(false) }
  }

  const handleConfirm = async e => {
    e.preventDefault()
    if (!code.trim())           { setError(t('auth.otp_code') + ' required'); return }
    if (!newPassword)           { setError(t('auth.err_password_required')); return }
    if (newPassword.length < 6) { setError(t('auth.err_password_len')); return }
    if (newPassword !== confirmPw) { setError(t('auth.err_confirm_match')); return }
    setLoading(true)
    setError('')
    try {
      await passwordResetConfirm({ username, code: code.trim(), new_password: newPassword })
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.detail || t('auth.err_invalid'))
    } finally { setLoading(false) }
  }

  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.1em', marginBottom: 6,
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(20,184,168,0.06) 0%, rgba(20,184,168,0.02) 100%), var(--bg)',
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px'
    }}>
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 600, height: 350, background: 'radial-gradient(ellipse, rgba(20,184,168,0.1) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}
      >
        {step < 3 && (
          <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0D9488', fontWeight: 600, textDecoration: 'none', marginBottom: 20 }}>
            <ArrowLeft size={14} /> {t('auth.back_to_login')}
          </Link>
        )}

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg, #14B8A8, #0D9488)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            boxShadow: '0 8px 32px rgba(20,184,168,0.35)'
          }}>
            {step === 3 ? <CheckCircle2 size={28} color="#fff" /> : <KeyRound size={28} color="#fff" />}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
            {step === 1 && t('auth.forgot_title')}
            {step === 2 && t('auth.otp_title')}
            {step === 3 && t('auth.reset_done_title')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {step === 1 && t('auth.forgot_subtitle')}
            {step === 2 && t('auth.otp_subtitle', { username })}
            {step === 3 && t('auth.reset_done_subtitle')}
          </p>
        </div>

        <div style={{
          borderRadius: 24, border: '1px solid var(--border)',
          background: 'var(--surface)', backdropFilter: 'blur(12px)',
          padding: 32, boxShadow: '0 24px 80px rgba(0,0,0,0.08)'
        }}>
          <AnimatePresence mode="wait">

            {/* Step 1 */}
            {step === 1 && (
              <motion.form key="s1" onSubmit={handleRequestOTP}
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {error && <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontSize: 13 }}>{error}</div>}
                <div>
                  <label style={labelStyle}>{t('auth.username')}</label>
                  <input value={username} onChange={e => { setUsername(e.target.value); setError('') }}
                    placeholder="johndoe" autoFocus autoComplete="username"
                    style={inputStyle(false)}
                    onFocus={e => e.target.style.borderColor = '#14B8A8'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                </div>
                <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', fontWeight: 800, color: '#fff', fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg, #14B8A8, #0D9488)', boxShadow: '0 8px 24px rgba(20,184,168,0.3)', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> {t('auth.sending')}</> : <><Send size={16} /> {t('auth.send_otp')}</>}
                </motion.button>
              </motion.form>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <motion.form key="s2" onSubmit={handleConfirm}
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {error && <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontSize: 13 }}>{error}</div>}
                <div>
                  <label style={labelStyle}>{t('auth.otp_code')}</label>
                  <input value={code} onChange={e => { setCode(e.target.value); setError('') }}
                    placeholder="123456" autoFocus maxLength={6}
                    style={{ ...inputStyle(false), letterSpacing: '0.3em', fontWeight: 700, fontSize: 20, textAlign: 'center' }}
                    onFocus={e => e.target.style.borderColor = '#14B8A8'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                </div>
                <div>
                  <label style={labelStyle}>{t('auth.new_password')}</label>
                  <PasswordInput value={newPassword} onChange={e => { setNewPassword(e.target.value); setError('') }} placeholder={t('auth.pw_min_6')} autoComplete="new-password" />
                </div>
                <div>
                  <label style={labelStyle}>{t('auth.confirm_password_label')}</label>
                  <PasswordInput value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setError('') }} placeholder={t('auth.pw_repeat')} autoComplete="new-password" />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => { setStep(1); setError('') }}
                    style={{ padding: '14px 18px', borderRadius: 14, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                    {t('not_found.go_back')}
                  </button>
                  <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    style={{ flex: 1, padding: '14px 0', borderRadius: 14, border: 'none', fontWeight: 800, color: '#fff', fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg, #14B8A8, #0D9488)', boxShadow: '0 8px 24px rgba(20,184,168,0.3)', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {loading ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> {t('auth.resetting')}</> : t('auth.reset_password')}
                  </motion.button>
                </div>
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {t('auth.didnt_receive')}{' '}
                  <button type="button" onClick={() => handleRequestOTP({})}
                    style={{ background: 'none', border: 'none', color: '#14B8A8', fontWeight: 600, cursor: 'pointer', fontSize: 12, padding: 0 }}>
                    {t('auth.resend')}
                  </button>
                </p>
              </motion.form>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '8px 0' }}>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>{t('auth.reset_done_body')}</p>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => navigate('/login')}
                  style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', fontWeight: 800, color: '#fff', fontSize: 15, cursor: 'pointer', background: 'linear-gradient(135deg, #14B8A8, #0D9488)', boxShadow: '0 8px 24px rgba(20,184,168,0.3)' }}>
                  {t('auth.go_to_login')}
                </motion.button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
