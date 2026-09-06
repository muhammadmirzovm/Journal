// Build-time-only entry point: renders the public Landing page to a static
// HTML string so search engines that don't execute JavaScript (Yandex, Bing,
// link-preview bots) see real content instead of an empty <div id="root">.
// Not shipped to the browser — only imported by scripts/prerender.mjs.
// Real visitors still get the normal client app (src/main.jsx), which fully
// replaces this markup once it mounts.
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Landing from './pages/Landing'
import './i18n.server.js'

export function renderLanding() {
  return renderToString(
    <StaticRouter location="/">
      <AuthProvider>
        <Landing />
      </AuthProvider>
    </StaticRouter>
  )
}
