import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  Code2, Users, BarChart2, BookOpen, GraduationCap, ArrowRight,
  CheckCircle, LayoutDashboard, Star, Zap, ChevronDown, Trophy,
  ClipboardList, TrendingUp, Key, Gamepad2, ShieldCheck,
  Baby, Database, Link2, MessageCircle, Send, Minus, Mail,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getOnlineCount, getPlatformStats } from '../api/users'

/* ── animation presets ───────────────────────────────────────────────── */
const fadeUp = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } }

/* ── animated counter ───────────────────────────────────────────────── */
function Counter({ value, duration = 1400 }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    if (!value) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        const start = Date.now()
        const tick = () => {
          const elapsed = Date.now() - start
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          setDisplay(Math.round(eased * value))
          if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [value, duration])

  return <span ref={ref}>{display.toLocaleString()}</span>
}

/* ── dashboard mockup ────────────────────────────────────────────────── */
function DashboardMockup() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', userSelect: 'none' }}>
      {/* Browser chrome */}
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#EF4444','#F59E0B','#22C55E'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 5, padding: '4px 12px', fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, maxWidth: 220, margin: '0 auto' }}>
          <ShieldCheck size={9} color="var(--accent)" /> journaly.uz
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Top row - stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Avg Score', value: '4.2/5', color: '#22C55E', icon: <TrendingUp size={13} /> },
            { label: 'Attendance', value: '92%',   color: '#6366F1', icon: <CheckCircle size={13} /> },
            { label: 'Students',  value: '34',     color: '#F59E0B', icon: <Users size={13} /> },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: s.color, marginBottom: 6 }}>
                {s.icon}
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.label}</span>
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Score trend chart (fake) */}
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Score Trend</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 44 }}>
            {[2, 3, 2.5, 4, 3.5, 4.2, 5, 4, 4.5, 4.8, 4.2, 5].map((v, i) => (
              <div key={i} style={{ flex: 1, background: `rgba(16,185,129,${0.2 + (v / 5) * 0.7})`, borderRadius: '3px 3px 0 0', height: `${(v / 5) * 100}%` }} />
            ))}
          </div>
        </div>

        {/* Student list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { name: 'Azizbek T.', score: 5, att: '✓', color: '#6366F1' },
            { name: 'Malika S.',  score: 4, att: '✓', color: '#F59E0B' },
            { name: 'Jasur R.',  score: 3, att: '✗', color: '#22C55E' },
          ].map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', borderRadius: 8, padding: '7px 10px', border: '1px solid var(--border)' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {s.name[0]}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{s.name}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: s.att === '✓' ? '#22C55E' : '#EF4444', fontWeight: 700 }}>{s.att}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '2px 7px', borderRadius: 5 }}>{s.score}/5</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── parent dashboard mockup ─────────────────────────────────────────── */
function ParentMockup() {
  const lessons = [
    { name: 'Lesson 12', score: 5, present: true },
    { name: 'Lesson 11', score: 4, present: true },
    { name: 'Lesson 10', score: 3, present: false },
    { name: 'Lesson 9',  score: 5, present: true },
  ]
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', userSelect: 'none' }}>
      {/* Browser chrome */}
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#EF4444','#F59E0B','#22C55E'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 5, padding: '4px 12px', fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, maxWidth: 220, margin: '0 auto' }}>
          <ShieldCheck size={9} color="var(--accent)" /> journaly.uz/dashboard
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Child card */}
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#EC4899,#F97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>A</span>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Azizbek Toshmatov</p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Python Basics · Group A</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>4.5</p>
              <p style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#22C55E' }}>88%</p>
              <p style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Att.</p>
            </div>
          </div>
        </div>

        {/* Score bar chart */}
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Score trend</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 36 }}>
            {[3, 4, 3.5, 5, 4, 4.5, 3, 5, 4, 4.5, 5, 4.5].map((v, i) => (
              <div key={i} style={{ flex: 1, background: `rgba(236,72,153,${0.2 + (v / 5) * 0.65})`, borderRadius: '3px 3px 0 0', height: `${(v / 5) * 100}%` }} />
            ))}
          </div>
        </div>

        {/* Recent lessons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {lessons.map(l => (
            <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderRadius: 8, padding: '7px 10px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{l.name}</span>
              <span style={{ fontSize: 10, color: l.present ? '#22C55E' : '#EF4444', fontWeight: 700 }}>{l.present ? '✓' : '✗'}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '2px 7px', borderRadius: 5 }}>{l.score}/5</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── telegram chat mockup ────────────────────────────────────────────── */
function BotMsg({ lines }) {
  return (
    <div style={{ background: '#232E3C', borderRadius: '4px 12px 12px 12px', padding: '8px 11px', maxWidth: '88%' }}>
      {lines.map((l, i) => <p key={i} style={{ fontSize: 11, color: '#E4E6EB', lineHeight: 1.6, margin: 0 }}>{l}</p>)}
    </div>
  )
}
function UserMsg({ text }) {
  return (
    <div style={{ background: '#2B5278', borderRadius: '12px 4px 12px 12px', padding: '8px 11px', maxWidth: '58%', alignSelf: 'flex-end' }}>
      <p style={{ fontSize: 11, color: '#fff', margin: 0, fontFamily: 'var(--font-mono)' }}>{text}</p>
    </div>
  )
}
function TelegramMockup() {
  return (
    <div style={{ background: '#17212B', borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.5)', userSelect: 'none', maxWidth: 300, margin: '0 auto' }}>
      <div style={{ background: '#232E3C', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#0088CC,#00AAFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <MessageCircle size={15} color="#fff" />
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Journaly Bot</p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>@academyjournal_bot · online</p>
        </div>
      </div>
      <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <BotMsg lines={['📢 Lesson 12 ended!', '✓ Present · Score: 5/5 ⭐']} />
        <UserMsg text="/mystats" />
        <BotMsg lines={['📊 Python Basics', 'Score: 4.2/5 · Attendance: 88%']} />
        <UserMsg text="/homework" />
        <BotMsg lines={['📚 Homework:', 'Complete exercises 1–10 from Ch. 3']} />
      </div>
    </div>
  )
}

/* ── role card ───────────────────────────────────────────────────────── */
function RoleCard({ icon: Icon, title, color, features, highlight }) {
  return (
    <div style={{ background: 'var(--surface)', border: `1.5px solid ${highlight ? color + '50' : 'var(--border)'}`, borderRadius: 16, overflow: 'hidden', boxShadow: highlight ? `0 0 0 1px ${color}20, 0 8px 32px ${color}18` : 'var(--shadow-sm)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {highlight && <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 0%, ${color}08 0%, transparent 65%)`, pointerEvents: 'none' }} />}
      <div style={{ padding: '24px 22px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <Icon size={21} color={color} />
        </div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{title}</h3>
      </div>
      <ul style={{ listStyle: 'none', padding: '16px 22px 24px', display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: 'var(--text)' }}>
            <CheckCircle size={14} color={color} style={{ flexShrink: 0, marginTop: 1 }} /> {f}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── testimonial card ────────────────────────────────────────────────── */
function TestimonialCard({ quote, name, role, color, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay }}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 22px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <span style={{ fontSize: 40, lineHeight: 1, color: color, fontFamily: 'Georgia, serif', opacity: 0.7 }}>"</span>
      <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.75, marginTop: -20, flex: 1 }}>{quote}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${color}20`, border: `2px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color }}>{name[0]}</span>
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{name}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{role}</p>
        </div>
      </div>
    </motion.div>
  )
}

/* ── FAQ item ────────────────────────────────────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '18px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{q}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.22 }} style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
          <ChevronDown size={18} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }} style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.75, paddingBottom: 18 }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── main component ──────────────────────────────────────────────────── */
export default function Landing() {
  const { user } = useAuth()
  const { t }    = useTranslation()

  const [onlineCount,   setOnlineCount]   = useState(null)
  const [platformStats, setPlatformStats] = useState(null)

  useEffect(() => {
    getOnlineCount().then(r => setOnlineCount(r.data.online)).catch(() => {})
    getPlatformStats().then(r => setPlatformStats(r.data)).catch(() => {})
  }, [])

  const features = [
    { icon: Users,         title: t('landing.feat_groups'),       desc: t('landing.feat_groups_desc') },
    { icon: BarChart2,     title: t('landing.feat_scores'),       desc: t('landing.feat_scores_desc') },
    { icon: CheckCircle,   title: t('landing.feat_attendance'),   desc: t('landing.feat_attendance_desc') },
    { icon: BookOpen,      title: t('landing.feat_journals'),     desc: t('landing.feat_journals_desc') },
    { icon: Code2,         title: t('landing.feat_charts'),       desc: t('landing.feat_charts_desc') },
    { icon: GraduationCap, title: t('landing.feat_profiles'),     desc: t('landing.feat_profiles_desc') },
    { icon: Star,          title: t('landing.feat_gamification'), desc: t('landing.feat_gamification_desc') },
    { icon: Baby,          title: t('landing.feat_parent'),       desc: t('landing.feat_parent_desc') },
    { icon: Database,      title: t('landing.feat_questions'),    desc: t('landing.feat_questions_desc') },
    { icon: Link2,         title: t('landing.feat_invites'),      desc: t('landing.feat_invites_desc') },
  ]

  const steps = [
    { icon: <Key size={22} color="var(--accent)" />,         n: '01', title: t('landing.how_s1_title'), desc: t('landing.how_s1_desc') },
    { icon: <Users size={22} color="#6366F1" />,              n: '02', title: t('landing.how_s2_title'), desc: t('landing.how_s2_desc') },
    { icon: <TrendingUp size={22} color="#F59E0B" />,         n: '03', title: t('landing.how_s3_title'), desc: t('landing.how_s3_desc') },
  ]

  const gamePoints = [t('landing.game_p1'), t('landing.game_p2'), t('landing.game_p3'), t('landing.game_p4')]

  const faqs = [
    [t('landing.faq_q1'), t('landing.faq_a1')],
    [t('landing.faq_q2'), t('landing.faq_a2')],
    [t('landing.faq_q3'), t('landing.faq_a3')],
    [t('landing.faq_q4'), t('landing.faq_a4')],
    [t('landing.faq_q5'), t('landing.faq_a5')],
  ]

  return (
    <div>

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <motion.div variants={stagger} initial="hidden" animate="show"
        className="hero-grid"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', paddingTop: 56, paddingBottom: 80, minHeight: 'calc(100vh - 60px)' }}>

        <div className="hero-text">
          {/* Badge */}
          <motion.div variants={fadeUp} style={{ marginBottom: 24 }} className="hero-badge">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--accent-bg)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 99, padding: '6px 18px' }}>
              <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                {onlineCount === null ? t('landing.badge') : t('landing.online_users', { count: onlineCount })}
              </span>
            </span>
          </motion.div>

          <motion.h1 variants={fadeUp}
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px, 5.5vw, 58px)', fontWeight: 800, lineHeight: 1.08, marginBottom: 20, color: 'var(--text)', letterSpacing: '-1px' }}>
            {t('landing.hero_title')}<br />
            <span style={{ color: 'var(--accent)' }}>{t('landing.hero_highlight')}</span>
          </motion.h1>

          <motion.p variants={fadeUp}
            style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 460, lineHeight: 1.75, marginBottom: 36 }}
            className="hero-sub">
            {t('landing.hero_sub')}
          </motion.p>

          <motion.div variants={fadeUp} className="hero-btns" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            {user ? (
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className="hero-btn-wrap">
                <Link to="/dashboard" style={primaryBtn} className="btn-primary">
                  <LayoutDashboard size={15} /> {t('landing.go_dashboard')}
                </Link>
              </motion.div>
            ) : (
              <>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className="hero-btn-wrap">
                  <Link to="/register" style={primaryBtn} className="btn-primary">
                    {t('landing.get_started_free')} <ArrowRight size={15} />
                  </Link>
                </motion.div>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className="hero-btn-wrap">
                  <Link to="/login" style={ghostBtn} className="btn-ghost">{t('landing.sign_in')}</Link>
                </motion.div>
              </>
            )}
          </motion.div>

          {!user && (
            <motion.div variants={fadeUp} className="hero-trust" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[t('landing.trust_free'), t('landing.trust_no_card'), t('landing.trust_roles')].map(txt => (
                <span key={txt} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                  <CheckCircle size={13} color="var(--success)" /> {txt}
                </span>
              ))}
            </motion.div>
          )}
        </div>

        {/* Mockup */}
        <motion.div variants={fadeUp} className="hero-mockup" style={{ perspective: 1000 }}>
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}>
            <DashboardMockup />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* ── STATS BAR ────────────────────────────────────────────────── */}
      {platformStats && (
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="stats-grid section-mb"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 16, overflow: 'hidden', marginBottom: 88 }}>
          {[
            { label: t('landing.stat_teachers'), value: platformStats.total_teachers, icon: <GraduationCap size={18} color="var(--accent)" /> },
            { label: t('landing.stat_students'), value: platformStats.total_students, icon: <Users size={18} color="#6366F1" /> },
            { label: t('landing.stat_lessons'),  value: platformStats.total_lessons,  icon: <ClipboardList size={18} color="#F59E0B" /> },
            { label: t('landing.stat_groups'),   value: platformStats.total_groups,   icon: <LayoutDashboard size={18} color="#22C55E" /> },
          ].map(s => (
            <div key={s.label} className="stat-cell" style={{ background: 'var(--surface)', padding: '28px 24px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>{s.icon}</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
                <Counter value={s.value} />
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        className="section-mb" style={{ marginBottom: 88 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.1em' }}>How it works</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, marginTop: 10, marginBottom: 12, letterSpacing: '-0.5px' }}>
            {t('landing.how_title')}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>{t('landing.how_sub')}</p>
        </div>

        <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, position: 'relative' }}>
          <div className="steps-line" style={{ position: 'absolute', top: 28, left: 'calc(16% + 20px)', right: 'calc(16% + 20px)', height: 2, background: 'linear-gradient(90deg, var(--accent), #6366F1, #F59E0B)', opacity: 0.25, borderRadius: 2 }} />
          {steps.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
              className="step-card"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 24px', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {s.icon}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{s.n}</span>
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── GAME FEATURE CALLOUT ──────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        className="game-grid section-mb"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', marginBottom: 88, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 'clamp(24px, 5vw, 52px)', overflow: 'hidden', position: 'relative' }}>

        <div style={{ position: 'absolute', top: -60, right: -60, width: 300, height: 300, background: 'var(--accent)', opacity: 0.05, borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />

        {/* Jeopardy board mockup */}
        <div className="game-board-side" style={{ order: 0 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, padding: 2, paddingBottom: 0 }}>
              {['Python', 'Django', 'React'].map(t => (
                <div key={t} style={{ background: 'var(--accent)', padding: '8px 4px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#fff', borderRadius: '6px 6px 0 0', letterSpacing: '.04em' }}>{t}</div>
              ))}
            </div>
            {[[1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]].map((row, ri) => (
              <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, padding: '0 2px', marginTop: 2 }}>
                {row.map((answered, ci) => {
                  const pts = (ri + 1) * 100
                  const colors = ['#22C55E', '#F59E0B', '#EF4444']
                  return (
                    <div key={ci} style={{ background: answered ? 'var(--surface)' : colors[ci % 3], borderRadius: 6, padding: '10px 4px', textAlign: 'center', opacity: answered ? 0.25 : 1 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: '#fff' }}>{pts}</span>
                    </div>
                  )
                })}
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, padding: 8, marginTop: 4 }}>
              {[['🦁 Lions', 400], ['🐍 Pythons', 250]].map(([name, score]) => (
                <div key={name} style={{ background: 'var(--surface)', borderRadius: 8, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>{name}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>{score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 99, padding: '5px 14px', marginBottom: 18 }}>
            <Gamepad2 size={13} color="#6366F1" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6366F1' }}>Quiz Games</span>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 3.5vw, 34px)', fontWeight: 800, marginBottom: 14, letterSpacing: '-0.5px' }}>
            {t('landing.game_title')}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.75, marginBottom: 28 }}>{t('landing.game_sub')}</p>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
            {gamePoints.map(p => (
              <li key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14 }}>
                <Zap size={14} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} /> {p}
              </li>
            ))}
          </ul>
          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} style={{ display: 'inline-block' }}>
            <Link to={user ? '/groups' : '/register'} style={primaryBtn} className="btn-primary">
              <Trophy size={15} /> {t('landing.game_btn')} <ArrowRight size={14} />
            </Link>
          </motion.div>
        </div>
      </motion.div>

      {/* ── FEATURES GRID ────────────────────────────────────────────── */}
      <motion.div id="features" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        className="section-mb" style={{ marginBottom: 88, scrollMarginTop: 80 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Features</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 800, marginTop: 10, letterSpacing: '-0.5px' }}>
            {t('landing.features_title')}
          </h2>
        </div>
        <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {features.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.12)' }}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 18px', boxShadow: 'var(--shadow-sm)', transition: 'box-shadow 0.2s' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <f.icon size={19} color="var(--accent)" />
              </div>
              <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{f.title}</h4>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── ROLE COMPARISON ──────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        className="section-mb" style={{ marginBottom: 88 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.1em' }}>{t('landing.roles_badge')}</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 800, marginTop: 10, marginBottom: 12, letterSpacing: '-0.5px' }}>
            {t('landing.roles_title')}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>{t('landing.roles_sub')}</p>
        </div>
        <div className="roles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          <RoleCard icon={GraduationCap} title={t('landing.roles_teacher')} color="#8B5CF6"
            features={[t('landing.roles_f1'), t('landing.roles_f2'), t('landing.roles_f3'), t('landing.roles_f4'), t('landing.roles_f5'), t('landing.roles_f12')]} />
          <RoleCard icon={BookOpen} title={t('landing.roles_student')} color="var(--accent)" highlight
            features={[t('landing.roles_f2'), t('landing.roles_f6'), t('landing.roles_f7'), t('landing.roles_f8'), t('landing.roles_f9'), t('landing.roles_f12')]} />
          <RoleCard icon={Baby} title={t('landing.roles_parent')} color="#EC4899"
            features={[t('landing.roles_f10'), t('landing.roles_f2'), t('landing.roles_f11'), t('landing.roles_f6'), t('landing.roles_f12')]} />
        </div>
      </motion.div>

      {/* ── PARENT CONTROL CALLOUT ───────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        className="game-grid section-mb"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', marginBottom: 88, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 'clamp(24px, 5vw, 52px)', overflow: 'hidden', position: 'relative' }}>

        <div style={{ position: 'absolute', top: -60, left: -60, width: 300, height: 300, background: '#EC4899', opacity: 0.04, borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />

        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: 99, padding: '5px 14px', marginBottom: 18 }}>
            <Baby size={13} color="#EC4899" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#EC4899' }}>{t('landing.parent_badge')}</span>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 3.5vw, 34px)', fontWeight: 800, marginBottom: 14, letterSpacing: '-0.5px' }}>
            {t('landing.parent_title')}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.75, marginBottom: 28 }}>{t('landing.parent_sub')}</p>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
            {[t('landing.parent_p1'), t('landing.parent_p2'), t('landing.parent_p3'), t('landing.parent_p4')].map(p => (
              <li key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14 }}>
                <CheckCircle size={14} color="#EC4899" style={{ flexShrink: 0, marginTop: 2 }} /> {p}
              </li>
            ))}
          </ul>
          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} style={{ display: 'inline-block' }}>
            <Link to={user ? '/dashboard' : '/register'}
              style={{ ...primaryBtn, background: 'linear-gradient(135deg,#EC4899,#F97316)', boxShadow: '0 4px 16px rgba(236,72,153,0.3)' }}
              className="btn-primary">
              {t('landing.parent_btn')} <ArrowRight size={14} />
            </Link>
          </motion.div>
        </div>

        <motion.div className="game-board-side" style={{ order: 1 }} animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}>
          <ParentMockup />
        </motion.div>
      </motion.div>

      {/* ── TELEGRAM BOT CALLOUT ─────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        className="game-grid section-mb"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', marginBottom: 88, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 'clamp(24px, 5vw, 52px)', overflow: 'hidden', position: 'relative' }}>

        <div style={{ position: 'absolute', top: -40, right: -40, width: 260, height: 260, background: '#0088CC', opacity: 0.04, borderRadius: '50%', filter: 'blur(50px)', pointerEvents: 'none' }} />

        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(0,136,204,0.1)', border: '1px solid rgba(0,136,204,0.3)', borderRadius: 99, padding: '5px 14px', marginBottom: 18 }}>
            <MessageCircle size={13} color="#0088CC" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0088CC' }}>{t('landing.tg_badge')}</span>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 3.5vw, 34px)', fontWeight: 800, marginBottom: 14, letterSpacing: '-0.5px' }}>
            {t('landing.tg_title')}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.75, marginBottom: 28 }}>{t('landing.tg_sub')}</p>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
            {[t('landing.tg_p1'), t('landing.tg_p2'), t('landing.tg_p3'), t('landing.tg_p4')].map(p => (
              <li key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14 }}>
                <Send size={13} color="#0088CC" style={{ flexShrink: 0, marginTop: 2 }} /> {p}
              </li>
            ))}
          </ul>
          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} style={{ display: 'inline-block' }}>
            <Link to={user ? '/profile/' + user.id : '/register'}
              style={{ ...primaryBtn, background: '#0088CC', boxShadow: '0 4px 16px rgba(0,136,204,0.3)' }}
              className="btn-primary">
              <MessageCircle size={15} /> {t('landing.tg_btn')} <ArrowRight size={14} />
            </Link>
          </motion.div>
        </div>

        <motion.div className="game-board-side" style={{ order: 1 }} animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}>
          <TelegramMockup />
        </motion.div>
      </motion.div>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        className="section-mb" style={{ marginBottom: 88 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.1em' }}>{t('landing.testimonials_badge')}</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 800, marginTop: 10, letterSpacing: '-0.5px' }}>
            {t('landing.testimonials_title')}
          </h2>
        </div>
        <div className="testimonials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          <TestimonialCard quote={t('landing.t1_quote')} name={t('landing.t1_name')} role={t('landing.t1_role')} color="#8B5CF6" delay={0} />
          <TestimonialCard quote={t('landing.t2_quote')} name={t('landing.t2_name')} role={t('landing.t2_role')} color="var(--accent)" delay={0.1} />
          <TestimonialCard quote={t('landing.t3_quote')} name={t('landing.t3_name')} role={t('landing.t3_role')} color="#EC4899" delay={0.2} />
        </div>
      </motion.div>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <motion.div id="faq" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        className="section-mb" style={{ maxWidth: 700, margin: '0 auto 88px', scrollMarginTop: 80 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.1em' }}>FAQ</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, marginTop: 10, letterSpacing: '-0.5px' }}>
            {t('landing.faq_title')}
          </h2>
        </div>
        <div className="faq-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '0 28px' }}>
          {faqs.map(([q, a]) => <FaqItem key={q} q={q} a={a} />)}
        </div>
      </motion.div>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        style={{ background: 'linear-gradient(135deg, #0f766e 0%, var(--accent) 50%, #6366F1 100%)', borderRadius: 20, padding: 'clamp(36px, 6vw, 64px) clamp(20px, 5vw, 64px)', textAlign: 'center', marginBottom: 56, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.07) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.07) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 4vw, 38px)', fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-0.5px', position: 'relative' }}>
          {t('landing.cta_title')}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, marginBottom: 32, position: 'relative', maxWidth: 480, margin: '0 auto 32px' }}>{t('landing.cta_sub')}</p>
        <motion.div whileHover={{ y: -2, scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ display: 'inline-block', position: 'relative' }} className="cta-btn-wrap">
          <Link to={user ? '/dashboard' : '/register'}
            className="cta-btn"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '15px 36px', borderRadius: 12, background: '#fff', color: '#0f766e', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            {user
              ? <><LayoutDashboard size={16} /> {t('landing.go_dashboard')}</>
              : <>{t('landing.cta_btn')} <ArrowRight size={16} /></>}
          </Link>
        </motion.div>
      </motion.div>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--border)', paddingTop: 40, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32, marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 30, height: 30, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GraduationCap size={16} color="#fff" />
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800 }}>Journaly</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 240, lineHeight: 1.6 }}>{t('footer.tagline')}</p>
          </div>

          <div>
            <p style={footColTitle}>{t('footer.pages')}</p>
            <a href="#features" className="foot-link" style={footLinkStyle}>{t('footer.features')}</a>
            <a href="#faq" className="foot-link" style={footLinkStyle}>{t('footer.faq')}</a>
            <Link to="/login" className="foot-link" style={footLinkStyle}>{t('footer.login')}</Link>
            <Link to="/register" className="foot-link" style={footLinkStyle}>{t('footer.register')}</Link>
          </div>

          <div>
            <p style={footColTitle}>{t('footer.contact')}</p>
            <a href="mailto:academyjournalsupport@gmail.com" className="foot-link" style={{ ...footLinkStyle, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Mail size={14} /> academyjournalsupport@gmail.com
            </a>
            <a href="https://t.me/journalyuzbot" target="_blank" rel="noopener noreferrer" className="foot-link" style={{ ...footLinkStyle, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Send size={14} /> @journalyuzbot
            </a>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
          © 2026 Journaly · {t('footer.rights')}
        </div>
      </footer>

      <style>{`
        .foot-link:hover { color: var(--accent) !important; }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.8); }
        }
        .pulse-dot { animation: pulse-dot 1.5s infinite; }

        /* ── tablet: ≤ 900px ──────────────────────────── */
        @media (max-width: 900px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            padding-top: 40px !important;
            padding-bottom: 56px !important;
            min-height: auto !important;
            gap: 28px !important;
          }
          .hero-mockup { display: none; }
          .steps-grid { grid-template-columns: 1fr 1fr !important; }
          .steps-line { display: none; }
          .game-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .game-board-side { order: -1; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .roles-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .testimonials-grid { grid-template-columns: 1fr 1fr !important; }
          .section-mb { margin-bottom: 60px !important; }
        }

        /* ── large mobile: ≤ 640px ────────────────────── */
        @media (max-width: 640px) {
          .hero-grid {
            padding-top: 32px !important;
            padding-bottom: 44px !important;
          }
          .hero-text { text-align: center; }
          .hero-badge { display: flex; justify-content: center; }
          .hero-sub { margin-left: auto; margin-right: auto; max-width: 100% !important; }
          .hero-btns { justify-content: center; flex-direction: column; }
          .hero-btn-wrap { width: 100%; }
          .btn-primary, .btn-ghost {
            width: 100%;
            justify-content: center;
            padding: 15px 20px !important;
            font-size: 15px !important;
            min-height: 50px;
          }
          .hero-trust { justify-content: center; gap: 12px !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .step-card { padding: 20px 18px !important; }
          .stat-cell { padding: 20px 12px !important; }
          .features-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .roles-grid { grid-template-columns: 1fr !important; }
          .testimonials-grid { grid-template-columns: 1fr !important; }
          .faq-card { padding: 0 16px !important; }
          .cta-btn-wrap { display: block; width: 100%; }
          .cta-btn { width: 100%; padding: 16px 20px !important; font-size: 16px !important; min-height: 54px; }
          .section-mb { margin-bottom: 48px !important; }
          .game-grid { padding: 20px !important; }
        }

        /* ── small mobile: ≤ 480px ────────────────────── */
        @media (max-width: 480px) {
          .hero-grid { padding-top: 24px !important; padding-bottom: 36px !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .stat-cell { padding: 18px 10px !important; }
          .features-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .game-grid { padding: 16px !important; }
          .faq-card { padding: 0 12px !important; }
          .section-mb { margin-bottom: 40px !important; }
        }

        /* ── xsmall mobile: ≤ 380px ───────────────────── */
        @media (max-width: 380px) {
          .stats-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .hero-trust { flex-direction: column; align-items: center; gap: 8px !important; }
        }
      `}</style>
    </div>
  )
}

const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '13px 28px', borderRadius: 10,
  background: 'var(--accent)', color: '#fff',
  fontSize: 14, fontWeight: 700, textDecoration: 'none',
  boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
  transition: 'transform 0.15s, box-shadow 0.15s',
}
const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '13px 28px', borderRadius: 10,
  border: '1.5px solid var(--border)', color: 'var(--text)',
  fontSize: 14, fontWeight: 600, textDecoration: 'none',
  transition: 'border-color 0.15s',
}
const footColTitle  = { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text)', marginBottom: 14 }
const footLinkStyle = { display: 'block', color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none', marginBottom: 9, transition: 'color 0.15s', width: 'fit-content' }
