'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ShoppingCart, Check, Truck, Save, MapPin, Clock, UserCheck, X, ShieldAlert, User, Phone } from 'lucide-react';

export default function DistributorOrdersPage() {
  const [activeTab, setActiveTab] = useState<'new' | 'in_progress' | 'archive'>('new');
  const [orders, setOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [showDriverModal, setShowDriverModal] = useState(false);
  const [selectedOrderForDriver, setSelectedOrderForDriver] = useState<any | null>(null);

  const supabase = createClient();

  const fetchOrdersAndDrivers = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    const orgId = profile?.organization_id;

    // Uzimamo sve profile da bismo našli vozače, ali i profil naručioca
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('*');

    let driversData: any[] = [];
    const profilesMap: Record<string, any> = {};

    if (allProfiles && allProfiles.length > 0) {
      allProfiles.forEach(p => {
        profilesMap[p.id] = p; // Mapa za brzo pronalaženje naručioca
      });

      const foundDrivers = allProfiles.filter(p => 
        p.role === 'driver' || 
        p.role === 'dis_driver' || 
        (p.full_name && p.full_name.toLowerCase().includes('vozač')) ||
        (p.email && p.email.includes('vozac'))
      );
      driversData = foundDrivers.length > 0 ? foundDrivers : allProfiles;
    }

    let activeDriverIds = new Set();
    try {
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('user_id')
        .is('clock_out', null);
      
      if (attendanceData && attendanceData.length > 0) {
        attendanceData.forEach(a => activeDriverIds.add(a.user_id));
      }
    } catch (e) {
      console.error('Greška pri proveri smena:', e);
    }

    const enrichedDrivers = driversData.map(d => ({
      ...d,
      isOnDuty: activeDriverIds.has(d.id)
    }));
    setDrivers(enrichedDrivers);

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('distributor_id', orgId)
      .order('created_at', { ascending: false });

    if (ordersData && ordersData.length > 0) {
      const restaurantIds = Array.from(new Set(ordersData.map(o => o.restaurant_id).filter(Boolean)));

      let organizationsMap: Record<string, any> = {};
      if (restaurantIds.length > 0) {
        const { data: orgsData } = await supabase
          .from('organizations')
          .select('id, name, city, part_of_city, address, number')
          .in('id', restaurantIds);

        if (orgsData) {
          orgsData.forEach(org => {
            organizationsMap[org.id] = org;
          });
        }
      }

      const enrichedOrders = ordersData.map(order => ({
        ...order,
        organizations: organizationsMap[order.restaurant_id] || null,
        userProfile: profilesMap[order.user_id] || null // Povezujemo podatke naručioca
      }));

      setOrders(enrichedOrders);
    } else {
      setOrders([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchOrdersAndDrivers();
  }, []);

  const handleItemPackedQtyChange = (orderId: string, itemIdx: number, packedQty: number) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const updatedItems = [...(o.items || [])];
      updatedItems[itemIdx] = { ...updatedItems[itemIdx], packed_qty: packedQty };
      return { ...o, items: updatedItems };
    }));
  };

  const assignDriverToOrder = async (driver: any) => {
    if (!selectedOrderForDriver) return;

    if (!driver.isOnDuty) {
      alert(`Greška: Vozač ${driver.full_name || driver.email} nije u smeni (Clock-out je aktivan) i ne može dobiti porudžbinu!`);
      return;
    }

    const orderId = selectedOrderForDriver.id;
    
    let existingCode = selectedOrderForDriver.delivery_code;
    if (!existingCode || existingCode === 'N/A') {
      existingCode = Math.random().toString(36).substring(2, 12).toUpperCase();
    }

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, driver_id: driver.id, delivery_code: existingCode } : o));
    
    await supabase
      .from('orders')
      .update({ 
        driver_id: driver.id,
        delivery_code: existingCode 
      })
      .eq('id', orderId);

    setShowDriverModal(false);
    setSelectedOrderForDriver(null);
  };

  const handleConfirmNewOrder = async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'packing' })
      .eq('id', orderId);

    if (error) alert('Greška: ' + error.message);
    else fetchOrdersAndDrivers();
  };

  const saveOrderPackingAndDriver = async (order: any) => {
    if (order.driver_id) {
      const assignedDriver = drivers.find(d => d.id === order.driver_id);
      if (assignedDriver && !assignedDriver.isOnDuty) {
        alert('Greška: Izabrani vozač nije u smeni! Morate izabrati drugog vozača ili ga staviti u smenu.');
        return;
      }
    }

    setSavingId(order.id);

    let existingCode = order.delivery_code;
    if (!existingCode || existingCode === 'N/A') {
      existingCode = Math.random().toString(36).substring(2, 12).toUpperCase();
    }

    const { error } = await supabase
      .from('orders')
      .update({
        items: order.items,
        driver_id: order.driver_id,
        delivery_code: existingCode,
        status: 'packed'
      })
      .eq('id', order.id);

    setSavingId(null);
    if (error) alert('Greška: ' + error.message);
    else {
      alert('Pakovanje, vozač i digitalni kod su uspešno sačuvani!');
      fetchOrdersAndDrivers();
    }
  };

  const newOrders = orders.filter(o => o.status === 'pending' || !o.status);
  const inProgressOrders = orders.filter(o => ['packing', 'packed', 'accepted', 'dispatched', 'in_transit'].includes(o.status));
  const archiveOrders = orders.filter(o => o.status === 'delivered');

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Učitavanje porudžbina...</div>;

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 max-w-7xl mx-auto w-full">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-emerald-600" /> Upravljanje Porudžbinama
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Praćenje narudžbi po restoranima, pregled sadržaja i dodela vozača u smeni.</p>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold max-w-xl border border-slate-200">
        <button onClick={() => setActiveTab('new')} className={`flex-1 py-2 rounded-lg ${activeTab === 'new' ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
          Nove ({newOrders.length})
        </button>
        <button onClick={() => setActiveTab('in_progress')} className={`flex-1 py-2 rounded-lg ${activeTab === 'in_progress' ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
          U obradi i pakovanju ({inProgressOrders.length})
        </button>
        <button onClick={() => setActiveTab('archive')} className={`flex-1 py-2 rounded-lg ${activeTab === 'archive' ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
          Arhiva ({archiveOrders.length})
        </button>
      </div>

      {activeTab === 'new' && (
        <div className="space-y-4">
          {newOrders.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 border border-dashed rounded-xl bg-white">Nema novih porudžbina.</div>
          ) : (
            newOrders.map((ord, idx) => {
              const orderDailyIndex = `#${String(newOrders.length - idx).padStart(3, '0')}`;
              const items = Array.isArray(ord.items) ? ord.items : [];
              const resto = ord.organizations;
              const formattedAddress = resto?.address ? `${resto.address}, ${resto.number || 'b.b.'}` : 'Nema adrese';
              const userProfile = ord.userProfile;

              return (
                <div key={ord.id} className="border border-slate-200 bg-white rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 gap-2">
                    <div className="flex items-center gap-3">
                      <span className="bg-emerald-600 text-white font-mono text-xs font-black px-2.5 py-1 rounded-lg">{orderDailyIndex}</span>
                      <div>
                        <h3 className="text-sm font-black text-slate-900">{resto?.name || ord.restaurant_name || 'Restoran bez naziva'}</h3>
                        <p className="text-[10px] text-slate-400 font-mono">ID: #{ord.id.slice(0, 8)}</p>
                      </div>
                    </div>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-md border self-start">Nova porudžbina</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg text-xs">
                    <div className="flex items-center gap-2 text-slate-700">
                      <MapPin className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span><strong>Adresa:</strong> {formattedAddress}, <strong>Deo grada:</strong> {resto?.part_of_city || resto?.city || 'Nije definisano'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span><strong>Vreme poručivanja:</strong> {new Date(ord.created_at).toLocaleString('sr-RS')}</span>
                    </div>
                    
                    {/* PODACI NARUČIOCA */}
                    <div className="sm:col-span-2 flex items-center gap-2 border-t border-slate-200 pt-2 mt-1 text-slate-700">
                      <User className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span><strong>Poručio:</strong> {userProfile?.full_name || 'Nepoznat korisnik'}</span>
                      {userProfile?.phone || userProfile?.phone_number ? (
                        <>
                          <span className="text-slate-300">|</span>
                          <Phone className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <span className="font-mono">{userProfile.phone || userProfile.phone_number}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* TABELA ARTIKALA */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b text-slate-500 uppercase text-[10px]">
                        <tr>
                          <th className="p-2">Artikal</th>
                          <th className="p-2">Količina</th>
                          <th className="p-2 text-right">Cena</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {items.map((item: any, i: number) => (
                          <tr key={i}>
                            <td className="p-2 font-bold">{item.name || item.product_name}</td>
                            <td className="p-2 font-mono">{item.qty || item.quantity} {item.unit || 'kom'}</td>
                            <td className="p-2 text-right font-mono">{(item.price || 0).toLocaleString()} RSD</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="font-mono font-black text-slate-900 text-sm">Ukupno: {Number(ord.total_amount || ord.total_price || 0).toLocaleString()} RSD</span>
                    <button
                      onClick={() => handleConfirmNewOrder(ord.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5"
                    >
                      <Check className="h-4 w-4" /> Potvrdi porudžbinu
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'in_progress' && (
        <div className="space-y-6">
          {inProgressOrders.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 border border-dashed rounded-xl bg-white">Nema porudžbina u obradi.</div>
          ) : (
            inProgressOrders.map(order => {
              const items = Array.isArray(order.items) ? order.items : [];
              const resto = order.organizations;
              const formattedAddress = resto?.address ? `${resto.address}, ${resto.number || 'b.b.'}` : 'Nema adrese';
              const assignedDriver = drivers.find(d => d.id === order.driver_id);
              const userProfile = order.userProfile;

              return (
                <div key={order.id} className="border border-slate-200 bg-white rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded font-bold">#{order.id.slice(0, 8)}</span>
                        <h3 className="text-sm font-black text-slate-900">{resto?.name || order.restaurant_name}</h3>
                      </div>
                      <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                        {order.status === 'packed' ? 'Spakovano / Spremnо' : 'U pakovanju'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-slate-50 border px-3 py-1.5 rounded-lg text-xs">
                        <Truck className="h-4 w-4 text-slate-400" />
                        <span className="font-semibold">{assignedDriver ? (assignedDriver.full_name || assignedDriver.email) : 'Nema dodeljenog vozača'}</span>
                        <button
                          onClick={() => { setSelectedOrderForDriver(order); setShowDriverModal(true); }}
                          className="bg-slate-900 text-white font-bold px-2.5 py-1 rounded text-[10px] hover:bg-slate-800"
                        >
                          Izaberi vozača
                        </button>
                      </div>

                      <button
                        onClick={() => saveOrderPackingAndDriver(order)}
                        disabled={savingId === order.id}
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm"
                      >
                        <Save className="h-4 w-4" /> {savingId === order.id ? 'Čuvanje...' : 'Sačuvaj pakovanje'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg text-xs">
                    <div className="flex items-center gap-2 text-slate-700">
                      <MapPin className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span><strong>Adresa:</strong> {formattedAddress}, <strong>Opština:</strong> {resto?.part_of_city || resto?.city || 'Nije definisano'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span><strong>Vreme poručivanja:</strong> {new Date(order.created_at).toLocaleString('sr-RS')}</span>
                    </div>
                    
                    {/* PODACI NARUČIOCA */}
                    <div className="sm:col-span-2 flex items-center gap-2 border-t border-slate-200 pt-2 mt-1 text-slate-700">
                      <User className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span><strong>Poručio:</strong> {userProfile?.full_name || 'Nepoznat korisnik'}</span>
                      {userProfile?.phone || userProfile?.phone_number ? (
                        <>
                          <span className="text-slate-300">|</span>
                          <Phone className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <span className="font-mono">{userProfile.phone || userProfile.phone_number}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* TABELA ARTIKALA (SA INPUTIMA ZA PAKOVANJE) */}
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 uppercase border-b text-[10px]">
                          <th className="p-2">Artikal</th>
                          <th className="p-2">Tražena kol.</th>
                          <th className="p-2 font-bold text-emerald-700">Spakovana kol.</th>
                          <th className="p-2 text-right">Cena</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {items.map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td className="p-2 font-bold text-slate-800">{item.name || item.product_name}</td>
                            <td className="p-2 font-mono">{item.qty || item.quantity} {item.unit || 'kom'}</td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={item.packed_qty ?? (item.qty || item.quantity)}
                                onChange={(e) => handleItemPackedQtyChange(order.id, idx, Number(e.target.value))}
                                className="w-24 border border-emerald-200 rounded px-2 py-1 font-mono font-bold text-emerald-700 bg-emerald-50/50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-slate-800">{(item.price || 0).toLocaleString()} RSD</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'archive' && (
        <div className="space-y-4">
          {archiveOrders.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 border border-dashed rounded-xl bg-white">Nema arhiviranih porudžbina.</div>
          ) : (
            archiveOrders.map(ord => {
              const resto = ord.organizations;
              const formattedAddress = resto?.address ? `${resto.address}, ${resto.number || 'b.b.'}` : 'Nema adrese';
              const items = Array.isArray(ord.items) ? ord.items : [];
              
              return (
                <div key={ord.id} className="border border-slate-200 bg-white rounded-xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded font-bold">#{ord.id.slice(0, 8)}</span>
                        <h3 className="text-sm font-black text-slate-900">{resto?.name || ord.restaurant_name}</h3>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">Kod prijema: {ord.delivery_code || '-'}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border text-xs">
                      Isporučeno
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg text-xs">
                    <div className="flex items-center gap-2 text-slate-700">
                      <MapPin className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span><strong>Adresa:</strong> {formattedAddress}, <strong>Opština:</strong> {resto?.part_of_city || resto?.city || 'Nije definisano'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span><strong>Datum:</strong> {new Date(ord.created_at).toLocaleString('sr-RS')}</span>
                    </div>
                  </div>

                  {/* LISTA ARTIKALA ZA ARHIVU (Uprošćena) */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b text-slate-500 uppercase text-[10px]">
                        <tr>
                          <th className="p-2">Artikal</th>
                          <th className="p-2 text-right">Spakovano</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-slate-600">
                        {items.map((item: any, i: number) => (
                          <tr key={i}>
                            <td className="p-2 font-medium">{item.name || item.product_name}</td>
                            <td className="p-2 text-right font-mono">{item.packed_qty ?? (item.qty || item.quantity)} {item.unit || 'kom'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center pt-2 font-mono font-bold text-xs">
                    <span className="text-slate-500">Ukupan iznos:</span>
                    <span className="text-slate-900 text-sm">{Number(ord.total_amount || ord.total_price || 0).toLocaleString()} RSD</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {showDriverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Truck className="h-4 w-4 text-emerald-600" /> Izaberi vozača u smeni
              </h3>
              <button onClick={() => setShowDriverModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>

            <p className="text-slate-500">Samo vozači koji su trenutno u smeni mogu biti izabrani:</p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {drivers.length === 0 ? (
                <p className="text-slate-400 italic py-4 text-center">Nema registrovanih vozača.</p>
              ) : (
                drivers.map(driver => (
                  <div
                    key={driver.id}
                    onClick={() => assignDriverToOrder(driver)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      driver.isOnDuty 
                        ? 'hover:bg-emerald-50 hover:border-emerald-300 cursor-pointer bg-white' 
                        : 'bg-slate-100 opacity-60 cursor-not-allowed border-slate-200'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-900">{driver.full_name || driver.email}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{driver.email}</p>
                    </div>
                    <div>
                      {driver.isOnDuty ? (
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1">
                          <UserCheck className="h-3 w-3" /> U smeni
                        </span>
                      ) : (
                        <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" /> Nije u smeni 
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button onClick={() => setShowDriverModal(false)} className="rounded-lg bg-slate-100 px-4 py-2 font-bold text-slate-600">Otkaži</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}