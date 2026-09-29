'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Package, Plus, Trash2, RefreshCw, FileSpreadsheet, Percent, X, Edit2, Image as ImageIcon } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku?: string;
  unit: string;
  price: number;
  brand?: string;
  category?: string;
  package_size?: number;
  min_order_qty?: number;
  barcode_1?: string;
  barcode_2?: string;
  internal_id?: string;
  image_url?: string;
}

export default function DistributorCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modali
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showSpecialPriceModal, setShowSpecialPriceModal] = useState(false);
  const [batchJson, setBatchJson] = useState('');

  // Editing state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Forma za artikal sa svim poljima
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('Meso i mesne prerađevine');
  const [sku, setSku] = useState('');
  const [barcode1, setBarcode1] = useState('');
  const [barcode2, setBarcode2] = useState('');
  const [internalId, setInternalId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [unit, setUnit] = useState('kg');
  const [price, setPrice] = useState('');
  const [packageSize, setPackageSize] = useState('1');
  const [minOrderQty, setMinOrderQty] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const categoriesList = [
    'Meso i mesne prerađevine',
    'Mlečni proizvodi i jaja',
    'Voće i povrće',
    'Smrznuti program',
    'Pića i napici',
    'Ulja, začini i sosovi',
    'Pekarski proizvodi',
    'Hemija i ambalaža'
  ];

  const fetchCatalog = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
    if (!profile?.organization_id) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('distributor_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (!error && data) setProducts(data);
    setLoading(false);
  };

  useEffect(() => { fetchCatalog(); }, []);

  // Automatsko prenošenje veličine pakovanja u min. narudžbinu (ali dozvoljava naknadnu izmenu)
  const handlePackageSizeChange = (val: string) => {
    setPackageSize(val);
    setMinOrderQty(val);
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setName(''); setBrand(''); setCategory('Meso i mesne prerađevine');
    setSku(''); setBarcode1(''); setBarcode2(''); setInternalId(''); setImageUrl('');
    setUnit('kg'); setPrice(''); setPackageSize('1'); setMinOrderQty('1');
    setShowAddModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setBrand(p.brand || '');
    setCategory(p.category || 'Meso i mesne prerađevine');
    setSku(p.sku || '');
    setBarcode1(p.barcode_1 || '');
    setBarcode2(p.barcode_2 || '');
    setInternalId(p.internal_id || '');
    setImageUrl(p.image_url || '');
    setUnit(p.unit || 'kg');
    setPrice(String(p.price));
    setPackageSize(String(p.package_size || 1));
    setMinOrderQty(String(p.min_order_qty || 1));
    setShowAddModal(true);
  };

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !price) { alert('Unesite naziv i cenu.'); return; }
    setSubmitting(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single();

    const payload = {
      distributor_id: profile?.organization_id,
      name,
      brand: brand || null,
      category,
      sku: sku || null,
      barcode_1: barcode1 || null,
      barcode_2: barcode2 || null,
      internal_id: internalId || null,
      image_url: imageUrl || null,
      unit,
      price: parseFloat(price),
      package_size: parseFloat(packageSize) || 1,
      min_order_qty: parseFloat(minOrderQty) || 1
    };

    let error = null;
    if (editingProduct) {
      // Izmena ne remeti stare porudžbine jer one čuvaju snapshot stavki
      const res = await supabase.from('products').update(payload).eq('id', editingProduct.id);
      error = res.error;
    } else {
      const res = await supabase.from('products').insert(payload);
      error = res.error;
    }

    if (error) alert('Greška: ' + error.message);
    else {
      setShowAddModal(false);
      fetchCatalog();
    }
    setSubmitting(false);
  }

  const handleBatchImport = async () => {
    try {
      const parsed = JSON.parse(batchJson);
      if (!Array.isArray(parsed)) { alert('Mora biti JSON niz!'); return; }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single();

      const prepared = parsed.map(item => ({ ...item, distributor_id: profile?.organization_id }));
      const { error } = await supabase.from('products').insert(prepared);

      if (error) alert('Greška: ' + error.message);
      else {
        alert('Uspešno uvezeno!');
        setShowBatchModal(false);
        setBatchJson('');
        fetchCatalog();
      }
    } catch (err) {
      alert('Neispravan JSON format.');
    }
  };

  async function handleDeleteProduct(id: string) {
    if (!confirm('Obrisati artikal?')) return;
    const supabase = createClient();
    await supabase.from('products').delete().eq('id', id);
    fetchCatalog();
  }

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-emerald-600" /> Katalog Proizvoda
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Uređivanje artikala, cena, pakovanja i brendova.</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowSpecialPriceModal(true)} className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
            <Percent className="h-4 w-4 text-amber-600" /> Specijalne Cene
          </button>
          <button onClick={() => setShowBatchModal(true)} className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Batch Import
          </button>
          <button onClick={openAddModal} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500">
            <Plus className="h-4 w-4" /> Dodaj artikal
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Aktivni artikli ({products.length})</h2>
          <button onClick={fetchCatalog} className="text-xs text-slate-500 flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" /> Osveži</button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Učitavanje...</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 italic">Katalog je prazan. Kliknite na "Dodaj artikal".</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b text-[11px] font-semibold text-slate-500 uppercase">
                  <th className="py-3 px-4">Slika</th>
                  <th className="py-3 px-4">Naziv i brend</th>
                  <th className="py-3 px-4">Kategorija</th>
                  <th className="py-3 px-4">Pakovanje / Min. nar.</th>
                  <th className="py-3 px-4">Cena</th>
                  <th className="py-3 px-4 text-right">Akcija</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-9 w-9 object-cover rounded-lg border" />
                      ) : (
                        <div className="h-9 w-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400"><ImageIcon className="h-4 w-4" /></div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-400">{p.brand || 'Nema brenda'} {p.sku ? `• SKU: ${p.sku}` : ''}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.category || '-'}</td>
                    <td className="py-3 px-4 font-mono">{p.package_size || 1} {p.unit} (Min: {p.min_order_qty || 1})</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-700">{Number(p.price).toLocaleString()} RSD</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button onClick={() => openEditModal(p)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded" title="Izmeni">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded" title="Obriši">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL ZA DODAVANJE / IZMENU ARTIKLA */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">{editingProduct ? 'Izmeni artikal' : 'Dodaj nov artikal'}</h3>
              <button onClick={() => setShowAddModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Naziv artikla *</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="npr. Juneći biftek svež" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Brend</label>
                  <input type="text" value={brand} onChange={e => setBrand(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="npr. Metro Chef" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategorija</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white">
                    {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Šifra / SKU</label>
                  <input type="text" value={sku} onChange={e => setSku(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Barkod 1</label>
                  <input type="text" value={barcode1} onChange={e => setBarcode1(e.target.value)} className="w-full rounded-lg border px-3 py-2 font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Interni ID</label>
                  <input type="text" value={internalId} onChange={e => setInternalId(e.target.value)} className="w-full rounded-lg border px-3 py-2 font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jedinica mere</label>
                  <select value={unit} onChange={e => setUnit(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white font-bold">
                    <option value="kg">kg</option>
                    <option value="kom">kom</option>
                    <option value="lit">lit</option>
                    <option value="pak">pak</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cena po J.M. (RSD) *</label>
                  <input type="number" step="0.01" required value={price} onChange={e => setPrice(e.target.value)} className="w-full rounded-lg border px-3 py-2 font-mono" placeholder="1200" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">URL slike</label>
                  <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="https://..." />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Veličina pakovanja</label>
                  <input type="number" step="any" value={packageSize} onChange={e => handlePackageSizeChange(e.target.value)} className="w-full rounded-lg border px-3 py-2 font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Min. narudžbina</label>
                  <input type="number" step="any" value={minOrderQty} onChange={e => setMinOrderQty(e.target.value)} className="w-full rounded-lg border px-3 py-2 font-mono" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg bg-slate-100 px-4 py-2 font-bold text-slate-600">Otkaži</button>
                <button type="submit" disabled={submitting} className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-500">Sačuvaj artikal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BATCH IMPORT */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Batch Import JSON</h3>
            <textarea rows={6} value={batchJson} onChange={e => setBatchJson(e.target.value)} className="w-full rounded-lg border p-3 font-mono text-xs bg-slate-50" placeholder='[{"name": "Artikal", "price": 500, "unit": "kg"}]' />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowBatchModal(false)} className="rounded-lg bg-slate-100 px-4 py-2 font-bold text-xs">Otkaži</button>
              <button onClick={handleBatchImport} className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white text-xs">Uvezi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}