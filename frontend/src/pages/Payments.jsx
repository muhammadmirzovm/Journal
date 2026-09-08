import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  Users, TrendingDown, Receipt, Loader2, PlusCircle, SlidersHorizontal, ChevronRight, Search, Download,
} from 'lucide-react'
import {
  getTuitionCategories, createTuitionCategory, getTuitionTemplates, createTuitionTemplate,
  setGroupTuition, getBalances, getPaymentHistory, exportBalancesExcel,
} from '../api/payments'
import { getGroups } from '../api/groups'
import { useToast } from '../context/ToastContext'
import ReceiptPreviewModal from '../components/ReceiptPreviewModal'
import PaymentHistoryList from '../components/payments/PaymentHistoryList'
import Pager from '../components/payments/Pager'
import { primaryBtn, ghostBtn, inputStyle, som } from '../components/payments/format'
import AmountInput from '../components/payments/AmountInput'

const GROUPS_PAGE_SIZE = 12

const tabBtn = (active) => ({ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-bg)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' })

export default function Payments() {
  const { t } = useTranslation()
  const { show } = useToast()

  const [groups, setGroups] = useState([])
  const [categories, setCategories] = useState([])
  const [templates, setTemplates] = useState([])
  const [panel, setPanel] = useState(null) // null | 'templates' | 'groups'

  const [balanceGroups, setBalanceGroups] = useState([])
  const [summary, setSummary] = useState({ debtor_count: 0, total_debt: 0 })
  const [loading, setLoading] = useState(true)
  const [groupSearch, setGroupSearch] = useState('')
  const [groupsPage, setGroupsPage] = useState(1)

  const [history, setHistory] = useState([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPages, setHistoryPages] = useState(1)
  const [historyLoading, setHistoryLoading] = useState(true)

  const [receiptFor, setReceiptFor] = useState(null)

  const loadStatic = () => {
    Promise.all([getGroups(), getTuitionCategories(), getTuitionTemplates()])
      .then(([g, c, tpl]) => { setGroups(g.data); setCategories(c.data); setTemplates(tpl.data) })
      .catch(() => show(t('payments.toast_load_fail'), 'error'))
  }

  const loadBalances = () => {
    setLoading(true)
    getBalances({})
      .then(r => { setBalanceGroups(r.data.groups); setSummary(r.data.summary) })
      .catch(() => show(t('payments.toast_load_fail'), 'error'))
      .finally(() => setLoading(false))
  }

  const loadHistory = () => {
    setHistoryLoading(true)
    getPaymentHistory({ page: historyPage, page_size: 20 })
      .then(r => { setHistory(r.data.results); setHistoryPages(r.data.pages) })
      .catch(() => show(t('payments.toast_load_fail'), 'error'))
      .finally(() => setHistoryLoading(false))
  }

  useEffect(loadStatic, [])
  useEffect(loadBalances, [])
  useEffect(loadHistory, [historyPage])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{t('payments.title')}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('payments.subtitle')}</p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <button onClick={() => setPanel(p => p === 'templates' ? null : 'templates')} style={tabBtn(panel === 'templates')}>
          <SlidersHorizontal size={15} /> {t('payments.templates_btn')}
        </button>
        <button onClick={() => setPanel(p => p === 'groups' ? null : 'groups')} style={tabBtn(panel === 'groups')}>
          <Users size={15} /> {t('payments.groups_pricing_btn')}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {panel === 'templates' && (
          <PanelShell key="templates">
            <TemplatesPanel
              t={t} categories={categories} templates={templates}
              onCategoryAdded={c => setCategories(prev => [...prev, c])}
              onTemplateAdded={tpl => setTemplates(prev => [...prev, tpl])}
            />
          </PanelShell>
        )}
        {panel === 'groups' && (
          <PanelShell key="groups">
            <GroupPricingPanel t={t} groups={groups} templates={templates} onAssigned={loadStatic} />
          </PanelShell>
        )}
      </AnimatePresence>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 26, marginTop: panel ? 20 : 0 }}>
        <StatCard icon={Users} label={t('payments.stat_debtors')} value={summary.debtor_count} color="#DC2626" />
        <StatCard icon={TrendingDown} label={t('payments.stat_total_debt')} value={`${som(summary.total_debt)} so'm`} color="#DC2626" />
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Users size={16} color="var(--text-muted)" />
          <p style={{ fontWeight: 700, fontSize: 14 }}>{t('payments.groups_list_title')}</p>
          <button onClick={() => exportBalancesExcel({})} style={{ ...ghostBtn, padding: '5px 10px', marginLeft: 'auto' }}>
            <Download size={13} /> {t('payments.export_excel_btn')}
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={22} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--text-muted)' }} />
          </div>
        ) : balanceGroups.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('payments.no_debt')}</p>
        ) : (() => {
          const q = groupSearch.trim().toLowerCase()
          const filtered = q ? balanceGroups.filter(g => g.group_name.toLowerCase().includes(q)) : balanceGroups
          const pages = Math.max(1, Math.ceil(filtered.length / GROUPS_PAGE_SIZE))
          const page = Math.min(groupsPage, pages)
          const pageGroups = filtered.slice((page - 1) * GROUPS_PAGE_SIZE, page * GROUPS_PAGE_SIZE)

          return (
            <>
              {balanceGroups.length > GROUPS_PAGE_SIZE && (
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input value={groupSearch} onChange={e => { setGroupSearch(e.target.value); setGroupsPage(1) }}
                    placeholder={t('payments.search_group_placeholder')}
                    style={{ ...inputStyle, paddingLeft: 34 }} />
                </div>
              )}
              {pageGroups.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('payments.no_search_results')}</p>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {pageGroups.map((g, i) => (
                    <GroupSummaryRow key={g.group_id} g={g} t={t} first={i === 0} />
                  ))}
                </div>
              )}
              <Pager page={page} pages={pages} onPageChange={setGroupsPage} />
            </>
          )
        })()}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Receipt size={16} color="var(--text-muted)" />
          <p style={{ fontWeight: 700, fontSize: 14 }}>{t('payments.history_title')}</p>
        </div>
        <PaymentHistoryList
          payments={history} loading={historyLoading}
          page={historyPage} pages={historyPages} onPageChange={setHistoryPage} t={t}
          onOpenReceipt={setReceiptFor}
          onVoided={() => { loadBalances(); loadHistory() }}
        />
      </div>

      <ReceiptPreviewModal payment={receiptFor} onClose={() => setReceiptFor(null)} />
    </div>
  )
}

