import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Save, Loader2, CheckSquare, Square, Star, Coins, BookOpen, Users, ClipboardList, BellRing, AlertTriangle, Trophy, CheckCheck, XCircle, CheckCircle2 } from 'lucide-react'
import { getGroup, getMembers, getLesson, getAttendance, saveAttendance, getScores, saveScores, getJournal, saveJournal, getHomework, saveHomework, setHomeworkAssignment, endLesson } from '../api/groups'
import { getLessonGame, startGame, cancelGame, closeGame } from '../api/games'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/ui/Modal'
import { weekdayName, formatDayMonthYear, formatDayMonthTime } from '../utils/date'

export default function LessonDetail() {
  const { groupId, lessonId } = useParams()
  const { user } = useAuth()
  const { show } = useToast()
  const { t, i18n } = useTranslation()

  const [group, setGroup]           = useState(null)
  const [lesson, setLesson]         = useState(null)
  const [members, setMembers]       = useState([])
  const [attendance, setAttendance] = useState([])
  const [scores, setScores]         = useState([])
  const [journal, setJournal]       = useState([])
  const [homework, setHomework]     = useState({ assignment: '', submissions: [] })
  const [tab, setTab]               = useState('attendance')
  const [loading, setLoading]       = useState(true)
  const [ending, setEnding]         = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

  const isTeacher = user?.role === 'teacher' && group?.teacher === user?.id

  const hasHomework  = !!homework.assignment?.trim()
  const scoredIds    = new Set(scores.map(s => s.student))
  const unscoredCount = members.filter(m => !scoredIds.has(m.id)).length

  const handleEndLesson = async () => {
    setShowEndConfirm(false)
    setEnding(true)
    try {
      const { data } = await endLesson(groupId, lessonId)
      setLesson(l => ({ ...l, ended_at: data.ended_at }))
      show(t('lesson.toast_ended', { count: data.notified }), 'success')
    } catch {
      show(t('lesson.toast_fail_end'), 'error')
    } finally {
      setEnding(false)
    }
  }

  const attemptEndLesson = () => {
    if (!hasHomework || unscoredCount > 0) {
      setShowEndConfirm(true)
    } else {
      handleEndLesson()
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getGroup(groupId),
      getMembers(groupId),
      getAttendance(groupId, lessonId),
      getScores(groupId, lessonId),
      getJournal(groupId, lessonId),
      getHomework(groupId, lessonId),
    ]).then(([g, m, a, s, j, hw]) => {
      setGroup(g.data)
      setMembers(m.data)
      setAttendance(a.data)
      setScores(s.data)
      setJournal(j.data)
      setHomework(hw.data)
      getLesson(groupId, lessonId).then(r => setLesson(r.data))
    }).catch(() => show(t('lesson.toast_fail_load'), 'error'))
    .finally(() => setLoading(false))
  }, [groupId, lessonId])

  if (loading) return <Spinner />
  if (!group) return <p style={{ color: 'var(--text-muted)' }}>{t('lesson.toast_fail_load')}</p>

  const tabs = [
    { key: 'attendance', label: t('lesson.tab_attendance') },
    { key: 'scores',     label: t('lesson.tab_scores') },
    { key: 'journal',    label: t('lesson.tab_journal') },
    { key: 'homework',   label: t('lesson.tab_homework') },
  ]

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        <Link to="/groups" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{t('common.groups')}</Link>
        <ChevronRight size={14} />
        <Link to={`/groups/${groupId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{group.name}</Link>
        <ChevronRight size={14} />
        <span>{lesson?.title || 'Lesson'}</span>
      </div>

      <div className="lesson-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 className="page-title" style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>{lesson?.title}</h2>
          {lesson?.ended_at && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--success)', background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: 99, padding: '4px 10px' }}>
              <CheckCircle2 size={13} /> {t('lesson.ended_badge')}
            </span>
          )}
        </div>
        {isTeacher && (
          <motion.button
            whileHover={{ translateY: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={attemptEndLesson}
            disabled={ending}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 8, border: 'none', flexShrink: 0,
              background: ending ? 'var(--text-muted)' : '#7C3AED',
              color: '#fff', fontWeight: 600, fontSize: 13, cursor: ending ? 'default' : 'pointer',
              opacity: ending ? 0.7 : 1,
            }}
          >
            {ending
              ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />
              : <BellRing size={14} />
            }
            {ending ? t('lesson.ending') : t('lesson.end_lesson')}
          </motion.button>
        )}
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
        {lesson ? formatDayMonthYear(lesson.date, i18n.language) : ''}
      </p>

      {isTeacher && lesson && (
        <div style={{ marginBottom: 24 }}>
          <GameBlock groupId={groupId} lessonId={lessonId} lesson={lesson} members={members} attendance={attendance} />
        </div>
      )}

      {/* Tabs */}
      <div className="scroll-fade" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {tabs.map(item => (
          <button key={item.key} className="tab-btn" onClick={() => setTab(item.key)} style={{
            padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, textTransform: 'capitalize', whiteSpace: 'nowrap',
            color: tab === item.key ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: tab === item.key ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.15s', flexShrink: 0,
          }}>{item.label}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {tab === 'attendance' && (
            <AttendanceTab members={members} attendance={attendance} groupId={groupId} lessonId={lessonId}
              isTeacher={isTeacher} onSaved={setAttendance} />
          )}
          {tab === 'scores' && (
            <ScoresTab members={members} scores={scores} groupId={groupId} lessonId={lessonId}
              isTeacher={isTeacher} onSaved={setScores} />
          )}
          {tab === 'journal' && (
            <JournalTab journal={journal} groupId={groupId} lessonId={lessonId}
              isTeacher={isTeacher} onSaved={setJournal} />
          )}
          {tab === 'homework' && (
            <HomeworkTab homework={homework} groupId={groupId} lessonId={lessonId}
              isTeacher={isTeacher} onSaved={setHomework} />
          )}
        </motion.div>
      </AnimatePresence>

      <Modal open={showEndConfirm} onClose={() => setShowEndConfirm(false)} title={t('lesson.end_confirm_title')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {!hasHomework && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderRadius: 9, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <AlertTriangle size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('lesson.end_warn_no_homework')}</span>
            </div>
          )}
          {unscoredCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderRadius: 9, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <AlertTriangle size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('lesson.end_warn_unscored', { count: unscoredCount })}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => setShowEndConfirm(false)} style={ghostBtn}>{t('lesson.cancel')}</button>
          <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={handleEndLesson}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: 'none', background: '#7C3AED', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <BellRing size={14} /> {t('lesson.end_anyway')}
          </motion.button>
        </div>
      </Modal>
    </div>
  )
}

// ── Attendance ────────────────────────────────────────────────────────────────

function AttendanceTab({ members, attendance, groupId, lessonId, isTeacher, onSaved }) {
  const { show } = useToast()
  const { t } = useTranslation()
  const [local, setLocal]   = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const map = {}
    attendance.forEach(a => { map[a.student] = a.present })
    members.forEach(m => { if (!(m.id in map)) map[m.id] = false })
    setLocal(map)
  }, [attendance, members])

  const toggle = id => setLocal(l => ({ ...l, [id]: !l[id] }))
  const markAll = present => setLocal(l => {
    const next = { ...l }
    members.forEach(m => { next[m.id] = present })
    return next
  })

  const save = async () => {
    setSaving(true)
    try {
      const records = Object.entries(local).map(([student, present]) => ({ student: Number(student), present }))
      const { data } = await saveAttendance(groupId, lessonId, records)
      onSaved(data)
      show(t('lesson.toast_attendance'), 'success')
    } catch { show(t('lesson.toast_fail_attendance'), 'error') }
    finally { setSaving(false) }
  }

  const presentCount = Object.values(local).filter(Boolean).length
  const total        = members.length

  return (
    <div>
      <div className="stats-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Stat label={t('lesson.present')} value={presentCount}          color="var(--success)" />
          <Stat label={t('lesson.absent')}  value={total - presentCount}  color="var(--danger)" />
          <Stat label={t('lesson.total')}   value={total}                 color="var(--text-muted)" />
        </div>
        {isTeacher && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={() => markAll(true)}
              title={t('lesson.mark_all_present')} aria-label={t('lesson.mark_all_present')}
              style={{ ...ghostBtn, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, padding: 0, color: 'var(--success)', borderColor: 'rgba(5,150,105,0.35)' }}>
              <CheckCheck size={16} />
            </motion.button>
            <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={() => markAll(false)}
              title={t('lesson.mark_all_absent')} aria-label={t('lesson.mark_all_absent')}
              style={{ ...ghostBtn, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, padding: 0, color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.35)' }}>
              <XCircle size={16} />
            </motion.button>
            <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={save} disabled={saving}
              style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Save size={14} />}
              {saving ? t('lesson.saving') : t('lesson.save')}
            </motion.button>
          </div>
        )}
      </div>

      {members.length === 0 ? <EmptyTab icon={Users} text={t('lesson.no_students')} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map((m, i) => {
            const present = local[m.id] ?? false
            return (
              <motion.div key={m.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14, background: 'var(--surface)', border: `1.5px solid ${present ? 'var(--success)' : 'var(--border)'}`, borderRadius: 10, padding: '12px 16px', transition: 'border-color 0.2s' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: present ? 'rgba(5,150,105,0.12)' : 'var(--bg)', border: `1.5px solid ${present ? 'var(--success)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: present ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0, transition: 'all 0.2s' }}>
                  {(m.first_name?.[0] || m.username?.[0] || '?').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{m.first_name} {m.last_name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{m.username}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: present ? 'var(--success)' : 'var(--danger)' }}>
                    {present ? t('lesson.present') : t('lesson.absent')}
                  </span>
                  {isTeacher && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggle(m.id)}
                      style={{ width: 32, height: 32, borderRadius: 7, border: `1.5px solid ${present ? 'var(--success)' : 'var(--border)'}`, background: present ? 'rgba(5,150,105,0.12)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.17s' }}>
                      <CheckSquare size={16} color={present ? 'var(--success)' : 'var(--text-muted)'} />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Scores ────────────────────────────────────────────────────────────────────

function ScoresTab({ members, scores, groupId, lessonId, isTeacher, onSaved }) {
  const { show } = useToast()
  const { t } = useTranslation()
  const [local, setLocal]   = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const map = {}
    scores.forEach(s => { map[s.student] = s.value })
    members.forEach(m => { if (!(m.id in map)) map[m.id] = '' })
    setLocal(map)
  }, [scores, members])

  const set = (id, val) => {
    const n = Number(val)
    if (val === '' || (n >= 0 && n <= 5)) setLocal(l => ({ ...l, [id]: val === '' ? '' : n }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const records = Object.entries(local)
        .filter(([, v]) => v !== '')
        .map(([student, value]) => ({ student: Number(student), value: Number(value) }))
      const { data } = await saveScores(groupId, lessonId, records)
      onSaved(data)
      show(t('lesson.toast_scores'), 'success')
    } catch { show(t('lesson.toast_fail_scores'), 'error') }
    finally { setSaving(false) }
  }

  const filled = Object.values(local).filter(v => v !== '').length
  const avg    = filled ? (Object.values(local).filter(v => v !== '').reduce((a, b) => a + Number(b), 0) / filled).toFixed(1) : '—'

  return (
    <div>
      <div className="stats-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Stat label={t('lesson.scored')}  value={filled} color="var(--accent)" />
          <Stat label={t('lesson.average')} value={avg}    color="var(--warning)" />
        </div>
        {isTeacher && (
          <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={save} disabled={saving}
            style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Save size={14} />}
            {saving ? t('lesson.saving') : t('lesson.save_scores')}
          </motion.button>
        )}
      </div>

      {members.length === 0 ? <EmptyTab icon={Users} text={t('lesson.no_students')} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map((m, i) => {
            const score = local[m.id] ?? ''
            return (
              <motion.div key={m.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', flexWrap: 'wrap' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-bg)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: 'var(--accent)', flexShrink: 0 }}>
                  {(m.first_name?.[0] || m.username?.[0] || '?').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{m.first_name} {m.last_name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{m.username}</p>
                </div>
                {isTeacher ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {[0,1,2,3,4,5].map(n => (
                      <motion.button key={n} whileTap={{ scale: 0.85 }} onClick={() => set(m.id, score === n ? '' : n)}
                        className="score-btn"
                        style={{ width: 36, height: 36, borderRadius: 7, border: `1.5px solid ${score === n ? 'var(--accent)' : 'var(--border)'}`, background: score === n ? 'var(--accent-bg)' : 'transparent', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: score === n ? 'var(--accent)' : 'var(--text-muted)', transition: 'all 0.15s', flexShrink: 0 }}>
                        {n}
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Star size={16} color="var(--warning)" fill={score !== '' ? 'var(--warning)' : 'none'} />
                    <span style={{ fontWeight: 700, fontSize: 18, color: score !== '' ? 'var(--text)' : 'var(--text-muted)' }}>
                      {score !== '' ? score : '—'}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>/5</span>
                    </span>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Journal ───────────────────────────────────────────────────────────────────

function JournalTab({ journal, groupId, lessonId, isTeacher, onSaved }) {
  const { show } = useToast()
  const { t } = useTranslation()
  const [body, setBody]     = useState(journal[0]?.body || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (!isTeacher) setBody(journal[0]?.body || '') }, [journal])

  const save = async () => {
    if (!body.trim()) { show(t('lesson.err_journal_empty'), 'error'); return }
    setSaving(true)
    try {
      const { data } = await saveJournal(groupId, lessonId, body)
      onSaved([data])
      show(t('lesson.toast_journal'), 'success')
    } catch { show(t('lesson.toast_fail_journal'), 'error') }
    finally { setSaving(false) }
  }

  const suffix = journal.length === 1 ? t('lesson.entry') : t('lesson.entries')

  if (isTeacher) {
    return (
      <div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{journal.length} {suffix} {t('lesson.entries_count').split(' ').slice(-1)[0]}</p>
        {journal.length === 0 ? <EmptyTab icon={BookOpen} text={t('lesson.no_journals')} /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {journal.map((j, i) => (
              <motion.div key={j.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-bg)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'var(--accent)' }}>
                    {j.student_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{j.student_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDayMonthTime(j.updated_at)}</p>
                  </div>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{j.body}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        {t('lesson.journal_hint')}
      </p>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={t('lesson.journal_placeholder')}
        rows={8}
        style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, lineHeight: 1.7, resize: 'vertical', outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={save} disabled={saving}
          style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Save size={14} />}
          {saving ? t('lesson.saving') : journal.length ? t('lesson.update_journal') : t('lesson.submit_journal')}
        </motion.button>
      </div>
    </div>
  )
}

// ── Homework ──────────────────────────────────────────────────────────────────

function HomeworkTab({ homework, groupId, lessonId, isTeacher, onSaved }) {
  const { show } = useToast()
  const { t } = useTranslation()
  const [assignment, setAssignment] = useState(homework.assignment || '')
  const [body, setBody]             = useState('')
  const [savingAssignment, setSavingAssignment] = useState(false)
  const [savingSubmission, setSavingSubmission] = useState(false)

  useEffect(() => {
    setAssignment(homework.assignment || '')
    if (!isTeacher) setBody(homework.submissions[0]?.body || '')
  }, [homework])

  const saveAssignment = async () => {
    setSavingAssignment(true)
    try {
      const { data } = await setHomeworkAssignment(groupId, lessonId, assignment)
      onSaved(hw => ({ ...hw, assignment: data.assignment }))
      show(t('lesson.toast_homework_saved'), 'success')
    } catch { show(t('lesson.toast_fail_homework'), 'error') }
    finally { setSavingAssignment(false) }
  }

  const submitHomework = async () => {
    if (!body.trim()) { show(t('lesson.err_homework_empty'), 'error'); return }
    setSavingSubmission(true)
    try {
      const { data } = await saveHomework(groupId, lessonId, body)
      onSaved(hw => ({ ...hw, submissions: [data] }))
      show(t('lesson.toast_homework_submitted'), 'success')
    } catch { show(t('lesson.toast_fail_homework'), 'error') }
    finally { setSavingSubmission(false) }
  }

  if (isTeacher) {
    return (
      <div style={{ maxWidth: 720 }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>{t('lesson.homework_assignment_hint')}</p>
        <textarea
          value={assignment}
          onChange={e => setAssignment(e.target.value)}
          placeholder={t('lesson.homework_assignment_placeholder')}
          rows={5}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, lineHeight: 1.7, resize: 'vertical', outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, marginBottom: 32 }}>
          <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={saveAssignment} disabled={savingAssignment}
            style={{ ...primaryBtn, opacity: savingAssignment ? 0.7 : 1 }}>
            {savingAssignment ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Save size={14} />}
            {savingAssignment ? t('lesson.saving') : t('lesson.save_assignment')}
          </motion.button>
        </div>

        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
          {homework.submissions.length} {t('lesson.submissions_count')}
        </p>
        {homework.submissions.length === 0 ? (
          <EmptyTab icon={ClipboardList} text={t('lesson.no_submissions')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {homework.submissions.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-bg)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'var(--accent)' }}>
                    {s.student_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{s.student_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDayMonthTime(s.submitted_at)}</p>
                  </div>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{s.body}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680 }}>
      {assignment ? (
        <div style={{ background: 'var(--surface)', border: '1.5px solid var(--accent)', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{t('lesson.assignment')}</p>
          <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{assignment}</p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t('lesson.no_assignment_yet')}</p>
        </div>
      )}

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>{t('lesson.homework_hint')}</p>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={t('lesson.homework_placeholder')}
        rows={7}
        style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, lineHeight: 1.7, resize: 'vertical', outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={submitHomework} disabled={savingSubmission}
          style={{ ...primaryBtn, opacity: savingSubmission ? 0.7 : 1 }}>
          {savingSubmission ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Save size={14} />}
          {savingSubmission ? t('lesson.saving') : homework.submissions.length ? t('lesson.update_homework') : t('lesson.submit_homework')}
        </motion.button>
      </div>
    </div>
  )
}

// ── Winning game ──────────────────────────────────────────────────────────────

const selectStyle = { padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none', minWidth: 150 }

function GameBlock({ groupId, lessonId, lesson, members, attendance }) {
  const [game, setGame]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)

  const load = () => {
    setLoading(true)
    getLessonGame(groupId, lessonId).then(r => setGame(r.data)).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(load, [groupId, lessonId])

  const presentIds = new Set(attendance.filter(a => a.present).map(a => a.student))
  const presentMembers = members.filter(m => presentIds.has(m.id))

  if (loading || !game) {
    return <div style={{ height: 84, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }} />
  }

  if (game.status === 'not_started') {
    return <NotStartedCard groupId={groupId} lessonId={lessonId} lesson={lesson} game={game} onStarted={setGame} />
  }

  if (game.status === 'in_progress') {
    if (closing) {
      return game.is_individual
        ? <IndividualCloseScreen groupId={groupId} lessonId={lessonId} presentMembers={presentMembers}
            onClosed={g => { setGame(g); setClosing(false) }} onBack={() => setClosing(false)} />
        : <CloseScreen groupId={groupId} lessonId={lessonId} game={game} presentMembers={presentMembers}
            onClosed={g => { setGame(g); setClosing(false) }} onBack={() => setClosing(false)} />
    }
    return <InProgressCard groupId={groupId} lessonId={lessonId}
      onCancelled={load} onFinishClick={() => setClosing(true)} startedAt={game.started_at} />
  }

  return <ClosedResultsCard game={game} />
}

function NotStartedCard({ groupId, lessonId, lesson, game, onStarted }) {
  const { t, i18n } = useTranslation(); const { show } = useToast()
  const [starting, setStarting] = useState(false)
  const dayName = weekdayName(new Date(lesson.date).getDay(), i18n.language)
  const rules = game.rules
  const big = game.is_big_day

  const start = async () => {
    setStarting(true)
    try {
      const { data } = await startGame(groupId, lessonId)
      onStarted(data)
      show(t('game.toast_started'), 'success')
    } catch (err) {
      show(err.response?.data?.detail || t('game.toast_start_fail'), 'error')
    } finally { setStarting(false) }
  }

  return (
    <div style={{ border: `1.5px solid ${big ? '#008E00' : 'var(--border)'}`, borderRadius: 14, padding: 20, background: big ? 'rgba(0,142,0,0.05)' : 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Trophy size={18} color={big ? '#008E00' : 'var(--text-muted)'} />
        <p style={{ fontWeight: 800, fontSize: 15 }}>{t('game.title')}</p>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
        {dayName} — {big ? <span style={{ color: '#008E00', fontWeight: 700 }}>{t('game.big_day')} ×2</span> : t('game.normal_day')}
      </p>

      {game.is_individual ? (
        <p style={{ fontSize: 14, marginBottom: 14 }}>🎯 {rules.individual} {t('game.coins_short')}</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18, marginBottom: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 15 }}>🥇 {rules.p1}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 15 }}>🥈 {rules.p2}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 15 }}>🥉 {rules.p3}</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('game.effort_range', { min: rules.effort_min, max: rules.effort_max })}</span>
        </div>
      )}

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        {t('game.attended_count', { count: game.attended_count })} · {t('game.total_preview', { total: game.total_preview })}
      </p>

      <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={start} disabled={starting}
        style={{ ...primaryBtn, opacity: starting ? 0.7 : 1 }}>
        {starting && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
        {starting ? t('game.starting') : t('game.start_btn')}
      </motion.button>
    </div>
  )
}

function InProgressCard({ groupId, lessonId, startedAt, onCancelled, onFinishClick }) {
  const { t } = useTranslation(); const { show } = useToast()
  const [cancelling, setCancelling] = useState(false)

  const cancel = async () => {
    setCancelling(true)
    try {
      await cancelGame(groupId, lessonId)
      onCancelled()
      show(t('game.toast_cancelled'), 'info')
    } catch { show(t('game.toast_cancel_fail'), 'error') }
    finally { setCancelling(false) }
  }

  return (
    <div style={{ border: '1.5px solid var(--accent)', borderRadius: 14, padding: 20, background: 'var(--accent-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Trophy size={18} color="var(--accent)" />
        <p style={{ fontWeight: 800, fontSize: 15 }}>{t('game.in_progress_title')}</p>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        {t('game.started_at', { time: new Date(startedAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) })}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={onFinishClick} style={primaryBtn}>
          <Trophy size={14} /> {t('game.finish_btn')}
        </motion.button>
        <button onClick={cancel} disabled={cancelling} style={{ ...ghostBtn, opacity: cancelling ? 0.7 : 1 }}>
          {cancelling ? t('game.cancelling') : t('game.cancel_btn')}
        </button>
      </div>
    </div>
  )
}

function IndividualCloseScreen({ groupId, lessonId, presentMembers, onClosed, onBack }) {
  const { t } = useTranslation(); const { show } = useToast()
  const [completed, setCompleted] = useState(true)
  const [saving, setSaving] = useState(false)
  const student = presentMembers[0]

  const submit = async () => {
    setSaving(true)
    try {
      const { data } = await closeGame(groupId, lessonId, { completed })
      onClosed(data)
      show(t('game.toast_closed'), 'success')
    } catch (err) {
      show(err.response?.data?.detail || t('game.toast_close_fail'), 'error')
    } finally { setSaving(false) }
  }

  if (!student) {
    return (
      <div style={{ border: '1.5px solid var(--border)', borderRadius: 14, padding: 20 }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{t('game.no_one_present')}</p>
        <button onClick={onBack} style={ghostBtn}>{t('game.back_btn')}</button>
      </div>
    )
  }

  return (
    <div style={{ border: '1.5px solid var(--accent)', borderRadius: 14, padding: 20 }}>
      <p style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>{`${student.first_name} ${student.last_name}`.trim() || student.username}</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setCompleted(true)}
          style={{ flex: 1, minWidth: 140, padding: 14, borderRadius: 10, border: `1.5px solid ${completed ? 'var(--success)' : 'var(--border)'}`, background: completed ? 'rgba(5,150,105,0.1)' : 'transparent', color: completed ? 'var(--success)' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer' }}>
          ✅ {t('game.completed_btn')}
        </button>
        <button onClick={() => setCompleted(false)}
          style={{ flex: 1, minWidth: 140, padding: 14, borderRadius: 10, border: `1.5px solid ${!completed ? 'var(--danger)' : 'var(--border)'}`, background: !completed ? 'rgba(220,38,38,0.1)' : 'transparent', color: !completed ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer' }}>
          ☐ {t('game.not_completed_btn')}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onBack} style={ghostBtn}>{t('game.back_btn')}</button>
        <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={submit} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
          {saving && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
          {saving ? t('game.closing') : t('game.confirm_close_btn')}
        </motion.button>
      </div>
    </div>
  )
}

function CloseScreen({ groupId, lessonId, game, presentMembers, onClosed, onBack }) {
  const { t } = useTranslation(); const { show } = useToast()
  const [first, setFirst]     = useState('')
  const [second, setSecond]   = useState('')
  const [third, setThird]     = useState('')
  const [efforts, setEfforts] = useState(() => Object.fromEntries(presentMembers.map(m => [m.id, 1])))
  const [saving, setSaving]   = useState(false)

  const rules = game.applied_rules
  const showGoodState = rules.effort_min !== rules.effort_max

  const handlePick = (place, value) => {
    const v = value ? Number(value) : ''
    if (place === 'first')  { setFirst(v);  if (second === v) setSecond(''); if (third === v) setThird('') }
    if (place === 'second') { setSecond(v); if (first === v) setFirst('');   if (third === v) setThird('') }
    if (place === 'third')  { setThird(v);  if (first === v) setFirst('');   if (second === v) setSecond('') }
  }

  const cycleEffort = id => setEfforts(e => {
    const cur = e[id]
    const next = showGoodState ? (cur + 1) % 3 : (cur === 0 ? 1 : 0)
    return { ...e, [id]: next }
  })

  const placedIds = new Set([first, second, third].filter(v => v !== ''))

  const total = (() => {
    let sum = 0
    if (first)  sum += rules.p1
    if (second) sum += rules.p2
    if (third)  sum += rules.p3
    presentMembers.forEach(m => {
      if (!placedIds.has(m.id)) {
        const eff = efforts[m.id]
        sum += eff === 2 ? rules.effort_max : eff === 1 ? rules.effort_min : 0
      }
    })
    return sum
  })()

  const submit = async () => {
    setSaving(true)
    try {
      const { data } = await closeGame(groupId, lessonId, { first: first || null, second: second || null, third: third || null, efforts })
      onClosed(data)
      show(t('game.toast_closed'), 'success')
    } catch (err) {
      show(err.response?.data?.detail || t('game.toast_close_fail'), 'error')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ border: '1.5px solid var(--accent)', borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        <Trophy size={18} color="var(--accent)" />
        <p style={{ fontWeight: 800, fontSize: 15 }}>{t('game.close_title')}</p>
      </div>

      <div style={{
        display: 'grid', gap: 12, marginBottom: 22,
        gridTemplateColumns: `repeat(auto-fit, minmax(170px, 1fr))`,
      }}>
        <PlaceSelect meta={MEDAL_META.first} value={first} coins={rules.p1}
          onChange={v => handlePick('first', v)} members={presentMembers} exclude={[second, third]} t={t} />
        <PlaceSelect meta={MEDAL_META.second} value={second} coins={rules.p2}
          onChange={v => handlePick('second', v)} members={presentMembers} exclude={[first, third]} t={t} />
        {game.can_pick_third && (
          <PlaceSelect meta={MEDAL_META.third} value={third} coins={rules.p3}
            onChange={v => handlePick('third', v)} members={presentMembers} exclude={[first, second]} t={t} />
        )}
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('game.attended_label')}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('game.effort_hint')}</p>
        </div>
        {presentMembers.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('game.no_one_present')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {presentMembers.map((m, i) => {
              const medalPlace = first === m.id ? 'first' : second === m.id ? 'second' : third === m.id ? 'third' : null
              const name = `${m.first_name} ${m.last_name}`.trim() || m.username

              if (medalPlace) {
                const meta = MEDAL_META[medalPlace]
                const coins = meta.coins(rules)
                return (
                  <motion.div key={m.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, background: meta.bg, border: `1.5px solid ${meta.color}`, borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: `1.5px solid ${meta.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                      {meta.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 100 }}>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{name}</p>
                      <p style={{ fontSize: 12, color: meta.color, fontWeight: 600 }}>{t(meta.labelKey)}</p>
                    </div>
                    <CoinBadge amount={coins} color={meta.color} />
                  </motion.div>
                )
              }

              const eff = efforts[m.id]
              const Icon = eff === 2 ? Star : eff === 1 ? CheckSquare : Square
              const color = eff === 2 ? '#F59E0B' : eff === 1 ? 'var(--success)' : 'var(--text-muted)'
              const stateLabel = eff === 2 ? t('game.effort_good') : eff === 1 ? t('game.effort_ok') : t('game.effort_none')
              const coins = eff === 2 ? rules.effort_max : eff === 1 ? rules.effort_min : 0
              return (
                <motion.button key={m.id} onClick={() => cycleEffort(m.id)}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                  whileTap={{ scale: 0.99 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)',
                    border: `1.5px solid ${eff !== 0 ? color : 'var(--border)'}`, borderRadius: 10, padding: '10px 14px',
                    cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color 0.15s',
                  }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: eff !== 0 ? `color-mix(in srgb, ${color} 14%, transparent)` : 'var(--bg)', border: `1.5px solid ${eff !== 0 ? color : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} color={color} fill={eff !== 0 ? color : 'none'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{name}</p>
                    <p style={{ fontSize: 12, color, fontWeight: 600 }}>{stateLabel}</p>
                  </div>
                  <CoinBadge amount={coins} color={color} muted={eff === 0} />
                </motion.button>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--accent-bg)', borderRadius: 10, padding: '12px 16px', marginBottom: 18 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{t('game.total_distributing')}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 18, color: 'var(--accent)' }}>
          <Coins size={16} color="var(--accent)" fill="var(--accent)" /> {total}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onBack} style={ghostBtn}>{t('game.back_btn')}</button>
        <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={submit} disabled={saving || presentMembers.length === 0}
          style={{ ...primaryBtn, opacity: (saving || presentMembers.length === 0) ? 0.7 : 1 }}>
          {saving && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
          {saving ? t('game.closing') : t('game.confirm_close_btn')}
        </motion.button>
      </div>
    </div>
  )
}

const MEDAL_META = {
  first:  { emoji: '🥇', color: '#D97706', bg: 'rgba(217,119,6,0.08)',   labelKey: 'game.place_1', coins: rules => rules.p1 },
  second: { emoji: '🥈', color: '#64748B', bg: 'rgba(100,116,139,0.10)', labelKey: 'game.place_2', coins: rules => rules.p2 },
  third:  { emoji: '🥉', color: '#B45309', bg: 'rgba(180,83,9,0.08)',    labelKey: 'game.place_3', coins: rules => rules.p3 },
}

function CoinBadge({ amount, color, muted }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 12,
      color: muted ? 'var(--text-muted)' : color, background: muted ? 'var(--bg)' : `color-mix(in srgb, ${color} 12%, transparent)`,
      borderRadius: 999, padding: '4px 10px', flexShrink: 0,
    }}>
      <Coins size={11} color={muted ? 'var(--text-muted)' : color} fill={muted ? 'none' : color} /> {amount > 0 ? `+${amount}` : amount}
    </span>
  )
}

function PlaceSelect({ meta, value, coins, onChange, members, exclude, t }) {
  return (
    <div style={{ border: `1.5px solid ${value ? meta.color : 'var(--border)'}`, background: value ? meta.bg : 'var(--surface)', borderRadius: 12, padding: '12px 14px', transition: 'all 0.2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: value ? meta.color : 'var(--text-muted)' }}>
          <span style={{ fontSize: 18 }}>{meta.emoji}</span> {t(meta.labelKey)}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>+{coins}</span>
      </div>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...selectStyle, width: '100%', minWidth: 0 }}>
        <option value="">{t('game.pick_placeholder')}</option>
        {members.filter(m => !exclude.includes(m.id)).map(m => (
          <option key={m.id} value={m.id}>{`${m.first_name} ${m.last_name}`.trim() || m.username}</option>
        ))}
      </select>
    </div>
  )
}

function ClosedResultsCard({ game }) {
  const { t } = useTranslation()
  const medalFor = r => r.place === 1 ? '🥇' : r.place === 2 ? '🥈' : r.place === 3 ? '🥉' : null

  return (
    <div style={{ border: '1.5px solid var(--success)', borderRadius: 14, padding: 20, background: 'rgba(5,150,105,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Trophy size={18} color="var(--success)" />
        <p style={{ fontWeight: 800, fontSize: 15 }}>{t('game.closed_title')}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {game.results.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', background: 'var(--surface)', borderRadius: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13 }}>{medalFor(r) && <span style={{ marginRight: 6 }}>{medalFor(r)}</span>}{r.student_name}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 13, color: r.coins > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
              <Coins size={13} color={r.coins > 0 ? 'var(--success)' : 'var(--text-muted)'} fill={r.coins > 0 ? 'var(--success)' : 'none'} />
              {r.coins > 0 ? `+${r.coins}` : '0'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', minWidth: 64 }}>
      <p style={{ fontSize: 18, fontWeight: 700, color }}>{value}</p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</p>
    </div>
  )
}

function EmptyTab({ icon: Icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ width: 48, height: 48, background: 'var(--accent-bg)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <Icon size={22} color="var(--accent)" />
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{text}</p>
    </div>
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

const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const ghostBtn   = { padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
