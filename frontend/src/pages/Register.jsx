import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { GraduationCap, Lock, LogIn } from 'lucide-react'
import { useDocumentMeta } from '../hooks/useDocumentMeta'

export default function Register() {
  const { t } = useTranslation()
  useDocumentMeta(t('meta.register_title'), t('meta.register_description'))

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, rgba(20,184,168,0.06) 0%, rgba(20,184,168,0.02) 100%), var(--bg)',
      padding: '24px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 300,
        background: 'radial-gradient(ellipse, rgba(20,184,168,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, textAlign: 'center' }}>

        <div style={{
          display: 'inline-flex', width: 72, height: 72, borderRadius: 20,
          background: 'linear-gradient(135deg, #14B8A8, #0D9488)',
          alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          boxShadow: '0 8px 32px rgba(20,184,168,0.3)',
        }}>
          <GraduationCap size={32} color="#fff" />
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
          {t('register.title')}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 32 }}>
          {t('register.sub')}
        </p>

        <div style={{
          background: 'var(--surface)', backdropFilter: 'blur(12px)',
          borderRadius: 20, border: '1px solid var(--border)',
          padding: '24px', marginBottom: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, textAlign: 'left' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(20,184,168,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Lock size={18} color="#0D9488" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('register.how_title')}</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {t('register.how_sub')}
              </p>
            </div>
          </div>
        </div>

        <Link to="/login"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '13px 28px', borderRadius: 14, border: 'none',
            background: 'linear-gradient(135deg, #14B8A8, #0D9488)',
            color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none',
            boxShadow: '0 8px 24px rgba(20,184,168,0.3)',
          }}>
          <LogIn size={16} />
          {t('register.signin_link')}
        </Link>
      </motion.div>
    </div>
  )
}
