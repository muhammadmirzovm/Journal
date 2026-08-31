import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  Building2, Link2, Plus, Copy, Check, Trash2,
  Loader2, Users, GraduationCap,
  Clock, Hash, Shield, Sparkles, AlertCircle, UserX, Send,
  ChevronLeft, ChevronRight, ChevronDown, Search, X,
} from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatDate } from '../utils/date'

const ALL_TABS = [
  { id: 'academy', icon: Building2, roles: ['admin', 'teacher', 'student', 'parent'] },
  { id: 'members', icon: Users,     roles: ['admin', 'teacher'] },
  { id: 'invites', icon: Link2,     roles: ['admin', 'teacher'] },
]

const ROLE_OPTION_DEFS = [
  { value: 'student', icon: GraduationCap, color: '#14B8A8' },
  { value: 'teacher', icon: Users,          color: '#8B5CF6' },
  { value: 'admin',   icon: Shield,         color: '#F59E0B' },
  { value: 'parent',  icon: Users,          color: '#EC4899' },
]

const ROLE_OPTIONS_BY_ROLE = {
  admin:   ['student', 'teacher', 'admin', 'parent'],
  teacher: ['student', 'parent'],
}

const PRESET_COLORS = [
  '#0D9488', '#14B8A8', '#8B5CF6', '#6366F1',
  '#F59E0B', '#EF4444', '#EC4899', '#10B981',
  '#3B82F6', '#F97316', '#64748B', '#1E293B',
]

const MAX_USES_PRESETS   = [1, 5, 20, 100]
const DAYS_VALID_PRESETS = [1, 7, 30, 90]

const presetChip = (active, color) => ({
  padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer',
  border: `1px solid ${active ? color : 'rgba(0,0,0,0.12)'}`,
  background: active ? `${color}18` : 'transparent',
  color: active ? color : 'var(--text-muted)',
})

function CopyButton({ text }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)',
        background: copied ? 'rgba(20,184,168,0.1)' : 'rgba(0,0,0,0.04)',
        color: copied ? '#0D9488' : 'rgba(30,41,59,0.6)',
        fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
      }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? t('groups.copied') : t('groups.copy')}
    </button>
  )
}

// ── Create Academy ─────────────────────────────────────────────────────────────
function CreateAcademy({ onCreated }) {
  const { t } = useTranslation()
  const { show }  = useToast()
  const { setUser, user } = useAuth()
  const [form, setForm]   = useState({ name: '', primary_color: '#0D9488' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setErrors({ name: t('settings.err_name_required') }); return }
    setLoading(true)
    try {
      const slug = form.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const { data } = await api.post('/academy/create/', { ...form, slug })
      const { data: me } = await api.get('/auth/me/')
      setUser(me)
      show(`${data.name} created!`, 'success')
      onCreated(data)
    } catch (err) {
      const d = err.response?.data
      if (typeof d === 'object') {
        const mapped = {}
        Object.entries(d).forEach(([k, v]) => { mapped[k] = Array.isArray(v) ? v[0] : v })
        setErrors(mapped)
      } else {
        show(t('settings.err_save'), 'error')
      }
    } finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          display: 'inline-flex', width: 72, height: 72, borderRadius: 20,
          background: 'linear-gradient(135deg, #14B8A8, #0D9488)',
          alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          boxShadow: '0 8px 32px rgba(20,184,168,0.3)',
        }}>
          <Building2 size={32} color="#fff" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
          {t('settings.create_academy_title')}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {t('settings.create_academy_sub')}
        </p>
      </div>

      <div style={{ background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={labelStyle}>{t('settings.academy_name')}</label>
            <input
              style={{ ...inputStyle(!!errors.name) }}
              placeholder={t('settings.academy_name_placeholder')}
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors({}) }}
            />
            {errors.name && <p style={errStyle}>{errors.name}</p>}
          </div>

          <div>
            <label style={labelStyle}>{t('settings.brand_color')}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, primary_color: c }))}
                  style={{
                    width: 32, height: 32, borderRadius: 8, background: c, border: 'none',
                    cursor: 'pointer', outline: form.primary_color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2, transition: 'transform 0.15s',
                    transform: form.primary_color === c ? 'scale(1.15)' : 'scale(1)',
                  }} />
              ))}
              {/* Custom — a swatch-sized native color-picker trigger instead of a full extra row */}
              <label title={form.primary_color} style={{
                position: 'relative', width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                background: form.primary_color, border: '2px dashed rgba(148,163,184,0.6)',
                outline: PRESET_COLORS.includes(form.primary_color) ? 'none' : `3px solid ${form.primary_color}`,
                outlineOffset: 2,
              }}>
                <input type="color" value={form.primary_color}
                  onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
              </label>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 6 }}>{form.primary_color}</p>
          </div>

          <motion.button type="submit" disabled={loading}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            style={{
              padding: '14px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #14B8A8, #0D9488)',
              color: '#fff', fontWeight: 800, fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 8px 24px rgba(20,184,168,0.3)',
            }}>
            {loading
              ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> {t('settings.creating')}</>
              : <><Sparkles size={16} /> {t('settings.create_btn')}</>
            }
          </motion.button>
        </form>
      </div>
    </motion.div>
  )
}

