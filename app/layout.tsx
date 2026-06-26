import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Runway',
  description: '',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