function PanelShell({ children }) {
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      style={{ overflow: 'hidden' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, width: '100%', boxSizing: 'border-box' }}>
        {children}
      </div>
    </motion.div>
  )
}

function GroupSummaryRow({ g, t, first }) {
  const allPaid = g.total_debt === 0
  return (
    <Link to={`/payments/groups/${g.group_id}`} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', textDecoration: 'none', color: 'inherit',
      borderTop: first ? 'none' : '1px solid var(--border)',
    }}>
      <span style={{ fontWeight: 700, fontSize: 14 }}>{g.group_name}</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.rows.length} {t('payments.col_student').toLowerCase()}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {!allPaid && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>
            {g.debtor_count} {t('payments.stat_debtors').toLowerCase()}
          </span>
        )}
        <span style={{ fontWeight: 700, fontSize: 13, color: allPaid ? '#16A34A' : '#DC2626', minWidth: 110, textAlign: 'right' }}>
          {allPaid ? t('payments.no_debt_short') : `${som(g.total_debt)} so'm`}
        </span>
        <ChevronRight size={16} color="var(--text-muted)" />
      </span>
    </Link>
  )
}

function TemplatesPanel({ t, categories, templates, onCategoryAdded, onTemplateAdded }) {
  const { show } = useToast()
  const [categoryName, setCategoryName] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)
  const [tplName, setTplName] = useState('')
  const [tplCategory, setTplCategory] = useState('')
  const [tplPrice, setTplPrice] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  const addCategory = async () => {
    if (!categoryName.trim()) return
    setSavingCategory(true)
    try {
      const { data } = await createTuitionCategory({ name: categoryName.trim() })
      onCategoryAdded(data)
      setCategoryName('')
    } catch (err) {
      show(err.response?.data?.name?.[0] || t('payments.toast_category_fail'), 'error')
    } finally { setSavingCategory(false) }
  }

  const addTemplate = async () => {
    if (!tplName.trim() || !tplCategory || !tplPrice) return
    setSavingTemplate(true)
    try {
      const { data } = await createTuitionTemplate({ name: tplName.trim(), category: tplCategory, default_price: Number(tplPrice) })
      onTemplateAdded(data)
      setTplName(''); setTplPrice('')
    } catch (err) {
      show(err.response?.data?.name?.[0] || t('payments.toast_template_fail'), 'error')
    } finally { setSavingTemplate(false) }
  }

  return (
    <div>
      {/* Categories */}
      <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{t('payments.categories_label')}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        {categories.map(c => (
          <span key={c.id} style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: 'var(--accent-bg)', color: 'var(--accent)' }}>{c.name}</span>
        ))}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <input value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder={t('payments.category_placeholder')}
            style={{ ...inputStyle, width: 200 }} />
          <button onClick={addCategory} disabled={savingCategory} style={{ ...primaryBtn, opacity: savingCategory ? 0.7 : 1 }}>
            {savingCategory ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <PlusCircle size={13} />}
            {t('payments.add_category_btn')}
          </button>
        </div>
      </div>

      {/* Templates table */}
      <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{t('payments.templates_label')}</p>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, padding: '9px 14px', background: 'var(--bg)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <span>{t('payments.template_name_placeholder')}</span>
          <span>{t('payments.template_category_placeholder')}</span>
          <span style={{ textAlign: 'right' }}>{t('payments.template_price_placeholder')}</span>
        </div>
        {templates.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 14 }}>—</p>
        ) : templates.map(tpl => (
          <div key={tpl.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 13, alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{tpl.name}</span>
            <span style={{ color: 'var(--text-muted)' }}>{tpl.category_name}</span>
            <span style={{ textAlign: 'right', fontWeight: 700 }}>{som(tpl.default_price)} so'm</span>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--border)', alignItems: 'center', background: 'var(--bg)' }}>
          <input value={tplName} onChange={e => setTplName(e.target.value)} placeholder={t('payments.template_name_placeholder')} style={inputStyle} />
          <select value={tplCategory} onChange={e => setTplCategory(e.target.value)} style={inputStyle}>
            <option value="">{t('payments.template_category_placeholder')}</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <AmountInput value={tplPrice} onChange={setTplPrice} placeholder={t('payments.template_price_placeholder')} style={inputStyle} />
          <button onClick={addTemplate} disabled={savingTemplate} style={{ ...primaryBtn, opacity: savingTemplate ? 0.7 : 1, whiteSpace: 'nowrap' }}>
            {savingTemplate && <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {t('payments.add_template_btn')}
          </button>
        </div>
      </div>
    </div>
  )
}

