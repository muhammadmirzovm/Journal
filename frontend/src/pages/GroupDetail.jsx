import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Users, BookOpen, Plus, Key, Copy, Check, Calendar, Loader2, ChevronLeft, ChevronRight, Trash2, Pencil, Crown, CopyPlus, Send, UserCheck, UserPlus, Search, FileDown, UserCog, MoreVertical, GraduationCap, CheckCircle2, Info } from 'lucide-react'
import {
  getGroup, getMembers, getLessons, createLesson, updateLesson, deleteLesson,
  updateGroup, deleteGroup, updateMembership, removeMember,
  getGroupAnnouncements, createGroupAnnouncement, deleteAnnouncement,
  addMemberDirect, searchStudents, toggleGraduate, exportExcel, getAcademyTeachers,
} from '../api/groups'
import { AnnouncementsSection } from '../components/AnnouncementCard'
import ExamsTab from '../components/ExamsTab'
import GameHistoryTab from '../components/GameHistoryTab'
import { getGames, createGame, deleteGame, getTopics, duplicateGame } from '../api/quiz'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/ui/Modal'
import { formatDayMonthYear, formatShortDayMonthYear } from '../utils/date'

// ── Ranking ───────────────────────────────────────────────────────────────────

function rankMembers(members) {
  const cmp = (a, b) => {
    const d1 = (b.comprehension ?? -1) - (a.comprehension ?? -1); if (d1 !== 0) return d1
    return (b.attendance_rate ?? -1) - (a.attendance_rate ?? -1)
  }
  const sorted = [...members].sort(cmp)
  let rank = 1
  return sorted.map((m, i) => {
    if (i > 0 && cmp(sorted[i - 1], m) !== 0) rank = i + 1
    return { ...m, rank }
  })
}

// ── Podium ────────────────────────────────────────────────────────────────────

const PODIUM_COLORS = {
  1: { border: '#F59E0B', bg: 'rgba(245,158,11,0.08)', text: '#F59E0B', height: 100 },
  2: { border: '#94A3B8', bg: 'rgba(148,163,184,0.08)', text: '#94A3B8', height: 70 },
  3: { border: '#CD7F32', bg: 'rgba(205,127,50,0.08)', text: '#CD7F32', height: 50 },
}

function PodiumSlot({ members, rank, delay }) {
  const col = PODIUM_COLORS[rank]
  if (!members.length) return <div style={{ flex: 1 }} />
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
    >
      {/* Student cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', width: '100%' }}>
        {members.slice(0, 2).map(m => (
          <div key={m.id} style={{ textAlign: 'center' }}>
            <motion.div
              animate={rank === 1 ? { boxShadow: ['0 0 0 0 rgba(245,158,11,0.5)', '0 0 0 10px rgba(245,158,11,0)', '0 0 0 0 rgba(245,158,11,0.5)'] } : {}}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: rank === 1 ? 54 : 44, height: rank === 1 ? 54 : 44, borderRadius: '50%', margin: '0 auto 6px', background: col.bg, border: `2px solid ${col.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: rank === 1 ? 20 : 16, color: col.text, position: 'relative' }}
            >
              {(m.first_name?.[0] || m.username?.[0] || '?').toUpperCase()}
              {rank === 1 && (
                <motion.div
                  animate={{ rotate: [0, -8, 8, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)' }}
                >
                  <Crown size={16} color="#F59E0B" fill="#F59E0B" />
                </motion.div>
              )}
            </motion.div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, maxWidth: 80, wordBreak: 'break-word' }}>
              {m.first_name || m.username}
            </p>
            <p style={{ fontSize: 11, fontWeight: 700, color: col.text, marginTop: 2 }}>
              {m.comprehension ?? 0}%
            </p>
          </div>
        ))}
        {members.length > 2 && (
          <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{members.length - 2} more</p>
        )}
      </div>

      {/* Podium bar */}
      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.6, delay: delay + 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: 'bottom', width: '100%', height: col.height, background: col.bg, border: `1.5px solid ${col.border}`, borderBottom: 'none', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <span style={{ fontSize: rank === 1 ? 22 : 18, fontWeight: 800, color: col.text }}>
          {rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}
        </span>
      </motion.div>
    </motion.div>
  )
}

