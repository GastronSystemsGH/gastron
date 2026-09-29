'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Search, Star, Plus, Minus, Image as ImageIcon } from 'lucide-react';

interface Product {
  id: string;
  distributor_id: string;
  name: string;
  brand: string;
  unit: string;
  price: number;
  image_url?: string;
}

interface CartItem extends Product {
  quantity: number;
}

export default function RestaurantCatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [restaurantOrgId, setRestaurantOrgId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function fetchCatalog() {
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

      if (profile?.organization_id) {
        setRestaurantOrgId(profile.organization_id);

        const { data: favData } = await supabase
          .from('restaurant_favorites')
          .select('product_id')
          .eq('restaurant_id', profile.organization_id);

        if (favData) setFavorites(favData.map(f => f.product_id));
      }

      const { data: prodData } = await supabase.from('products').select('*');
      if (prodData) setProducts(prodData);

      setLoading(false);
    }
    fetchCatalog();
  }, []);

  async function toggleFavorite(productId: string) {
    if (!restaurantOrgId) return;
    const isFav = favorites.includes(productId);

    if (isFav) {
      await supabase.from('restaurant_favorites').delete().eq('restaurant_id', restaurantOrgId).eq('product_id', productId);
      setFavorites(prev => prev.filter(id => id !== productId));
    } else {
      await supabase.from('restaurant_favorites').insert({ restaurant_id: restaurantOrgId, product_id: productId });
      setFavorites(prev => [...prev, productId]);
    }
  }

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }

  function decreaseFromCart(productId: string) {
    setCart(prev => {
      const existing = prev.find(item => item.id === productId);
      if (!existing) return prev;
      if (existing.quantity <= 1) return prev.filter(item => item.id !== productId);
      return prev.map(item => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item);
    });
  }

  function getCartQty(productId: string) {
    const item = cart.find(c => c.id === productId);
    return item ? item.quantity : 0;
  }

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFav = showOnlyFavorites ? favorites.includes(p.id) : true;
    return matchesSearch && matchesFav;
  });

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-500">Učitavanje kataloga...</div>;
  }

  return (
    <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50/50">
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Katalog namirnica</h2>
                <p className="text-xs text-slate-500">Pronađite željene artikle i dodajte ih u korpu za poručivanje</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowOnlyFavorites(false)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!showOnlyFavorites ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Svi artikli</button>
                <button onClick={() => setShowOnlyFavorites(true)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${showOnlyFavorites ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  <Star className="h-3.5 w-3.5 fill-current" /> Moji favoriti
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Pretraži po nazivu artikla ili brendu..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:border-emerald-600" />
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">Nema artikala u katalogu.</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {filteredProducts.map(product => {
                const qtyInCart = getCartQty(product.id);
                const isFav = favorites.includes(product.id);
                const priceWithoutVat = product.price / 1.2;

                return (
                  <div key={product.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleFavorite(product.id)} className={`p-1.5 rounded-lg ${isFav ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-slate-500'}`}>
                        <Star className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
                      </button>

                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded-lg object-cover border border-slate-200 shrink-0" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shrink-0">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-slate-900">{product.name}</p>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 border">{product.brand || 'Standard'}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs">
                          <span className="font-semibold text-slate-800">Cena bez PDV: {priceWithoutVat.toFixed(2)} RSD</span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-400 font-mono">Sa PDV: {product.price} RSD</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {qtyInCart > 0 ? (
                        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg p-1">
                          <button onClick={() => decreaseFromCart(product.id)} className="p-1 rounded bg-white text-emerald-700 shadow-sm"><Minus className="h-3.5 w-3.5" /></button>
                          <span className="w-8 text-center text-xs font-bold text-emerald-900">{qtyInCart}</span>
                          <button onClick={() => addToCart(product)} className="p-1 rounded bg-white text-emerald-700 shadow-sm"><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(product)} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
                          <Plus className="h-3.5 w-3.5" /> Dodaj
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sticky top-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Aktivna korpa</h2>
          {cart.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">Korpa je prazna.</p>
          ) : (
            <div className="space-y-4">
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-900">{item.name}</p>
                      <p className="text-[11px] text-slate-500">{item.price * item.quantity} RSD</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-1">
                      <button onClick={() => decreaseFromCart(item.id)} className="p-1 rounded bg-white text-slate-700 shadow-sm"><Minus className="h-3.5 w-3" /></button>
                      <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                      <button onClick={() => addToCart(item)} className="p-1 rounded bg-white text-slate-700 shadow-sm"><Plus className="h-3.5 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-4 space-y-1.5 text-xs text-slate-500">
                <div className="flex justify-between"><span>Osnovica (bez PDV):</span><span className="font-mono">{(cartTotal / 1.2).toFixed(2)} RSD</span></div>
                <div className="flex justify-between"><span>PDV (20%):</span><span className="font-mono">{(cartTotal - (cartTotal / 1.2)).toFixed(2)} RSD</span></div>
                <div className="flex justify-between pt-2 border-t border-slate-100 text-sm font-bold text-slate-900">
                  <span>Ukupno:</span><span>{cartTotal} RSD</span>
                </div>
              </div>
              <button onClick={async () => {
                if (cart.length === 0) return;
                setSubmitting(true);
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
                if (!profile?.organization_id) return;
                const targetDistributorId = cart[0]?.distributor_id;
                const formattedItems = cart.map(item => ({ name: item.name, qty: item.quantity, unit: item.unit, price: item.price, brand: item.brand }));
                await supabase.from('orders').insert({
                  restaurant_id: profile.organization_id,
                  distributor_id: targetDistributorId,
                  status: 'pending',
                  total_amount: cartTotal,
                  items: formattedItems,
                  user_id: user.id
                });
                setCart([]);
                setSubmitting(false);
                window.location.href = '/restaurant/orders';
              }} disabled={submitting} className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors disabled:opacity-50">
                {submitting ? 'Slanje...' : 'Pošalji narudžbinu distributeru'}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}