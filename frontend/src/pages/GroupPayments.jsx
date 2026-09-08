import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Wallet, Users, TrendingDown, Receipt, Search, CreditCard, Percent, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Download } from 'lucide-react'
import { getBalances, getPaymentHistory, setGroupTuition, getTuitionTemplates, exportBalancesExcel } from '../api/payments'
import { getGroups } from '../api/groups'
import { useToast } from '../context/ToastContext'
import ReceiptPreviewModal from '../components/ReceiptPreviewModal'
import RecordPaymentModal from '../components/payments/RecordPaymentModal'
import DiscountModal from '../components/payments/DiscountModal'
import PaymentHistoryList from '../components/payments/PaymentHistoryList'
import { inputStyle, ghostBtn, som } from '../components/payments/format'
import Pager from '../components/payments/Pager'

const STUDENTS_PAGE_SIZE = 15

export default function GroupPayments() {
  const { groupId } = useParams()
  const { t } = useTranslation()
  const { show } = useToast()

  const [group, setGroup] = useState(null) // from getGroups() — name, tuition, etc.
  const [templates, setTemplates] = useState([])
  const [balance, setBalance] = useState(null) // { group_id, group_name, rows, debtor_count, total_debt } | null
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dueSoonOnly, setDueSoonOnly] = useState(false)
  const [sort, setSort] = useState({ key: 'balance', dir: 'desc' })
  const [studentsPage, setStudentsPage] = useState(1)

  const [history, setHistory] = useState([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPages, setHistoryPages] = useState(1)
  const [historyLoading, setHistoryLoading] = useState(true)

  const [recordFor, setRecordFor] = useState(null)
  const [receiptFor, setReceiptFor] = useState(null)
  const [discountFor, setDiscountFor] = useState(null)

  const loadGroup = () => {
    getGroups().then(r => setGroup(r.data.find(g => String(g.id) === groupId) || null)).catch(() => {})
    getTuitionTemplates().then(r => setTemplates(r.data)).catch(() => {})
  }

  const loadBalance = () => {
    setLoading(true)
    getBalances({ group: groupId })
      .then(r => setBalance(r.data.groups[0] || { group_id: Number(groupId), group_name: '', rows: [], debtor_count: 0, total_debt: 0 }))
      .catch(() => show(t('payments.toast_load_fail'), 'error'))
      .finally(() => setLoading(false))
  }

  const loadHistory = () => {
    setHistoryLoading(true)
    getPaymentHistory({ group: groupId, page: historyPage, page_size: 20 })
      .then(r => { setHistory(r.data.results); setHistoryPages(r.data.pages) })
      .catch(() => show(t('payments.toast_load_fail'), 'error'))
      .finally(() => setHistoryLoading(false))
  }

  useEffect(loadGroup, [groupId])
  useEffect(loadBalance, [groupId])
  useEffect(loadHistory, [groupId, historyPage])

  const afterRecorded = () => {
    setRecordFor(null)
    loadBalance()
    setHistoryPage(1)
    loadHistory()
  }

  const groupName = group?.name || balance?.group_name || ''

  const daysUntil = (iso) => iso ? Math.ceil((new Date(iso) - new Date()) / 86400000) : null
  const isDueSoon = (row) => row.balance > 0 || (() => {
    const d = daysUntil(row.next_due_date)
    return d !== null && d >= 0 && d <= 5
  })()

  const q = search.trim().toLowerCase()
  let visibleRows = balance ? balance.rows.filter(r => r.student_name.toLowerCase().includes(q)) : []
  if (dueSoonOnly) visibleRows = visibleRows.filter(isDueSoon)

  const sortValue = (row) => {
    if (sort.key === 'name') return row.student_name.toLowerCase()
    if (sort.key === 'period') return row.next_due_date ? new Date(row.next_due_date).getTime() : Infinity
    return row.balance
  }
  visibleRows = [...visibleRows].sort((a, b) => {
    const av = sortValue(a), bv = sortValue(b)
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sort.dir === 'asc' ? cmp : -cmp
  })

  const studentsPages = Math.max(1, Math.ceil(visibleRows.length / STUDENTS_PAGE_SIZE))
  const studentsPageClamped = Math.min(studentsPage, studentsPages)
  const pagedRows = visibleRows.slice((studentsPageClamped - 1) * STUDENTS_PAGE_SIZE, studentsPageClamped * STUDENTS_PAGE_SIZE)

  const toggleSort = (key) => {
    setStudentsPage(1)
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' })
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Link to="/payments" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 14 }}>
        <ArrowLeft size={14} /> {t('payments.title')}
      </Link>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{groupName || '…'}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('payments.group_page_subtitle')}</p>
      </div>

      {group && (
        <GroupTuitionCard
          group={group} templates={templates} t={t}
          onChanged={() => { loadGroup(); loadBalance() }}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard icon={Users} label={t('payments.col_student')} value={balance?.rows.length ?? '…'} color="var(--accent)" />
        <StatCard icon={Wallet} label={t('payments.stat_debtors')} value={balance?.debtor_count ?? '…'} color="#DC2626" />
        <StatCard icon={TrendingDown} label={t('payments.stat_total_debt')} value={balance ? `${som(balance.total_debt)} so'm` : '…'} color="#DC2626" />
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setStudentsPage(1) }}
              placeholder={t('payments.search_student_placeholder')}
              style={{ ...inputStyle, paddingLeft: 34 }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={dueSoonOnly} onChange={e => { setDueSoonOnly(e.target.checked); setStudentsPage(1) }} />
            {t('payments.due_soon_filter')}
          </label>
          <button onClick={() => exportBalancesExcel({ group: groupId })} style={{ ...ghostBtn, padding: '7px 12px', whiteSpace: 'nowrap' }}>
            <Download size={13} /> {t('payments.export_excel_btn')}
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={22} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--text-muted)' }} />
          </div>
        ) : balance.rows.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('payments.no_groups')}</p>
        ) : visibleRows.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('payments.no_search_results')}</p>
        ) : (
          <>
          <div className="hide-mobile" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <SortableTh label={t('payments.col_student')} sortKey="name" sort={sort} onSort={toggleSort} align="left" />
                  <SortableTh label={t('payments.col_period')} sortKey="period" sort={sort} onSort={toggleSort} align="left" />
                  <th style={{ textAlign: 'right', padding: '8px 10px' }}>{t('payments.col_paid_month')}</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>{t('payments.col_progress')}</th>
                  <SortableTh label={t('payments.col_balance')} sortKey="balance" sort={sort} onSort={toggleSort} align="right" />
                  <th style={{ padding: '8px 10px' }}></th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map(row => {
                  const inDebt = row.balance > 0
                  const color = inDebt ? '#DC2626' : '#16A34A'
                  return (
                    <tr key={row.student_id} style={{ borderTop: '1px solid var(--border)', fontSize: 13, background: inDebt ? 'rgba(220,38,38,0.035)' : 'transparent' }}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{row.student_name}</td>
                      <td style={{ padding: '10px' }}>
                        <PeriodCell row={row} t={t} />
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{som(row.paid_this_month)} so'm</td>
                      <td style={{ padding: '10px', minWidth: 150 }}>
                        <ProgressCell paid={row.paid} expected={row.expected} />
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color, whiteSpace: 'nowrap' }}>
                        {inDebt ? `${som(row.balance)} so'm` : t('payments.no_debt_short')}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => setDiscountFor({ ...row, group_id: Number(groupId), group_name: groupName })}
                            title={t('payments.discount_btn')} style={{ ...ghostBtn, padding: '6px 8px' }}>
                            <Percent size={13} />
                          </button>
                          <button onClick={() => setRecordFor({ ...row, group_id: Number(groupId), group_name: groupName })}
                            style={{ ...ghostBtn, padding: '6px 10px', whiteSpace: 'nowrap' }}>
                            <CreditCard size={13} /> {t('payments.record_payment_btn')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mobile-only" style={{ display: 'none', flexDirection: 'column', gap: 10 }}>
            {pagedRows.map(row => (
              <MobileStudentCard
                key={row.student_id} row={row} t={t}
                onDiscount={() => setDiscountFor({ ...row, group_id: Number(groupId), group_name: groupName })}
                onRecord={() => setRecordFor({ ...row, group_id: Number(groupId), group_name: groupName })}
              />
            ))}
          </div>

          <Pager page={studentsPageClamped} pages={studentsPages} onPageChange={setStudentsPage} />
          </>
        )}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Receipt size={16} color="var(--text-muted)" />
          <p style={{ fontWeight: 700, fontSize: 14 }}>{t('payments.history_title')}</p>
        </div>
        <PaymentHistoryList
          payments={history} loading={historyLoading} showGroup={false}
          page={historyPage} pages={historyPages} onPageChange={setHistoryPage} t={t}
          onOpenReceipt={setReceiptFor}
          onVoided={() => { loadBalance(); loadHistory() }}
        />
      </div>

      <RecordPaymentModal row={recordFor} onClose={() => setRecordFor(null)} onRecorded={afterRecorded} t={t} />
      <ReceiptPreviewModal payment={receiptFor} onClose={() => setReceiptFor(null)} />
      <DiscountModal row={discountFor} onClose={() => setDiscountFor(null)} onSaved={() => { setDiscountFor(null); loadBalance() }} t={t} />
    </div>
  )
}

