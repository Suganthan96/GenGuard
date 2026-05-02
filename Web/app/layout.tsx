import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono, IBM_Plex_Sans } from 'next/font/google'
import { Courier_Prime } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from './providers'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const _courierPrime = Courier_Prime({ weight: ["400", "700"], subsets: ["latin"] });
const _ibmPlexSans = IBM_Plex_Sans({ weight: ["300", "400", "500", "600"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'GenGuard — GuardMesh | AXL + 0G Agent Firewall',
  description:
    'Decentralised agent safety: intent broadcast over Gensyn AXL, guardian consensus, immutable audit on 0G Galileo.',
  keywords: ['AI agents', 'autonomous agents', 'LLM orchestration', 'AI automation', 'multi-agent platform'],
  authors: [{ name: 'Genguard' }],
  openGraph: {
    title: 'GenGuard — GuardMesh | AXL + 0G',
    description:
      'Decentralised agent safety: AXL intent mesh, guardian consensus, 0G audit trail.',
    type: 'website',
    siteName: 'GenGuard',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GenGuard — GuardMesh | AXL + 0G',
    description:
      'Decentralised agent safety: AXL intent mesh, guardian consensus, 0G audit trail.',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  )
}
