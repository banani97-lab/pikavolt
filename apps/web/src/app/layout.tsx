import type { Metadata } from 'next';
import { Anton, Inter } from 'next/font/google';
import { ChatWidgetLoader } from '@/components/chat/ChatWidgetLoader';
import './globals.css';

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Pikavolt LLC — Electrical Contractor in Central Ohio',
    template: '%s | Pikavolt LLC',
  },
  description:
    'Powering Ohio with Quality You Can Trust. Residential, commercial, and agricultural electrical services across Central Ohio — with 24/7 emergency service.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${anton.variable} ${inter.variable} bg-storm font-sans text-white antialiased`}>
        {children}
        <ChatWidgetLoader />
      </body>
    </html>
  );
}
