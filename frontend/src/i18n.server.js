// Node-safe i18next instance used only by the prerender build step
// (src/entry-server.jsx). Unlike src/i18n.js, this skips
// i18next-browser-languagedetector — it reads `navigator`/`localStorage`,
// neither of which exist under Node — and fixes the language to 'uz'
// (Journaly's primary audience) since a build-time snapshot can't detect
// a real visitor's browser.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en/translation.json'
import uz from './locales/uz/translation.json'
import ru from './locales/ru/translation.json'

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, uz: { translation: uz }, ru: { translation: ru } },
    lng: 'uz',
    fallbackLng: 'uz',
    interpolation: { escapeValue: false },
  })

export default i18n
