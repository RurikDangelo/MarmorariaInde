import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { BrandTheme } from '@/components/theme/brand-theme'
import { Toaster } from '@/components/ui/sonner'
import { getCompanySettings } from '@/lib/auth/session'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Marmoraria Independência',
    template: '%s · Marmoraria Independência',
  },
  description: 'Sistema de gestão da Marmoraria Independência: ordens de serviço, medição, produção, estoque e financeiro.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Marmoraria', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
}

/**
 * Todo o ERP e por usuario e depende de cookie de sessao + RLS.
 * Nada aqui pode ser pre-renderizado em build.
 */
export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#232322' },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getCompanySettings().catch(() => null)

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <BrandTheme settings={settings} />
      </head>
      <body className="min-h-full">
        <ThemeProvider defaultTheme={settings?.default_theme ?? 'system'}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
