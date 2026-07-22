import type { Metadata } from 'next';
import SidebarLayout from './components/SidebarLayout';
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
        <SidebarLayout>{children}</SidebarLayout>
      </body>
    </html>
  );
}
