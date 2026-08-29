import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Sun, Moon, Menu, X, GraduationCap, LogOut, User, LayoutDashboard, Users, Globe, BookMarked, Settings, Gift, HelpCircle } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import NotificationBell from './NotificationBell'

const LANGS = [
  { code: 'en', label: 'EN', full: 'English' },
  { code: 'uz', label: 'UZ', full: "O'zbek" },
  { code: 'ru', label: 'RU', full: 'Русский' },
]

export default function Navbar() {
  const { user, logout }    = useAuth()
  const { theme, toggle }   = useTheme()
  const { t, i18n }         = useTranslation()
  const navigate             = useNavigate()
  const location             = useLocation()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [scrolled,   setScrolled]   = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // close drawer/menu on route change
  useEffect(() => { setDrawerOpen(false); setMenuOpen(false) }, [location.pathname])

  const handleLogout = () => { logout(); navigate('/login') }
  const setLang = (code) => { i18n.changeLanguage(code) }

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  const navLinks = user ? [
    { to: '/dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard size={15} /> },
    ...(user.role === 'admin' || user.role === 'teacher'
      ? [{ to: '/groups', label: t('nav.groups'), icon: <Users size={15} /> }]
      : []),
    { to: '/rewards', label: t('nav.rewards'), icon: <Gift size={15} /> },
    ...(user.role === 'admin' || user.role === 'teacher'
      ? [{ to: '/settings', label: t('nav.settings'), icon: <Settings size={15} /> }]
      : []),
  ] : []

  const initials = user
    ? (user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()
    : ''

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: scrolled
          ? 'rgba(var(--nav-bg-rgb, 15,17,27), 0.88)'
          : 'var(--nav-bg)',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.07)',
        boxShadow: scrolled ? '0 4px 20px rgba(0,0,0,0.25)' : 'none',
        transition: 'background 0.25s, border-color 0.25s, backdrop-filter 0.25s, box-shadow 0.25s',
        height: 60,
      }}>
        <div className="nav-inner" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0, marginRight: 8 }}>
            <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(16,185,129,0.35)' }}>
              <GraduationCap size={17} color="#fff" />
            </div>
            <span className="nav-brand-text" style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, letterSpacing: '-0.3px' }}>
              <span style={{ color: '#14B8A8' }}>Journaly</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            {navLinks.map(link => (
              <NavLink key={link.to} to={link.to} active={isActive(link.to)} icon={link.icon} label={link.label} />
            ))}
          </div>

          {/* Desktop right controls */}
          <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {/* Notifications */}
            {user && <NotificationBell />}

            {user ? (
              <div ref={menuRef} style={{ position: 'relative' }}>
                <button onClick={() => setMenuOpen(o => !o)} className="nav-ctrl-btn"
                  style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #059669)', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', cursor: 'pointer', flexShrink: 0, boxShadow: '0 0 0 2px rgba(16,185,129,0.3)' }}
                  title={user.first_name || user.username}>
                  {initials}
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      style={{ position: 'absolute', right: 0, top: 46, width: 240, background: 'var(--nav-bg)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.4)', zIndex: 300 }}>

                      <div style={{ padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.first_name || user.username}</p>
                        <p style={{ fontSize: 11, color: '#64748B', textTransform: 'capitalize' }}>{user.role}</p>
                      </div>

                      <Link to={`/profile/${user.id}`} onClick={() => setMenuOpen(false)} className="nav-menu-item" style={menuItemStyle}>
                        <User size={14} color="#94A3B8" /> {t('nav.profile')}
                      </Link>
                      <a href="/guide.html" target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className="nav-menu-item" style={menuItemStyle}>
                        <HelpCircle size={14} color="#94A3B8" /> {t('nav.help')}
                      </a>
                      <button onClick={toggle} className="nav-menu-item" style={menuItemStyle}>
                        {theme === 'dark' ? <Sun size={14} color="#94A3B8" /> : <Moon size={14} color="#94A3B8" />}
                        {t('nav.theme')}
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748B' }}>
                          {theme === 'dark' ? t('nav.theme_dark') : t('nav.theme_light')}
                        </span>
                      </button>

                      <div style={{ padding: '10px 16px 12px' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Globe size={11} /> {t('nav.language')}
                        </p>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {LANGS.map(l => (
                            <button key={l.code} onClick={() => setLang(l.code)}
                              style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1.5px solid ${i18n.language === l.code ? 'var(--accent)' : 'rgba(255,255,255,0.07)'}`, background: i18n.language === l.code ? 'rgba(16,185,129,0.12)' : 'transparent', color: i18n.language === l.code ? 'var(--accent)' : '#64748B', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              {l.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
                      <button onClick={handleLogout} className="nav-menu-item" style={{ ...menuItemStyle, color: '#F87171' }}>
                        <LogOut size={14} /> {t('nav.logout')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <Link to="/login"
                  style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94A3B8', fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'border-color 0.15s, color 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94A3B8' }}>
                  {t('nav.login')}
                </Link>
                <Link to="/register"
                  style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', boxShadow: '0 2px 10px rgba(16,185,129,0.3)', transition: 'box-shadow 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 18px rgba(16,185,129,0.45)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 10px rgba(16,185,129,0.3)'}>
                  {t('nav.get_started')}
                </Link>
              </>
            )}
          </div>

          {/* Mobile right: theme + hamburger */}
          <div className="mobile-nav" style={{ display: 'none', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <button onClick={toggle} className="nav-ctrl-btn" style={circleBtn}>
              {theme === 'dark' ? <Sun size={15} color="#CBD5E1" /> : <Moon size={15} color="#CBD5E1" />}
            </button>
            <button onClick={() => setDrawerOpen(o => !o)} className="nav-ctrl-btn" style={{ ...circleBtn, borderColor: drawerOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)' }}>
              {drawerOpen ? <X size={17} color="#fff" /> : <Menu size={17} color="#CBD5E1" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile backdrop + drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
              style={{ position: 'fixed', inset: 0, top: 60, background: 'rgba(0,0,0,0.5)', zIndex: 190, backdropFilter: 'blur(3px)' }} />

            {/* Drawer */}
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{ position: 'fixed', top: 60, right: 0, bottom: 0, width: 270, background: 'var(--nav-bg)', borderLeft: '1px solid rgba(255,255,255,0.07)', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 4, zIndex: 195, overflowY: 'auto' }}>

              {/* User info strip */}
              {user && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{user.first_name || user.username}</p>
                    <p style={{ fontSize: 11, color: '#64748B', textTransform: 'capitalize' }}>{user.role}</p>
                  </div>
                </div>
              )}

              {/* Notifications */}
              {user && (
                <div style={{ padding: '8px 4px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <NotificationBell />
                </div>
              )}

              {/* Nav links */}
              {navLinks.map(link => (
                <DrawerLink key={link.to} to={link.to} icon={link.icon} active={isActive(link.to)}>
                  {link.label}
                </DrawerLink>
              ))}

              {user && (
                <DrawerLink to={`/profile/${user.id}`} icon={<User size={16} />} active={isActive(`/profile/${user.id}`)}>
                  {t('nav.profile')}
                </DrawerLink>
              )}

              <a href="/guide.html" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#CBD5E1', fontSize: 14, fontWeight: 500, textDecoration: 'none', padding: '10px 12px', borderRadius: 9 }}>
                <span style={{ color: '#64748B' }}><HelpCircle size={16} /></span>
                {t('nav.help')}
              </a>

              {/* Language section */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 8, paddingTop: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 12px', marginBottom: 6 }}>{t('nav.language')}</p>
                <div style={{ display: 'flex', gap: 6, padding: '0 4px' }}>
                  {LANGS.map(l => (
                    <button key={l.code} onClick={() => setLang(l.code)}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1.5px solid ${i18n.language === l.code ? 'var(--accent)' : 'rgba(255,255,255,0.07)'}`, background: i18n.language === l.code ? 'rgba(16,185,129,0.12)' : 'transparent', color: i18n.language === l.code ? 'var(--accent)' : '#64748B', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auth actions */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 8, paddingTop: 14 }}>
                {user ? (
                  <button onClick={handleLogout}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', color: '#F87171', fontSize: 13, fontWeight: 600, padding: '10px 14px', borderRadius: 9 }}>
                    <LogOut size={15} /> {t('nav.logout')}
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Link to="/login" onClick={() => setDrawerOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94A3B8', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                      {t('nav.login')}
                    </Link>
                    <Link to="/register" onClick={() => setDrawerOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                      {t('nav.get_started')}
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        .nav-ctrl-btn { transition: background 0.15s, border-color 0.15s, transform 0.1s; }
        .nav-ctrl-btn:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.18); }
        .nav-ctrl-btn:active { transform: scale(0.92); }
        .nav-menu-item:hover { background: rgba(255,255,255,0.06); }
        @media (max-width: 900px) {
          .desktop-nav { display: none !important; }
          .mobile-nav  { display: flex !important; }
          .nav-inner   { padding: 0 16px !important; }
        }
        @media (max-width: 400px) {
          .nav-brand-text { display: none !important; }
          .nav-inner      { padding: 0 12px !important; }
        }
      `}</style>
    </>
  )
}

function NavLink({ to, active, icon, label }) {
  const [hover, setHover] = useState(false)
  return (
    <Link to={to}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 13px', borderRadius: 8, fontSize: 13, fontWeight: active ? 700 : 600,
        textDecoration: 'none', transition: 'color 0.15s, background 0.15s',
        color: active ? 'var(--accent)' : (hover ? '#F1F5F9' : '#CBD5E1'),
        background: !active && hover ? 'rgba(255,255,255,0.06)' : 'transparent',
      }}>
      {icon} {label}
      {active && <span style={{ position: 'absolute', left: 13, right: 13, bottom: 2, height: 2, borderRadius: 2, background: 'var(--accent)' }} />}
    </Link>
  )
}

function DrawerLink({ to, icon, active, children }) {
  return (
    <Link to={to}
      style={{ display: 'flex', alignItems: 'center', gap: 10, color: active ? 'var(--accent)' : '#CBD5E1', fontSize: 14, fontWeight: active ? 700 : 500, textDecoration: 'none', padding: '10px 12px', borderRadius: 9, background: active ? 'rgba(16,185,129,0.1)' : 'transparent', transition: 'background 0.15s' }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      <span style={{ color: active ? 'var(--accent)' : '#64748B' }}>{icon}</span>
      {children}
    </Link>
  )
}

const circleBtn = {
  width: 36, height: 36, borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'transparent', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, transition: 'border-color 0.15s, background 0.15s',
}

const menuItemStyle = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box',
  padding: '10px 16px', background: 'transparent', border: 'none',
  color: '#CBD5E1', fontSize: 13, fontWeight: 500, textDecoration: 'none',
  cursor: 'pointer', textAlign: 'left',
}
