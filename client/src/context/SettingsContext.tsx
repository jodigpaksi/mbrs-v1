import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { en, id, type TranslationKey } from '../i18n/translations'
import { useAuth } from './AuthContext'
import { updatePreferences } from '../api/auth'

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
  defaultBuilding: number | null
  showBarTitle: boolean
  showKeyboardShortcuts: boolean
  setDefaultView: (v: ViewPref) => void
  setDefaultType: (v: TypePref) => void
  setLanguage: (v: LangPref) => void
  setDarkMode: (v: boolean) => void
  setStartDay: (v: StartDayPref) => void
  setDefaultBuilding: (v: number | null) => void
  setShowBarTitle: (v: boolean) => void
  setShowKeyboardShortcuts: (v: boolean) => void
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
  const { user } = useAuth()
  const prefs = user?.preferences

  const [defaultView, setDefaultViewRaw]         = useState<ViewPref>(() => (prefs?.defaultView as ViewPref) ?? load('mbrs_default_view', 'day'))
  const [defaultType, setDefaultTypeRaw]         = useState<TypePref>(() => (prefs?.defaultType as TypePref) ?? load('mbrs_default_type', 'internal'))
  const [language, setLanguageRaw]               = useState<LangPref>(() => (prefs?.language as LangPref) ?? load('mbrs_language', 'en'))
  const [darkMode, setDarkModeRaw]               = useState<boolean>(() => prefs?.darkMode ?? load('mbrs_dark_mode', false))
  const [startDay, setStartDayRaw]               = useState<StartDayPref>(() => (prefs?.startDay as StartDayPref) ?? load('mbrs_start_day', 'mon'))
  const [showBarTitle, setShowBarTitleRaw]       = useState<boolean>(() => prefs?.showBarTitle ?? load('mbrs_show_bar_title', false))
  const [showKeyboardShortcuts, setShowKeyboardShortcutsRaw] = useState<boolean>(() => prefs?.showKeyboardShortcuts ?? load('mbrs_show_keyboard_shortcuts', true))
  const [defaultBuilding, setDefaultBuildingRaw] = useState<number | null>(() => {
    // Priority: server default_building_id > server preferences.defaultBuilding > localStorage
    if (user?.default_building_id != null) return user.default_building_id
    if (prefs?.defaultBuilding != null) return prefs.defaultBuilding as number
    return load('mbrs_default_building', null)
  })

  // Hydrate from server when user loads (e.g. after login)
  useEffect(() => {
    if (!prefs) return
    if (prefs.defaultView)   setDefaultViewRaw(prefs.defaultView as ViewPref)
    if (prefs.defaultType)   setDefaultTypeRaw(prefs.defaultType as TypePref)
    if (prefs.language)      setLanguageRaw(prefs.language as LangPref)
    if (prefs.darkMode   != null) setDarkModeRaw(prefs.darkMode)
    if (prefs.startDay)      setStartDayRaw(prefs.startDay as StartDayPref)
    if (prefs.showBarTitle != null) setShowBarTitleRaw(prefs.showBarTitle)
    if (prefs.showKeyboardShortcuts != null) setShowKeyboardShortcutsRaw(prefs.showKeyboardShortcuts)
    const building = user?.default_building_id ?? (prefs.defaultBuilding as number | null | undefined) ?? null
    if (building != null) setDefaultBuildingRaw(building)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Sync dark mode class to <html>
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [darkMode])

  function syncToServer(patch: Record<string, unknown>) {
    if (!user) return
    updatePreferences(patch).catch(() => {})
  }

  const setDefaultView = (v: ViewPref) => {
    setDefaultViewRaw(v); persist('mbrs_default_view', v)
    syncToServer({ defaultView: v })
  }
  const setDefaultType = (v: TypePref) => {
    setDefaultTypeRaw(v); persist('mbrs_default_type', v)
    syncToServer({ defaultType: v })
  }
  const setLanguage = (v: LangPref) => {
    setLanguageRaw(v); persist('mbrs_language', v)
    syncToServer({ language: v })
  }
  const setDarkMode = (v: boolean) => {
    setDarkModeRaw(v); persist('mbrs_dark_mode', v)
    syncToServer({ darkMode: v })
  }
  const setStartDay = (v: StartDayPref) => {
    setStartDayRaw(v); persist('mbrs_start_day', v)
    syncToServer({ startDay: v })
  }
  const setShowBarTitle = (v: boolean) => {
    setShowBarTitleRaw(v); persist('mbrs_show_bar_title', v)
    syncToServer({ showBarTitle: v })
  }
  const setShowKeyboardShortcuts = (v: boolean) => {
    setShowKeyboardShortcutsRaw(v); persist('mbrs_show_keyboard_shortcuts', v)
    syncToServer({ showKeyboardShortcuts: v })
  }
  const setDefaultBuilding = (v: number | null) => {
    setDefaultBuildingRaw(v); persist('mbrs_default_building', v)
    syncToServer({ defaultBuilding: v })
  }

  const dict = language === 'id' ? id : en
  const t = useCallback((key: TranslationKey): string => dict[key] ?? key, [dict])

  const value = useMemo(() => ({
    defaultView, defaultType, language, darkMode, startDay, defaultBuilding, showBarTitle, showKeyboardShortcuts,
    setDefaultView, setDefaultType, setLanguage, setDarkMode, setStartDay, setDefaultBuilding, setShowBarTitle, setShowKeyboardShortcuts, t,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [defaultView, defaultType, language, darkMode, startDay, defaultBuilding, showBarTitle, showKeyboardShortcuts, t])

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be within SettingsProvider')
  return ctx
}
