import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { en, id, type TranslationKey } from '../i18n/translations'

export type ViewPref    = 'day' | 'week' | 'month'
export type TypePref    = 'internal' | 'external'
export type LangPref    = 'en' | 'id'
export type StartDayPref = 'mon' | 'sun'

interface Settings {
  defaultView: ViewPref
  defaultType: TypePref
  language: LangPref
  darkMode: boolean
  startDay: StartDayPref
  setDefaultView: (v: ViewPref) => void
  setDefaultType: (v: TypePref) => void
  setLanguage: (v: LangPref) => void
  setDarkMode: (v: boolean) => void
  setStartDay: (v: StartDayPref) => void
  t: (key: TranslationKey) => string
}

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v !== null ? (JSON.parse(v) as T) : fallback
  } catch { return fallback }
}

function persist(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

const SettingsContext = createContext<Settings | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [defaultView, setDefaultViewRaw] = useState<ViewPref>(() => load('mbrs_default_view', 'day'))
  const [defaultType, setDefaultTypeRaw] = useState<TypePref>(() => load('mbrs_default_type', 'internal'))
  const [language, setLanguageRaw]       = useState<LangPref>(() => load('mbrs_language', 'en'))
  const [darkMode, setDarkModeRaw]       = useState<boolean>(() => load('mbrs_dark_mode', false))
  const [startDay, setStartDayRaw]       = useState<StartDayPref>(() => load('mbrs_start_day', 'mon'))

  // Sync dark mode class to <html>
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [darkMode])

  const setDefaultView = (v: ViewPref)     => { setDefaultViewRaw(v); persist('mbrs_default_view', v) }
  const setDefaultType = (v: TypePref)     => { setDefaultTypeRaw(v); persist('mbrs_default_type', v) }
  const setLanguage    = (v: LangPref)     => { setLanguageRaw(v);    persist('mbrs_language', v) }
  const setDarkMode    = (v: boolean)      => { setDarkModeRaw(v);    persist('mbrs_dark_mode', v) }
  const setStartDay    = (v: StartDayPref) => { setStartDayRaw(v);    persist('mbrs_start_day', v) }

  const dict = language === 'id' ? id : en
  const t = useCallback((key: TranslationKey): string => dict[key] ?? key, [dict])

  return (
    <SettingsContext.Provider value={{ defaultView, defaultType, language, darkMode, startDay, setDefaultView, setDefaultType, setLanguage, setDarkMode, setStartDay, t }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be within SettingsProvider')
  return ctx
}
