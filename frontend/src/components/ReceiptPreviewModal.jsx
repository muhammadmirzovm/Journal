import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Loader2 } from 'lucide-react'
import Modal from './ui/Modal'
import { fetchReceiptBlob } from '../api/payments'
import { useToast } from '../context/ToastContext'

const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const ghostBtn   = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }

// Shared by the admin Payments page and the student/parent self-service
// view — pass the payment being viewed (needs .id and .receipt_code) and
// it fetches + previews the PDF before offering a download, instead of
// downloading blind the moment the button is tapped.
export default function ReceiptPreviewModal({ payment, onClose }) {
  const { t } = useTranslation()
  const { show } = useToast()
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!payment) return
    let objectUrl = null
    let cancelled = false
    setLoading(true)
    setUrl(null)
    fetchReceiptBlob(payment.id)
      .then(blob => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => { if (!cancelled) show(t('payments.toast_receipt_fail'), 'error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [payment])

  if (!payment) return null

  const download = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `kvitansiya_${payment.receipt_code || payment.id}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <Modal open={!!payment} onClose={onClose} title={t('payments.receipt_modal_title')} maxWidth={560}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={22} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--text-muted)' }} />
        </div>
      ) : url ? (
        <iframe src={url} title="receipt" style={{ width: '100%', height: 440, border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }} />
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>{t('payments.toast_receipt_fail')}</p>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
        <button onClick={onClose} style={ghostBtn}>{t('payments.receipt_back')}</button>
        <button onClick={download} disabled={!url} style={{ ...primaryBtn, opacity: url ? 1 : 0.6, cursor: url ? 'pointer' : 'default' }}>
          <Download size={14} /> {t('payments.receipt_download')}
        </button>
      </div>
    </Modal>
  )
}