function Podium({ members, t }) {
  const ranked = rankMembers(members.filter(m => m.comprehension !== null))
  if (ranked.length === 0) return null

  const pos = { 1: ranked.filter(m => m.rank === 1), 2: ranked.filter(m => m.rank === 2), 3: ranked.filter(m => m.rank === 3) }

  const scored = members.filter(m => m.comprehension !== null)
  const avg = scored.length ? Math.round(scored.reduce((a, b) => a + b.comprehension, 0) / scored.length) : null

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 20px 0', marginBottom: 24, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <p style={{ fontWeight: 700, fontSize: 14 }}>{t('group_detail.podium_title')}</p>
        {avg !== null && (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 99, padding: '3px 10px' }}>
            {t('group_detail.avg_label')}: <span style={{ color: 'var(--accent)' }}>{avg}%</span>
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <PodiumSlot members={pos[2]} rank={2} delay={0.1} />
        <PodiumSlot members={pos[1]} rank={1} delay={0} />
        <PodiumSlot members={pos[3]} rank={3} delay={0.2} />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GroupDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { show } = useToast()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const [group, setGroup]     = useState(null)
  const [members, setMembers] = useState([])
  const [lessons, setLessons] = useState([])
  const [lessonPage,  setLessonPage]  = useState(1)
  const [lessonPages, setLessonPages] = useState(1)
  const [lessonTotal, setLessonTotal] = useState(0)
  const initialTab = new URLSearchParams(location.search).get('tab') || 'lessons'
  const [tab, setTab]         = useState(initialTab)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied]   = useState(false)

  const [showAddLesson,     setShowAddLesson]     = useState(false)
  const [showEditGroup,     setShowEditGroup]      = useState(false)
  const [showDetails,       setShowDetails]        = useState(false)
  const [showDeleteGroup,   setShowDeleteGroup]    = useState(false)
  const [editingLesson,     setEditingLesson]      = useState(null)
  const [editingMembership, setEditingMembership] = useState(null)
  const [games,             setGames]             = useState([])
  const [showNewGame,       setShowNewGame]        = useState(false)
  const [announcements,     setAnnouncements]      = useState([])
  const [showAddStudent,       setShowAddStudent]       = useState(false)
  const [exportLoading,        setExportLoading]        = useState(false)
  const [showChangeTeacher,    setShowChangeTeacher]    = useState(false)
  const [teachersList,         setTeachersList]         = useState([])
  const [teacherSearch,        setTeacherSearch]        = useState('')
  const [selectedTeacherId,    setSelectedTeacherId]    = useState(null)
  const [changeTeacherLoading, setChangeTeacherLoading] = useState(false)
  const [showActions,          setShowActions]          = useState(false)
  const actionsRef = useRef(null)

  const isAdmin    = user?.role === 'admin'
  const isTeacher  = (user?.role === 'teacher' && group?.teacher === user?.id) || isAdmin
  const isReadOnly = !!group?.is_graduated

  useEffect(() => {
    const handler = e => { if (actionsRef.current && !actionsRef.current.contains(e.target)) setShowActions(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [g, m, l, gm, anns] = await Promise.all([
        getGroup(id), getMembers(id), getLessons(id, 1), getGames(id),
        getGroupAnnouncements(id),
      ])
      setGroup(g.data); setMembers(m.data); setGames(gm.data)
      setLessons(l.data.results); setLessonPages(l.data.pages); setLessonTotal(l.data.total); setLessonPage(l.data.page)
      setAnnouncements(anns.data)
    } catch { show(t('group_detail.toast_load_fail'), 'error') }
    finally { setLoading(false) }
  }

  const handlePostGroupAnn = async data => {
    const { data: ann } = await createGroupAnnouncement(id, data)
    setAnnouncements(prev => [ann, ...prev].sort((a, b) => b.is_pinned - a.is_pinned || new Date(b.created_at) - new Date(a.created_at)))
    show(t('ann.toast_created'), 'success')
  }

  const handleDeleteGroupAnn = async annId => {
    await deleteAnnouncement(annId)
    setAnnouncements(prev => prev.filter(a => a.id !== annId))
    show(t('ann.toast_deleted'), 'success')
  }

  useEffect(() => { load() }, [id])

  const copy = () => { navigator.clipboard.writeText(group.join_key); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const handleDeleteGroup = async () => {
    try { await deleteGroup(id); show(t('group_detail.toast_group_deleted'), 'info'); navigate('/groups') }
    catch { show(t('group_detail.toast_group_delete_fail'), 'error') }
  }

  const fetchLessons = async (page) => {
    const { data } = await getLessons(id, page)
    setLessons(data.results); setLessonPages(data.pages); setLessonTotal(data.total); setLessonPage(data.page)
  }

  const handleDeleteLesson = async (lid) => {
    try {
      await deleteLesson(id, lid)
      // Reload the current page (backfilling from the next); step back if it emptied.
      await fetchLessons(lessons.length === 1 && lessonPage > 1 ? lessonPage - 1 : lessonPage)
      show(t('group_detail.toast_deleted'), 'info')
    }
    catch { show(t('group_detail.toast_delete_fail'), 'error') }
  }

  const handleRemoveMember = async (mid) => {
    try { await removeMember(id, mid); setMembers(ms => ms.filter(m => m.membership_id !== mid)); show(t('group_detail.toast_member_removed'), 'info') }
    catch { show(t('group_detail.toast_member_fail'), 'error') }
  }

  const handleGraduate = async () => {
    try {
      const { data } = await toggleGraduate(id)
      setGroup(g => ({ ...g, is_graduated: data.is_graduated }))
      show(data.is_graduated ? t('group_detail.toast_graduated') : t('group_detail.toast_ungraduated'), 'success')
    } catch { show(t('group_detail.toast_graduate_fail'), 'error') }
  }

  const openChangeTeacher = async () => {
    setSelectedTeacherId(group.teacher)
    setTeacherSearch('')
    setShowChangeTeacher(true)
    try {
      const { data } = await getAcademyTeachers()
      setTeachersList(data.results || data)
    } catch { show('O\'qituvchilar ro\'yxatini yuklab bo\'lmadi', 'error') }
  }

  const handleChangeTeacher = async () => {
    if (!selectedTeacherId) return
    setChangeTeacherLoading(true)
    try {
      const { data } = await updateGroup(id, { teacher: selectedTeacherId })
      setGroup(g => ({ ...g, teacher: data.teacher, teacher_name: data.teacher_name }))
      setShowChangeTeacher(false)
      show('O\'qituvchi o\'zgartirildi', 'success')
    } catch (err) {
      show(err?.response?.data?.detail || 'Xatolik yuz berdi', 'error')
    } finally { setChangeTeacherLoading(false) }
  }

  const handleExport = async () => {
    setExportLoading(true)
    try {
      await exportExcel(id, group.name)
    } catch {
      show('Excel yuklab olishda xatolik', 'error')
    } finally { setExportLoading(false) }
  }

  if (loading) return <Spinner />
  if (!group) return <p style={{ color: 'var(--text-muted)' }}>{t('group_detail.toast_load_fail')}</p>

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        <Link to="/groups" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{t('common.groups')}</Link>
        <ChevronRight size={14} />
        <span>{group.name}</span>
      </div>

      {/* Header */}
      <div className="group-detail-hd" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, margin: 0 }}>{group.name}</h2>
            {group.is_individual && (
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', letterSpacing: '0.05em', flexShrink: 0 }}>
                INDIVIDUAL
              </span>
            )}
            {group.is_graduated && (
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: 'color-mix(in srgb, #10B981 15%, transparent)', color: '#10B981', letterSpacing: '0.05em', flexShrink: 0 }}>
                {t('group_detail.graduated')}
              </span>
            )}
          </div>
          {group.description && <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8 }}>{group.description}</p>}
          {group.is_individual && members.length > 0 && (() => {
            const s = members[0]
            const pctColor = p => p === null || p === undefined ? 'var(--text-muted)' : p >= 70 ? 'var(--success)' : p >= 40 ? 'var(--warning)' : 'var(--danger)'
            const comp = s.comprehension
            const att  = s.attendance_rate
            return (
              <div style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, maxWidth: '100%', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: 10, padding: '8px 14px', marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0 }}>
                  {(s.first_name?.[0] || s.username?.[0] || '?').toUpperCase()}
                </div>
                <div>
                  <Link to={`/profile/${s.id}`} style={{ margin: 0, fontWeight: 700, fontSize: 13, color: 'var(--text)', textDecoration: 'none', display: 'block' }}>{s.first_name} {s.last_name}</Link>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>@{s.username}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', borderRadius: 6, padding: '2px 8px' }}>
                  {t('group_detail.connected_student')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 4, paddingLeft: 12, borderLeft: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: pctColor(comp) }}>{comp === null || comp === undefined ? '—' : `${comp}%`}</span>
                    <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>{t('group_detail.comprehension')}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: pctColor(att) }}>{att === null || att === undefined ? '—' : `${att}%`}</span>
                    <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>{t('group_detail.attendance')}</p>
                  </div>
                </div>
              </div>
            )
          })()}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            {!group.is_individual && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Users size={14} />{members.length} {t('group_detail.students_count')}</span>}
          </div>
        </div>
        <div className="group-detail-hd-btns" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          {isTeacher && (
            <>
              <button className="hd-icon-btn" onClick={() => setShowDetails(true)} title={t('group_detail.details')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
                <Info size={14} color="var(--accent)" /> <span className="hd-btn-label">{t('group_detail.details')}</span>
              </button>
              {!isReadOnly && group.is_individual && members.length === 0 && (
                <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setShowAddStudent(true)} style={primaryBtn}>
                  <UserPlus size={13} /> {t('group_detail.add_student')}
                </motion.button>
              )}
              <button className="hd-icon-btn" onClick={() => setShowEditGroup(true)} title={t('group_detail.edit_group')} style={ghostBtn}><Pencil size={13} /> <span className="hd-btn-label">{t('group_detail.edit_group')}</span></button>

              {/* Secondary actions dropdown */}
              <div ref={actionsRef} className="hd-icon-btn" style={{ position: 'relative' }}>
                <button onClick={() => setShowActions(o => !o)} title={t('group_detail.more_actions')}
                  style={{ ...iconActionBtn, width: 36, height: 36, justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <MoreVertical size={16} color="var(--text-muted)" />
                </button>
                <AnimatePresence>
                  {showActions && (
                    <motion.div initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="hd-dropdown"
                      style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', width: 210, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 12px 32px rgba(0,0,0,0.18)', zIndex: 50 }}>
                      {isAdmin && (
                        <button onClick={() => { setShowActions(false); openChangeTeacher() }} style={menuItemStyle('#8B5CF6')}>
                          <UserCog size={14} /> O'qituvchi
                        </button>
                      )}
                      <button onClick={() => { setShowActions(false); handleExport() }} disabled={exportLoading} style={menuItemStyle('#10B981')}>
                        {exportLoading ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <FileDown size={14} />} Excel
                      </button>
                      <button onClick={() => { setShowActions(false); handleGraduate() }} style={menuItemStyle('#10B981')}>
                        <GraduationCap size={14} /> {group.is_graduated ? t('group_detail.ungraduate') : t('group_detail.graduate')}
                      </button>
                      <div style={{ height: 1, background: 'var(--border)' }} />
                      <button onClick={() => { setShowActions(false); setShowDeleteGroup(true) }} style={menuItemStyle('var(--danger)')}>
                        <Trash2 size={14} /> {t('group_detail.delete_group')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Podium — only for group (not individual) with scored members */}
      {!group.is_individual && members.some(m => m.comprehension !== null) && <Podium members={members} t={t} />}

      {/* Tabs */}
      <div className="scroll-fade" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[
          { key: 'lessons',       label: t('group_detail.tab_lessons') },
          ...(!group.is_individual ? [{ key: 'members', label: t('group_detail.tab_members') }] : []),
          { key: 'games',         label: t('quiz.games') },
          { key: 'announcements', label: t('ann.tab') },
          { key: 'exams',         label: t('exam.tab') },
          { key: 'winners',       label: t('game.history_tab') },
        ].map(item => (
          <button key={item.key} className="tab-btn" onClick={() => setTab(item.key)} style={{
            padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize', whiteSpace: 'nowrap',
            color: tab === item.key ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: tab === item.key ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.15s', flexShrink: 0,
          }}>{item.label}</button>
        ))}
      </div>

      {/* Lessons tab */}
      {tab === 'lessons' && (
        <div>
          {isTeacher && !isReadOnly && (
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setShowAddLesson(true)} style={primaryBtn}>
                <Plus size={14} /> {t('group_detail.add_lesson')}
              </motion.button>
            </div>
          )}
          {lessonTotal === 0 ? (
            <EmptyTab icon={BookOpen} text={t('group_detail.no_lessons')} sub={isTeacher ? t('group_detail.no_lessons_teacher') : t('group_detail.no_lessons_student')} />
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lessons.map((l, i) => (
                  <LessonRow key={l.id} lesson={l} groupId={id} index={i} isTeacher={isTeacher && !isReadOnly}
                    onEdit={() => setEditingLesson(l)} onDelete={() => handleDeleteLesson(l.id)} />
                ))}
              </div>
              {lessonPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 }}>
                  <button onClick={() => fetchLessons(lessonPage - 1)} disabled={lessonPage <= 1}
                    style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: lessonPage <= 1 ? 'not-allowed' : 'pointer', opacity: lessonPage <= 1 ? 0.4 : 1 }}>
                    <ChevronLeft size={16} color="var(--text-muted)" />
                  </button>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{lessonPage} / {lessonPages}</span>
                  <button onClick={() => fetchLessons(lessonPage + 1)} disabled={lessonPage >= lessonPages}
                    style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: lessonPage >= lessonPages ? 'not-allowed' : 'pointer', opacity: lessonPage >= lessonPages ? 0.4 : 1 }}>
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div>
          {members.length === 0 ? (
            <EmptyTab icon={Users} text={t('group_detail.no_students')} sub={t('group_detail.no_students_sub')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rankMembers(members).map((m, i) => (
                <MemberRow key={m.membership_id} member={m} index={i} isTeacher={isTeacher && !isReadOnly}
                  onEditJoinDate={() => setEditingMembership(m)}
                  onRemove={() => handleRemoveMember(m.membership_id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Games tab */}
      {tab === 'games' && (
        <div>
          {isTeacher && !isReadOnly && (
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setShowNewGame(true)} style={primaryBtn}>
                <Plus size={14} /> {t('quiz.new_game')}
              </motion.button>
            </div>
          )}
          {games.length === 0 ? (
            <EmptyTab icon={Users} text={t('quiz.no_games')} sub={t('quiz.no_games_sub')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {games.map((g, i) => <GameRow key={g.id} game={g} groupId={id} index={i} isTeacher={isTeacher}
                onDelete={async () => { try { await deleteGame(id, g.id); setGames(gs => gs.filter(x => x.id !== g.id)) } catch {} }}
                onDuplicated={copy => setGames(gs => [copy, ...gs])} />)}
            </div>
          )}
        </div>
      )}

      {/* Announcements tab */}
      {tab === 'announcements' && (
        <AnnouncementsSection
          announcements={announcements}
          loading={false}
          canPost={isTeacher && !isReadOnly}
          onPost={handlePostGroupAnn}
          onDelete={handleDeleteGroupAnn}
        />
      )}

      {/* Exams tab */}
      {tab === 'exams' && (
        <ExamsTab
          group={group}
          members={members}
          isAdmin={isAdmin && !isReadOnly}
          isTeacher={isTeacher && !isAdmin && !isReadOnly}
          userId={user?.id}
          groupId={id}
        />
      )}

      {/* Winners history tab */}
      {tab === 'winners' && <GameHistoryTab groupId={id} t={t} />}

      {/* Modals */}
      <AddLessonModal open={showAddLesson} onClose={() => setShowAddLesson(false)} groupId={id}
        onAdded={() => { fetchLessons(1); setShowAddLesson(false); show(t('group_detail.toast_added'), 'success') }} />
      <EditLessonModal open={!!editingLesson} onClose={() => setEditingLesson(null)} lesson={editingLesson} groupId={id}
        onUpdated={u => { setLessons(ls => ls.map(l => l.id === u.id ? u : l)); setEditingLesson(null); show(t('group_detail.toast_lesson_updated'), 'success') }} />
      <EditGroupModal open={showEditGroup} onClose={() => setShowEditGroup(false)} group={group} groupId={id}
        onUpdated={u => { setGroup(g => ({ ...g, ...u })); setShowEditGroup(false); show(t('group_detail.toast_group_updated'), 'success') }} />
      <DeleteGroupModal open={showDeleteGroup} onClose={() => setShowDeleteGroup(false)} onConfirm={handleDeleteGroup} />
      <EditJoinDateModal open={!!editingMembership} onClose={() => setEditingMembership(null)} membership={editingMembership} groupId={id}
        onUpdated={u => { setMembers(ms => ms.map(m => m.membership_id === u.membership_id ? { ...m, ...u } : m)); setEditingMembership(null); show(t('group_detail.toast_join_updated'), 'success') }} />
      <NewGameModal open={showNewGame} onClose={() => setShowNewGame(false)} groupId={id}
        onCreated={g => { setGames(gs => [g, ...gs]); setShowNewGame(false); show(t('quiz.toast_game_created'), 'success') }} />
      <AddStudentModal open={showAddStudent} onClose={() => setShowAddStudent(false)} groupId={id}
        onAdded={m => { setMembers(ms => [...ms, m]); show(t('group_detail.toast_student_added'), 'success') }} />

      {/* Group details modal — teacher, schedule, Telegram status, join key */}
      <Modal open={showDetails} onClose={() => setShowDetails(false)} title={t('group_detail.details_modal_title')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {group.teacher_name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <GraduationCap size={16} color="var(--text-muted)" />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('group_detail.teacher_label')}:</span>
              {isAdmin ? (
                <Link to={`/profile/${group.teacher}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>{group.teacher_name}</Link>
              ) : (
                <span style={{ fontWeight: 600, fontSize: 13 }}>{group.teacher_name}</span>
              )}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={16} color="var(--text-muted)" />
            <span style={{ fontSize: 13 }}>{lessonTotal} {t('group_detail.lessons_count')}</span>
          </div>
          {(group.class_days?.length > 0 || group.class_time) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Calendar size={16} color="var(--text-muted)" />
              <span style={{ fontSize: 13 }}>
                {group.class_days?.length > 0 ? group.class_days.map(d => ['Mo','Tu','We','Th','Fr','Sa','Su'][d]).join(', ') : ''}
                {group.class_days?.length > 0 && group.class_time && ' — '}
                {group.class_time ? group.class_time.replace('-', ' — ') : ''}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10,
            color: group.telegram_chat_id ? '#0EA5E9' : 'var(--text-muted)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            <span style={{ fontSize: 13 }}>{group.telegram_chat_id ? t('group_detail.tg_linked') : t('group_detail.tg_not_linked')}</span>
          </div>
          {!isReadOnly && !group.is_individual && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Key size={14} color="var(--accent)" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, letterSpacing: '0.12em', fontWeight: 600 }}>{group.join_key}</span>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={copy}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: copied ? 'var(--success)' : 'var(--text-muted)', padding: 0 }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? t('group_detail.copied') : t('group_detail.copy_key')}
              </motion.button>
            </div>
          )}
        </div>
      </Modal>

      {/* Change Teacher modal (admin only) */}
      <Modal open={showChangeTeacher} onClose={() => setShowChangeTeacher(false)} title="Guruh o'qituvchisini o'zgartirish">
        {teachersList.length > 6 && (
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)}
              placeholder="Ism yoki username bo'yicha qidirish…" autoFocus
              style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
          {teachersList.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Yuklanmoqda...</p>
          )}
          {teachersList.length > 0 && teachersList.filter(teacher =>
            `${teacher.first_name} ${teacher.last_name} ${teacher.username}`.toLowerCase().includes(teacherSearch.trim().toLowerCase())
          ).length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Hech narsa topilmadi</p>
          )}
          {teachersList.filter(teacher =>
            `${teacher.first_name} ${teacher.last_name} ${teacher.username}`.toLowerCase().includes(teacherSearch.trim().toLowerCase())
          ).map(teacher => (
            <button key={teacher.id} onClick={() => setSelectedTeacherId(teacher.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${selectedTeacherId === teacher.id ? '#8B5CF6' : 'var(--border)'}`, background: selectedTeacherId === teacher.id ? 'rgba(139,92,246,0.08)' : 'var(--surface)', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: selectedTeacherId === teacher.id ? 'rgba(139,92,246,0.15)' : 'var(--accent-bg)', border: `1.5px solid ${selectedTeacherId === teacher.id ? '#8B5CF6' : 'var(--accent)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: selectedTeacherId === teacher.id ? '#8B5CF6' : 'var(--accent)', flexShrink: 0 }}>
                {(teacher.first_name?.[0] || teacher.username?.[0] || '?').toUpperCase()}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{teacher.first_name} {teacher.last_name}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>@{teacher.username}</p>
              </div>
              {group.teacher === teacher.id && (
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,0.1)', borderRadius: 6, padding: '2px 7px' }}>Joriy</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setShowChangeTeacher(false)} style={ghostBtn}>Bekor</button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleChangeTeacher}
            disabled={changeTeacherLoading || !selectedTeacherId || selectedTeacherId === group.teacher}
            style={{ ...primaryBtn, opacity: (changeTeacherLoading || selectedTeacherId === group.teacher) ? 0.6 : 1 }}>
            {changeTeacherLoading ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <UserCog size={13} />}
            Saqlash
          </motion.button>
        </div>
      </Modal>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Lesson Row ────────────────────────────────────────────────────────────────

function LessonRow({ lesson, groupId, index, isTeacher, onEdit, onDelete }) {
  const { t, i18n } = useTranslation()
  const [confirm, setConfirm] = useState(false)
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Calendar size={18} color="var(--accent)" />
      </div>
      <div style={{ flex: 1, minWidth: 120 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Link to={`/groups/${groupId}/lessons/${lesson.id}`} style={{ fontWeight: 600, fontSize: 14, textDecoration: 'none', color: 'var(--text)' }}>{lesson.title}</Link>
          {lesson.ended_at && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--success)', background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: 99, padding: '2px 8px' }}>
              <CheckCircle2 size={11} /> {t('group_detail.lesson_ended')}
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {formatDayMonthYear(lesson.date, i18n.language)}
        </p>
      </div>
      <Link to={`/groups/${groupId}/lessons/${lesson.id}`}
        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
        {t('group_detail.open')} <ChevronRight size={14} />
      </Link>
      {isTeacher && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={onEdit} style={iconActionBtn}><Pencil size={14} color="var(--text-muted)" /></button>
          {confirm ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={onDelete} style={{ ...dangerBtn, padding: '4px 10px', fontSize: 12 }}>{t('group_detail.delete')}</button>
              <button onClick={() => setConfirm(false)} style={{ ...ghostBtn, padding: '4px 10px', fontSize: 12 }}>{t('group_detail.cancel')}</button>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)} style={iconActionBtn}><Trash2 size={14} color="var(--text-muted)" /></button>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ── Member Row ────────────────────────────────────────────────────────────────

function MemberRow({ member: m, index, isTeacher, onEditJoinDate, onRemove }) {
  const { t, i18n } = useTranslation()
  const [confirm, setConfirm] = useState(false)
  const pct   = m.comprehension
  const color = pct === null ? 'var(--border)' : pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)'
  const isFirst = m.rank === 1

  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }}
      style={{ background: 'var(--surface)', border: `1px solid ${isFirst ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`, borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Avatar, with rank as a corner badge — a leaderboard detail on the
            student's identity, not a property of the list row itself */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: isFirst ? 'rgba(245,158,11,0.12)' : 'var(--accent-bg)', border: `1.5px solid ${isFirst ? '#F59E0B' : 'var(--accent)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: isFirst ? '#F59E0B' : 'var(--accent)' }}>
            {(m.first_name?.[0] || m.username?.[0] || '?').toUpperCase()}
          </div>
          <span style={{
            position: 'absolute', top: -6, left: -6, minWidth: 16, height: 16, padding: '0 3px',
            borderRadius: 99, background: PODIUM_COLORS[m.rank]?.text || 'var(--text-muted)',
            color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--surface)', lineHeight: 1,
          }}>
            {m.rank}
          </span>
        </div>

        {/* Name + comprehension */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <Link to={`/profile/${m.id}`} style={{ fontWeight: 600, fontSize: 14, textDecoration: 'none', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.first_name} {m.last_name}
          </Link>
          {pct !== null ? <span style={{ fontSize: 15, fontWeight: 700, color, flexShrink: 0 }}>{pct}%</span>
            : <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{t('group_detail.no_scores')}</span>}
        </div>
      </div>

      {/* Meta: date/edit + remove on one line, status badges on their own line below */}
      <div style={{ paddingLeft: 48, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
            {formatShortDayMonthYear(m.joined_at, i18n.language)}
            {isTeacher && <button onClick={onEditJoinDate} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}><Pencil size={11} /></button>}
          </span>

          {isTeacher && (
            confirm ? (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={onRemove} style={{ ...dangerBtn, padding: '4px 10px', fontSize: 12 }}>{t('group_detail.remove_student')}</button>
                <button onClick={() => setConfirm(false)} style={{ ...ghostBtn, padding: '4px 10px', fontSize: 12 }}>{t('group_detail.cancel')}</button>
              </div>
            ) : (
              <button onClick={() => setConfirm(true)} style={{ ...iconActionBtn, flexShrink: 0 }}><Trash2 size={14} color="var(--text-muted)" /></button>
            )
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          <span title={m.has_parent ? t('group_detail.badge_has_parent') : t('group_detail.badge_no_parent')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 600,
              background: m.has_parent ? 'rgba(20,184,168,0.12)' : 'rgba(148,163,184,0.08)',
              color: m.has_parent ? '#14B8A6' : 'var(--text-muted)' }}>
            <UserCheck size={9} />{m.has_parent ? t('group_detail.badge_has_parent') : t('group_detail.badge_no_parent')}
          </span>
          <span title={m.student_telegram ? t('group_detail.badge_tg_yes') : t('group_detail.badge_tg_no')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 600,
              background: m.student_telegram ? 'rgba(99,102,241,0.1)' : 'rgba(148,163,184,0.08)',
              color: m.student_telegram ? '#6366F1' : 'var(--text-muted)' }}>
            <Send size={9} />TG
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 10, height: 4, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct ?? 0}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: index * 0.04 }}
          style={{ height: '100%', borderRadius: 99, background: color }} />
      </div>
    </motion.div>
  )
}

// ── Modals ────────────────────────────────────────────────────────────────────

function AddLessonModal({ open, onClose, onAdded, groupId }) {
  const { show } = useToast(); const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', date: new Date().toISOString().slice(0, 10) })
  const [error, setError] = useState('')
  const submit = async e => {
    e.preventDefault()
    if (!form.title.trim()) { setError(t('group_detail.err_title_required')); return }
    setLoading(true)
    try { const { data } = await createLesson(groupId, form); setForm({ title: '', date: new Date().toISOString().slice(0, 10) }); onAdded(data) }
    catch { show(t('group_detail.toast_load_fail'), 'error') } finally { setLoading(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('group_detail.add_lesson_title')}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('group_detail.lesson_title')}</label>
          <input style={{ ...inputStyle(!!error), marginTop: 6 }} placeholder={t('group_detail.lesson_title_placeholder')}
            value={form.title} onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setError('') }} autoFocus />
          {error && <p style={errorStyle}>{error}</p>}
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>{t('group_detail.lesson_date')}</label>
          <input type="date" style={{ ...inputStyle(false), marginTop: 6 }} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>{t('group_detail.cancel')}</button>
          <motion.button type="submit" disabled={loading} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {loading ? t('group_detail.adding') : t('group_detail.add_btn')}
          </motion.button>
        </div>
      </form>
    </Modal>
  )
}

function EditLessonModal({ open, onClose, onUpdated, lesson, groupId }) {
  const { show } = useToast(); const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', date: '' })
  const [error, setError] = useState('')
  useEffect(() => { if (lesson) setForm({ title: lesson.title, date: lesson.date }) }, [lesson])
  const submit = async e => {
    e.preventDefault()
    if (!form.title.trim()) { setError(t('group_detail.err_title_required')); return }
    setLoading(true)
    try { const { data } = await updateLesson(groupId, lesson.id, form); onUpdated(data) }
    catch { show(t('group_detail.toast_lesson_update_fail'), 'error') } finally { setLoading(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('group_detail.edit_lesson_modal')}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('group_detail.lesson_title')}</label>
          <input style={{ ...inputStyle(!!error), marginTop: 6 }} value={form.title}
            onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setError('') }} autoFocus />
          {error && <p style={errorStyle}>{error}</p>}
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>{t('group_detail.lesson_date')}</label>
          <input type="date" style={{ ...inputStyle(false), marginTop: 6 }} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>{t('group_detail.cancel')}</button>
          <motion.button type="submit" disabled={loading} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {loading ? t('group_detail.adding') : t('group_detail.save_changes')}
          </motion.button>
        </div>
      </form>
    </Modal>
  )
}

const WEEKDAYS = [
  { label: 'Mo', value: 0 }, { label: 'Tu', value: 1 }, { label: 'We', value: 2 },
  { label: 'Th', value: 3 }, { label: 'Fr', value: 4 }, { label: 'Sa', value: 5 }, { label: 'Su', value: 6 },
]

function EditGroupModal({ open, onClose, onUpdated, group, groupId }) {
  const { show } = useToast(); const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', class_days: [], class_time_start: '', class_time_end: '', telegram_chat_id: '', language: 'uz' })
  const [error, setError] = useState('')

  useEffect(() => {
    if (group) {
      const parts = (group.class_time || '').split('-')
      setForm({
        name: group.name,
        description: group.description || '',
        class_days: Array.isArray(group.class_days) ? group.class_days : [],
        class_time_start: parts[0] || '',
        class_time_end: parts[1] || '',
        telegram_chat_id: group.telegram_chat_id ?? '',
        language: group.language || 'uz',
      })
    }
  }, [group])

  const toggleDay = day => setForm(f => ({
    ...f,
    class_days: f.class_days.includes(day)
      ? f.class_days.filter(d => d !== day)
      : [...f.class_days, day].sort((a, b) => a - b),
  }))

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('groups.err_name_required')); return }
    setLoading(true)
    const { class_time_start, class_time_end, ...rest } = form
    const payload = {
      ...rest,
      class_time: class_time_start && class_time_end ? `${class_time_start}-${class_time_end}` : '',
      telegram_chat_id: rest.telegram_chat_id !== '' ? Number(rest.telegram_chat_id) : null,
    }
    try { const { data } = await updateGroup(groupId, payload); onUpdated(data) }
    catch { show(t('group_detail.toast_group_update_fail'), 'error') } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('group_detail.edit_group_modal')}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('groups.group_name')}</label>
          <input style={{ ...inputStyle(!!error), marginTop: 6 }} value={form.name}
            onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError('') }} autoFocus />
          {error && <p style={errorStyle}>{error}</p>}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('groups.description')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('groups.description_optional')}</span></label>
          <textarea style={{ ...inputStyle(false), marginTop: 6, resize: 'vertical', minHeight: 72 }}
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('groups.class_days')}</label>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {WEEKDAYS.map(day => {
              const active = form.class_days.includes(day.value)
              return (
                <button key={day.value} type="button" onClick={() => toggleDay(day.value)}
                  style={{
                    width: 38, height: 38, borderRadius: 9,
                    border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--text-muted)',
                    fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  {day.label}
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>{t('groups.class_time')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <input type="time" style={{ ...inputStyle(false), maxWidth: 140 }}
              value={form.class_time_start} onChange={e => setForm(f => ({ ...f, class_time_start: e.target.value }))} />
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>—</span>
            <input type="time" style={{ ...inputStyle(false), maxWidth: 140 }}
              value={form.class_time_end} onChange={e => setForm(f => ({ ...f, class_time_end: e.target.value }))} />
          </div>
        </div>
        <div style={{ marginBottom: 24, padding: '14px 16px', background: 'rgba(14,165,233,0.06)', borderRadius: 10, border: '1px solid rgba(14,165,233,0.15)' }}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            {t('group_detail.telegram_chat_id_label')}
          </label>
          <input
            style={{ ...inputStyle(false), marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 14 }}
            placeholder="-100123456789"
            value={form.telegram_chat_id}
            onChange={e => setForm(f => ({ ...f, telegram_chat_id: e.target.value }))}
          />
          <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {t('group_detail.telegram_chat_id_hint')}
          </p>
          <div style={{ marginTop: 10 }}>
            <label style={{ ...labelStyle, marginBottom: 6, display: 'block' }}>{t('group_detail.group_language')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ value: 'uz', label: "🇺🇿 O'zbek" }, { value: 'ru', label: '🇷🇺 Русский' }].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setForm(f => ({ ...f, language: opt.value }))}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${form.language === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                    background: form.language === opt.value ? 'var(--accent)' : 'transparent',
                    color: form.language === opt.value ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>{t('group_detail.cancel')}</button>
          <motion.button type="submit" disabled={loading} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {loading ? t('group_detail.adding') : t('group_detail.save_changes')}
          </motion.button>
        </div>
      </form>
    </Modal>
  )
}

function DeleteGroupModal({ open, onClose, onConfirm }) {
  const { t } = useTranslation(); const [loading, setLoading] = useState(false)
  const handle = async () => { setLoading(true); await onConfirm(); setLoading(false) }
  return (
    <Modal open={open} onClose={onClose} title={t('group_detail.delete_group')}>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>{t('group_detail.delete_group_confirm')}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={ghostBtn}>{t('group_detail.cancel')}</button>
        <motion.button onClick={handle} disabled={loading} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} style={{ ...dangerBtn, opacity: loading ? 0.7 : 1 }}>
          {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
          {t('group_detail.delete_group_btn')}
        </motion.button>
      </div>
    </Modal>
  )
}

function EditJoinDateModal({ open, onClose, onUpdated, membership, groupId }) {
  const { show } = useToast(); const { t } = useTranslation()
  const [loading, setLoading] = useState(false); const [date, setDate] = useState('')
  useEffect(() => { if (membership) setDate(membership.joined_at?.slice(0, 10) || '') }, [membership])
  const submit = async e => {
    e.preventDefault(); if (!date) return; setLoading(true)
    try { const { data } = await updateMembership(groupId, membership.membership_id, { joined_at: date }); onUpdated(data) }
    catch { show(t('group_detail.toast_join_fail'), 'error') } finally { setLoading(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('group_detail.join_date_modal')}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>{t('group_detail.join_date_label')}</label>
          <input type="date" style={{ ...inputStyle(false), marginTop: 6 }} value={date} onChange={e => setDate(e.target.value)} autoFocus />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>{t('group_detail.cancel')}</button>
          <motion.button type="submit" disabled={loading} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {loading ? t('group_detail.adding') : t('group_detail.save_changes')}
          </motion.button>
        </div>
      </form>
    </Modal>
  )
}

// ── Add Student Modal (individual groups) ─────────────────────────────────────

function AddStudentModal({ open, onClose, groupId, onAdded }) {
  const { show } = useToast(); const { t } = useTranslation()
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [adding,  setAdding]  = useState(null)

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]) }
  }, [open])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await searchStudents(query)
        setResults(data.results || data)
      } catch {} finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const handleAdd = async (student) => {
    setAdding(student.id)
    try {
      await addMemberDirect(groupId, student.id)
      onAdded({
        id: student.id,
        username: student.username,
        first_name: student.first_name,
        last_name: student.last_name,
        membership_id: null,
        comprehension: null,
        rank: 99,
        has_parent: false,
        joined_at: new Date().toISOString(),
      })
      onClose()
    } catch (err) {
      show(err?.response?.data?.detail || t('group_detail.toast_member_fail'), 'error')
    } finally { setAdding(null) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('group_detail.add_student')}>
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          autoFocus
          placeholder={t('group_detail.search_student_placeholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ minHeight: 120, maxHeight: 300, overflowY: 'auto' }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Loader2 size={20} color="var(--accent)" style={{ animation: 'spin 0.7s linear infinite' }} />
          </div>
        )}
        {!loading && query && results.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>{t('group_detail.no_students_found')}</p>
        )}
        {!loading && !query && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>{t('group_detail.search_student_hint')}</p>
        )}
        {results.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'var(--accent)', flexShrink: 0 }}>
              {(s.first_name?.[0] || s.username?.[0] || '?').toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{s.first_name} {s.last_name}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>@{s.username}</p>
            </div>
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}
              onClick={() => handleAdd(s)}
              disabled={adding === s.id}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: adding === s.id ? 'not-allowed' : 'pointer', opacity: adding === s.id ? 0.7 : 1 }}>
              {adding === s.id ? <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> : <UserPlus size={12} />}
              {t('group_detail.add_btn')}
            </motion.button>
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ── Game Row ──────────────────────────────────────────────────────────────────

