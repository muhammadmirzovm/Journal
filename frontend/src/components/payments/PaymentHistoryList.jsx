import { useState } from 'react'
import { Loader2, Receipt, Trash2 } from 'lucide-react'
import { voidPayment } from '../../api/payments'
import { useToast } from '../../context/ToastContext'
import { formatDate } from '../../utils/date'
import { ghostBtn, som } from './format'
import Pager from './Pager'

// showGroup: set false when already inside a single group's page — the
// group name on every row would just repeat the page's own heading there.
export default function PaymentHistoryList({ payments, loading, page, pages, onPageChange, onOpenReceipt, onVoided, showGroup = true, t }) {
  const { show } = useToast()
  const [voiding, setVoiding] = useState(null)

  const handleVoid = async (p) => {
    if (!window.confirm(t('payments.void_confirm', { amount: som(p.amount), student: p.student_name }))) return
    setVoiding(p.id)
    try {
      await voidPayment(p.id)
      show(t('payments.toast_voided'), 'success')
      onVoided()
    } catch {
      show(t('payments.toast_void_fail'), 'error')
    } finally { setVoiding(null) }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Loader2 size={22} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--text-muted)' }} />
      </div>
    )
  }
  if (payments.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('payments.no_payments')}</p>
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {payments.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ minWidth: 140 }}>
              <p style={{ fontWeight: 600, fontSize: 13 }}>{p.student_name}</p>
              {showGroup && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.group_name}</p>}
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{som(p.amount)} so'm</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.method_label}</span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{p.receipt_code}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(p.paid_at)}</span>
            <button onClick={() => onOpenReceipt(p)} style={{ ...ghostBtn, padding: '5px 10px', marginLeft: 'auto' }}>
              <Receipt size={12} /> {t('payments.receipt_btn')}
            </button>
            <button onClick={() => handleVoid(p)} disabled={voiding === p.id}
              style={{ ...ghostBtn, padding: '5px 10px', color: '#DC2626', borderColor: 'rgba(220,38,38,0.35)', opacity: voiding === p.id ? 0.6 : 1 }}>
              {voiding === p.id ? <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Trash2 size={12} />}
              {t('payments.void_btn')}
            </button>
          </div>
        ))}
      </div>

      <Pager page={page} pages={pages} onPageChange={onPageChange} />
    </>
  )
}
