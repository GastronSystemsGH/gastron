import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function RootPage() {
  const supabase = await createClient();
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', session.user.id)
    .single();

  if (!profile || profile.role === 'orphan') {
    redirect('/pending');
  }

  const role = (profile.role || '').toLowerCase();

  // KLJUČNA PROVERA: Bilo koja admin uloga mora na /admin
  if (role === 'superadmin' || role === 'admin' || role === 'res_admin' || role.includes('admin')) {
    redirect('/admin');
  }
  
  if (['dis_admin', 'dis_office', 'dis_driver'].includes(role)) {
    redirect('/distributor');
  }

  if (['res_owner', 'res_chef', 'res_cook'].includes(role) || role.includes('owner')) {
    redirect('/restaurant');
  }

  redirect('/pending');
}