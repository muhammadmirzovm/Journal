import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { Users, BookOpen, LayoutDashboard, Star, CalendarDays } from 'lucide-react'

const COLORS = ['#0D9488','#0891B2','#7C3AED','#DB2777','#D97706','#059669','#DC2626','#6366F1']
const DAYS = ['Mo','Tu','We','Th','Fr','Sa','Su']

export default function TeacherStats({ stats }) {
  const { t } = useTranslation()
  if (!stats) return null

  // Today's weekday in class_days convention (0=Mon … 6=Sun)
  const todayIdx = (new Date().getDay() + 6) % 7

  const statCards = [
    { label: t('teacher_stats.total_students'), value: stats.total_students, icon: Users,          color: '#0D9488' },
    { label: t('teacher_stats.groups'),         value: stats.total_groups,   icon: LayoutDashboard, color: '#0891B2' },
    { label: t('teacher_stats.lessons'),        value: stats.total_lessons,  icon: BookOpen,        color: '#7C3AED' },
    { label: t('teacher_stats.avg_score'),      value: stats.avg_score ? `${stats.avg_score}/5` : '—', icon: Star, color: '#D97706' },
  ]

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={20} color={s.color} />
            </div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      {stats.scores_by_group?.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>

          {/* Avg score per group */}
          <div style={card}>
            <p style={cardTitle}>{t('teacher_stats.score_by_group')}</p>
            <p style={cardSub}>{t('teacher_stats.score_by_group_sub')}</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.scores_by_group} margin={{ top: 8, right: 8, left: -20, bottom: 40 }}>
                <XAxis dataKey="group" tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  angle={-35} textAnchor="end" interval={0} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`${v} / 5`, t('teacher_stats.avg_score_tooltip')]}
                />
                <Bar dataKey="avg_score" radius={[6, 6, 0, 0]}>
                  {stats.scores_by_group.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Students per group */}
          <div style={card}>
            <p style={cardTitle}>{t('teacher_stats.students_by_group')}</p>
            <p style={cardSub}>{t('teacher_stats.students_by_group_sub')}</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.students_by_group} margin={{ top: 8, right: 8, left: -20, bottom: 40 }}>
                <XAxis dataKey="group" tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  angle={-35} textAnchor="end" interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [v, t('teacher_stats.students_tooltip')]}
                />
                <Bar dataKey="students" radius={[6, 6, 0, 0]}>
                  {stats.students_by_group.map((_, i) => (
                    <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}

      {/* Weekly timetable */}
      {stats.schedule?.length > 0 && (
        <div style={{ ...card, marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <CalendarDays size={16} color="var(--accent)" />
            <p style={{ ...cardTitle, marginBottom: 0 }}>{t('teacher_stats.timetable')}</p>
          </div>
          <p style={cardSub}>{t('teacher_stats.timetable_sub')}</p>
          <div className="scroll-fade" style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560, fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr>
                  <th style={{ ...thCell, textAlign: 'left', paddingLeft: 4, position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }}>
                    {t('teacher_stats.groups')}
                  </th>
                  {DAYS.map((d, i) => {
                    const isToday = i === todayIdx
                    return (
                      <th key={d} style={{ ...thCell,
                        color: isToday ? 'var(--accent)' : i >= 5 ? 'color-mix(in srgb, var(--text-muted) 60%, transparent)' : 'var(--text-muted)',
                        background: isToday ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : undefined,
                        borderTopLeftRadius: isToday ? 8 : 0, borderTopRightRadius: isToday ? 8 : 0 }}>
                        {isToday && <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', marginBottom: 2 }}>{t('teacher_stats.today')}</div>}
                        {d}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {stats.schedule.map((g, gi) => {
                  const color = COLORS[gi % COLORS.length]
                  const time  = g.class_time ? g.class_time.replace('-', '–') : null
                  return (
                    <tr key={gi}>
                      <td style={{ ...nameCell, position: 'sticky', left: 0, background: 'var(--surface)' }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.group}</span>
                        {g.is_individual && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>·</span>}
                      </td>
                      {DAYS.map((_, di) => (
                        <td key={di} style={{ ...cellStyle, background: di === todayIdx ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : undefined }}>
                          {g.class_days.includes(di) ? (
                            time ? (
                              <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color, background: `color-mix(in srgb, ${color} 14%, transparent)`, padding: '4px 8px', borderRadius: 7, whiteSpace: 'nowrap' }}>{time}</span>
                            ) : (
                              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: color }} />
                            )
                          ) : (
                            <span style={{ color: 'color-mix(in srgb, var(--text-muted) 45%, transparent)' }}>·</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state — teacher has no groups yet */}
      {stats.total_groups === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>
          {t('teacher_stats.no_groups')}
        </div>
      )}
    </div>
  )
}

const thCell    = { fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '10px 6px', borderBottom: '1px solid var(--border)', textAlign: 'center' }
const nameCell  = { display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px 11px 4px', fontWeight: 600, fontSize: 13.5, borderBottom: '1px solid var(--border)', maxWidth: 180 }
const cellStyle = { textAlign: 'center', padding: '9px 6px', borderBottom: '1px solid var(--border)' }

const card      = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: 'var(--shadow-sm)' }
const cardTitle = { fontWeight: 700, fontSize: 14, marginBottom: 2 }
const cardSub   = { fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }
