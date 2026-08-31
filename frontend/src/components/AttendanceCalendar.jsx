import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flame, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { formatMonthYear } from '../utils/date'

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function AttendanceCalendar({ calendar, streak, attendanceSummary }) {
  const { t, i18n } = useTranslation()

  const map = {}
  ;(calendar || []).forEach(c => { map[c.date] = c.present })

  const [{ y, m }, setYM] = useState(() => {
    if (calendar && calendar.length) {
      const d = new Date(calendar[calendar.length - 1].date)
      return { y: d.getFullYear(), m: d.getMonth() }
    }
    const n = new Date()
    return { y: n.getFullYear(), m: n.getMonth() }
  })

  const prev = () => setYM(s => s.m === 0  ? { y: s.y - 1, m: 11 } : { y: s.y, m: s.m - 1 })
  const next = () => setYM(s => s.m === 11 ? { y: s.y + 1, m: 0 }  : { y: s.y, m: s.m + 1 })

  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const lead        = (new Date(y, m, 1).getDay() + 6) % 7   // Mon-first
  const monthLabel  = formatMonthYear(new Date(y, m, 1), i18n.language)
  const today       = new Date()
  const pct = attendanceSummary?.total ? Math.round(attendanceSummary.present / attendanceSummary.total * 100) : null

  const key = d => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const isToday = d => today.getFullYear() === y && today.getMonth() === m && today.getDate() === d

  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const dayStyle = (d) => {
    const base = { aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', position: 'relative' }
    if (isToday(d)) { base.outline = '2px solid var(--accent)'; base.outlineOffset = 1 }
    if (map[key(d)] === true)  return { ...base, background: 'rgba(22,163,74,0.14)',  color: '#16A34A', fontWeight: 800 }
    if (map[key(d)] === false) return { ...base, background: 'rgba(220,38,38,0.14)',  color: '#DC2626', fontWeight: 800 }
    return { ...base, color: 'var(--text-muted)' }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-sm)' }}>
      {/* Streak / stats */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        <div className="stat-card" style={statCard}>
          <div style={{ ...statBig, color: '#F59E0B' }}><Flame size={20} /> {streak?.current ?? 0}</div>
          <div style={statLbl} lang={i18n.language}>{t('profile.current_streak')}</div>
        </div>
        <div className="stat-card" style={statCard}>
          <div style={statBig}>{streak?.longest ?? 0}</div>
          <div style={statLbl} lang={i18n.language}>{t('profile.longest_streak')}</div>
        </div>
        <div className="stat-card" style={statCard}>
          <div style={statBig}>{pct === null ? '—' : `${pct}%`}</div>
          <div style={statLbl} lang={i18n.language}>{t('profile.attendance')}</div>
        </div>
      </div>

      {/* Calendar header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarDays size={16} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize' }}>{monthLabel}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={prev} style={navBtn}><ChevronLeft size={16} color="var(--text-muted)" /></button>
          <button onClick={next} style={navBtn}><ChevronRight size={16} color="var(--text-muted)" /></button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {DOW.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', paddingBottom: 4, textTransform: 'uppercase' }}>{d}</div>
        ))}
        {cells.map((d, i) => d === null
          ? <div key={`e${i}`} />
          : <div key={d} style={dayStyle(d)}>{d}</div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span style={legItem}><span style={{ ...sw, background: 'rgba(22,163,74,0.14)', border: '1px solid #16A34A' }} /> {t('profile.cal_present')}</span>
        <span style={legItem}><span style={{ ...sw, background: 'rgba(220,38,38,0.14)', border: '1px solid #DC2626' }} /> {t('profile.cal_absent')}</span>
        <span style={legItem}><span style={{ ...sw, background: 'var(--bg)', border: '1px solid var(--border)' }} /> {t('profile.cal_nolesson')}</span>
      </div>
    </div>
  )
}

const statCard = { minWidth: 0, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, textAlign: 'center' }
const statBig  = { fontSize: 24, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }
const statLbl  = { fontSize: 11, color: 'var(--text-muted)', marginTop: 6, overflowWrap: 'break-word', hyphens: 'auto' }
const navBtn   = { width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const legItem  = { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }
const sw       = { width: 14, height: 14, borderRadius: 5, flexShrink: 0 }
