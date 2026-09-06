import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Home, ArrowLeft } from 'lucide-react'
import { useDocumentMeta } from '../hooks/useDocumentMeta'

export default function NotFound() {
  const { t } = useTranslation()
  useDocumentMeta(t('meta.not_found_title'))

  // 404s shouldn't be indexed — override index.html's default robots tag
  // while this page is mounted, restore it on unmount.
  useEffect(() => {
    const tag = document.querySelector('meta[name="robots"]')
    const prev = tag?.getAttribute('content') ?? null
    if (tag) tag.setAttribute('content', 'noindex, nofollow')
    return () => { if (tag && prev !== null) tag.setAttribute('content', prev) }
  }, [])

  return (
    <div style={{ minHeight: '72vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <motion.p animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ fontSize: 80, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', lineHeight: 1, marginBottom: 16 }}>
          404
        </motion.p>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginBottom: 10 }}>{t('not_found.title')}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32, maxWidth: 340, margin: '0 auto 32px' }}>
          {t('not_found.sub')}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              <Home size={15} /> {t('not_found.go_home')}
            </Link>
          </motion.div>
          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
            <button onClick={() => window.history.back()} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              <ArrowLeft size={15} /> {t('not_found.go_back')}
            </button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
