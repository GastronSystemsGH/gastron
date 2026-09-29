'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Package, Check, X, QrCode, ShieldCheck, AlertTriangle, Clock, User, ChevronRight, CheckCircle2 } from 'lucide-react';

const REJECTION_REASONS = [
  'Pokvareno',
  'Oštećeno',
  'Odleđeno',
  'Pogrešan artikal',
  'Manjak u pakovanju'
];

export default function RestaurantOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const [receptionState, setReceptionState] = useState<Record<string, { action: 'accept' | 'reject' | 'partial' | null, partialQty: number, reason: string }>>({});
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [inputDeliveryCode, setInputDeliveryCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  const fetchOrders = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/login';
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }

    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (orderData) setOrders(orderData);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const openOrderModal = (order: any) => {
    setSelectedOrder(order);
    const initialRec: Record<string, any> = {};
    const items = Array.isArray(order.items) ? order.items : [];
    
    items.forEach((item: any, idx: number) => {
      initialRec[idx] = {
        action: null,
        partialQty: item.packed_qty ?? item.qty ?? item.quantity ?? 1,
        reason: REJECTION_REASONS[0]
      };
    });
    setReceptionState(initialRec);
  };

  const handleItemAction = (idx: number, action: 'accept' | 'reject' | 'partial') => {
    setReceptionState(prev => ({
      ...prev,
      [idx]: { ...prev[idx], action }
    }));
  };

  const handlePartialQtyChange = (idx: number, val: number) => {
    setReceptionState(prev => ({
      ...prev,
      [idx]: { ...prev[idx], partialQty: val }
    }));
  };

  const handleReasonChange = (idx: number, reason: string) => {
    setReceptionState(prev => ({
      ...prev,
      [idx]: { ...prev[idx], reason }
    }));
  };

  const allItemsChecked =
    !!selectedOrder &&
    Array.isArray(selectedOrder.items) &&
    selectedOrder.items.every((_: unknown, idx: number) => {
      const state = receptionState[idx];
      if (!state || !state.action) return false;
      if (state.action === 'partial' && state.partialQty <= 0) return false;
      return true;
    });

  const handleSignOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const enteredCode = inputDeliveryCode.trim().toUpperCase();

    const { data: freshOrder, error: fetchErr } = await supabase
      .from('orders')
      .select('delivery_code')
      .eq('id', selectedOrder.id)
      .single();

    if (fetchErr || !freshOrder) {
      alert('Greška pri proveri koda u bazi.');
      return;
    }

    const actualCode = (freshOrder.delivery_code || '').trim().toUpperCase();

    if (!actualCode || enteredCode !== actualCode) {
      alert('Uneti kod nije ispravan. Proverite kod sa vozačem.');
      return;
    }

    setSubmitting(true);

    const items = selectedOrder.items.map((item: any, idx: number) => {
      const rec = receptionState[idx];
      return {
        ...item,
        reception_action: rec.action,
        accepted_qty: rec.action === 'accept' ? (item.packed_qty ?? item.qty) : rec.action === 'partial' ? rec.partialQty : 0,
        rejection_reason: rec.action !== 'accept' ? rec.reason : null
      };
    });

    const { error } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        items: items
      })
      .eq('id', selectedOrder.id);

    setSubmitting(false);

    if (error) {
      alert('Greška pri završetku prijema: ' + error.message);
    } else {
      alert('Prijem robe je uspešno završen i porudžbina je arhivirana!');
      setShowCodeModal(false);
      setSelectedOrder(null);
      setInputDeliveryCode('');
      fetchOrders();
    }
  };

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Učitavanje porudžbina restorana...</div>;

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 max-w-7xl mx-auto w-full">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Package className="h-6 w-6 text-emerald-600" /> Prijem robe i istorija porudžbina
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Pregled pristiglih isporuka, verifikacija robe u transportu i elektronsko potpisivanje.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Sve porudžbine restorana ({orders.length})</h2>
        </div>

        {orders.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">Nema unetih porudžbina.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map(order => {
              const isInTransit = order.status === 'in_transit' || order.status === 'dispatched';
              const isDelivered = order.status === 'delivered';

              return (
                <div key={order.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700">#{order.id.slice(0, 8)}</span>
                      <span className={`uppercase px-2 py-0.5 rounded text-[10px] font-bold border ${
                        isDelivered ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        isInTransit ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {isInTransit ? 'U transportu (Spremno za prijem)' : order.status || 'Kreirano'}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-900 text-sm mt-1">Iznos: {Number(order.total_amount || 0).toLocaleString()} RSD</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Datum: {new Date(order.created_at).toLocaleString('sr-RS')}</p>
                  </div>

                  <button
                    onClick={() => openOrderModal(order)}
                    className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-lg text-xs self-start sm:self-auto transition-colors shadow-sm"
                  >
                    <span>{isInTransit ? 'Otvori prijem robe' : 'Pogledaj detalje'}</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Package className="h-5 w-5 text-emerald-600" /> Detalji i prijem porudžbine #{selectedOrder.id.slice(0, 8)}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Status: <strong className="uppercase">{selectedOrder.status}</strong></p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border">
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                  <span><strong>Kreirano:</strong> {new Date(selectedOrder.created_at).toLocaleString('sr-RS')}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <User className="h-4 w-4 text-slate-400 shrink-0" />
                  <span><strong>Ukupan iznos:</strong> {Number(selectedOrder.total_amount || 0).toLocaleString()} RSD</span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Pregled i verifikacija artikala</h4>

                <div className="space-y-3">
                  {selectedOrder.items && Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, idx: number) => {
                    const rec = receptionState[idx] || {};
                    const requestedQty = item.qty || item.quantity || 1;
                    const packedQty = item.packed_qty ?? requestedQty;
                    const isInTransit = selectedOrder.status === 'in_transit' || selectedOrder.status === 'dispatched';

                    return (
                      <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-white space-y-3 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5">
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{item.name || item.product_name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">Brend: {item.brand || 'Standard'}</p>
                          </div>
                          <div className="flex items-center gap-4 font-mono text-xs">
                            <span className="text-slate-500">Traženo: <strong>{requestedQty} {item.unit || 'kom'}</strong></span>
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded">Spakovano: {packedQty} {item.unit || 'kom'}</span>
                          </div>
                        </div>

                        {isInTransit ? (
                          <div className="space-y-2 pt-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-700 text-[11px] mr-2">Akcija prijem:</span>

                              <button
                                type="button"
                                onClick={() => handleItemAction(idx, 'accept')}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold transition-all ${
                                  rec.action === 'accept'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                <Check className="h-3.5 w-3.5" /> Prihvati
                              </button>

                              <div className="flex items-center gap-1 bg-slate-50 border rounded-lg px-2 py-1">
                                <input
                                  type="number"
                                  min="0"
                                  max={packedQty}
                                  placeholder="Delimično"
                                  value={rec.action === 'partial' ? rec.partialQty : ''}
                                  onChange={(e) => {
                                    handleItemAction(idx, 'partial');
                                    handlePartialQtyChange(idx, Number(e.target.value));
                                  }}
                                  className="w-20 bg-transparent text-xs font-mono font-bold focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-400">{item.unit || 'kom'}</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleItemAction(idx, 'reject')}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold transition-all ${
                                  rec.action === 'reject'
                                    ? 'bg-rose-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                <X className="h-3.5 w-3.5" /> Odbij
                              </button>
                            </div>

                            {(rec.action === 'reject' || rec.action === 'partial') && (
                              <div className="flex items-center gap-2 pt-2 bg-rose-50/50 p-2.5 rounded-lg border border-rose-200">
                                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                                <span className="text-[11px] font-bold text-rose-900">Razlog:</span>
                                <select
                                  value={rec.reason}
                                  onChange={(e) => handleReasonChange(idx, e.target.value)}
                                  className="bg-white border border-rose-300 rounded px-2 py-1 text-xs font-semibold text-rose-900 focus:outline-none"
                                >
                                  {REJECTION_REASONS.map(reason => (
                                    <option key={reason} value={reason}>{reason}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 italic">
                            Status porudžbine: {selectedOrder.status}. Verifikacija artikala je moguća samo kada je porudžbina u transportu.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border-t pt-4 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Zatvori
              </button>

              {(selectedOrder.status === 'in_transit' || selectedOrder.status === 'dispatched') && (
                <button
                  type="button"
                  disabled={!allItemsChecked}
                  onClick={() => setShowCodeModal(true)}
                  className={`flex items-center gap-1.5 px-6 py-3 rounded-xl text-xs font-bold shadow-sm transition-all ${
                    allItemsChecked
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4" /> Potpiši porudžbinu
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-5 text-center">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="h-5 w-5 text-emerald-600" /> Verifikacija isporuke kodom
              </h3>
              <button onClick={() => setShowCodeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Unesite desetocifreni kod koji vam je dao vozač da potvrdite prijem.
            </p>

            <form onSubmit={handleSignOrder} className="space-y-4">
              <input
                type="text"
                placeholder="UNESI KOD"
                value={inputDeliveryCode}
                onChange={(e) => setInputDeliveryCode(e.target.value)}
                className="w-full bg-slate-100 border-2 border-slate-300 text-slate-900 px-4 py-3 rounded-xl font-mono font-black text-center text-lg uppercase tracking-widest focus:outline-none focus:border-emerald-600"
                required
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCodeModal(false)}
                  className="flex-1 rounded-xl bg-slate-100 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Otkaži
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-3 text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {submitting ? 'Potpisivanje...' : 'Potvrdi i završi prijem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}