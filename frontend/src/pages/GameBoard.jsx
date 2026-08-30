import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Crown, ChevronRight, RotateCcw, Trophy, Zap, Check, X, Loader2, Lightbulb, Flag, Users, Clock, HelpCircle, AlertTriangle, XCircle, KeyRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getGame, startGame, pickSquare, answerQuestion, finishGame, resetGame, swapTeamMembers, reshuffleTeams } from '../api/quiz'

const DIFF_COLOR = { easy: '#22C55E', medium: '#F59E0B', hard: '#EF4444' }
const TEAM_COLORS = ['#6366F1', '#F59E0B', '#22C55E', '#EF4444', '#8B5CF6', '#EC4899']

// ── Sound effects (Web Audio API) ─────────────────────────────────────────────
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const g = ctx.createGain()
    g.connect(ctx.destination)
    if (type === 'correct') {
      const freqs = [523, 659, 784, 1047]
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f
        const eg = ctx.createGain(); eg.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.12)
        eg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3)
        o.connect(eg); eg.connect(ctx.destination)
        o.start(ctx.currentTime + i * 0.12); o.stop(ctx.currentTime + i * 0.12 + 0.3)
      })
    } else if (type === 'wrong') {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(220, ctx.currentTime)
      o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4)
      g.gain.setValueAtTime(0.18, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      o.connect(g); o.start(); o.stop(ctx.currentTime + 0.4)
    } else if (type === 'tick') {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 880
      g.gain.setValueAtTime(0.06, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
      o.connect(g); o.start(); o.stop(ctx.currentTime + 0.08)
    } else if (type === 'steal') {
      const o = ctx.createOscillator(); o.type = 'sine'
      o.frequency.setValueAtTime(440, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2)
      g.gain.setValueAtTime(0.2, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      o.connect(g); o.start(); o.stop(ctx.currentTime + 0.3)
    }
    setTimeout(() => ctx.close(), 2000)
  } catch {}
}

