import type { Metadata, Viewport } from 'next'
import '@misterbeardy/design-system/styles.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'The Wes Cup — World Cup 2026 Drinking Game',
  description: 'Live World Cup 2026 drinking game. Every time a team wins, drink their national shot.',
  appleWebApp: {
    capable: true,
    title: 'Wes Cup',
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    title: 'The Wes Cup 🍺⚽',
    description: 'Every time a team wins, drink their national shot. 48 teams. 48 drinks.',
    url: 'https://wescupworldcupdrinks.com',
  },
}

export const viewport: Viewport = {
  // The design system's --bg in each theme.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f5f3' },
    { media: '(prefers-color-scheme: dark)', color: '#211f1c' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

const THEME_SCRIPT = `(function(){var m=window.matchMedia('(prefers-color-scheme: dark)');function a(){document.documentElement.setAttribute('data-theme',m.matches?'dark':'light')}a();m.addEventListener('change',a)})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Dark-mode bridge: the design system's tokens flip under
            data-theme="dark" on <html>. Follow the system setting, set before
            first paint so the page never flashes the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
