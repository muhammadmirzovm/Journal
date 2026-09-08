import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pager({ page, pages, onPageChange }) {
  if (pages <= 1) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 18 }}>
      <button onClick={() => onPageChange(p => Math.max(1, p - 1))} disabled={page === 1}
        style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
        <ChevronLeft size={16} />
      </button>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{page} / {pages}</span>
      <button onClick={() => onPageChange(p => Math.min(pages, p + 1))} disabled={page === pages}
        style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: page === pages ? 'not-allowed' : 'pointer', opacity: page === pages ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
