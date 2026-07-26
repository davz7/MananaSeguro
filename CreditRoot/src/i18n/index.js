import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './es.json'
import en from './en.json'

// Get stored language preference, defaulting to Spanish (the product's
// primary language) when the user hasn't explicitly chosen otherwise.
const getInitialLanguage = () => {
  const storedLang = localStorage.getItem('manana-seguro-language')
  if (storedLang && (storedLang === 'es' || storedLang === 'en')) {
    return storedLang
  }

  return 'es'
}

const initialLanguage = getInitialLanguage()

i18n
  .use(initReactI18next)
  .init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: initialLanguage,
    fallbackLng: 'es',
    interpolation: { escapeValue: false },
  })

// Save language preference to localStorage whenever it changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('manana-seguro-language', lng)
})

export default i18n