function GroupTuitionCard({ group, templates, t, onChanged }) {
  const { show } = useToast()
  const [editing, setEditing] = useState(false)
  const [choice, setChoice] = useState(group.tuition?.template ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setChoice(group.tuition?.template ?? '') }, [group.tuition])

  const save = async () => {
    if (!choice) return
    setSaving(true)
    try {
      await setGroupTuition(group.id, choice)
      show(t('payments.toast_assign_saved'), 'success')
      setEditing(false)
      onChanged()
    } catch { show(t('payments.toast_assign_fail'), 'error') } finally { setSaving(false) }
  }

  const missing = !group.tuition

  if (editing || missing) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        background: missing ? 'rgba(220,38,38,0.06)' : 'var(--surface)',
        border: `1px solid ${missing ? 'rgba(220,38,38,0.25)' : 'var(--border)'}`,
        borderRadius: 12, padding: '12px 16px', marginBottom: 20,
      }}>
        {missing && <span style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>{t('payments.group_no_template')}</span>}
        <select value={choice} onChange={e => setChoice(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: '1 1 240px' }}>
          <option value="">{t('payments.group_no_template')}</option>
          {templates.map(tpl => <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.category_name}) — {som(tpl.default_price)} so'm</option>)}
        </select>
        <button onClick={save} disabled={saving || !choice} style={{ ...ghostBtn, opacity: (saving || !choice) ? 0.6 : 1 }}>
          {saving ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : t('payments.assign_btn')}
        </button>
        {!missing && <button onClick={() => setEditing(false)} style={ghostBtn}>{t('payments.record_cancel')}</button>}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)' }}>{t('payments.template_price_placeholder')}:</span>
      <span style={{ fontWeight: 700 }}>{group.tuition.template_name} — {som(group.tuition.default_price)} so'm</span>
      <button onClick={() => setEditing(true)} style={{ ...ghostBtn, marginLeft: 'auto', padding: '5px 10px' }}>{t('payments.assign_btn')}</button>
    </div>
  )
}

