import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Wallet, Receipt, Loader2 } from 'lucide-react'
import { getMyPayments } from '../api/payments'
import { useToast } from '../context/ToastContext'
import { formatDate } from '../utils/date'
import ReceiptPreviewModal from '../components/ReceiptPreviewModal'

const ghostBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }
const som = n => new Intl.NumberFormat('uz-UZ').format(n)

export default function MyPayments() {
  const { t } = useTranslation()
  const { show } = useToast()
  const [balances, setBalances] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [receiptFor, setReceiptFor] = useState(null)

  useEffect(() => {
    getMyPayments()
      .then(r => { setBalances(r.data.balances); setPayments(r.data.recent_payments) })
      .catch(() => show(t('payments.toast_load_fail'), 'error'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Loader2 size={22} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--text-muted)' }} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{t('payments.my_title')}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('payments.my_subtitle')}</p>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Wallet size={16} color="var(--text-muted)" />
          <p style={{ fontWeight: 700, fontSize: 14 }}>{t('payments.my_balance_title')}</p>
        </div>

        {balances.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('payments.my_no_balances')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {balances.map(row => {
              const inDebt = row.balance > 0
              const color = inDebt ? '#DC2626' : '#16A34A'
              return (
                <div key={`${row.student_id}-${row.group_id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{row.student_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.group_name}</p>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color, marginLeft: 'auto' }}>
                    {inDebt ? `${som(row.balance)} so'm` : t('payments.no_debt_short')}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Receipt size={16} color="var(--text-muted)" />
          <p style={{ fontWeight: 700, fontSize: 14 }}>{t('payments.history_title')}</p>
        </div>

        {payments.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('payments.no_payments')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {payments.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ minWidth: 140 }}>
                  <p style={{ fontWeight: 600, fontSize: 13 }}>{p.student_name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.group_name}</p>
                </div>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{som(p.amount)} so'm</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.method_label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(p.paid_at)}</span>
                <button onClick={() => setReceiptFor(p)} style={{ ...ghostBtn, marginLeft: 'auto' }}>
                  <Receipt size={12} /> {t('payments.receipt_btn')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ReceiptPreviewModal payment={receiptFor} onClose={() => setReceiptFor(null)} />
    </div>
  )
}
