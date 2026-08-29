import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Search, Users, GraduationCap, MessageCircle, UserCheck, UserX, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import api from '../api/axios'
import { setStudentActive } from '../api/users'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const PAGE_SIZE = 20

function StatBadge({ value, suffix = '%', color, label }) {
  if (value == null) return (
    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
      {label}: —
    </span>
  )
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      background: color + '18', color,
    }}>{label}: {value}{suffix}</span>
  )
}

export default function Students() {
  const { t }      = useTranslation()
  const { user }   = useAuth()
  const { show }   = useToast()
  const navigate   = useNavigate()

  const [students, setStudents] = useState([])
  const [groups,   setGroups]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [groupId,  setGroupId]  = useState('')
  const [status,   setStatus]   = useState('active')
  const [page,     setPage]     = useState(1)
  const [total,    setTotal]    = useState(0)
  const [pages,    setPages]    = useState(1)

  const fetchStudents = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = { page: p, page_size: PAGE_SIZE, status }
      if (search)  params.search  = search
      if (groupId) params.group   = groupId
      const { data } = await api.get('/auth/admin/students/', { params })
      setStudents(data.results)
      setTotal(data.count)
      setPages(data.pages)
    } catch {
      show('Error loading students', 'error')
    } finally { setLoading(false) }
  }, [page, search, groupId, status])

  const handleToggleActive = async (e, s) => {
    e.stopPropagation()
    if (s.is_active) {
      const name = `${s.first_name} ${s.last_name}`.trim() || s.username
      if (!window.confirm(t('students.deactivate_confirm', { name }))) return
    }
    try {
      await setStudentActive(s.id, !s.is_active)
      show(s.is_active ? t('students.deactivated_toast') : t('students.activated_toast'), 'success')
      fetchStudents(page)
    } catch { show('Error', 'error') }
  }

  useEffect(() => {
    api.get('/groups/').then(r => setGroups(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); fetchStudents(1) }, 300)
    return () => clearTimeout(timer)
  }, [search, groupId, status])

  useEffect(() => { fetchStudents(page) }, [page])

  if (!['admin', 'teacher'].includes(user?.role)) return null

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
          <GraduationCap size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          {t('students.title')}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {t('students.subtitle', { count: total })}
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            placeholder={t('students.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10,
              border: '1.5px solid rgba(0,0,0,0.1)', background: 'var(--card)',
              color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
            }}
          />
        </div>
        <select
          value={groupId}
          onChange={e => setGroupId(e.target.value)}
          style={{
            padding: '10px 14px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)',
            background: 'var(--card)', color: 'var(--text)', fontSize: 13, minWidth: 160,
          }}
        >
          <option value="">{t('students.all_groups')}</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'active',   label: t('students.st_active') },
          { key: 'inactive', label: t('students.st_inactive') },
          { key: 'all',      label: t('students.st_all') },
        ].map(tab => {
          const on = status === tab.key
          return (
            <button key={tab.key} onClick={() => setStatus(tab.key)}
              style={{ padding: '7px 15px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                background: on ? 'var(--accent)' : 'var(--card)', color: on ? '#fff' : 'var(--text)' }}>
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={28} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--text-muted)' }} />
        </div>
      ) : students.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <Users size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p>{t('students.empty')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {students.map((s, i) => (
            <motion.div key={s.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/profile/${s.id}`)}
              className="student-row"
              style={{
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                padding: '14px 18px', borderRadius: 14,
                background: 'var(--card)', border: '1.5px solid rgba(0,0,0,0.07)',
                cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s',
                opacity: s.is_active === false ? 0.6 : 1,
              }}
              whileHover={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)', borderColor: 'rgba(13,148,136,0.3)' }}
            >
              {/* Avatar */}
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg, #0D9488, #0D9488aa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 800, color: '#fff',
              }}>
                {(s.first_name?.[0] || s.username[0]).toUpperCase()}
              </div>

              {/* Name & groups */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
                  {s.first_name || s.last_name
                    ? `${s.first_name} ${s.last_name}`.trim()
                    : s.username}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                  {s.groups.length > 0
                    ? s.groups.map(g => g.name).join(', ')
                    : t('students.no_group')}
                </p>
              </div>

              {/* Stats */}
              <div className="student-stats" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                <StatBadge value={s.attendance_pct} color="#10B981" label={t('students.attendance')} />
                <StatBadge value={s.avg_score_pct}  color="#8B5CF6" label={t('students.score')} />
                <span title="Telegram" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6,
                  background: s.telegram_linked ? '#0EA5E918' : 'rgba(0,0,0,0.05)',
                  color: s.telegram_linked ? '#0EA5E9' : 'var(--text-muted)',
                }}>
                  <MessageCircle size={12} />
                  {s.telegram_linked ? t('students.connected') : t('students.not_connected')}
                </span>
                <span title="Parent" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6,
                  background: s.has_parent ? '#F59E0B18' : 'rgba(0,0,0,0.05)',
                  color: s.has_parent ? '#F59E0B' : 'var(--text-muted)',
                }}>
                  <UserCheck size={12} />
                  {s.has_parent ? t('students.parent_yes') : t('students.parent_no')}
                </span>
                {s.is_active === false && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(100,116,139,0.15)', color: '#64748B' }}>
                    <UserX size={12} /> {t('students.inactive_badge')}
                  </span>
                )}
                <button onClick={e => handleToggleActive(e, s)}
                  title={s.is_active ? t('students.deactivate') : t('students.activate')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${s.is_active ? 'rgba(220,38,38,0.3)' : 'rgba(22,163,74,0.3)'}`,
                    background: s.is_active ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)',
                    color: s.is_active ? '#DC2626' : '#16A34A' }}>
                  {s.is_active ? <><UserX size={12} /> {t('students.deactivate')}</> : <><UserCheck size={12} /> {t('students.activate')}</>}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 580px) {
          .student-row { gap: 10px !important; padding: 12px 14px !important; }
          .student-stats { width: 100%; }
        }
      `}</style>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 24 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{
              padding: '8px 14px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)',
              background: 'var(--card)', cursor: page === 1 ? 'not-allowed' : 'pointer',
              opacity: page === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center',
            }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {page} / {pages}
          </span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            style={{
              padding: '8px 14px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)',
              background: 'var(--card)', cursor: page === pages ? 'not-allowed' : 'pointer',
              opacity: page === pages ? 0.4 : 1, display: 'flex', alignItems: 'center',
            }}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
