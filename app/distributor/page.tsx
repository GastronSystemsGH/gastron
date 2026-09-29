'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  BarChart3, Package, Building2, AlertTriangle, 
  Clock, TrendingUp, ShoppingCart, Truck 
} from 'lucide-react';

export default function DistributorDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');

  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<any[]>([]);
  const [rejectedProducts, setRejectedProducts] = useState<any[]>([]);
  const [hoursCount, setHoursCount] = useState<number[]>(Array(24).fill(0));
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [statusCounts, setStatusCounts] = useState({ newCount: 0, inProgressCount: 0, deliveredCount: 0 });

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    const distOrgId = profile?.organization_id;

    // 1. Total broj artikala u katalogu
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('distributor_id', distOrgId);
    setTotalProducts(productCount || 0);

    // 2. Porudžbine sa spoljnim ključem ka organizacijama
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*, organizations!restaurant_id(name)')
      .eq('distributor_id', distOrgId);

    if (ordersData) {
      const filteredOrders = ordersData.filter(o => {
        if (!o.created_at) return false;
        if (timeRange === 'all') return true;
        const diffDays = (new Date().getTime() - new Date(o.created_at).getTime()) / (1000 * 3600 * 24);
        return timeRange === '7d' ? diffDays <= 7 : diffDays <= 30;
      });

      setTotalOrders(filteredOrders.length);

      const hCount = Array(24).fill(0);
      const productSalesMap: Record<string, { name: string; qty: number; amount: number }> = {};
      const restaurantSalesMap: Record<string, { name: string; count: number; amount: number }> = {};
      const rejectedMap: Record<string, { name: string; rejectedQty: number; count: number }> = {};

      let nCnt = 0;
      let pCnt = 0;
      let dCnt = 0;

      filteredOrders.forEach(order => {
        const st = (order.status || '').toLowerCase();
        if (st === 'pending' || st === 'nova') nCnt++;
        else if (['packing', 'packed', 'dispatched', 'in_transit', 'accepted'].includes(st)) pCnt++;
        else if (st === 'delivered') dCnt++;

        const hour = new Date(order.created_at).getHours();
        hCount[hour] += 1;

        // Pouzdano izvlačenje naziva restorana
        const restoName = order.organizations?.name || order.restaurant_name || 'Restoran';
        if (!restaurantSalesMap[restoName]) {
          restaurantSalesMap[restoName] = { name: restoName, count: 0, amount: 0 };
        }
        restaurantSalesMap[restoName].count += 1;
        restaurantSalesMap[restoName].amount += (order.total_amount || order.total_price || 0);

        const items = Array.isArray(order.items) ? order.items : [];
        items.forEach((item: any) => {
          const pName = item.name || item.product_name || 'Artikal';
          const qty = Number(item.qty || item.quantity || 0);
          const price = Number(item.price || 0);
          const rejQty = Number(item.rejected_qty || 0);

          if (!productSalesMap[pName]) {
            productSalesMap[pName] = { name: pName, qty: 0, amount: 0 };
          }
          productSalesMap[pName].qty += qty;
          productSalesMap[pName].amount += (qty * price);

          if (rejQty > 0) {
            if (!rejectedMap[pName]) {
              rejectedMap[pName] = { name: pName, rejectedQty: 0, count: 0 };
            }
            rejectedMap[pName].rejectedQty += rejQty;
            rejectedMap[pName].count += 1;
          }
        });
      });

      setStatusCounts({ newCount: nCnt, inProgressCount: pCnt, deliveredCount: dCnt });
      setHoursCount(hCount);
      setTopProducts(Object.values(productSalesMap).sort((a, b) => b.qty - a.qty).slice(0, 5));
      setTopRestaurants(Object.values(restaurantSalesMap).sort((a, b) => b.amount - a.amount).slice(0, 5));
      setRejectedProducts(Object.values(rejectedMap).sort((a, b) => b.rejectedQty - a.rejectedQty).slice(0, 5));
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const maxHourVal = Math.max(...hoursCount, 1);

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Učitavanje analitike...</div>;

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-emerald-600" /> Distributerski Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Pregled prodaje, prijema i vršnih opterećenja poručivanja.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button onClick={() => setTimeRange('7d')} className={`px-3 py-1.5 rounded-md ${timeRange === '7d' ? 'bg-white shadow-sm font-bold text-emerald-700' : 'text-slate-600'}`}>7 dana</button>
          <button onClick={() => setTimeRange('30d')} className={`px-3 py-1.5 rounded-md ${timeRange === '30d' ? 'bg-white shadow-sm font-bold text-emerald-700' : 'text-slate-600'}`}>30 dana</button>
          <button onClick={() => setTimeRange('all')} className={`px-3 py-1.5 rounded-md ${timeRange === 'all' ? 'bg-white shadow-sm font-bold text-emerald-700' : 'text-slate-600'}`}>Sve</button>
        </div>
      </div>

      {/* KPI Kartice */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ukupno artikala u katalogu</p>
            <p className="text-2xl font-bold text-slate-900 font-mono mt-1">{totalProducts}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Package className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ukupno porudžbina ({timeRange})</p>
            <p className="text-2xl font-bold text-slate-900 font-mono mt-1">{totalOrders}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Porudžbine u obradi</p>
            <p className="text-2xl font-bold text-amber-600 font-mono mt-1">{statusCounts.inProgressCount}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Truck className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Reklamirani / Odbijeni artikli</p>
            <p className="text-2xl font-bold text-rose-600 font-mono mt-1">{rejectedProducts.length}</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Grid: Najprodavaniji, Top lista restorana, Odbijeni proizvodi */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-900 border-b pb-2 flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-600" /> Najprodavaniji artikli
          </h2>
          <div className="space-y-2">
            {topProducts.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">Nema podataka.</p>
            ) : (
              topProducts.map((p, i) => (
                <div key={i} className="flex justify-between items-center text-xs p-2 rounded bg-slate-50 border">
                  <span className="font-medium truncate max-w-[150px]">{i + 1}. {p.name}</span>
                  <span className="font-mono font-bold text-emerald-700">{p.qty} kom</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* TOP LISTA RESTORANA */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-900 border-b pb-2 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-600" /> Top lista restorana
          </h2>
          <div className="space-y-2">
            {topRestaurants.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">Nema zabeleženih porudžbina od restorana.</p>
            ) : (
              topRestaurants.map((r, i) => (
                <div key={i} className="flex justify-between items-center text-xs p-2 rounded bg-slate-50 border">
                  <span className="font-medium truncate max-w-[150px]">{i + 1}. {r.name}</span>
                  <span className="font-mono font-bold text-emerald-700">{r.amount.toLocaleString()} RSD</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-900 border-b pb-2 flex items-center gap-2 text-rose-700">
            <AlertTriangle className="h-4 w-4 text-rose-600" /> Odbijeni proizvodi na prijemu
          </h2>
          <div className="space-y-2">
            {rejectedProducts.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">Nema reklamiranih artikala.</p>
            ) : (
              rejectedProducts.map((rp, i) => (
                <div key={i} className="flex justify-between items-center text-xs p-2 rounded bg-rose-50 border border-rose-200">
                  <span className="font-medium truncate max-w-[150px]">{rp.name}</span>
                  <span className="font-mono font-bold text-rose-700">{rp.rejectedQty} odbijeno</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* GRAFIKON: Prosečno vreme porudžbine po satima */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="border-b pb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-600" /> Prosečno vreme porudžbine po satima
          </h2>
        </div>
        <div className="pt-2 pb-2">
          {totalOrders === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-slate-400 italic">
              Nema porudžbina u izabranom periodu.
            </div>
          ) : (
            <div className="flex items-end gap-1.5 h-44 border-b border-slate-200 px-2 pb-1 bg-slate-50/50 rounded-lg">
              {hoursCount.map((count, hour) => {
                const heightPct = (count / maxHourVal) * 100;
                const pctShare = totalOrders > 0 ? (count / totalOrders) * 100 : 0;
                return (
                  <div key={hour} className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer">
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-xs px-3 py-1.5 rounded-md whitespace-nowrap z-30 shadow-xl font-mono border border-slate-700">
                      <span className="font-bold text-emerald-400 text-sm">{pctShare.toFixed(1)}% porudžbina</span>
                      <span className="text-slate-300 text-xs">({count} od {totalOrders} por.)</span>
                    </div>

                    <div 
                      style={{ height: `${Math.max(heightPct, 6)}%` }} 
                      className={`w-full rounded-t-md transition-all duration-200 ${
                        count > 0 ? 'bg-emerald-600 hover:bg-emerald-500 shadow-sm' : 'bg-slate-200'
                      }`} 
                    />
                    <span className="text-[10px] font-mono text-slate-500 mt-1">{hour}h</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}