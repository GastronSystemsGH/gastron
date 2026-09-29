'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  BarChart3, TrendingUp, Users, Building2, Truck, 
  Clock, ShieldAlert, ShoppingCart, Percent
} from 'lucide-react';
import Link from 'next/link';

type OrderItem = {
  qty?: number;
  quantity?: number;
  received_qty?: number;
  delivered_qty?: number;
  received?: number;
  accepted_qty?: number;
  confirmed_qty?: number;
  packed_qty?: number;
  [k: string]: any;
};

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');
  
  const [orders, setOrders] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [topRestaurantsSort, setTopRestaurantsSort] = useState<'count' | 'amount'>('amount');

  const fetchData = async () => {
    const supabase = createClient();
    
    const { data: orgs } = await supabase.from('organizations').select('*');
    const orgsMap = new Map();
    if (orgs) orgs.forEach(o => orgsMap.set(o.id, o));

    const { data: profiles } = await supabase.from('profiles').select('*');
    const profilesMap = new Map();
    if (profiles) profiles.forEach(p => profilesMap.set(p.id, p));

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ordersData) {
      const enrichedOrders = ordersData.map(order => ({
        ...order,
        organizations: order.restaurant_id ? orgsMap.get(order.restaurant_id) || null : null,
        distributorOrg: (order.distributor_id || order.supplier_id) ? orgsMap.get(order.distributor_id || order.supplier_id) || null : null,
        profiles: order.user_id ? profilesMap.get(order.user_id) || null : null
      }));
      setOrders(enrichedOrders);
    }

    const { data: logsData } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
      
    if (logsData) {
      const enrichedLogs = logsData.map(log => {
        const user = log.user_id ? profilesMap.get(log.user_id) : null;
        const org = log.restaurant_id ? orgsMap.get(log.restaurant_id) : null;
        return {
          ...log,
          userName: user ? (user.full_name || user.email) : (log.user_id ? log.user_id.slice(0,8) : 'Sistem'),
          orgName: org ? org.name : (log.restaurant_id ? log.restaurant_id.slice(0,8) : 'Centrala / Nema firme')
        };
      });
      setAuditLogs(enrichedLogs);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredOrders = orders.filter(o => {
    if (!o.created_at) return false;
    if (timeRange === 'all') return true;
    const orderDate = new Date(o.created_at);
    const now = new Date();
    const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
    if (timeRange === '7d') return diffDays >= 0 && diffDays <= 7;
    if (timeRange === '30d') return diffDays >= 0 && diffDays <= 30;
    return true;
  });

  const totalOrdersCount = filteredOrders.length;
  const grandTotalWithVAT = filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const grandTotalWithoutVAT = grandTotalWithVAT / 1.20;
  const averageCostPerOrder = totalOrdersCount > 0 ? grandTotalWithVAT / totalOrdersCount : 0;
  
  const totalItemsCount = filteredOrders.reduce((sum, o) => {
    const items = Array.isArray(o.items) ? (o.items as OrderItem[]) : [];
    return sum + items.reduce((iSum: number, item: OrderItem) => iSum + (item.qty || item.quantity || 1), 0);
  }, 0);
  const averageItemsPerOrder = totalOrdersCount > 0 ? totalItemsCount / totalOrdersCount : 0;

  const uniqueDistributorsPerOrder = filteredOrders.map(o => o.distributor_id || o.supplier_id).filter(Boolean);
  const averageDistributorsPerOrder = totalOrdersCount > 0 ? new Set(uniqueDistributorsPerOrder).size / Math.min(totalOrdersCount, 1) : 1;

  // --- FULFILLMENT RATE (Ispravljeno pravilo: max 100% po stavki, računa se poručena ako je primljeno više) ---
  let totalOrderedQty = 0;
  let totalReceivedQty = 0;

  filteredOrders.forEach(o => {
    const items = Array.isArray(o.items) ? (o.items as OrderItem[]) : [];
    items.forEach((item: OrderItem) => {
      const ordered = Number(item.qty || item.quantity || 0);
      const rawReceived = Number(
        item.received_qty || 
        item.delivered_qty || 
        item.received || 
        item.accepted_qty || 
        item.confirmed_qty || 
        item.packed_qty ||
        0
      );
      
      // Ako je primljeno/spakovano veće od poručenog, računa se poručena (cap na 100%)
      const effectiveReceived = Math.min(rawReceived, ordered);

      totalOrderedQty += ordered;
      totalReceivedQty += effectiveReceived;
    });
  });

  const fulfillmentRate = totalOrderedQty > 0 
    ? Math.min(100, Number(((totalReceivedQty / totalOrderedQty) * 100).toFixed(1))) 
    : '0.0';

  // --- STATISTIKA RESTORANA ---
  const restaurantStats: Record<string, { name: string; count: number; amount: number }> = {};
  filteredOrders.forEach(o => {
    const restoId = o.restaurant_id || 'nepoznato';
    const restoName = o.organizations?.name || o.restaurant_name || 'Gostujući restoran';
    if (!restaurantStats[restoId]) restaurantStats[restoId] = { name: restoName, count: 0, amount: 0 };
    restaurantStats[restoId].count += 1;
    restaurantStats[restoId].amount += (o.total_amount || 0);
  });

  const topRestaurants = Object.values(restaurantStats).sort((a, b) => {
    return topRestaurantsSort === 'amount' ? b.amount - a.amount : b.count - a.count;
  }).slice(0, 10);

  // --- STATISTIKA DISTRIBUTERA ---
  const distributorStats: Record<string, { name: string; amount: number; ordered: number; received: number }> = {};
  filteredOrders.forEach(o => {
    let distName = 'Glavni distributer (Nepoznato)';
    if (o.distributorOrg) {
      distName = `${o.distributorOrg.name} (PIB: ${o.distributorOrg.company_pib || o.distributorOrg.pib || 'N/A'})`;
    } else if (o.distributor_name) {
      distName = o.distributor_name;
    } else if (o.supplier_name) {
      distName = o.supplier_name;
    }

    if (!distributorStats[distName]) {
      distributorStats[distName] = { name: distName, amount: 0, ordered: 0, received: 0 };
    }
    
    distributorStats[distName].amount += (o.total_amount || 0);
    
    const items = Array.isArray(o.items) ? (o.items as OrderItem[]) : [];
    items.forEach((item: OrderItem) => {
      const ordered = Number(item.qty || item.quantity || 0);
      const rawReceived = Number(
        item.received_qty || 
        item.delivered_qty || 
        item.received || 
        item.accepted_qty || 
        item.confirmed_qty || 
        item.packed_qty ||
        0
      );
      const effectiveReceived = Math.min(rawReceived, ordered);

      distributorStats[distName].ordered += ordered;
      distributorStats[distName].received += effectiveReceived;
    });
  });
  
  const allDistributors = Object.values(distributorStats).map(d => {
    const rateVal = d.ordered > 0 ? (d.received / d.ordered) * 100 : 0;
    return {
      ...d,
      rate: Math.min(100, rateVal).toFixed(1)
    };
  });

  const topDistributors = [...allDistributors].sort((a, b) => b.amount - a.amount).slice(0, 10);
  
  // 10 najgorih sa FR% ispod 75%
  const worstDistributors = [...allDistributors]
    .filter(d => d.ordered > 0 && parseFloat(d.rate) < 75)
    .sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate))
    .slice(0, 10);

  const hoursCount = Array(24).fill(0);
  filteredOrders.forEach(o => {
    if (o.created_at) hoursCount[new Date(o.created_at).getHours()] += 1;
  });
  const maxPeakHourValue = Math.max(...hoursCount, 1);
  const hoursPercentage = hoursCount.map(count => totalOrdersCount > 0 ? (count / totalOrdersCount) * 100 : 0);

  if (loading) return <div className="p-12 text-center text-sm text-slate-500">Učitavanje Dashboard-a...</div>;

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-emerald-600" /> Admin Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Centralni sistem nadzora i analitike svih restorana i distributera.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/orders/new" className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition-colors">
            <ShoppingCart className="h-4 w-4" /> Nova porudžbina
          </Link>
          <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button onClick={() => setTimeRange('7d')} className={`px-3 py-1.5 rounded-md ${timeRange === '7d' ? 'bg-white shadow-sm font-bold text-emerald-700' : 'text-slate-600'}`}>7 dana</button>
            <button onClick={() => setTimeRange('30d')} className={`px-3 py-1.5 rounded-md ${timeRange === '30d' ? 'bg-white shadow-sm font-bold text-emerald-700' : 'text-slate-600'}`}>30 dana</button>
            <button onClick={() => setTimeRange('all')} className={`px-3 py-1.5 rounded-md ${timeRange === 'all' ? 'bg-white shadow-sm font-bold text-emerald-700' : 'text-slate-600'}`}>Sve</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ukupno porudžbina</p>
          <p className="text-xl font-bold text-slate-900 font-mono">{totalOrdersCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Grand Total (Sa PDV)</p>
          <p className="text-xl font-bold text-slate-900 font-mono">{grandTotalWithVAT.toLocaleString()} RSD</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Prosečna cena porudžbine</p>
          <p className="text-xl font-bold text-slate-900 font-mono">{averageCostPerOrder.toLocaleString()} RSD</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Prosečne stavke / dist.</p>
          <p className="text-xl font-bold text-emerald-600 font-mono">{averageItemsPerOrder.toFixed(1)} / {averageDistributorsPerOrder.toFixed(1)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-sm font-bold text-slate-900">Top 10 restorana</h2>
            <div className="flex bg-slate-100 p-0.5 rounded text-[11px]">
              <button onClick={() => setTopRestaurantsSort('amount')} className={`px-2 py-1 rounded ${topRestaurantsSort === 'amount' ? 'bg-white shadow-sm' : ''}`}>Iznos</button>
              <button onClick={() => setTopRestaurantsSort('count')} className={`px-2.5 py-1 rounded ${topRestaurantsSort === 'count' ? 'bg-white shadow-sm' : ''}`}>Broj</button>
            </div>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {topRestaurants.map((resto, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 text-xs border">
                <span className="font-semibold">#{idx + 1} {resto.name}</span>
                <span className="font-mono font-bold">{resto.amount.toLocaleString()} RSD</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="border-b pb-3">
            <h2 className="text-sm font-bold text-slate-900">Top 10 distributera (Promet)</h2>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {topDistributors.map((dist, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 text-xs border border-slate-100">
                <div className="flex flex-col">
                    <span className="font-semibold text-slate-800">#{idx + 1} {dist.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{dist.amount.toLocaleString()} RSD</span>
                </div>
                <span className={`font-mono font-bold text-sm ${parseFloat(dist.rate) < 75 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {dist.rate}% FR
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="border-b pb-3">
            <h2 className="text-sm font-bold text-rose-700">10 Najgorih distributera (FR% ispod 75%)</h2>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {worstDistributors.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6 italic">Nema distributera sa FR ispod 75%.</p>
            ) : (
              worstDistributors.map((dist, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-rose-50 text-xs border border-rose-100">
                  <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">#{idx + 1} {dist.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{dist.amount.toLocaleString()} RSD</span>
                  </div>
                  <span className="font-mono font-bold text-rose-600 text-sm">{dist.rate}% FR</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Prosečno vreme porudžbine po satima</h2>
            <div className="flex items-end gap-1.5 h-48 border-b border-slate-200 px-2 pb-1 bg-slate-50/50 rounded-lg">
                {hoursCount.map((count, hour) => {
                  const heightPct = (count / maxPeakHourValue) * 100;
                  return (
                    <div key={hour} className="flex-1 flex flex-col items-center h-full justify-end">
                      <div style={{ height: `${Math.max(heightPct, 6)}%` }} className={`w-full rounded-t-md ${count > 0 ? 'bg-emerald-600' : 'bg-slate-200'}`} />
                      <span className="text-[10px] font-mono text-slate-500 mt-1">{hour}h</span>
                    </div>
                  );
                })}
            </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
            <h2 className="text-sm font-bold text-slate-900">Fulfillment Rate</h2>
            <div className="my-4 flex flex-col items-center justify-center space-y-2">
                <div className="text-3xl font-black text-slate-900 font-mono">{fulfillmentRate}%</div>
                <div className="flex gap-4 text-xs font-mono">
                    <div className="text-center"><span className="block text-slate-400">Poručeno</span>{totalOrderedQty}</div>
                    <div className="text-center"><span className="block text-slate-400">Primljeno</span><span className="text-emerald-600 font-bold">{totalReceivedQty}</span></div>
                </div>
            </div>
        </div>
      </div>
      
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b px-6 py-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-emerald-600" /> System Activity
            </h2>
        </div>
        <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
                    <tr>
                        <th className="py-3 px-6">Vreme</th>
                        <th className="py-3 px-4">Korisnik</th>
                        <th className="py-3 px-4">Org</th>
                        <th className="py-3 px-4">Akcija</th>
                    </tr>
                </thead>
                <tbody className="divide-y text-xs">
                    {auditLogs.map((log) => (
                        <tr key={log.id}>
                            <td className="py-3 px-6 font-mono text-slate-500">{new Date(log.created_at).toLocaleString('sr-RS')}</td>
                            <td className="py-3 px-4 font-bold">{log.userName}</td>
                            <td className="py-3 px-4 font-semibold text-emerald-700">{log.orgName}</td>
                            <td className="py-3 px-4 font-mono">{log.action}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}