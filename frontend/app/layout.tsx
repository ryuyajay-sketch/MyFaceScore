import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'First Impression — AI-Powered Facial Analysis',
  description: 'Discover your first impression score using advanced AI. Upload your photo and get instant AI-powered analysis of trustworthiness, attractiveness, and confidence.',
  keywords: ['AI', 'facial analysis', 'first impression', 'face detection', 'scoring'],
  authors: [{ name: 'First Impression App' }],
  openGraph: {
    title: 'First Impression — AI-Powered Facial Analysis',
    description: 'Discover your first impression score using advanced AI.',
    type: 'website',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'First Impression App',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'First Impression — AI-Powered Facial Analysis',
    description: 'Discover your first impression score using advanced AI.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
