'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function DistributorLayout({ children }: { children: React.ReactNode }) {
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/login';
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile) {
        const role = (profile.role || '').toLowerCase();

        if (role === 'admin' || role === 'superadmin') {
          window.location.href = '/admin';
          return;
        } else if (role === 'dis_driver' || role === 'driver' || role.includes('driver')) {
          window.location.href = '/driver';
          return;
        } else if (!role.startsWith('dis_') && !role.includes('distributor')) {
          // Ako korisnik NIJE distributer, šaljemo ga na restoran
          window.location.href = '/restaurant';
          return;
        }
      }

      setCheckingAccess(false);
    };

    checkAccess();
  }, []);

  if (checkingAccess) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-xs text-slate-500">
        Provera pristupa...
      </div>
    );
  }

  return <>{children}</>;
}