function GroupPricingPanel({ t, groups, templates, onAssigned }) {
  const { show } = useToast()
  const [saving, setSaving] = useState(null) // group id currently saving
  const [choice, setChoice] = useState({}) // { [groupId]: templateId }

  const assign = async (groupId) => {
    const templateId = choice[groupId] || groups.find(g => g.id === groupId)?.tuition?.template
    if (!templateId) return
    setSaving(groupId)
    try {
      await setGroupTuition(groupId, templateId)
      show(t('payments.toast_assign_saved'), 'success')
      onAssigned()
    } catch { show(t('payments.toast_assign_fail'), 'error') } finally { setSaving(null) }
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{t('payments.groups_pricing_hint')}</p>
      {groups.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('payments.no_groups')}</p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {groups.map((g, i) => (
            <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 2fr auto', gap: 12, alignItems: 'center', padding: '10px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</span>
              <select
                value={choice[g.id] ?? (g.tuition?.template ?? '')}
                onChange={e => setChoice(prev => ({ ...prev, [g.id]: e.target.value }))}
                style={inputStyle}
              >
                <option value="">{t('payments.group_no_template')}</option>
                {templates.map(tpl => <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.category_name}) — {som(tpl.default_price)} so'm</option>)}
              </select>
              <button onClick={() => assign(g.id)} disabled={saving === g.id} style={{ ...ghostBtn, opacity: saving === g.id ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                {saving === g.id ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : t('payments.assign_btn')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{label}</p>
      </div>
    </div>
  )
}
