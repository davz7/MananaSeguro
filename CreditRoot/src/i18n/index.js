import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './es.json'
import en from './en.json'

// ─── Language detection with localStorage persistence ──────────────────────
// Priority: 1) localStorage('ms-lang') → 2) navigator.language → 3) fallback 'es'
function detectInitialLanguage() {
  const stored = localStorage.getItem('ms-lang')
  if (stored && (stored === 'es' || stored === 'en')) {
    return stored
  }

  const browserLang = (navigator.language || 'es').toLowerCase()
  if (browserLang.startsWith('en')) {
    return 'en'
  }

  return 'es'
}

i18n
  .use(initReactI18next)
  .init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: detectInitialLanguage(),
    fallbackLng: 'es',
    interpolation: { escapeValue: false },
  })

export default i18n