// ── Typewriter text ────────────────────────────────────────────────────────────
function Typewriter({ text, speed = 22 }) {
  const [shown, setShown] = useState('')
  useEffect(() => {
    setShown('')
    let i = 0
    const id = setInterval(() => {
      i++
      setShown(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [text])
  return <span>{shown}</span>
}

// ── Timer ring ────────────────────────────────────────────────────────────────
function TimerRing({ seconds, total, onTick }) {
  const r = 32, circ = 2 * Math.PI * r
  const pct = Math.max(0, seconds / total)
  const color = pct > 0.5 ? '#22C55E' : pct > 0.25 ? '#F59E0B' : '#EF4444'
  useEffect(() => { if (seconds <= 5 && seconds > 0) playSound('tick') }, [seconds])
  return (
    <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={80} height={80} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx={40} cy={40} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
        <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }} />
      </svg>
      <span style={{ fontSize: 22, fontWeight: 800, color }}>{seconds}</span>
    </div>
  )
}

// ── STOLEN! flash ─────────────────────────────────────────────────────────────
function StolenFlash({ teamColor, teamName, onDone }) {
  useEffect(() => { playSound('steal'); const t = setTimeout(onDone, 1800); return () => clearTimeout(t) }, [])
  return (
    <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      style={{ position: 'fixed', inset: 0, background: `${teamColor}CC`, zIndex: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <motion.p animate={{ rotate: [-3, 3, -3, 3, 0] }} transition={{ duration: 0.4, repeat: 3 }}
        style={{ fontFamily: 'var(--font-display)', fontSize: 72, fontWeight: 900, color: '#fff', textShadow: '0 4px 40px rgba(0,0,0,0.4)' }}>
        STOLEN!
      </motion.p>
      <p style={{ fontSize: 22, fontWeight: 700, color: '#ffffffCC', marginTop: 12 }}>{teamName}</p>
    </motion.div>
  )
}

// ── Split animation ───────────────────────────────────────────────────────────
function TeamSplitScreen({ teams: initialTeams, isTeacher, groupId, gameId, onDone, onUpdate }) {
  const { t } = useTranslation()
  const { show } = useToast()
  const [teams, setTeams]           = useState(initialTeams)
  const [selected, setSelected]     = useState(null) // { studentId, teamId }
  const [swapping, setSwapping]     = useState(false)
  const [reshuffling, setReshuffling] = useState(false)

  useEffect(() => { setTeams(initialTeams) }, [initialTeams])

  const handleMemberClick = async (student, team) => {
    if (!isTeacher) return
    if (!selected) {
      setSelected({ studentId: student.id, teamId: team.id })
      return
    }
    if (selected.studentId === student.id) { setSelected(null); return }
    if (selected.teamId === team.id) { setSelected({ studentId: student.id, teamId: team.id }); return }

    setSwapping(true)
    try {
      const { data } = await swapTeamMembers(groupId, gameId, { student_a: selected.studentId, student_b: student.id })
      setTeams(data.teams)
      onUpdate(data)
    } catch { show(t('quiz.swap_fail'), 'error') }
    finally { setSwapping(false); setSelected(null) }
  }

  const handleReshuffle = async () => {
    setReshuffling(true)
    setSelected(null)
    try {
      const { data } = await reshuffleTeams(groupId, gameId)
      setTeams(data.teams)
      onUpdate(data)
    } catch { show(t('quiz.reshuffle_fail'), 'error') }
    finally { setReshuffling(false) }
  }

  const totalDelay = teams.length * 0.18 + 0.5

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24, overflowY: 'auto' }}>

      <motion.h2 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--text)', textAlign: 'center' }}>
        {t('quiz.teams_ready')}
      </motion.h2>

      {isTeacher && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 400 }}>
          {selected ? t('quiz.swap_hint_select_second') : t('quiz.swap_hint')}
        </motion.p>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 900 }}>
        {teams.map((team, ti) => {
          const color = TEAM_COLORS[ti % TEAM_COLORS.length]
          return (
            <motion.div key={team.id}
              initial={{ opacity: 0, scale: 0.6, y: 60 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: ti * 0.18, type: 'spring', stiffness: 300, damping: 22 }}
              style={{ background: 'var(--surface)', border: `2px solid ${color}`, borderRadius: 16, padding: '18px 20px', minWidth: 150, textAlign: 'center' }}>
              <p style={{ fontWeight: 800, fontSize: 16, color, marginBottom: 12 }}>{team.name}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {team.members.map(m => {
                  const isSel = selected?.studentId === m.id
                  const isSwapTarget = selected && selected.teamId !== team.id
                  return (
                    <motion.div key={m.id}
                      whileHover={isTeacher ? { scale: 1.04 } : {}}
                      whileTap={isTeacher ? { scale: 0.96 } : {}}
                      onClick={() => handleMemberClick(m, team)}
                      style={{
                        padding: '7px 12px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                        cursor: isTeacher ? 'pointer' : 'default',
                        background: isSel ? `${color}28` : isSwapTarget ? 'rgba(255,255,255,0.04)' : 'var(--bg)',
                        border: isSel ? `2px solid ${color}` : isSwapTarget ? `1.5px dashed ${color}66` : '1.5px solid var(--border)',
                        color: isSel ? color : 'var(--text)',
                        transition: 'all 0.18s',
                        opacity: swapping ? 0.6 : 1,
                      }}>
                      {isSel && <span style={{ marginRight: 5 }}>👆</span>}
                      {m.first_name ? `${m.first_name} ${m.last_name || ''}`.trim() : m.username}
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )
        })}
      </div>

      {isTeacher ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: totalDelay }}
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={handleReshuffle} disabled={reshuffling}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: reshuffling ? 0.6 : 1 }}>
            {reshuffling
              ? <Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} />
              : <RotateCcw size={15} />}
            {t('quiz.reshuffle')}
          </motion.button>
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => { setSelected(null); onDone() }}
            style={{ ...primaryBtn, fontSize: 15, padding: '10px 32px' }}>
            <Zap size={15} /> {t('quiz.go_board')}
          </motion.button>
        </motion.div>
      ) : (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: totalDelay }}
          style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {t('quiz.waiting_teacher')}
        </motion.p>
      )}
    </motion.div>
  )
}

