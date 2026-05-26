import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import es from './es.json'
import en from './en.json'

// Get stored language preference or detect browser language
const getInitialLanguage = () => {
  const storedLang = localStorage.getItem('manana-seguro-language')
  if (storedLang && (storedLang === 'es' || storedLang === 'en')) {
    return storedLang
  }
  
  // Detect browser language
  const browserLang = navigator.language || navigator.userLanguage
  if (browserLang.startsWith('en')) {
    return 'en'
  }
  
  // Default to Spanish
  return 'es'
}

const initialLanguage = getInitialLanguage()

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: initialLanguage,
    fallbackLng: 'es',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ms-lang',
      caches: ['localStorage'],
      convertDetectedLanguage: (lang) => {
        if (lang && lang.startsWith('en')) return 'en'
        return 'es'
      },
    },
  })

// Save language preference to localStorage whenever it changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('manana-seguro-language', lng)
})

export default i18n
