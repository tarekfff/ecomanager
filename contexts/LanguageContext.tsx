'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n, { Lang, isLang, isRtl } from '@/lib/i18n'

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  dir: 'rtl' | 'ltr'
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'fr',
  setLang: () => {},
  dir: 'ltr',
})

function applyDocument(lang: Lang) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  html.lang = lang
  html.dir = isRtl(lang) ? 'rtl' : 'ltr'
  html.classList.toggle('lang-ar', lang === 'ar')
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr')

  // Restore the saved language after mount (keeps SSR/first render = fr).
  useEffect(() => {
    const saved = localStorage.getItem('lang')
    if (isLang(saved) && saved !== 'fr') {
      setLangState(saved)
      i18n.changeLanguage(saved)
      applyDocument(saved)
    } else {
      applyDocument('fr')
    }
  }, [])

  function setLang(next: Lang) {
    setLangState(next)
    i18n.changeLanguage(next)
    localStorage.setItem('lang', next)
    applyDocument(next)
  }

  return (
    <I18nextProvider i18n={i18n}>
      <LanguageContext.Provider value={{ lang, setLang, dir: isRtl(lang) ? 'rtl' : 'ltr' }}>
        {children}
      </LanguageContext.Provider>
    </I18nextProvider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
