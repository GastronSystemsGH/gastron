'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Truck, MapPin, Clock, CheckCircle2, QrCode, X, Check, ArrowRight } from 'lucide-react';

export default function DriverOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeQrCode, setActiveQrCode] = useState<string | null>(null);
  const [pickedOrders, setPickedOrders] = useState<Record<string, boolean>>({});
  const [startingDelivery, setStartingDelivery] = useState(false);

  const supabase = createClient();

  const fetchAssignedOrders = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: ordersData, error } = await supabase
      .from('orders')
      .select('*')
      .eq('driver_id', user.id)
      .order('created_at', { ascending: false });

    if (error || !ordersData) {
      setLoading(false);
      return;
    }

    const restaurantIds = Array.from(new Set(ordersData.map(o => o.restaurant_id).filter(Boolean)));
    let orgsMap: Record<string, any> = {};

    if (restaurantIds.length > 0) {
      const { data: orgsData } = await supabase
        .from('organizations')
        .select('*')
        .in('id', restaurantIds);

      if (orgsData) {
        orgsData.forEach(org => {
          orgsMap[org.id] = org;
        });
      }
    }

    const enrichedOrders = ordersData.map(order => ({
      ...order,
      restaurant: orgsMap[order.restaurant_id] || {}
    }));

    setOrders(enrichedOrders);

    // Inicijalno označavamo kao preuzeto ako je status već in_transit ili dispatched
    const initialPicked: Record<string, boolean> = {};
    enrichedOrders.forEach(ord => {
      if (['in_transit', 'dispatched'].includes(ord.status)) {
        initialPicked[ord.id] = true;
      }
    });
    setPickedOrders(initialPicked);

    setLoading(false);
  };

  useEffect(() => {
    fetchAssignedOrders();
  }, []);

  const togglePickOrder = (orderId: string) => {
    setPickedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Pokretanje isporuke za sve preuzete porudžbine
  const handleStartDelivery = async () => {
    const activeOrders = orders.filter(o => o.status !== 'delivered');
    if (activeOrders.length === 0) return;

    setStartingDelivery(true);

    for (const ord of activeOrders) {
      if (pickedOrders[ord.id]) {
        await supabase
          .from('orders')
          .update({ status: 'in_transit' })
          .eq('id', ord.id);
      }
    }

    setStartingDelivery(false);
    alert('Uspešno ste krenuli u isporuku! Status porudžbina je prebačen u "U transportu".');
    fetchAssignedOrders();
  };

  const activeOrders = orders.filter(o => o.status !== 'delivered');
  const finishedOrders = orders.filter(o => o.status === 'delivered');

  // Provera da li su sve aktivne porudžbine preuzete u kombi
  const allActivePicked = activeOrders.length > 0 && activeOrders.every(o => pickedOrders[o.id]);
  const isAnyInTransit = activeOrders.some(o => o.status === 'in_transit' || o.status === 'dispatched');

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Učitavanje dodeljenih tura...</div>;

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 max-w-7xl mx-auto w-full">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Truck className="h-6 w-6 text-emerald-600" /> Moje Isporuke
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Potvrdite preuzimanje robe u kombi i pokrenite isporuku.</p>
        </div>

        {/* GLAVNO DUGME "KRENI U ISPORUKU" - Pojavljuje se kad su sve porudžbine preuzete */}
        {activeOrders.length > 0 && !isAnyInTransit && (
          <button
            onClick={handleStartDelivery}
            disabled={!allActivePicked || startingDelivery}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all shadow-sm ${
              allActivePicked
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Truck className="h-4 w-4" />
            {startingDelivery ? 'Pokretanje...' : 'Kreni u isporuku'}
          </button>
        )}

        {isAnyInTransit && (
          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-4 py-2 rounded-xl border border-blue-200 flex items-center gap-1.5">
            <Truck className="h-4 w-4" /> Tura je u transportu
          </span>
        )}
      </div>

      <div className="space-y-6">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Aktivne ture ({activeOrders.length})</h2>
        
        {activeOrders.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 border border-dashed rounded-xl bg-white">
            Trenutno nemate dodeljenih aktivnih porudžbina.
          </div>
        ) : (
          activeOrders.map(order => {
            const resto = order.restaurant;
            const items = Array.isArray(order.items) ? order.items : [];
            const displayCode = order.delivery_code || 'Nema koda';
            const isPicked = pickedOrders[order.id];

            return (
              <div key={order.id} className={`border rounded-xl p-5 shadow-sm space-y-4 bg-white transition-all ${isPicked ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold">#{order.id.slice(0, 8)}</span>
                    <h3 className="text-sm font-black text-slate-900">{resto.name || order.restaurant_name || 'Restoran'}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${order.status === 'in_transit' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      Status: {order.status === 'in_transit' ? 'U transportu' : order.status}
                    </span>

                    {/* DUGME ZA POTVRDU PREUZIMANJA U KOMBI */}
                    <button
                      onClick={() => togglePickOrder(order.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        isPicked 
                          ? 'bg-emerald-600 text-white shadow-sm' 
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {isPicked ? 'Preuzeto u kombi' : 'Preuzmi porudžbinu'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <MapPin className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span><strong>Adresa:</strong> {resto.address || 'Adresa nije uneta'}, <strong>Opština:</strong> {resto.part_of_city || resto.city || 'Nije definisano'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <span><strong>Kreirano:</strong> {new Date(order.created_at).toLocaleString('sr-RS')}</span>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b text-slate-500 uppercase text-[10px]">
                      <tr>
                        <th className="p-2">Artikal</th>
                        <th className="p-2">Količina</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((item: any, i: number) => (
                        <tr key={i}>
                          <td className="p-2 font-bold">{item.name || item.product_name}</td>
                          <td className="p-2 font-mono">{item.packed_qty ?? item.qty ?? item.quantity} {item.unit || 'kom'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* DIGITALNI POTPIS / KOD I QR GENERISANJE */}
                <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <QrCode className="h-6 w-6 text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-300">Vaš digitalni kod (Potpis isporuke):</p>
                      <p className="text-base font-mono font-black text-emerald-400 tracking-wider mt-0.5">{displayCode}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {displayCode !== 'Nema koda' && (
                      <button
                        onClick={() => setActiveQrCode(displayCode)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <QrCode className="h-4 w-4" /> Generiši QR kod
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {finishedOrders.length > 0 && (
          <div className="space-y-4 pt-6 border-t">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Završene isporuke ({finishedOrders.length})</h2>
            {finishedOrders.map(ord => {
              const resto = ord.restaurant || {};
              return (
                <div key={ord.id} className="border border-slate-200 bg-slate-50 rounded-xl p-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{resto.name || ord.restaurant_name || 'Restoran'}</span>
                    <p className="text-[10px] text-slate-400 font-mono">Adresa: {resto.address || 'N/A'}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border text-[11px]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Uspešno isporučeno
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeQrCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-5 text-center">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="h-5 w-5 text-emerald-600" /> Vaš Digitalni QR Kod
              </h3>
              <button onClick={() => setActiveQrCode(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border flex flex-col items-center justify-center space-y-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(activeQrCode)}`}
                alt="QR Kod isporuke"
                className="rounded-lg shadow-sm border bg-white p-2"
              />
              <p className="font-mono text-lg font-black text-slate-900 tracking-widest">{activeQrCode}</p>
            </div>

            <p className="text-[11px] text-slate-500">Pokažite ovaj QR kod restoranu da verifikuje isporuku.</p>

            <button
              onClick={() => setActiveQrCode(null)}
              className="w-full rounded-xl bg-slate-900 text-white py-2.5 text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Zatvori
            </button>
          </div>
        </div>
      )}
    </div>
  );
}