function SortableTh({ label, sortKey, sort, onSort, align }) {
  const active = sort.key === sortKey
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th style={{ textAlign: align, padding: '8px 10px' }}>
      <button onClick={() => onSort(sortKey)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, flexDirection: align === 'right' ? 'row-reverse' : 'row',
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        font: 'inherit', color: active ? 'var(--accent)' : 'inherit',
      }}>
        {label} <Icon size={11} />
      </button>
    </th>
  )
}

function shortDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`
}

// Shows when the student joined and either their next payment due date
// (color-coded: red if already overdue, amber if due within 5 days) or,
// once they've left/the group graduated, the date billing stopped.
function PeriodCell({ row, t }) {
  const joinedLine = <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('payments.joined_label')}: {shortDate(row.joined_at)}</p>

  if (row.ended_at) {
    return (
      <div>
        {joinedLine}
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{t('payments.ended_label')}: {shortDate(row.ended_at)}</p>
      </div>
    )
  }

  const daysLeft = row.next_due_date ? Math.ceil((new Date(row.next_due_date) - new Date()) / 86400000) : null
  const dueSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 5
  const dueColor = row.balance > 0 ? '#DC2626' : dueSoon ? '#B45309' : 'var(--text)'

  return (
    <div>
      {joinedLine}
      <p style={{ fontSize: 12, fontWeight: 600, color: dueColor }}>{t('payments.next_due_label')}: {shortDate(row.next_due_date)}</p>
    </div>
  )
}

// Paid-vs-expected as a small bar instead of two separate raw-number
// columns — quicker to scan at a glance than reading two figures.
function ProgressCell({ paid, expected }) {
  const pct = expected > 0 ? Math.min(100, Math.round((paid / expected) * 100)) : (paid > 0 ? 100 : 0)
  const color = paid >= expected ? '#16A34A' : '#DC2626'
  return (
    <div>
      <div style={{ height: 6, borderRadius: 99, background: 'var(--bg)', overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.3s' }} />
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{som(paid)} / {som(expected)} so'm</p>
    </div>
  )
}

// Card layout for narrow screens — the 6-column table doesn't fit a phone
// width even with horizontal scroll in a readable way, so this stacks the
// same fields vertically instead (shown/hidden via the .mobile-only /
// .hide-mobile classes in index.css, same convention as the rest of the app).
function MobileStudentCard({ row, t, onDiscount, onRecord }) {
  const inDebt = row.balance > 0
  const color = inDebt ? '#DC2626' : '#16A34A'
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: inDebt ? 'rgba(220,38,38,0.035)' : 'var(--surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <p style={{ fontWeight: 700, fontSize: 14 }}>{row.student_name}</p>
        <span style={{ fontWeight: 700, fontSize: 14, color, whiteSpace: 'nowrap' }}>
          {inDebt ? `${som(row.balance)} so'm` : t('payments.no_debt_short')}
        </span>
      </div>
      <PeriodCell row={row} t={t} />
      <div style={{ margin: '10px 0' }}>
        <ProgressCell paid={row.paid} expected={row.expected} />
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        {t('payments.col_paid_month')}: {som(row.paid_this_month)} so'm
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onDiscount} style={{ ...ghostBtn, padding: '8px 10px' }}>
          <Percent size={13} />
        </button>
        <button onClick={onRecord} style={{ ...ghostBtn, padding: '8px 12px', flex: 1, justifyContent: 'center' }}>
          <CreditCard size={13} /> {t('payments.record_payment_btn')}
        </button>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ width: 38, height: 38, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{value}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</p>
      </div>
    </div>
  )
}