const STATUS_COLOR = { waiting: 'var(--text-muted)', active: 'var(--success)', final: 'var(--warning)', finished: 'var(--accent)' }

function GameRow({ game, groupId, index, isTeacher, onDelete, onDuplicated }) {
  const { t, i18n } = useTranslation()
  const { show } = useToast()
  const [confirm,    setConfirm]    = useState(false)
  const [copying,    setCopying]    = useState(false)
  const statusKey = `quiz.status_${game.status}`

  const handleDuplicate = async () => {
    setCopying(true)
    try {
      const { data } = await duplicateGame(groupId, game.id)
      onDuplicated(data)
      show(t('quiz.toast_game_copied'), 'success')
    } catch { show(t('quiz.toast_game_copy_fail'), 'error') }
    finally { setCopying(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Users size={18} color="var(--accent)" />
      </div>
      <div style={{ flex: 1, minWidth: 120 }}>
        <p style={{ fontWeight: 600, fontSize: 14 }}>{game.name}</p>
        <p style={{ fontSize: 12, color: STATUS_COLOR[game.status] || 'var(--text-muted)', marginTop: 2 }}>
          {t(statusKey)} · {game.team_count} {t('quiz.teams')}
          {game.question_count > 0 && (
            <span style={{ color: 'var(--text-muted)' }}> · {game.question_count} {t('quiz.questions_in_game').toLowerCase()}</span>
          )}
        </p>
      </div>
      <Link to={`/groups/${groupId}/games/${game.id}`}
        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
        {t('quiz.open_game')} <ChevronRight size={14} />
      </Link>
      {isTeacher && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleDuplicate} disabled={copying} title={t('quiz.duplicate_game')}
            style={{ ...iconActionBtn, opacity: copying ? 0.5 : 1 }}>
            {copying ? <Loader2 size={14} color="var(--text-muted)" style={{ animation: 'spin 0.7s linear infinite' }} /> : <CopyPlus size={14} color="var(--text-muted)" />}
          </motion.button>
          {confirm ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={onDelete} style={{ ...dangerBtn, padding: '4px 10px', fontSize: 12 }}>{t('group_detail.delete')}</button>
              <button onClick={() => setConfirm(false)} style={{ ...ghostBtn, padding: '4px 10px', fontSize: 12 }}>{t('group_detail.cancel')}</button>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)} style={iconActionBtn}><Trash2 size={14} color="var(--text-muted)" /></button>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ── New Game Modal ────────────────────────────────────────────────────────────

const DIFF_ORDER = ['easy', 'medium', 'hard']
const DIFF_COLOR_MAP = { easy: '#22C55E', medium: '#F59E0B', hard: '#EF4444' }
const TIMER_PRESETS = [15, 30, 60, 90]
const TEAM_COUNT_PRESETS = [2, 3, 4]

function DiffInput({ diff, available, value, onChange, t }) {
  const val = Number(value) || 0
  const over = val > available
  const color = DIFF_COLOR_MAP[diff]
  const diffKey = `quiz.${diff}`
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {t(diffKey)}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{available}</span>
      </div>
      <input
        type="number" min={0} max={available}
        value={value}
        onChange={e => onChange(Math.max(0, Number(e.target.value)))}
        style={{
          width: '100%', padding: '5px 6px', borderRadius: 6, textAlign: 'center',
          border: `1.5px solid ${over ? 'var(--danger)' : val > 0 ? color : 'var(--border)'}`,
          background: over ? 'rgba(239,68,68,0.06)' : val > 0 ? `${color}12` : 'var(--surface)',
          color: over ? 'var(--danger)' : 'var(--text)', fontSize: 13, fontWeight: 700, outline: 'none',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        disabled={available === 0}
        title={available === 0 ? t('quiz.none_available') : undefined}
      />
      {over && (
        <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 600 }}>
          max {available}
        </span>
      )}
    </div>
  )
}

function NewGameModal({ open, onClose, groupId, onCreated }) {
  const { show } = useToast(); const { t } = useTranslation()
  const [loading,       setLoading]       = useState(false)
  const [topics,        setTopics]        = useState([])
  const [diffCounts,    setDiffCounts]    = useState({})
  const [topicsLoading, setTopicsLoading] = useState(false)
  const [topicSearch,   setTopicSearch]   = useState('')
  const [form, setForm] = useState({ name: '', timer_seconds: 30, team_count: 2 })
  const [formError, setFormError] = useState('')

  const reset = () => {
    setForm({ name: '', timer_seconds: 30, team_count: 2 })
    setTopics([]); setDiffCounts({}); setFormError(''); setTopicSearch('')
  }

  useEffect(() => {
    if (open) {
      setTopicsLoading(true)
      getTopics().then(res => {
        setTopics(res.data)
        const init = {}
        res.data.forEach(tp => { init[tp.id] = { easy: 0, medium: 0, hard: 0 } })
        setDiffCounts(init)
      }).catch(() => {}).finally(() => setTopicsLoading(false))
    }
    if (!open) reset()
  }, [open])

  const setCount = (topicId, diff, val) => {
    setDiffCounts(c => ({ ...c, [topicId]: { ...c[topicId], [diff]: val } }))
    setFormError('')
  }

  const totalQ = Object.values(diffCounts).reduce((sum, dc) =>
    sum + DIFF_ORDER.reduce((s, d) => s + (Number(dc[d]) || 0), 0), 0)

  const hasOverflow = topics.some(tp => {
    const dc = diffCounts[tp.id] || {}
    return (Number(dc.easy) || 0) > tp.easy_count
        || (Number(dc.medium) || 0) > tp.medium_count
        || (Number(dc.hard) || 0) > tp.hard_count
  })

  const topicSelected = id => {
    const dc = diffCounts[id] || {}
    return DIFF_ORDER.some(d => (Number(dc[d]) || 0) > 0)
  }

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setFormError(t('quiz.err_game_name')); return }
    if (totalQ === 0)       { setFormError(t('quiz.err_no_questions')); return }
    if (hasOverflow)        { setFormError(t('quiz.err_overflow')); return }
    setFormError('')
    setLoading(true)
    try {
      const { data } = await createGame(groupId, {
        ...form,
        topic_difficulty_counts: diffCounts,
      })
      onCreated(data)
    } catch (err) {
      show(err?.response?.data?.detail || t('quiz.toast_game_fail'), 'error')
    } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('quiz.new_game')}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{t('quiz.game_name')}</label>
          <input style={{ ...inputStyle(false), marginTop: 5 }} placeholder={t('quiz.game_name_placeholder')}
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
        </div>

        <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <div>
            <label style={labelStyle}>{t('quiz.timer')}</label>
            <input type="number" min={5} max={300} style={{ ...inputStyle(false), marginTop: 5 }}
              value={form.timer_seconds} onChange={e => setForm(f => ({ ...f, timer_seconds: Number(e.target.value) }))} />
            <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
              {TIMER_PRESETS.map(p => (
                <button key={p} type="button" onClick={() => setForm(f => ({ ...f, timer_seconds: p }))}
                  style={presetChip(form.timer_seconds === p)}>{p}s</button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>{t('quiz.team_count')}</label>
            <input type="number" min={2} max={8} style={{ ...inputStyle(false), marginTop: 5 }}
              value={form.team_count} onChange={e => setForm(f => ({ ...f, team_count: Number(e.target.value) }))} />
            <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
              {TEAM_COUNT_PRESETS.map(p => (
                <button key={p} type="button" onClick={() => setForm(f => ({ ...f, team_count: p }))}
                  style={presetChip(form.team_count === p)}>{p}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('quiz.select_questions')}
          </p>
          <span style={{
            fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '2px 8px',
            color: totalQ > 0 ? 'var(--accent)' : 'var(--text-muted)',
            background: totalQ > 0 ? 'var(--accent-bg)' : 'var(--bg)',
            border: `1px solid ${totalQ > 0 ? 'var(--accent)' : 'var(--border)'}`,
          }}>
            {totalQ} {t('quiz.questions_selected')}
          </span>
        </div>

        {topics.length > 6 && (
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={topicSearch} onChange={e => setTopicSearch(e.target.value)}
              placeholder={t('quiz.topic_search_placeholder')}
              style={{ ...inputStyle(false), padding: '7px 10px 7px 30px', fontSize: 13 }} />
          </div>
        )}

        {/* Topics list with per-difficulty inputs */}
        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, paddingRight: 2 }}>
          {topicsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <Loader2 size={20} color="var(--accent)" style={{ animation: 'spin 0.7s linear infinite' }} />
            </div>
          ) : topics.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>{t('quiz.no_topics_hint')}</p>
          ) : topics.filter(tp => tp.name.toLowerCase().includes(topicSearch.trim().toLowerCase())).length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>{t('settings.no_results')}</p>
          ) : topics.filter(tp => tp.name.toLowerCase().includes(topicSearch.trim().toLowerCase())).map(tp => {
            const dc = diffCounts[tp.id] || { easy: 0, medium: 0, hard: 0 }
            const sel = topicSelected(tp.id)
            return (
              <div key={tp.id} style={{
                background: sel ? 'var(--accent-bg)' : 'var(--bg)',
                border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 10, padding: '10px 12px', transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{tp.name}</span>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{tp.created_by_name}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[['easy', tp.easy_count, '#22C55E'], ['medium', tp.medium_count, '#F59E0B'], ['hard', tp.hard_count, '#EF4444']].map(([d, cnt, col]) => (
                      <span key={d} style={{ fontSize: 10, fontWeight: 700, color: cnt > 0 ? col : 'var(--text-muted)', background: cnt > 0 ? `${col}18` : 'transparent', border: `1px solid ${cnt > 0 ? `${col}40` : 'var(--border)'}`, borderRadius: 4, padding: '1px 5px' }}>
                        {cnt}{d[0].toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {DIFF_ORDER.map(d => (
                    <DiffInput key={d} diff={d} available={tp[`${d}_count`]} value={dc[d]} onChange={v => setCount(tp.id, d, v)} t={t} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {formError && (
          <p style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '8px 12px', marginBottom: 12 }}>
            ⚠ {formError}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>{t('group_detail.cancel')}</button>
          <motion.button type="submit" disabled={loading || hasOverflow} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }}
            style={{ ...primaryBtn, opacity: loading || hasOverflow ? 0.6 : 1, cursor: hasOverflow ? 'not-allowed' : 'pointer' }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {loading ? t('quiz.saving') : t('quiz.new_game')}
          </motion.button>
        </div>
      </form>
    </Modal>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function EmptyTab({ icon: Icon, text, sub }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ width: 52, height: 52, background: 'var(--accent-bg)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Icon size={24} color="var(--accent)" />
      </div>
      <p style={{ fontWeight: 600, marginBottom: 6 }}>{text}</p>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sub}</p>
    </motion.div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <Loader2 size={30} color="var(--accent)" style={{ animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const primaryBtn       = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const ghostBtn         = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }
const dangerBtn        = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7, border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }
const dangerOutlineBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 7, border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }
const iconActionBtn    = { background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }
const menuItemStyle    = (color) => ({ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color, textAlign: 'left' })
const labelStyle       = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }
const errorStyle       = { fontSize: 12, color: 'var(--danger)', marginTop: 4 }
const inputStyle       = (hasError) => ({ width: '100%', padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`, background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'var(--font-body)', display: 'block' })
const presetChip       = (active) => ({
  padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  background: active ? 'var(--accent-bg)' : 'transparent',
  color: active ? 'var(--accent)' : 'var(--text-muted)',
})
