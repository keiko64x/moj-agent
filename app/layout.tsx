import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { AuthProvider } from '@/app/lib/auth';
import AuthShell from '@/app/components/AuthShell';
import './globals.css';

export const metadata: Metadata = {
  title: '🏠 Agentosław Reaktowski — Centrum dowodzenia',
  description: 'Agentosław Reaktowski — Twój sztuczny inteligent za jeden uśmiech. Daj mi misje!',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>
        <AuthProvider>
          <AuthShell>{children}</AuthShell>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
