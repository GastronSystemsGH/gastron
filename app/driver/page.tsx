'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Truck, Package, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function DriverDashboard() {
  const [driverName, setDriverName] = useState('');
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [completedTodayCount, setCompletedTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();

      if (profile) {
        setDriverName(profile.full_name || profile.email);
      }

      // Proširen filter statusa da obuhvati sve faze u kojima vozač treba da vidi porudžbinu
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('driver_id', user.id)
        .in('status', ['packed', 'dispatched', 'in_transit', 'assigned', 'accepted', 'pending']);

      if (activeOrders) setActiveOrdersCount(activeOrders.length);

      // Povlačenje završenih
      const { data: doneOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('driver_id', user.id)
        .eq('status', 'delivered');

      if (doneOrders) setCompletedTodayCount(doneOrders.length);

      setLoading(false);
    }

    loadDashboard();
  }, []);

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Učitavanje kontrolne table...</div>;

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 max-w-7xl mx-auto w-full">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Truck className="h-6 w-6 text-emerald-600" /> Dobrodošli, {driverName}
        </h1>
        <p className="text-xs text-slate-500 mt-1">Pregled vaših zadataka i aktivnih dostava.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="border border-slate-200 bg-white rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Aktivne dostave</span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><Truck className="h-5 w-5" /></div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{activeOrdersCount}</div>
          <p className="text-[11px] text-slate-400">Porudžbine koje čekaju isporuku</p>
        </div>

        <div className="border border-slate-200 bg-white rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Isporučeno</span>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><CheckCircle2 className="h-5 w-5" /></div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{completedTodayCount}</div>
          <p className="text-[11px] text-slate-400">Uspešno završene vožnje</p>
        </div>
      </div>

      <div className="pt-4">
        <Link
          href="/driver/orders"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition-colors"
        >
          Pogledaj porudžbine za dostavu <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}