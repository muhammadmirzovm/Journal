// Thin wrapper around the Telegram WebApp SDK (loaded via <script> in index.html).
// Returns null outside Telegram's in-app browser, so callers can no-op safely.
export function getTelegramWebApp() {
  const wa = window.Telegram?.WebApp
  if (!wa?.initData) return null
  wa.ready()
  wa.expand()
  return wa
}
