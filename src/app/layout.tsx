import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Providers } from '@/components/Providers';

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'MCQHub - Assessment Studio & Examination Engine',
  description:
    'Engineering-grade generative assessment engine with LaTeX math, Firebase Firestore database, and Gemini 2.5 Flash Lite.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-64.png', type: 'image/png', sizes: '64x64' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20',
          fontSans.variable,
          fontMono.variable
        )}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
