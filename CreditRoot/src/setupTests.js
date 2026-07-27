// Inicializa i18n para el entorno de test.
// Sin esto, useTranslation no encuentra una instancia y t() devuelve
// las claves crudas (ej. "goalCard.porMes") en vez del texto traducido,
// lo que rompe los tests que buscan por texto o aria-label.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './i18n/es.json'
import en from './i18n/en.json'

i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: 'es',
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
})

export default i18n