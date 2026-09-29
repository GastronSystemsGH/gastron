'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Package, ChevronUp, ChevronDown, Truck, MapPin, Building, User, Plus } from 'lucide-react';
import Link from 'next/link';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    const supabase = createClient();

    // 1. Povuci organizacije nezavisno
    const { data: orgs } = await supabase.from('organizations').select('*');
    const orgsMap = new Map();
    if (orgs) {
      orgs.forEach(o => orgsMap.set(o.id, o));
    }

    // 2. Povuci profile nezavisno
    const { data: profiles } = await supabase.from('profiles').select('*');
    const profilesMap = new Map();
    if (profiles) {
      profiles.forEach(p => profilesMap.set(p.id, p));
    }

    // 3. Povuci porudžbine čisto bez zavisnih join-ova
    const { data: orderData, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Greška pri učitavanju porudžbina:', error.message);
    }

    if (orderData) {
      const enrichedOrders = orderData.map(order => ({
        ...order,
        organizations: order.restaurant_id ? orgsMap.get(order.restaurant_id) || null : null,
        profiles: order.user_id ? profilesMap.get(order.user_id) || null : null
      }));
      setOrders(enrichedOrders);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  function toggleOrderExpand(orderId: string) {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  }

  async function handleUpdateStatus(orderId: string, newStatus: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) alert('Greška pri promeni statusa: ' + error.message);
    else fetchOrders();
  }

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Učitavanje svih porudžbina...</div>;

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-600" /> Upravljanje prijemom robe i porudžbinama (God Mode)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Uvid i kontrola statusa isporuka, lokacija, vozača i finansija za sve restorane.</p>
        </div>
        <Link
          href="/admin/orders/new"
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition-colors"
        >
          <Plus className="h-4 w-4" /> Kreiraj novu porudžbinu
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">Nema unetih porudžbina u sistemu.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map(order => {
              const isExpanded = !!expandedOrders[order.id];
              const resto = order.organizations;

              return (
                <div key={order.id} className="hover:bg-slate-50/50">
                  <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                    <div className="space-y-1 cursor-pointer flex-1" onClick={() => toggleOrderExpand(order.id)}>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-400 text-[11px]">ID: {order.id.slice(0, 8)}...</span>
                        <span className="font-bold text-slate-900 text-sm flex items-center gap-1">
                          <Building className="h-3.5 w-3.5 text-emerald-600" /> {resto?.name || 'Nepoznat restoran'}
                        </span>
                        <span className="text-slate-500 font-mono">(PIB: {resto?.company_pib || 'N/A'})</span>
                      </div>
                      <p className="text-slate-600 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" /> Lokacija isporuke: <strong className="text-slate-800">{resto?.address || ''}, {resto?.city || 'Lokacija nije uneta'}</strong>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Datum: {order.created_at ? new Date(order.created_at).toLocaleString('sr-RS') : 'N/A'} | Kreirao: {order.profiles?.full_name || order.profiles?.email || 'Sistem'}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-semibold text-slate-400">Ukupan iznos</p>
                        <p className="font-mono font-bold text-slate-900 text-sm">{order.total_amount || 0} RSD</p>
                      </div>

                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <select
                          value={order.status || 'PENDING'}
                          onChange={e => handleUpdateStatus(order.id, e.target.value)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold bg-white text-emerald-800 shadow-sm focus:outline-none focus:border-emerald-600"
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="Kreirano">Kreirano</option>
                          <option value="U obradi">U obradi</option>
                          <option value="U transportu">U transportu</option>
                          <option value="DELIVERED">DELIVERED</option>
                          <option value="Isporučeno">Isporučeno</option>
                          <option value="Otkazano">Otkazano</option>
                        </select>

                        <button onClick={() => toggleOrderExpand(order.id)} className="p-1 rounded hover:bg-slate-200">
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-6 pb-5 pt-2 bg-slate-50 border-t border-slate-100 space-y-3 text-xs">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-3 rounded-lg border border-slate-200">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400">Logistika i prevoz</p>
                          <p className="text-slate-700 mt-1 flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5 text-emerald-600" /> Ko nosi: <strong className="text-slate-900">{order.distributor_name || 'Glavni distributer'}</strong>
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400">Prijem robe</p>
                          <p className="text-slate-700 mt-1 flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-emerald-600" /> Ko je primio: <strong className="text-slate-900">{order.received_by || 'Čeka potvrdu'}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Naručeni artikli i iznosi:</p>
                        {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
                          <div className="space-y-1">
                            {order.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-slate-700 bg-white px-3 py-2 rounded border border-slate-200">
                                <span>• {item.name || item.product_name || 'Artikal'} <span className="text-slate-400 text-[10px]">({item.brand || 'Standard'})</span></span>
                                <div className="flex items-center gap-4 font-mono">
                                  <span>{item.qty || item.quantity || 1} {item.unit || 'kom'}</span>
                                  <strong className="text-slate-900">{(item.price || 0) * (item.qty || item.quantity || 1)} RSD</strong>
                                  {item.price ? <span className="text-slate-400 text-[10px]">({item.price} RSD/kom)</span> : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 italic text-[11px]">Nema detaljnih stavki za ovu porudžbinu.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}