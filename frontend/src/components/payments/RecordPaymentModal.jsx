import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { recordPayment } from '../../api/payments'
import { useToast } from '../../context/ToastContext'
import Modal from '../ui/Modal'
import { primaryBtn, ghostBtn, labelStyle, inputStyle, todayIso } from './format'
import AmountInput from './AmountInput'

// row: { student_id, student_name, group_id, group_name } | null
export default function RecordPaymentModal({ row, onClose, onRecorded, t }) {
  const { show } = useToast()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [paidAt, setPaidAt] = useState(todayIso())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (row) { setAmount(''); setMethod('cash'); setNote(''); setPaidAt(todayIso()) }
  }, [row])

  if (!row) return null

  const submit = async (e) => {
    e.preventDefault()
    const value = Number(amount)
    if (!value || value < 1) return
    setSubmitting(true)
    try {
      await recordPayment({ student: row.student_id, group: row.group_id, amount: value, method, note: note.trim(), paid_at: paidAt })
      show(t('payments.toast_recorded'), 'success')
      onRecorded()
    } catch { show(t('payments.toast_record_fail'), 'error') } finally { setSubmitting(false) }
  }

  return (
    <Modal open={!!row} onClose={onClose} title={t('payments.record_title')}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('payments.col_student')}</label>
          <p style={{ fontSize: 14, fontWeight: 600 }}>{row.student_name}</p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('payments.record_group')}</label>
          <p style={{ fontSize: 14 }}>{row.group_name}</p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('payments.record_amount')}</label>
          <AmountInput value={amount} onChange={setAmount} style={inputStyle} autoFocus />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('payments.record_date')}</label>
          <input type="date" value={paidAt} max={todayIso()} onChange={e => setPaidAt(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('payments.record_method')}</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['cash', 'card', 'click', 'payme'].map(m => (
              <button key={m} type="button" onClick={() => setMethod(m)}
                style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${method === m ? 'var(--accent)' : 'var(--border)'}`, background: method === m ? 'var(--accent-bg)' : 'transparent', color: method === m ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                {t(`payments.method_${m}`)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>{t('payments.record_note')}</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder={t('payments.record_note_placeholder')} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>{t('payments.record_cancel')}</button>
          <motion.button type="submit" disabled={submitting} whileTap={{ scale: 0.97 }} style={{ ...primaryBtn, opacity: submitting ? 0.7 : 1 }}>
            {submitting && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {t('payments.record_submit')}
          </motion.button>
        </div>
      </form>
    </Modal>
  )
}
