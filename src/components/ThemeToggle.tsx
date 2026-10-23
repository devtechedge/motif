import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const THEME_KEY = 'motif:theme:v1'

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

/**
 * Top-right theme control. The initial value is set by a blocking boot script
 * in index.html, so there is no flash of the wrong theme.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // private mode: theme applies for this session only
    }
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'light' ? '#dfe3ea' : '#08090d')
  }, [theme])

  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={() => setTheme(next)}
      aria-label={next === 'light' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={next === 'light' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="theme-icons" aria-hidden="true">
        <svg className="i-sun" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19" />
        </svg>
        <svg className="i-moon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M20.2 14.5A8.3 8.3 0 0 1 9.5 3.8a8.3 8.3 0 1 0 10.7 10.7z" />
        </svg>
      </span>
    </button>
  )
}