// ── UTC ↔ UZT (UTC+5) helpers ──────────────────────────────────────────────────
function utcToUzt(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const total = (h * 60 + m + 300) % (24 * 60)   // +5 hours
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
function uztToUtc(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const total = ((h * 60 + m - 300) % (24 * 60) + 24 * 60) % (24 * 60)  // -5 hours
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// ── Academy Tab ────────────────────────────────────────────────────────────────
function AcademyTab({ academy, onUpdated }) {
  const { t } = useTranslation()
  const { show }  = useToast()
  const [form, setForm]       = useState({ name: academy.name, primary_color: academy.primary_color, report_time: utcToUzt(academy.report_time), weekly_report_time: utcToUzt(academy.weekly_report_time) })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved]     = useState(false)

  const [tgGroups, setTgGroups]       = useState([])
  const [tgForm, setTgForm]           = useState({ chat_id: '', name: '', language: 'uz' })
  const [tgLoading, setTgLoading]     = useState(false)
  const [tgAdding, setTgAdding]       = useState(false)

  useEffect(() => {
    api.get('/academy/telegram-groups/').then(r => setTgGroups(r.data)).catch(() => {})
  }, [])

  const addTgGroup = async e => {
    e.preventDefault()
    if (!tgForm.chat_id || !tgForm.name) return
    setTgAdding(true)
    try {
      const { data } = await api.post('/academy/telegram-groups/', { chat_id: Number(tgForm.chat_id), name: tgForm.name, language: tgForm.language })
      setTgGroups(g => [...g, data])
      setTgForm({ chat_id: '', name: '', language: 'uz' })
    } catch {
      show(t('settings.err_save'), 'error')
    } finally { setTgAdding(false) }
  }

  const removeTgGroup = async id => {
    setTgLoading(true)
    try {
      await api.delete(`/academy/telegram-groups/${id}/`)
      setTgGroups(g => g.filter(x => x.id !== id))
    } catch {
      show(t('settings.err_save'), 'error')
    } finally { setTgLoading(false) }
  }

  const save = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { ...form, report_time: uztToUtc(form.report_time) || null, weekly_report_time: uztToUtc(form.weekly_report_time) || null }
      const { data } = await api.patch('/academy/', payload)
      onUpdated(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      show(t('settings.err_save'), 'error')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Name */}
      <div>
        <label style={labelStyle}>{t('settings.academy_name')}</label>
        <input style={inputStyle(false)} value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </div>

      {/* Color */}
      <div>
        <label style={labelStyle}>{t('settings.brand_color')}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {PRESET_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setForm(f => ({ ...f, primary_color: c }))}
              style={{
                width: 32, height: 32, borderRadius: 8, background: c, border: 'none',
                cursor: 'pointer', outline: form.primary_color === c ? `3px solid ${c}` : 'none',
                outlineOffset: 2, transition: 'transform 0.15s',
                transform: form.primary_color === c ? 'scale(1.15)' : 'scale(1)',
              }} />
          ))}
          {/* Custom — a swatch-sized native color-picker trigger instead of a full extra row */}
          <label title={form.primary_color} style={{
            position: 'relative', width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
            background: form.primary_color, border: '2px dashed rgba(148,163,184,0.6)',
            outline: PRESET_COLORS.includes(form.primary_color) ? 'none' : `3px solid ${form.primary_color}`,
            outlineOffset: 2,
          }}>
            <input type="color" value={form.primary_color}
              onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
          </label>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 6 }}>{form.primary_color}</p>

        {/* Live preview */}
        <div style={{
          marginTop: 16, padding: '14px 18px', borderRadius: 14,
          background: `linear-gradient(135deg, ${form.primary_color}22, ${form.primary_color}11)`,
          border: `1.5px solid ${form.primary_color}44`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: form.primary_color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={18} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: form.primary_color }}>{form.name || t('settings.academy_name')}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('settings.invite_preview')}</p>
          </div>
        </div>
      </div>

      {/* Reports section */}
      <div>
        <label style={labelStyle}>
          <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          {t('settings.reports_section')}
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Daily report card */}
          <div style={{ border: '1.5px solid #F59E0B44', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#F59E0B0D', flexWrap: 'wrap' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F59E0B22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Shield size={16} color="#F59E0B" />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{t('settings.daily_report_title')}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>{t('settings.daily_report_desc')}</p>
              </div>
              <input
                type="time"
                style={{ padding: '7px 10px', borderRadius: 9, border: '1.5px solid #F59E0B55', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontWeight: 600, outline: 'none', width: 120, flexShrink: 0 }}
                value={form.report_time}
                onChange={e => setForm(f => ({ ...f, report_time: e.target.value }))}
              />
            </div>
            <div style={{ padding: '8px 16px', background: '#F59E0B08', borderTop: '1px solid #F59E0B22' }}>
              <p style={{ fontSize: 11, color: '#92400E', margin: 0 }}>📋 {t('settings.daily_report_recipients')}</p>
            </div>
          </div>

          {/* Weekly report card */}
          <div style={{ border: '1.5px solid #EC489944', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#EC48990D', flexWrap: 'wrap' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#EC489922', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={16} color="#EC4899" />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{t('settings.weekly_report_title')}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>{t('settings.weekly_report_desc')}</p>
              </div>
              <input
                type="time"
                style={{ padding: '7px 10px', borderRadius: 9, border: '1.5px solid #EC489955', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontWeight: 600, outline: 'none', width: 120, flexShrink: 0 }}
                value={form.weekly_report_time}
                onChange={e => setForm(f => ({ ...f, weekly_report_time: e.target.value }))}
              />
            </div>
            <div style={{ padding: '8px 16px', background: '#EC489908', borderTop: '1px solid #EC489922' }}>
              <p style={{ fontSize: 11, color: '#9D174D', margin: 0 }}>👨‍👩‍👧 {t('settings.weekly_report_recipients')}</p>
            </div>
          </div>

        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{t('settings.reports_tz_hint')}</p>
      </div>

      {/* Telegram groups */}
      <div>
        <label style={labelStyle}>
          <Send size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          {t('settings.telegram_groups')}
        </label>

        {tgGroups.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {tgGroups.map(g => (
              <div key={g.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 10,
                background: 'var(--card)', border: '1.5px solid rgba(0,0,0,0.08)',
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{g.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, fontFamily: 'monospace' }}>
                    {g.chat_id} · {g.language === 'ru' ? '🇷🇺 Русский' : "🇺🇿 O'zbek"}
                  </p>
                </div>
                <button type="button" onClick={() => removeTgGroup(g.id)} disabled={tgLoading}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4 }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder={t('settings.tg_group_name')}
            value={tgForm.name}
            onChange={e => setTgForm(f => ({ ...f, name: e.target.value }))}
            style={{ ...inputStyle(false), flex: 1, minWidth: 140 }}
          />
          <input
            placeholder="Chat ID (-100...)"
            value={tgForm.chat_id}
            onChange={e => setTgForm(f => ({ ...f, chat_id: e.target.value }))}
            style={{ ...inputStyle(false), width: 150 }}
          />
          <select
            value={tgForm.language}
            onChange={e => setTgForm(f => ({ ...f, language: e.target.value }))}
            style={{ ...inputStyle(false), width: 120, cursor: 'pointer' }}
          >
            <option value="uz">🇺🇿 O'zbek</option>
            <option value="ru">🇷🇺 Русский</option>
          </select>
          <button type="button" onClick={addTgGroup} disabled={tgAdding || !tgForm.chat_id || !tgForm.name}
            style={{
              padding: '0 16px', borderRadius: 10, border: 'none',
              background: '#0D9488', color: '#fff', fontWeight: 700,
              cursor: tgAdding ? 'not-allowed' : 'pointer', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {tgAdding ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Plus size={14} />}
            {t('settings.add')}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{t('settings.tg_group_hint')}</p>
      </div>

      <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
        style={{
          padding: '13px', borderRadius: 12, border: 'none',
          background: saved
            ? 'linear-gradient(135deg, #10B981, #059669)'
            : `linear-gradient(135deg, ${form.primary_color}, ${form.primary_color}cc)`,
          color: '#fff', fontWeight: 800, fontSize: 14,
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 0.3s',
        }}>
        {loading
          ? <><Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> {t('settings.saving')}</>
          : saved
            ? <><Check size={15} /> {t('settings.saved')}</>
            : t('settings.save_changes')
        }
      </motion.button>
    </form>
  )
}

// ── Members Tab ────────────────────────────────────────────────────────────────
const ROLE_BADGE = {
  admin:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  teacher: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  student: { color: '#14B8A8', bg: 'rgba(20,184,168,0.12)' },
  parent:  { color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
}

function MembersTab({ userRole }) {
  const { t } = useTranslation()
  const { show } = useToast()
  const [members, setMembers]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [page, setPage]               = useState(1)
  const [totalPages, setTotalPages]   = useState(1)
  const [total, setTotal]             = useState(0)
  const [removing, setRemoving]       = useState(null)
  const [search, setSearch]           = useState('')
  const [roleFilter, setRoleFilter]   = useState('')
  const [linking, setLinking]         = useState(null)
  const [allStudents, setAllStudents] = useState([])
  const [linkStudent, setLinkStudent] = useState('')
  const [linkSaving, setLinkSaving]   = useState(false)
  const searchTimer = useRef(null)

  const fetchPage = useCallback(async (p, q, role) => {
    setLoading(true)
    try {
      const params = { page: p, page_size: 20 }
      if (q) params.search = q
      if (role) params.role = role
      const { data } = await api.get('/academy/members/', { params })
      setMembers(data.results)
      setTotalPages(data.pages)
      setTotal(data.total)
      setPage(data.page)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPage(1, '', '') }, [fetchPage])

  const handleSearch = e => {
    const q = e.target.value
    setSearch(q)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchPage(1, q, roleFilter), 350)
  }

  const handleRoleFilter = role => {
    setRoleFilter(role)
    fetchPage(1, search, role)
  }

  const removeMember = async (member) => {
    const name = member.first_name || member.username
    if (!window.confirm(t('settings.remove_confirm', { name }))) return
    setRemoving(member.id)
    try {
      await api.delete(`/academy/members/${member.id}/`)
      fetchPage(page, search, roleFilter)
      show(t('settings.member_removed'), 'success')
    } catch (err) {
      show(err.response?.data?.detail || t('settings.err_remove_member'), 'error')
    } finally { setRemoving(null) }
  }

  const canRemove = (member) => {
    if (member.role === 'admin') return userRole === 'admin'
    if (member.role === 'teacher') return userRole === 'admin'
    return true
  }

  const [togglingActive, setTogglingActive] = useState(null)
  const toggleTeacherActive = async (member) => {
    setTogglingActive(member.id)
    try {
      await api.post(`/auth/teachers/${member.id}/active/`, { is_active: !member.is_active })
      fetchPage(page, search, roleFilter)
      show(member.is_active ? t('settings.teacher_deactivated') : t('settings.teacher_activated'), 'success')
    } catch (err) {
      show(err.response?.data?.detail || t('settings.err_toggle_active'), 'error')
    } finally { setTogglingActive(null) }
  }

  const openLink = async (memberId) => {
    setLinking(memberId)
    setLinkStudent('')
    if (allStudents.length === 0) {
      const { data } = await api.get('/academy/members/', { params: { role: 'student' } })
      setAllStudents(Array.isArray(data) ? data : data.results || [])
    }
  }

  const linkChild = async (parentId) => {
    if (!linkStudent) return
    setLinkSaving(true)
    try {
      await api.post('/auth/link-child/', { parent: parentId, student: linkStudent })
      show(t('settings.child_linked'), 'success')
      setLinking(null)
      setLinkStudent('')
    } catch (err) {
      show(err.response?.data?.detail || t('settings.err_link_child'), 'error')
    } finally { setLinkSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          placeholder={t('settings.search_members')}
          value={search} onChange={handleSearch}
          style={{ ...inputStyle(false), fontSize: 14, flex: 1 }}
        />
        {total > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: 600 }}>
            {total}
          </span>
        )}
      </div>

      {/* Role filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => handleRoleFilter('')}
          style={{
            padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: `1.5px solid ${roleFilter === '' ? 'var(--accent)' : 'var(--border)'}`,
            background: roleFilter === '' ? 'var(--accent)' : 'transparent',
            color: roleFilter === '' ? '#fff' : 'var(--text-muted)',
          }}>
          {t('settings.role_filter_all')}
        </button>
        {ROLE_OPTION_DEFS.map(r => {
          const active = roleFilter === r.value
          return (
            <button key={r.value} onClick={() => handleRoleFilter(r.value)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1.5px solid ${active ? r.color : 'var(--border)'}`,
                background: active ? `${r.color}18` : 'transparent',
                color: active ? r.color : 'var(--text-muted)',
              }}>
              <r.icon size={12} />
              {t(`settings.role_${r.value}`)}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Loader2 size={24} style={{ color: '#14B8A8', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
        </div>
      ) : members.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <Users size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
          <p style={{ fontWeight: 600 }}>{search ? t('settings.no_results') : t('settings.no_members')}</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>{t('settings.no_members_sub')}</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map(m => {
              const badge = ROLE_BADGE[m.role] || ROLE_BADGE.student
              const initials = (m.first_name?.[0] || m.username?.[0] || '?').toUpperCase()
              return (
                <motion.div key={m.id} layout
                  className="member-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    padding: '12px 16px', borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                  }}>
                  <Link to={`/profile/${m.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, textDecoration: 'none' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      background: `linear-gradient(135deg, ${badge.color}, ${badge.color}bb)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 800, color: '#fff',
                    }}>
                      {initials}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                          {m.first_name ? `${m.first_name} ${m.last_name}` : m.username}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          background: badge.bg, color: badge.color,
                        }}>
                          {t(`settings.role_${m.role}`, { defaultValue: m.role })}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        @{m.username}
                        {m.invited_by && (
                          <span> · {t('settings.invited_by')} <strong>{m.invited_by.first_name || m.invited_by.username}</strong></span>
                        )}
                      </p>
                    </div>
                  </Link>

                  <div className="member-date" style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0, marginRight: 8 }}>
                    {formatDate(m.date_joined)}
                  </div>

                  {m.role === 'parent' && (
                    linking === m.id ? (
                      <div className="member-row-action" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <select value={linkStudent} onChange={e => setLinkStudent(e.target.value)}
                          style={{ fontSize: 12, padding: '5px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', maxWidth: 140, flex: 1, minWidth: 0 }}>
                          <option value="">{t('settings.pick_student')}</option>
                          {allStudents.map(s => (
                            <option key={s.id} value={s.id}>{s.first_name ? `${s.first_name} ${s.last_name}` : s.username}</option>
                          ))}
                        </select>
                        <button onClick={() => linkChild(m.id)} disabled={!linkStudent || linkSaving}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: 'none', background: '#EC4899', color: '#fff', fontSize: 12, fontWeight: 700, cursor: (!linkStudent || linkSaving) ? 'not-allowed' : 'pointer', opacity: (!linkStudent || linkSaving) ? 0.6 : 1 }}>
                          {linkSaving ? <Loader2 size={11} style={{ animation: 'spin 0.7s linear infinite' }} /> : t('settings.link')}
                        </button>
                        <button onClick={() => { setLinking(null); setLinkStudent('') }}
                          style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button className="member-row-action" onClick={() => openLink(m.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px',
                          borderRadius: 9, border: '1px solid rgba(236,72,153,0.25)',
                          background: 'rgba(236,72,153,0.07)', color: '#EC4899',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                        }}>
                        + {t('settings.link_child')}
                      </button>
                    )
                  )}

                  {m.role === 'teacher' && m.is_active === false && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(100,116,139,0.15)', color: '#64748B', flexShrink: 0 }}>
                      {t('settings.inactive_badge')}
                    </span>
                  )}

                  {m.role === 'teacher' && userRole === 'admin' && (
                    <button className="member-row-action" onClick={() => toggleTeacherActive(m)} disabled={togglingActive === m.id}
                      title={m.is_active ? t('settings.deactivate_teacher') : t('settings.activate_teacher')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px',
                        borderRadius: 9, cursor: togglingActive === m.id ? 'not-allowed' : 'pointer', flexShrink: 0,
                        border: `1px solid ${m.is_active ? 'rgba(220,38,38,0.2)' : 'rgba(22,163,74,0.25)'}`,
                        background: m.is_active ? 'rgba(220,38,38,0.06)' : 'rgba(22,163,74,0.07)',
                        color: m.is_active ? '#DC2626' : '#16A34A', fontSize: 12, fontWeight: 600,
                      }}>
                      {togglingActive === m.id
                        ? <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} />
                        : <UserX size={12} />}
                      {m.is_active ? t('settings.deactivate_teacher') : t('settings.activate_teacher')}
                    </button>
                  )}

                  {canRemove(m) && (
                    <button className="member-row-action" onClick={() => removeMember(m)} disabled={removing === m.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px',
                        borderRadius: 9, border: '1px solid rgba(239,68,68,0.2)',
                        background: 'rgba(239,68,68,0.06)', color: '#EF4444',
                        fontSize: 12, fontWeight: 600, cursor: removing === m.id ? 'not-allowed' : 'pointer',
                        flexShrink: 0, transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}>
                      {removing === m.id
                        ? <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} />
                        : <UserX size={12} />
                      }
                      {t('settings.remove')}
                    </button>
                  )}
                </motion.div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 4 }}>
              <button onClick={() => fetchPage(page - 1, search, roleFilter)} disabled={page <= 1}
                style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}>
                <ChevronLeft size={16} color="var(--text-muted)" />
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                {page} / {totalPages}
              </span>
              <button onClick={() => fetchPage(page + 1, search, roleFilter)} disabled={page >= totalPages}
                style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1 }}>
                <ChevronRight size={16} color="var(--text-muted)" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Invites Tab ────────────────────────────────────────────────────────────────
function InvitesTab({ academy, userRole }) {
  const { t } = useTranslation()
  const { show } = useToast()
  const [invites, setInvites]   = useState([])
  const [invitePage,  setInvitePage]  = useState(1)
  const [invitePages, setInvitePages] = useState(1)
  const [filterSearch, setFilterSearch] = useState('')
  const [filterRole,   setFilterRole]   = useState('')
  const [groups, setGroups]     = useState([])
  const [students, setStudents] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ role: 'student', group: '', student: '', max_uses: 1, days_valid: 7, note: '' })
  const didMountFilters = useRef(false)

  const allowedRoleDefs = ROLE_OPTION_DEFS.filter(r =>
    (ROLE_OPTIONS_BY_ROLE[userRole] || ['student', 'parent']).includes(r.value)
  )

  const fetchInvites = async (page) => {
    const params = { page }
    if (filterSearch.trim()) params.search = filterSearch.trim()
    if (filterRole) params.role = filterRole
    const { data } = await api.get('/invites/', { params })
    setInvites(data.results); setInvitePages(data.pages); setInvitePage(data.page)
  }

  useEffect(() => {
    Promise.all([
      api.get('/invites/', { params: { page: 1 } }).catch(() => ({ data: { results: [], pages: 1, page: 1 } })),
      api.get('/groups/').catch(() => ({ data: [] })),
      api.get('/academy/members/', { params: { role: 'student' } }).catch(() => ({ data: [] })),
    ]).then(([inv, grp, mem]) => {
      setInvites(inv.data.results); setInvitePages(inv.data.pages); setInvitePage(inv.data.page)
      setGroups(grp.data)
      setStudents((mem.data || []).filter(m => m.role === 'student'))
    }).finally(() => setLoadingList(false))
  }, [])

  useEffect(() => {
    if (!didMountFilters.current) { didMountFilters.current = true; return }
    const timer = setTimeout(() => { fetchInvites(1) }, 350)
    return () => clearTimeout(timer)
  }, [filterSearch, filterRole])

  const handleDeleteInvite = async (id) => {
    try {
      await api.delete(`/invites/${id}/`)
      show(t('settings.invite_deleted'), 'info')
      await fetchInvites(invites.length === 1 && invitePage > 1 ? invitePage - 1 : invitePage)
    } catch {
      show(t('settings.err_invite_delete'), 'error')
    }
  }

  const createInvite = async e => {
    e.preventDefault()
    setCreating(true)
    try {
      const payload = { ...form, max_uses: Number(form.max_uses), days_valid: Number(form.days_valid) }
      if (!payload.group) delete payload.group
      if (payload.role !== 'parent' || !payload.student) delete payload.student
      await api.post('/invites/create/', payload)
      await fetchInvites(1)
      setShowForm(false)
      setForm({ role: 'student', group: '', student: '', max_uses: 1, days_valid: 7, note: '' })
      show(t('settings.invite_created'), 'success')
    } catch {
      show(t('settings.err_invite_create'), 'error')
    } finally { setCreating(false) }
  }

  const inviteUrl = token => `${window.location.origin}/invite/${token}`

  const color = academy.primary_color || '#0D9488'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Create button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => setShowForm(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
            borderRadius: 12, border: 'none', cursor: 'pointer',
            background: showForm ? 'rgba(0,0,0,0.06)' : `linear-gradient(135deg, ${color}, ${color}cc)`,
            color: showForm ? 'var(--text)' : '#fff', fontWeight: 700, fontSize: 14,
            boxShadow: showForm ? 'none' : `0 4px 16px ${color}44`,
          }}>
          <Plus size={15} />
          {t('settings.new_invite')}
        </motion.button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }}
            style={{ background: 'var(--card)', borderRadius: 16, border: `1.5px solid ${color}44`, padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 18 }}>{t('settings.generate_invite')}</h3>
            <form onSubmit={createInvite} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Role picker */}
              <div>
                <label style={labelStyle}>{t('settings.role')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8 }}>
                  {allowedRoleDefs.map(r => (
                    <button key={r.value} type="button" onClick={() => setForm(f => ({ ...f, role: r.value, group: '', student: '' }))}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        padding: '12px 8px', borderRadius: 12, border: `1.5px solid ${form.role === r.value ? r.color : 'rgba(0,0,0,0.1)'}`,
                        background: form.role === r.value ? `${r.color}15` : 'transparent',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      <r.icon size={16} style={{ color: form.role === r.value ? r.color : 'var(--text-muted)' }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: form.role === r.value ? r.color : 'var(--text-muted)' }}>
                        {t(`settings.role_${r.value}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {/* Max uses */}
                <div>
                  <label style={labelStyle}><Hash size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{t('settings.max_uses')}</label>
                  <input type="number" min="1" max="500" style={inputStyle(false)}
                    value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                    {MAX_USES_PRESETS.map(p => (
                      <button key={p} type="button" onClick={() => setForm(f => ({ ...f, max_uses: p }))}
                        style={presetChip(Number(form.max_uses) === p, color)}>{p}</button>
                    ))}
                  </div>
                </div>

                {/* Days valid */}
                <div>
                  <label style={labelStyle}><Clock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{t('settings.valid_days')}</label>
                  <input type="number" min="1" max="365" style={inputStyle(false)}
                    value={form.days_valid} onChange={e => setForm(f => ({ ...f, days_valid: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                    {DAYS_VALID_PRESETS.map(p => (
                      <button key={p} type="button" onClick={() => setForm(f => ({ ...f, days_valid: p }))}
                        style={presetChip(Number(form.days_valid) === p, color)}>{t('settings.days_preset', { count: p })}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Group (optional, students only) — graduated groups excluded */}
              {groups.some(g => !g.is_graduated) && form.role === 'student' && (
                <div>
                  <label style={labelStyle}>{t('settings.autojoin_group')}</label>
                  <Dropdown
                    value={form.group}
                    onChange={v => setForm(f => ({ ...f, group: v }))}
                    placeholder={t('settings.no_group')}
                    options={groups.filter(g => !g.is_graduated).map(g => ({ value: String(g.id), label: g.name }))}
                  />
                </div>
              )}

              {/* Student link (parents only) */}
              {form.role === 'parent' && (
                <div>
                  <label style={labelStyle}>{t('settings.link_student')}</label>
                  <Dropdown
                    value={form.student}
                    onChange={v => setForm(f => ({ ...f, student: v }))}
                    placeholder={t('settings.no_student')}
                    options={students.map(s => ({
                      value: String(s.id),
                      label: (s.first_name || s.last_name) ? `${s.first_name} ${s.last_name}`.trim() : s.username,
                    }))}
                  />
                </div>
              )}

              {/* Note */}
              <div>
                <label style={labelStyle}>{t('settings.invite_note')}</label>
                <input style={inputStyle(false)} placeholder={t('settings.invite_note_placeholder')}
                  value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <motion.button type="submit" disabled={creating} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                    color: '#fff', fontWeight: 800, fontSize: 14,
                    cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {creating
                    ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> {t('settings.creating')}</>
                    : <><Link2 size={14} /> {t('settings.create_link')}</>
                  }
                </motion.button>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: '12px 18px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.12)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  {t('settings.cancel')}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + role filter */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
            placeholder={t('settings.invite_search_placeholder')}
            style={{ ...inputStyle(false), paddingLeft: 34, paddingRight: filterSearch ? 34 : 12 }} />
          {filterSearch && (
            <button type="button" onClick={() => setFilterSearch('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
              <X size={13} />
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setFilterRole('')} style={presetChip(filterRole === '', color)}>{t('settings.all_roles')}</button>
          {allowedRoleDefs.map(r => (
            <button key={r.value} type="button" onClick={() => setFilterRole(r.value)} style={presetChip(filterRole === r.value, r.color)}>
              {t(`settings.role_${r.value}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Invite list */}
      {loadingList ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Loader2 size={24} style={{ color, animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : invites.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <Link2 size={36} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
          <p style={{ fontWeight: 600 }}>{(filterSearch || filterRole) ? t('settings.no_results') : t('settings.no_invites')}</p>
          {!(filterSearch || filterRole) && <p style={{ fontSize: 13, marginTop: 4 }}>{t('settings.no_invites_sub')}</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {invites.map(inv => (
            <InviteRow key={inv.id} inv={inv} url={inviteUrl(inv.token)} onDelete={() => handleDeleteInvite(inv.id)} />
          ))}
        </div>
      )}

      {invitePages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 4 }}>
          <button onClick={() => fetchInvites(invitePage - 1)} disabled={invitePage <= 1}
            style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: invitePage <= 1 ? 'not-allowed' : 'pointer', opacity: invitePage <= 1 ? 0.4 : 1 }}>
            <ChevronLeft size={16} color="var(--text-muted)" />
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{invitePage} / {invitePages}</span>
          <button onClick={() => fetchInvites(invitePage + 1)} disabled={invitePage >= invitePages}
            style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: invitePage >= invitePages ? 'not-allowed' : 'pointer', opacity: invitePage >= invitePages ? 0.4 : 1 }}>
            <ChevronRight size={16} color="var(--text-muted)" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Invite Row ────────────────────────────────────────────────────────────────

function InviteRow({ inv, url, onDelete }) {
  const { t } = useTranslation()
  const [confirm, setConfirm] = useState(false)
  const roleDef  = ROLE_OPTION_DEFS.find(r => r.value === inv.role) || ROLE_OPTION_DEFS[0]
  const expired  = !inv.is_valid
  const usedUp   = inv.use_count >= inv.max_uses

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      style={{
        padding: '14px 18px', borderRadius: 14,
        border: `1px solid ${expired || usedUp ? 'rgba(0,0,0,0.08)' : roleDef.color + '33'}`,
        background: expired || usedUp ? 'rgba(0,0,0,0.02)' : `${roleDef.color}08`,
        opacity: expired || usedUp ? 0.6 : 1,
      }}>
      <div className="invite-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: expired || usedUp ? 'rgba(0,0,0,0.06)' : `${roleDef.color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <roleDef.icon size={16} style={{ color: expired || usedUp ? 'var(--text-muted)' : roleDef.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: expired || usedUp ? 'var(--text-muted)' : roleDef.color }}>
              {t(`settings.role_${inv.role}`, { defaultValue: inv.role })}
            </span>
            {inv.group && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.06)', color: 'var(--text-muted)' }}>{t('settings.group_attached')}</span>}
            {inv.student_name && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(236,72,153,0.1)', color: '#EC4899' }}>👤 {inv.student_name}</span>}
            {(expired || usedUp) && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                {usedUp ? t('settings.used_up') : t('settings.expired')}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {url}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={10} /> {inv.use_count}/{inv.max_uses} {t('settings.used')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={10} /> {t('settings.expires')} {formatDate(inv.expires_at)}
            </span>
            {inv.note && <span style={{ fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>"{inv.note}"</span>}
          </div>
        </div>
        <div className="invite-row-actions" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {!expired && !usedUp && <CopyButton text={url} />}
          {confirm ? (
            <>
              <button onClick={onDelete} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {t('settings.confirm_delete')}
              </button>
              <button onClick={() => setConfirm(false)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                {t('settings.cancel')}
              </button>
            </>
          ) : (
            <button onClick={() => setConfirm(true)} title={t('settings.delete_invite')}
              style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Trash2 size={14} color="var(--text-muted)" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

function Dropdown({ value, onChange, options, placeholder, searchPlaceholder }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    const onClickOutside = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (open) { setQuery(''); setTimeout(() => searchRef.current?.focus(), 50) }
  }, [open])

  const selected = options.find(o => o.value === value)
  const showSearch = options.length > 6
  const filtered = showSearch && query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ ...inputStyle(false), display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ color: selected ? 'var(--text)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--surface, var(--card))', border: '1px solid var(--border, rgba(0,0,0,0.1))', borderRadius: 10, overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.18)', zIndex: 50 }}>
            {showSearch && (
              <div style={{ padding: 8, borderBottom: '1px solid var(--border, rgba(0,0,0,0.1))' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    placeholder={searchPlaceholder || t('settings.search_placeholder')}
                    style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              <button type="button" onClick={() => { onChange(''); setOpen(false) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: value === '' ? 'var(--accent-bg)' : 'transparent', color: value === '' ? 'var(--accent)' : 'var(--text-muted)', fontSize: 13, fontWeight: value === '' ? 700 : 500, cursor: 'pointer', fontStyle: 'italic' }}>
                {placeholder}
              </button>
              {filtered.length === 0 ? (
                <p style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{t('settings.no_results')}</p>
              ) : filtered.map(o => (
                <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: o.value === value ? 'var(--accent-bg)' : 'transparent', color: o.value === value ? 'var(--accent)' : 'var(--text)', fontSize: 13, fontWeight: o.value === value ? 700 : 500, cursor: 'pointer' }}>
                  {o.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main Settings Page ─────────────────────────────────────────────────────────
export default function Settings() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('academy')
  const [academy, setAcademy]     = useState(null)
  const [fetched, setFetched]     = useState(false)

  useEffect(() => {
    if (!user) return
    if (user.academy) {
      api.get('/academy/')
        .then(r => setAcademy(r.data))
        .catch(() => {})
        .finally(() => setFetched(true))
    } else {
      setFetched(true)
    }
  }, [user?.id])

  if (!user) return null

  if (!fetched) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} style={{ color: '#14B8A8', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // No academy yet
  if (!academy) {
    return (
      <>
        <CreateAcademy onCreated={data => setAcademy(data)} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </>
    )
  }

  const color = academy.primary_color || '#14B8A8'
  const TABS = ALL_TABS.filter(t => t.roles.includes(user.role))

  return (
    <div className="settings-page" style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: `0 4px 16px ${color}44`,
          }}>
            {academy.logo_url
              ? <img src={academy.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
              : <Building2 size={22} color="#fff" />
            }
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{academy.name}</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {t(`settings.role_${user.role}`, { defaultValue: user.role })} · {t('nav.settings')}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="settings-tabs" style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--card)', borderRadius: 12, padding: 4, border: '1px solid var(--border)' }}>
        {TABS.map(tab => (
          <button key={tab.id} className="settings-tabs-btn" onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '9px 4px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: activeTab === tab.id ? `linear-gradient(135deg, ${color}, ${color}cc)` : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
              fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
              boxShadow: activeTab === tab.id ? `0 2px 10px ${color}44` : 'none',
            }}>
            <tab.icon size={14} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(`settings.tab_${tab.id}`)}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="settings-tab-content" style={{ background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'academy' && (
            <motion.div key="academy" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
              {user.role === 'admin'
                ? <AcademyTab academy={academy} onUpdated={setAcademy} />
                : <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                    <AlertCircle size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
                    <p style={{ fontWeight: 600 }}>{t('settings.admin_only')}</p>
                    <p style={{ fontSize: 13, marginTop: 4 }}>{t('settings.admin_only_sub')}</p>
                  </div>
              }
            </motion.div>
          )}
          {activeTab === 'members' && (
            <motion.div key="members" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
              <MembersTab userRole={user.role} />
            </motion.div>
          )}
          {activeTab === 'invites' && (
            <motion.div key="invites" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
              <InvitesTab academy={academy} userRole={user.role} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 580px) {
          .settings-page { padding: 16px 12px !important; }
          .member-row { padding: 10px 12px !important; gap: 8px !important; }
          .member-date { display: none !important; }
          .settings-tab-content { padding: 16px !important; border-radius: 14px !important; }
        }
      `}</style>
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: 7,
}

const inputStyle = hasErr => ({
  width: '100%', padding: '11px 14px', borderRadius: 10, boxSizing: 'border-box',
  background: 'var(--input-bg, rgba(0,0,0,0.04))',
  border: `1.5px solid ${hasErr ? 'rgba(239,68,68,0.5)' : 'var(--border, rgba(0,0,0,0.1))'}`,
  color: 'var(--text)', fontSize: 14, outline: 'none',
})

const errStyle = { fontSize: 11, color: '#f87171', marginTop: 4 }
