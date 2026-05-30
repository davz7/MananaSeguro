import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function AppHeader() {
  const { i18n } = useTranslation();
  const [lang, setLang] = useState(i18n.language);

  const toggleLang = () => {
    const next = lang === 'es' ? 'en' : 'es';
    i18n.changeLanguage(next);
    localStorage.setItem('ms-lang', next);
    setLang(next);
  };

  return (
    <header>
      <button onClick={toggleLang}>
        {lang === 'es' ? 'EN' : 'ES'}
      </button>
    </header>
  );
}
