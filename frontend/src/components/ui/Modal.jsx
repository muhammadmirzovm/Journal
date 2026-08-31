import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, maxWidth = 480 }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200 }}
          />
          <div
            key="modal-wrapper"
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 201, padding: 16, pointerEvents: 'none' }}
          >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            style={{
              width: '100%', maxWidth: maxWidth,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden', pointerEvents: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>{title}</h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 6 }}>
                <X size={18} color="var(--text-muted)" />
              </button>
            </div>
            <div className="modal-body" style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(90vh - 70px)' }}>{children}</div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
