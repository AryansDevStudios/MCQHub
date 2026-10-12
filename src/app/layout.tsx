import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Providers } from '@/components/Providers';

const fontSans = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'MCQHub — AI Practice Quiz Engine',
  description:
    'Create AI-powered multiple-choice quizzes on any topic. Minimal, focused, distraction-free.',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('mcqhub_theme');if(t==='dark'){document.documentElement.classList.add('dark')}else if(t==='light'){document.documentElement.classList.remove('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={cn(
          'min-h-screen bg-background font-sans text-foreground antialiased',
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
