'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/auth';
import SidebarLayout from '@/app/components/SidebarLayout';

const PUBLIC_PATHS = new Set(['/login']);

export default function AuthShell({ children }: { children: ReactNode }) {
  const { user, loading, configured } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (loading) return;
    // Bez Supabase — nie blokuj (lokalny tryb bez bazy)
    if (!configured) return;

    if (!user && !isPublic) {
      router.replace('/login');
      return;
    }
    if (user && pathname === '/login') {
      router.replace('/');
    }
  }, [user, loading, configured, isPublic, pathname, router]);

  if (configured && loading) {
    return (
      <div className="auth-loading">
        <p>Sprawdzam sesję…</p>
      </div>
    );
  }

  if (configured && !user && !isPublic) {
    return (
      <div className="auth-loading">
        <p>Przekierowanie do logowania…</p>
      </div>
    );
  }

  if (isPublic) {
    return <>{children}</>;
  }

  return <SidebarLayout>{children}</SidebarLayout>;
}
