import { useEffect } from 'react'

/**
 * Enter → primary action, Escape → cancel/close action, while a modal is open.
 * Skips Enter inside a <textarea> (newline) and while a <button> is focused
 * (the browser already fires a click on Enter for a focused button — calling
 * onEnter too would double-submit).
 */
export function useModalHotkeys(isOpen: boolean, onEnter?: () => void, onEscape?: () => void) {
  useEffect(() => {
    if (!isOpen) return
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.key === 'Enter' && onEnter) {
        if (tag === 'TEXTAREA' || tag === 'BUTTON') return
        e.preventDefault()
        onEnter()
      } else if (e.key === 'Escape' && onEscape) {
        e.preventDefault()
        onEscape()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onEnter, onEscape])
}
