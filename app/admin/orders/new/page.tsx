'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ShoppingCart, ArrowLeft, Building2, Plus, Minus } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminNewOrderPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [selectedResto, setSelectedResto] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      
      const { data: orgs } = await supabase.from('organizations').select('*');
      if (orgs) setRestaurants(orgs);

      const { data: prods } = await supabase.from('products').select('*');
      if (prods) setCatalogProducts(prods);

      setLoading(false);
    };
    fetchData();
  }, []);

  function handleQuantityChange(productId: string, delta: number) {
    setCart(prev => {
      const current = prev[productId] || 0;
      const updated = Math.max(0, current + delta);
      if (updated === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: updated };
    });
  }

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedResto) {
      alert('Molimo Vas da izaberete restoran za koji se pravi porudžbina.');
      return;
    }
    const cartEntries = Object.entries(cart);
    if (cartEntries.length === 0) {
      alert('Korpa je prazna. Izaberite bar jedan artikal.');
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let totalAmount = 0;
    const formattedItems = cartEntries.map(([prodId, qty]) => {
      const prod = catalogProducts.find(p => p.id === prodId);
      const price = prod?.price || 0;
      totalAmount += price * qty;
      return { product_id: prodId, name: prod?.name, qty, price, unit: prod?.unit };
    });

    const { error } = await supabase.from('orders').insert({
      restaurant_id: selectedResto,
      total_amount: totalAmount,
      items: formattedItems
    });

    if (error) {
      alert('Greška pri kreiranju porudžbine: ' + error.message);
      setSubmitting(false);
    } else {
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'ADMIN_CREATED_ORDER',
        restaurant_id: selectedResto,
        details: `Admin kreirao porudžbinu u vrednosti od ${totalAmount} RSD`,
        location: 'Admin Centrala / Srbija'
      });

      alert('Porudžbina je uspešno kreirana!');
      router.push('/admin/orders');
    }
  }

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Učitavanje kataloga...</div>;

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <button onClick={() => router.push('/admin/orders')} className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 mb-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Nazad na porudžbine
          </button>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-emerald-600" /> Kreiranje nove porudžbine (Admin)
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmitOrder} className="space-y-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-emerald-600" /> Izaberite restoran za isporuku (Obavezno)
          </label>
          <select
            value={selectedResto}
            onChange={e => setSelectedResto(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white font-semibold"
            required
          >
            <option value="">-- Izaberite restoran --</option>
            {restaurants.map(r => (
              <option key={r.id} value={r.id}>{r.name} (PIB: {r.company_pib || 'N/A'})</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="border-b px-5 py-4 bg-slate-50">
            <h2 className="text-sm font-bold text-slate-900">Katalog artikala</h2>
            <p className="text-xs text-slate-500">Izaberite količine za željene proizvode iz kataloga nabavke.</p>
          </div>

          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto p-4 space-y-2">
            {catalogProducts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Nema artikala u katalogu.</p>
            ) : (
              catalogProducts.map(prod => {
                const qty = cart[prod.id] || 0;
                return (
                  <div key={prod.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{prod.name}</p>
                      <p className="text-slate-500">{prod.price} RSD / {prod.unit}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(prod.id, -1)}
                        className="p-1.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-12 text-center font-mono font-bold text-sm">{qty} {prod.unit}</span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(prod.id, 1)}
                        className="p-1.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/admin/orders')}
            className="rounded-lg bg-slate-100 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            Otkaži
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Slanje porudžbine...' : 'Pošalji porudžbinu za restoran'}
          </button>
        </div>
      </form>
    </div>
  );
}