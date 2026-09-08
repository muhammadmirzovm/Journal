import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { getStudentTuitionOverride, setStudentTuitionOverride } from '../../api/payments'
import { useToast } from '../../context/ToastContext'
import Modal from '../ui/Modal'
import { primaryBtn, ghostBtn, labelStyle, inputStyle } from './format'
import AmountInput from './AmountInput'

// row: { student_id, student_name, group_id, group_name } | null
export default function DiscountModal({ row, onClose, onSaved, t }) {
  const { show } = useToast()
  const [loading, setLoading] = useState(true)
  const [hasOverride, setHasOverride] = useState(false)
  const [price, setPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!row) return
    setLoading(true)
    getStudentTuitionOverride(row.student_id, row.group_id)
      .then(r => {
        if (r.data) { setHasOverride(true); setPrice(String(r.data.custom_price)) }
        else { setHasOverride(false); setPrice('') }
      })
      .catch(() => show(t('payments.toast_load_fail'), 'error'))
      .finally(() => setLoading(false))
  }, [row])

  if (!row) return null

  const save = async () => {
    if (!price) return
    setSubmitting(true)
    try {
      await setStudentTuitionOverride(row.student_id, row.group_id, Number(price))
      show(t('payments.toast_discount_saved'), 'success')
      onSaved()
    } catch { show(t('payments.toast_discount_fail'), 'error') } finally { setSubmitting(false) }
  }

  const remove = async () => {
    setSubmitting(true)
    try {
      await setStudentTuitionOverride(row.student_id, row.group_id, null)
      show(t('payments.toast_discount_removed'), 'success')
      onSaved()
    } catch { show(t('payments.toast_discount_fail'), 'error') } finally { setSubmitting(false) }
  }

  return (
    <Modal open={!!row} onClose={onClose} title={t('payments.discount_title')}>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>{t('payments.col_student')}</label>
        <p style={{ fontSize: 14, fontWeight: 600 }}>{row.student_name}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.group_name}</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
          <Loader2 size={20} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--text-muted)' }} />
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>{t('payments.discount_price_label')}</label>
            <AmountInput value={price} onChange={setPrice} style={inputStyle} placeholder={t('payments.template_price_placeholder')} />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{t('payments.discount_hint')}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
            {hasOverride ? (
              <button type="button" onClick={remove} disabled={submitting}
                style={{ ...ghostBtn, color: '#DC2626', borderColor: 'rgba(220,38,38,0.35)', opacity: submitting ? 0.6 : 1 }}>
                {t('payments.discount_remove')}
              </button>
            ) : <span />}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onClose} style={ghostBtn}>{t('payments.record_cancel')}</button>
              <motion.button type="button" onClick={save} disabled={submitting || !price} whileTap={{ scale: 0.97 }}
                style={{ ...primaryBtn, opacity: (submitting || !price) ? 0.6 : 1, cursor: (submitting || !price) ? 'default' : 'pointer' }}>
                {submitting && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
                {t('payments.record_submit')}
              </motion.button>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
