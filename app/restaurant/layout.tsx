'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Cookies from 'js-cookie';

export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      // Hibridna provera: localStorage ili kolačić
      const impersonatedId = localStorage.getItem('impersonated_user_id') || Cookies.get('impersonated_user_id');
      
      if (impersonatedId) {
        setCheckingAccess(false);
        return;
      }

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