// ── Game board grid ───────────────────────────────────────────────────────────
function Board({ board, answeredIds, doubleId, currentTeam, isTeacher, onPickSquare, t }) {
  const topics = Object.keys(board)
  if (!topics.length) return <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>{t('quiz.no_questions_in_game')}</p>

  return (
    <div className="scroll-fade" style={{ overflowX: 'auto', maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${topics.length}, minmax(140px, 1fr))`, gap: 10, minWidth: topics.length * 150 }}>
        {topics.map(topic => (
          <div key={topic} style={{ background: 'var(--accent)', borderRadius: 10, padding: '12px 14px', textAlign: 'center', fontWeight: 800, fontSize: 14, color: '#fff' }}>
            {topic}
          </div>
        ))}
        {(() => {
          const maxRows = Math.max(...topics.map(t => board[t].length))
          const cells = []
          for (let r = 0; r < maxRows; r++) {
            topics.forEach(topic => {
              const cell = board[topic][r]
              if (!cell) { cells.push(<div key={`${topic}-${r}-empty`} />); return }
              const answered  = answeredIds.includes(cell.id)
              const isDouble  = cell.id === doubleId
              const pickable  = isTeacher && !answered && currentTeam
              cells.push(
                <motion.button key={cell.id} whileHover={pickable ? { scale: 1.05, boxShadow: `0 6px 18px ${DIFF_COLOR[cell.difficulty]}33` } : {}} whileTap={pickable ? { scale: 0.97 } : {}}
                  onClick={() => pickable && onPickSquare(cell)}
                  disabled={answered || !isTeacher}
                  style={{
                    position: 'relative', padding: '24px 10px', borderRadius: 12,
                    border: `2px solid ${answered ? 'var(--border)' : isDouble ? '#F59E0B' : DIFF_COLOR[cell.difficulty]}`,
                    background: answered ? 'var(--bg)' : isDouble ? 'rgba(245,158,11,0.08)' : `${DIFF_COLOR[cell.difficulty]}12`,
                    cursor: pickable ? 'pointer' : 'default', textAlign: 'center', transition: 'opacity 0.2s',
                    opacity: answered ? 0.35 : 1,
                  }}>
                  {isDouble && !answered && (
                    <span style={{ position: 'absolute', top: 5, right: 7, fontSize: 10, fontWeight: 800, color: '#F59E0B' }}>2×</span>
                  )}
                  <span style={{ fontWeight: 800, fontSize: 26, color: answered ? 'var(--border)' : DIFF_COLOR[cell.difficulty], display: 'block' }}>
                    {answered ? '✓' : cell.points}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 3 }}>
                    {answered ? '' : t(`quiz.${cell.difficulty}`)}
                  </span>
                </motion.button>
              )
            })
          }
          return cells
        })()}
      </div>
    </div>
  )
}

// ── Question overlay ──────────────────────────────────────────────────────────
function QuestionOverlay({ question, team, timerTotal, isTeacher, teams, groupId, gameId, onDone, t }) {
  const { show } = useToast()
  const [timeLeft,     setTimeLeft]   = useState(timerTotal)
  const [phase,        setPhase]      = useState('answering') // answering | wrong | done
  const [loading,      setLoading]    = useState(false)
  const [stolenBy,     setStolenBy]   = useState(null)
  const [hintVisible,  setHintVisible] = useState(false)
  const [answerVisible, setAnswerVisible] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    setTimeLeft(timerTotal); setPhase('answering'); setHintVisible(false); setAnswerVisible(false); setStolenBy(null)
    intervalRef.current = setInterval(() => {
      setTimeLeft(s => { if (s <= 1) { clearInterval(intervalRef.current); return 0 } return s - 1 })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [question?.id])

  const markAnswer = async (correct, stealTeamId = null, partialPct = null) => {
    clearInterval(intervalRef.current)
    if (stealTeamId) {
      const st = teams.find(t => t.id === stealTeamId)
      setStolenBy({ id: stealTeamId, name: st?.name, color: TEAM_COLORS[teams.indexOf(st) % TEAM_COLORS.length] })
      return
    }
    setLoading(true)
    if (correct || (partialPct !== null && partialPct > 0)) playSound('correct'); else playSound('wrong')
    try {
      const { data } = await answerQuestion(groupId, gameId, { correct, steal_team_id: null, partial_pct: partialPct })
      onDone(data)
    } catch { show(t('quiz.toast_answer_fail'), 'error') }
    finally { setLoading(false) }
  }

  const confirmSteal = async () => {
    setLoading(true)
    playSound('steal')
    try {
      const { data } = await answerQuestion(groupId, gameId, { correct: false, steal_team_id: stolenBy.id })
      onDone(data)
    } catch { show(t('quiz.toast_answer_fail'), 'error') }
    finally { setLoading(false); setStolenBy(null) }
  }

  const otherTeams = teams.filter(tm => tm.id !== team?.id)

  return (
    <>
      <AnimatePresence>
        {stolenBy && (
          <StolenFlash teamColor={stolenBy.color} teamName={stolenBy.name} onDone={confirmSteal} />
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 36, maxWidth: 700, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {question.topic_name} · {question.points} {t('quiz.pts')}
              </span>
              {team && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-bg)', borderRadius: 99, padding: '2px 10px' }}>{team.name}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {isTeacher && question.hint && (
                <motion.button whileTap={{ scale: 0.94 }} onClick={() => setHintVisible(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: `1px solid ${hintVisible ? '#F59E0B' : 'var(--border)'}`, background: hintVisible ? 'rgba(245,158,11,0.12)' : 'transparent', color: hintVisible ? '#F59E0B' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Lightbulb size={13} /> {t('quiz.hint_btn')}
                </motion.button>
              )}
              {isTeacher && question.correct_answer && (
                <motion.button whileTap={{ scale: 0.94 }} onClick={() => setAnswerVisible(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: `1px solid ${answerVisible ? 'var(--success)' : 'var(--border)'}`, background: answerVisible ? 'rgba(5,150,105,0.12)' : 'transparent', color: answerVisible ? 'var(--success)' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <KeyRound size={13} /> {t('quiz.answer_key_btn')}
                </motion.button>
              )}
              <TimerRing seconds={timeLeft} total={timerTotal} />
            </div>
          </div>

          {/* Hint */}
          <AnimatePresence>
            {hintVisible && question.hint && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#F59E0B', fontStyle: 'italic', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <Lightbulb size={14} style={{ flexShrink: 0, marginTop: 1 }} />{question.hint}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Answer key (teacher-only, private reference) */}
          <AnimatePresence>
            {answerVisible && question.correct_answer && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <KeyRound size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                {question.answer_type === 'mcq'
                  ? `${question.correct_answer.toUpperCase()}) ${question.options?.[question.correct_answer] || ''}`
                  : question.answer_type === 'true_false'
                    ? (question.correct_answer === 'true' ? t('quiz.true') : t('quiz.false'))
                    : question.correct_answer}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Question */}
          <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.4, marginBottom: 28, color: 'var(--text)' }}>
            <Typewriter text={question.text} />
          </p>

          {/* MCQ options */}
          {question.answer_type === 'mcq' && question.options && (
            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
              {['a', 'b', 'c', 'd'].filter(k => question.options[k]).map(k => (
                <div key={k} style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--accent)', width: 20 }}>{k.toUpperCase()}</span>
                  <span style={{ fontSize: 14, color: 'var(--text)' }}>{question.options[k]}</span>
                </div>
              ))}
            </div>
          )}

          {/* True/False */}
          {question.answer_type === 'true_false' && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
              {['True', 'False'].map(v => (
                <div key={v} style={{ flex: 1, background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '16px', textAlign: 'center', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{v}</div>
              ))}
            </div>
          )}

          {/* Open */}
          {question.answer_type === 'open' && (
            <div style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '16px', marginBottom: 28, fontSize: 14, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {t('quiz.verbal_answer')}
            </div>
          )}

          {/* Teacher controls */}
          {isTeacher && phase === 'answering' && question.answer_type === 'open' ? (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                {t('quiz.partial_score_label')}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
                {[25, 50, 75, 100].map(pct => {
                  const pts = Math.floor(question.points * (question.is_double || false ? 2 : 1) * pct / 100)
                  const color = pct === 100 ? '#22C55E' : pct >= 75 ? '#65a30d' : pct >= 50 ? '#F59E0B' : '#f97316'
                  return (
                    <motion.button key={pct} whileTap={{ scale: 0.94 }} disabled={loading}
                      onClick={() => markAnswer(pct === 100, null, pct)}
                      style={{ padding: '12px 4px', borderRadius: 10, border: `2px solid ${color}`, background: `${color}18`, color, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 18 }}>{pct}%</span>
                      <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>{pts} {t('quiz.pts')}</span>
                    </motion.button>
                  )
                })}
              </div>
              <motion.button whileTap={{ scale: 0.96 }} disabled={loading} onClick={() => setPhase('wrong')}
                style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <X size={16} /> {t('quiz.wrong')} (0 {t('quiz.pts')})
              </motion.button>
            </div>
          ) : isTeacher && phase === 'answering' ? (
            <div style={{ display: 'flex', gap: 12 }}>
              <motion.button whileTap={{ scale: 0.96 }} disabled={loading} onClick={() => markAnswer(true)}
                style={{ flex: 1, padding: '13px 0', borderRadius: 10, border: 'none', background: '#22C55E', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Check size={18} /> {t('quiz.correct')}
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} disabled={loading} onClick={() => setPhase('wrong')}
                style={{ flex: 1, padding: '13px 0', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <X size={18} /> {t('quiz.wrong')}
              </motion.button>
            </div>
          ) : null}

          {/* Steal phase */}
          {isTeacher && phase === 'wrong' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <p style={{ fontWeight: 700, marginBottom: 12, color: 'var(--warning)' }}>{t('quiz.steal_prompt')}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {otherTeams.map(ot => (
                  <motion.button key={ot.id} whileTap={{ scale: 0.96 }} onClick={() => markAnswer(false, ot.id)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--warning)', background: 'rgba(245,158,11,0.08)', color: 'var(--warning)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    <Zap size={13} style={{ marginRight: 4 }} />{ot.name}
                  </motion.button>
                ))}
                <button onClick={() => markAnswer(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
                  {t('quiz.no_steal')}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </>
  )
}

// ── Final round ───────────────────────────────────────────────────────────────
function FinalRound({ game, groupId, isTeacher, onUpdate, t }) {
  const { show } = useToast()
  const [bets, setBets]   = useState({})
  const [phase, setPhase] = useState('bet')
  const [loading, setLoading] = useState(false)

  const submitBets = async () => {
    setLoading(true)
    try {
      for (const team of game.teams) {
        const amt = Number(bets[team.id] || 0)
        await placeBet(groupId, game.id, { team_id: team.id, amount: amt })
      }
      setPhase('answer')
    } catch { show(t('quiz.toast_bet_fail'), 'error') }
    finally { setLoading(false) }
  }

  const markFinal = async (teamId, correct) => {
    if (correct) playSound('correct'); else playSound('wrong')
    try {
      const { data } = await answerFinal(groupId, game.id, { team_id: teamId, correct })
      onUpdate(data)
    } catch { show(t('quiz.toast_answer_fail'), 'error') }
  }

  const finish = async () => {
    try {
      const { data } = await finishGame(groupId, game.id)
      onUpdate(data)
    } catch { show(t('quiz.toast_finish_fail'), 'error') }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ maxWidth: 600, margin: '40px auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <Trophy size={22} color="#F59E0B" />
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>{t('quiz.final_round')}</h2>
      </div>

      {game.current_question_data && (
        <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 16, marginBottom: 24, fontSize: 16, fontWeight: 600, lineHeight: 1.5, color: 'var(--text)' }}>
          {game.current_question_data.text}
        </div>
      )}

      {phase === 'bet' ? (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{t('quiz.bet_hint')}</p>
          {game.teams.map(team => (
            <div key={team.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{team.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('quiz.balance')}: {team.score}</span>
              {isTeacher && (
                <input type="number" min={0} max={team.score} placeholder="0"
                  value={bets[team.id] || ''}
                  onChange={e => setBets(b => ({ ...b, [team.id]: e.target.value }))}
                  style={{ width: 80, padding: '6px 10px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
              )}
            </div>
          ))}
          {isTeacher && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={submitBets} disabled={loading}
              style={{ ...primaryBtn, width: '100%', justifyContent: 'center', marginTop: 8 }}>
              {loading ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : null}
              {t('quiz.lock_bets')}
            </motion.button>
          )}
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{t('quiz.mark_teams')}</p>
          {game.teams.map(team => (
            <div key={team.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontWeight: 700, flex: 1 }}>{team.name}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('quiz.bet')}: {team.final_bet ?? 0}</span>
              {isTeacher && (
                <>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => markFinal(team.id, true)}
                    style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: '#22C55E18', color: '#22C55E', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={13} /> {t('quiz.correct')}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => markFinal(team.id, false)}
                    style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: '#EF444418', color: '#EF4444', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <X size={13} /> {t('quiz.wrong')}
                  </motion.button>
                </>
              )}
            </div>
          ))}
          {isTeacher && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={finish}
              style={{ ...primaryBtn, width: '100%', justifyContent: 'center', marginTop: 16 }}>
              {t('quiz.finish_game')}
            </motion.button>
          )}
        </>
      )}
    </motion.div>
  )
}

// ── Winner screen ─────────────────────────────────────────────────────────────
function WinnerScreen({ teams, groupId, gameId, isTeacher, onReset, t }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score)
  const top3   = [sorted[1], sorted[0], sorted[2]].filter(Boolean)
  const heights = [70, 110, 50]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ textAlign: 'center', padding: '40px 0' }}>
      <motion.h2 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Trophy size={30} color="#F59E0B" />{t('quiz.game_over')}
      </motion.h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 40 }}>{sorted[0]?.name} {t('quiz.wins')}</p>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 48 }}>
        {top3.map((team, i) => {
          const rank = i === 1 ? 1 : i === 0 ? 2 : 3
          const color = rank === 1 ? '#F59E0B' : rank === 2 ? '#94A3B8' : '#CD7F32'
          const ti = teams.indexOf(team)
          const tcolor = TEAM_COLORS[ti % TEAM_COLORS.length]
          return (
            <motion.div key={team.id} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15, type: 'spring', stiffness: 280, damping: 22 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {rank === 1 && (
                <motion.div animate={{ rotate: [0, -8, 8, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}>
                  <Crown size={24} color="#F59E0B" fill="#F59E0B" />
                </motion.div>
              )}
              <motion.div animate={rank === 1 ? { boxShadow: ['0 0 0 0 rgba(245,158,11,0.5)', '0 0 0 12px rgba(245,158,11,0)', '0 0 0 0 rgba(245,158,11,0.5)'] } : {}}
                transition={{ duration: 2.4, repeat: Infinity }}
                style={{ width: 56, height: 56, borderRadius: '50%', background: `${tcolor}20`, border: `2.5px solid ${tcolor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: tcolor }}>
                {(team.members[0]?.first_name?.[0] || team.name[0]).toUpperCase()}
              </motion.div>
              <p style={{ fontWeight: 700, fontSize: 14 }}>{team.name}</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{team.score} {t('quiz.pts')}</p>
              <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                transition={{ delay: i * 0.15 + 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformOrigin: 'bottom', width: 100, height: heights[i], background: `${color}18`, border: `2px solid ${color}`, borderBottom: 'none', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: 20, color }}>{rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}</span>
              </motion.div>
            </motion.div>
          )
        })}
      </div>

      <div style={{ maxWidth: 360, margin: '0 auto 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((team, i) => {
          const ti = teams.indexOf(team)
          const color = TEAM_COLORS[ti % TEAM_COLORS.length]
          return (
            <div key={team.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', width: 20 }}>{i + 1}</span>
              <span style={{ fontWeight: 700, flex: 1, color }}>{team.name}</span>
              <span style={{ fontWeight: 800, fontSize: 16 }}>{team.score}</span>
            </div>
          )
        })}
      </div>

      {isTeacher && (
        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={onReset}
          style={{ ...primaryBtn, margin: '0 auto' }}>
          <RotateCcw size={14} /> {t('quiz.play_again')}
        </motion.button>
      )}
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GameBoard() {
  const { id: groupId, gameId } = useParams()
  const { user } = useAuth()
  const { show }  = useToast()
  const { t }     = useTranslation()

  const [game,      setGame]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [splitting, setSplitting] = useState(false)

  const isTeacher = user?.role === 'teacher'

  const load = async () => {
    try { const { data } = await getGame(groupId, gameId); setGame(data) }
    catch { show(t('quiz.toast_load_fail'), 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [gameId])

  const handleStart = async () => {
    try {
      const { data } = await startGame(groupId, gameId)
      setGame(data)
      if (!data.is_individual) setSplitting(true)
    } catch { show(t('quiz.toast_start_fail'), 'error') }
  }

  const handleSelectTeamAndPick = async (cell) => {
    if (!game.current_team) return
    try {
      const { data } = await pickSquare(groupId, gameId, { question_id: cell.id, team_id: game.current_team })
      setGame(data)
    } catch { show(t('quiz.toast_pick_fail'), 'error') }
  }

  const handleAnswerDone = (data) => { setGame(data) }

  const handleReset = async () => {
    try { const { data } = await resetGame(groupId, gameId); setGame(data) }
    catch { show(t('quiz.toast_fail'), 'error') }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}>
      <Loader2 size={32} color="var(--accent)" style={{ animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
  if (!game) return null

  const currentQ    = game.current_question_data
  const currentTeam = game.teams?.find(tm => tm.id === game.current_team)

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        <Link to={`/groups/${groupId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{t('common.groups')}</Link>
        <ChevronRight size={14} />
        <Link to={`/groups/${groupId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{t('quiz.games')}</Link>
        <ChevronRight size={14} />
        <span>{game.name}</span>
      </div>

      {/* Split animation — skip for individual (solo) games */}
      <AnimatePresence>
        {splitting && !game.is_individual && (
          <TeamSplitScreen
            teams={game.teams}
            isTeacher={isTeacher}
            groupId={groupId}
            gameId={gameId}
            onUpdate={data => setGame(data)}
            onDone={() => { setSplitting(false); load() }}
          />
        )}
      </AnimatePresence>

      {/* Question overlay */}
      <AnimatePresence>
        {currentQ && !splitting && (
          <QuestionOverlay question={currentQ} team={currentTeam} timerTotal={game.timer_seconds}
            isTeacher={isTeacher} teams={game.teams} groupId={groupId} gameId={gameId}
            onDone={handleAnswerDone} t={t} />
        )}
      </AnimatePresence>

      {/* WAITING */}
      {game.status === 'waiting' && (() => {
        const board = game.board || {}
        const topics = Object.entries(board)
        const totalQ = topics.reduce((s, [, qs]) => s + qs.length, 0)
        const tooFew = totalQ < game.team_count
        const warn   = !tooFew && totalQ < game.team_count * 3
        return (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            style={{ maxWidth: 560, margin: '40px auto' }}>

            {/* Hero card */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '40px 32px 32px', textAlign: 'center', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
              {/* subtle glow behind trophy */}
              <div style={{ position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)', width: 200, height: 200, background: 'var(--accent)', opacity: 0.06, borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />

              <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),#059669)', marginBottom: 20, boxShadow: '0 8px 24px rgba(16,185,129,.28)' }}>
                <Trophy size={34} color="#fff" />
              </motion.div>

              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, marginBottom: 6, color: 'var(--text)' }}>{game.name}</h2>

              {/* Stat pills */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
                {game.is_individual && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 999, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', border: '1px solid var(--accent)', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                    ⚡ {t('quiz.solo_quiz')}
                  </span>
                )}
                {!game.is_individual && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 999, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                    <Users size={13} /> {game.team_count} {t('quiz.teams')}
                  </span>
                )}
                {[
                  { icon: <Clock size={13} />, label: `${game.timer_seconds}s ${t('quiz.per_question')}` },
                  { icon: <HelpCircle size={13} />, label: `${totalQ} ${t('quiz.questions_in_game')}` },
                ].map(({ icon, label }) => (
                  <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 999, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                    {icon} {label}
                  </span>
                ))}
              </div>

              {/* Topics breakdown */}
              {topics.length > 0 && (
                <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', marginBottom: 24, textAlign: 'left' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>{t('quiz.topics')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {topics.map(([topic, qs]) => {
                      const e = qs.filter(q => q.difficulty === 'easy').length
                      const m = qs.filter(q => q.difficulty === 'medium').length
                      const h = qs.filter(q => q.difficulty === 'hard').length
                      return (
                        <div key={topic} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topic}</span>
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            {e > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#22C55E18', color: '#16A34A' }}>{e}E</span>}
                            {m > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#F59E0B18', color: '#D97706' }}>{m}M</span>}
                            {h > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#EF444418', color: '#DC2626' }}>{h}H</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Mismatch warnings */}
              {tooFew && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 10, background: '#EF444410', border: '1px solid #EF444440', marginBottom: 20, textAlign: 'left' }}>
                  <XCircle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 2 }}>{t('quiz.err_too_few_title')}</p>
                    <p style={{ fontSize: 12, color: '#DC2626', opacity: .8 }}>{t('quiz.err_too_few_sub', { teams: game.team_count })}</p>
                  </div>
                </div>
              )}
              {warn && !tooFew && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 10, background: '#F59E0B10', border: '1px solid #F59E0B40', marginBottom: 20, textAlign: 'left' }}>
                  <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#D97706', marginBottom: 2 }}>{t('quiz.warn_few_title')}</p>
                    <p style={{ fontSize: 12, color: '#D97706', opacity: .85 }}>{t('quiz.warn_few_sub', { recommended: game.team_count * 3 })}</p>
                  </div>
                </div>
              )}

              {isTeacher ? (
                <motion.button whileHover={{ y: -2, boxShadow: '0 10px 28px rgba(16,185,129,.35)' }} whileTap={{ scale: 0.97 }}
                  onClick={handleStart} disabled={tooFew}
                  style={{ ...primaryBtn, fontSize: 16, padding: '13px 40px', margin: '0 auto', borderRadius: 12, opacity: tooFew ? 0.45 : 1, cursor: tooFew ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg,var(--accent),#059669)', boxShadow: '0 4px 16px rgba(16,185,129,.25)', transition: 'box-shadow .2s' }}>
                  <Zap size={17} /> {t('quiz.start_game')}
                </motion.button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 14 }}>
                  <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}
                    style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
                  {t('quiz.waiting_teacher')}
                </div>
              )}
            </div>
          </motion.div>
        )
      })()}

      {/* ACTIVE */}
      {game.status === 'active' && !splitting && (
        <div>
          {isTeacher && !currentQ && !game.current_team && (
            <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('quiz.whose_turn')}</span>
              {game.teams.map((team, ti) => (
                <motion.button key={team.id} whileTap={{ scale: 0.96 }}
                  onClick={() => setGame(g => ({ ...g, current_team: team.id }))}
                  style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${TEAM_COLORS[ti % TEAM_COLORS.length]}`, background: `${TEAM_COLORS[ti % TEAM_COLORS.length]}12`, color: TEAM_COLORS[ti % TEAM_COLORS.length], fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {team.name}
                </motion.button>
              ))}
            </div>
          )}

          {isTeacher && game.current_team && !currentQ && (
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                {t('quiz.picking_for')}: {currentTeam?.name}
              </span>
              <button onClick={() => setGame(g => ({ ...g, current_team: null }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>
                {t('quiz.change')}
              </button>
            </div>
          )}

          <Board board={game.board || {}} answeredIds={game.answered_question_ids || []}
            doubleId={game.double_question_id} currentTeam={game.current_team}
            isTeacher={isTeacher} onPickSquare={handleSelectTeamAndPick} t={t} />

          {isTeacher && (
            <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <motion.button whileTap={{ scale: 0.96 }} onClick={async () => {
                try { const { data } = await finishGame(groupId, gameId); setGame(data) }
                catch { show(t('quiz.toast_fail'), 'error') }
              }} style={{ ...ghostBtn }}>
                <Flag size={13} /> {t('quiz.finish_game')}
              </motion.button>
            </div>
          )}
        </div>
      )}

      {/* FINISHED */}
      {game.status === 'finished' && (
        <WinnerScreen teams={game.teams} groupId={groupId} gameId={gameId}
          isTeacher={isTeacher} onReset={handleReset} t={t} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
const ghostBtn   = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }
