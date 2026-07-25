import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { AdminShell } from '@/components/admin/AdminShell';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | Pikavolt Admin' },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already gates /admin to owners; these reads personalize the shell.
  let ownerName = 'Owner';
  let unreadChats = 0;

  if (user) {
    const [{ data: profile }, { data: convs }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
      supabase.from('conversations').select('owner_unread').gt('owner_unread', 0),
    ]);
    ownerName = profile?.full_name ?? 'Owner';
    unreadChats = (convs ?? []).length;
  }

  return (
    <AdminShell ownerName={ownerName} unreadChats={unreadChats}>
      {children}
    </AdminShell>
  );
}
