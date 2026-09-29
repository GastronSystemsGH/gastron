'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Utensils, Plus, Trash2, Edit2, Check, X, Image as ImageIcon, FolderPlus, Upload, BookOpen } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  unit: string;
  price: number;
}

interface RecipeItem {
  id: string;
  product_id: string;
  quantity: number;
  products: {
    name: string;
    price: number;
    unit: string;
  };
}

interface Recipe {
  id: string;
  name: string;
  category: string;
  selling_price: number;
  target_food_cost?: number;
  image_url?: string;
  preparation?: string;
  recipe_items: RecipeItem[];
}

interface CategoryRow {
  id: string;
  name: string;
}

const DEFAULT_CATEGORIES = [
  'Glavna jela',
  'Predjela',
  'Supe i čorbe',
  'Dezerti',
  'Dodaci',
  'Salate',
  'Paste',
  'Pice'
];

export default function RestaurantRecipes() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCook, setIsCook] = useState(false);

  // Nova jela
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newCategory, setNewCategory] = useState('Glavna jela');
  const [newSellingPrice, setNewSellingPrice] = useState('');
  const [newTargetFC, setNewTargetFC] = useState('33');
  const [newPreparation, setNewPreparation] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Kategorije
  const [newCatInput, setNewCatInput] = useState('');
  const [showCatManager, setShowCatManager] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('Sve');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');

  // Editovanje jela
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editTargetFC, setEditTargetFC] = useState('33');
  const [editPreparation, setEditPreparation] = useState('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);

  const [addingIngredientToId, setAddingIngredientToId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [ingredientQuantity, setIngredientQuantity] = useState<string>('0.1');

  const fetchData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profile) {
      const roleStr = (profile.role || '').toLowerCase();
      const isOwnerCheck = roleStr.includes('owner') || roleStr.includes('res_owner');
      const isChefCheck = roleStr.includes('chef') || roleStr.includes('res_chef');
      const isCookCheck = !isOwnerCheck && !isChefCheck;
      setIsCook(isCookCheck);

      if (profile.organization_id) {
        const { data: catData } = await supabase
          .from('recipe_categories')
          .select('*')
          .eq('restaurant_id', profile.organization_id);

        if (catData) {
          setCategoryRows(catData);
          const customNames = catData.map(c => c.name);
          setCategories(Array.from(new Set([...DEFAULT_CATEGORIES, ...customNames])));
        }
      }
    }

    const { data: prodData } = await supabase.from('products').select('*');
    if (prodData) {
      setProducts(prodData);
      if (prodData.length > 0) setSelectedProductId(prodData[0].id);
    }

    const { data: recipeData } = await supabase
      .from('recipes')
      .select(`
        id,
        name,
        category,
        selling_price,
        target_food_cost,
        image_url,
        preparation,
        recipe_items (
          id,
          product_id,
          quantity,
          products (
            name,
            price,
            unit
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (recipeData) {
      setRecipes(recipeData as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (isCook) return;
    if (!newCatInput.trim()) return;
    const catName = newCatInput.trim();
    if (categories.includes(catName)) {
      alert('Ova kategorija već postoji.');
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();

    if (profile?.organization_id) {
      const { data, error } = await supabase.from('recipe_categories').insert({
        restaurant_id: profile.organization_id,
        name: catName
      }).select().single();

      if (error) {
        alert('Greška: ' + error.message);
      } else if (data) {
        setCategoryRows(prev => [...prev, data]);
        setCategories(prev => [...prev, catName]);
        setNewCatInput('');
      }
    }
  }

  async function handleUpdateCategory(catId: string, oldName: string) {
    if (isCook) return;
    if (!editCatName.trim()) return;
    const newName = editCatName.trim();
    if (DEFAULT_CATEGORIES.includes(oldName)) {
      alert('Podrazumevane kategorije se ne mogu menjati.');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from('recipe_categories').update({ name: newName }).eq('id', catId);

    if (error) {
      alert('Greška: ' + error.message);
    } else {
      setCategoryRows(prev => prev.map(c => c.id === catId ? { ...c, name: newName } : c));
      setCategories(prev => prev.map(c => c === oldName ? newName : c));
      setEditingCatId(null);
      fetchData();
    }
  }

  async function handleDeleteCategory(catId: string, catName: string) {
    if (isCook) return;
    if (DEFAULT_CATEGORIES.includes(catName)) {
      alert('Podrazumevane kategorije se ne mogu brisati.');
      return;
    }
    if (!confirm(`Da li ste sigurni da želite da obrišete kategoriju "${catName}"?`)) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();

    await supabase.from('recipe_categories').delete().eq('id', catId);
    if (profile?.organization_id) {
      await supabase.from('recipe_categories').delete().eq('restaurant_id', profile.organization_id).eq('name', catName);
    }

    setCategoryRows(prev => prev.filter(c => c.id !== catId && c.name !== catName));
    setCategories(prev => prev.filter(c => c !== catName));
    if (selectedCategoryFilter === catName) setSelectedCategoryFilter('Sve');
    fetchData();
  }

  async function uploadImageToStorage(file: File): Promise<string | null> {
    const supabase = createClient();
    const fileExt = file.name.split('.').pop();
    const randomPart = Math.random().toString(36).substring(2);
    const fileName = `${randomPart}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage.from('recipes').upload(filePath, file);
    if (uploadError) {
      alert('Greška pri otpremanju slike: ' + uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from('recipes').getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function handleCreateRecipe(e: React.FormEvent) {
    e.preventDefault();
    if (isCook) return;
    if (!newRecipeName) {
      alert('Unesite naziv jela.');
      return;
    }
    setSubmitting(true);

    let imageUrl = null;
    if (imageFile) {
      imageUrl = await uploadImageToStorage(imageFile);
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
    if (!profile?.organization_id) return;

    const { error } = await supabase.from('recipes').insert({
      restaurant_id: profile.organization_id,
      name: newRecipeName,
      category: newCategory || 'Glavna jela',
      selling_price: parseFloat(newSellingPrice) || 0,
      target_food_cost: parseFloat(newTargetFC) || 33.0,
      preparation: newPreparation.trim() || null,
      image_url: imageUrl
    });

    if (error) {
      alert('Greška: ' + error.message);
    } else {
      setNewRecipeName('');
      setNewSellingPrice('');
      setNewTargetFC('33');
      setNewPreparation('');
      setImageFile(null);
      fetchData();
    }
    setSubmitting(false);
  }

  function startEditingRecipe(recipe: Recipe) {
    if (isCook) return;
    setEditingRecipeId(recipe.id);
    setEditName(recipe.name);
    setEditCategory(recipe.category || 'Glavna jela');
    setEditPrice(recipe.selling_price.toString());
    setEditTargetFC((recipe.target_food_cost ?? 33).toString());
    setEditPreparation(recipe.preparation || '');
    setEditImageFile(null);
  }

  async function handleSaveRecipeEdit(recipeId: string, currentImageUrl?: string) {
    if (isCook) return;
    let imageUrl = currentImageUrl;
    if (editImageFile) {
      const uploaded = await uploadImageToStorage(editImageFile);
      if (uploaded) imageUrl = uploaded;
    }

    const supabase = createClient();
    const { error } = await supabase.from('recipes').update({
      name: editName,
      category: editCategory,
      selling_price: parseFloat(editPrice) || 0,
      target_food_cost: parseFloat(editTargetFC) || 33.0,
      preparation: editPreparation.trim() || null,
      image_url: imageUrl
    }).eq('id', recipeId);

    if (error) alert('Greška: ' + error.message);
    else {
      setEditingRecipeId(null);
      fetchData();
    }
  }

  async function handleAddIngredientToRecipe(recipeId: string) {
    if (isCook) return;
    if (!selectedProductId) return;
    const qty = parseFloat(ingredientQuantity);
    if (isNaN(qty) || qty <= 0) return;

    const supabase = createClient();
    await supabase.from('recipe_items').insert({
      recipe_id: recipeId,
      product_id: selectedProductId,
      quantity: qty
    });
    setAddingIngredientToId(null);
    fetchData();
  }

  async function handleDeleteIngredient(itemId: string) {
    if (isCook) return;
    const supabase = createClient();
    await supabase.from('recipe_items').delete().eq('id', itemId);
    fetchData();
  }

  async function handleDeleteRecipe(id: string) {
    if (isCook) return;
    if (!confirm('Obrisati ovo jelo?')) return;
    const supabase = createClient();
    await supabase.from('recipes').delete().eq('id', id);
    fetchData();
  }

  const filteredRecipes = selectedCategoryFilter === 'Sve' 
    ? recipes 
    : recipes.filter(r => (r.category || 'Glavna jela') === selectedCategoryFilter);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
        <h1 className="text-base font-semibold text-slate-900">
          {isCook ? 'Recepti restorana (Samo za čitanje)' : 'Upravljanje receptima i Food Cost-om'}
        </h1>
        {!isCook && (
          <button
            onClick={() => setShowCatManager(!showCatManager)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <FolderPlus className="h-4 w-4" /> {showCatManager ? 'Zatvori upravljanje kategorijama' : 'Upravljaj kategorijama'}
          </button>
        )}
      </header>

      <main className="flex-1 p-6 space-y-6">
        {!isCook && showCatManager && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm space-y-4 max-w-xl">
            <h2 className="text-sm font-semibold text-slate-900">Kreirajte, uredite ili obrišite kategorije jela</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => {
                const rowObj = categoryRows.find(c => c.name === cat);
                const isCustom = !DEFAULT_CATEGORIES.includes(cat);
                const isEditingThisCat = editingCatId === (rowObj?.id || cat);

                return (
                  <span key={cat} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 border border-emerald-200 shadow-sm">
                    {isEditingThisCat ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editCatName}
                          onChange={e => setEditCatName(e.target.value)}
                          className="rounded border px-1.5 py-0.5 text-xs bg-white w-28"
                        />
                        <button onClick={() => handleUpdateCategory(rowObj?.id || '', cat)} className="text-emerald-600"><Check className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setEditingCatId(null)} className="text-slate-400"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <>
                        {cat}
                        {isCustom && (
                          <div className="flex items-center gap-1 ml-1.5">
                            <button
                              onClick={() => { setEditingCatId(rowObj?.id || cat); setEditCatName(cat); }}
                              className="text-slate-400 hover:text-emerald-600 transition-colors"
                              title="Izmeni naziv"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(rowObj?.id || '', cat)}
                              className="text-slate-400 hover:text-rose-600 transition-colors"
                              title="Obriši kategoriju"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </span>
                );
              })}
            </div>
            <form onSubmit={handleAddCategory} className="flex gap-2 pt-2 border-t border-emerald-200/60">
              <input
                type="text"
                placeholder="Nova kategorija (npr. Specijaliteti kuće)"
                value={newCatInput}
                onChange={e => setNewCatInput(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-emerald-600"
              />
              <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
                Dodaj kategoriju
              </button>
            </form>
          </div>
        )}

        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategoryFilter('Sve')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${selectedCategoryFilter === 'Sve' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            Sve kategorije ({recipes.length})
          </button>
          {categories.map(cat => {
            const count = recipes.filter(r => (r.category || 'Glavna jela') === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${selectedCategoryFilter === cat ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        <div className={`grid grid-cols-1 ${isCook ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-6`}>
          {!isCook && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm h-fit">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Dodaj novo jelo</h2>
              <p className="text-xs text-slate-500 mb-4">Unesi naziv, kategoriju, cenu, max Food Cost, pripremu i sliku.</p>
              
              <form onSubmit={handleCreateRecipe} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">Naziv jela</label>
                  <input
                    type="text"
                    required
                    value={newRecipeName}
                    onChange={(e) => setNewRecipeName(e.target.value)}
                    placeholder="npr. Ramstek na žaru"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">Kategorija</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">Prodajna cena (RSD)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newSellingPrice}
                      onChange={(e) => setNewSellingPrice(e.target.value)}
                      placeholder="1850.00"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">Max Food Cost %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newTargetFC}
                      onChange={(e) => setNewTargetFC(e.target.value)}
                      placeholder="33"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">Način pripreme (opciono)</label>
                  <textarea
                    rows={3}
                    value={newPreparation}
                    onChange={(e) => setNewPreparation(e.target.value)}
                    placeholder="Unesite korake pripreme jela..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">Slika jela (Upload)</label>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 text-xs text-slate-600">
                      <Upload className="h-4 w-4 text-emerald-600" />
                      <span className="truncate">{imageFile ? imageFile.name : 'Izaberi sliku...'}</span>
                      <input type="file" accept="image/*" onChange={(e) => e.target.files && setImageFile(e.target.files[0])} className="hidden" />
                    </label>
                    {imageFile && (
                      <button type="button" onClick={() => setImageFile(null)} className="p-2 text-slate-400 hover:text-rose-600">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> {submitting ? 'Čuvanje...' : 'Kreiraj jelo'}
                </button>
              </form>
            </div>
          )}

          <div className={`${isCook ? 'lg:col-span-1' : 'lg:col-span-2'} rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden h-fit`}>
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Jelovnik i normativi ({selectedCategoryFilter})</h2>
              <p className="text-xs text-slate-500">{isCook ? 'Pregled normativa i pripreme jela' : 'Upravljanje cenama, normativima i pripremom'}</p>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">Učitavanje...</div>
            ) : filteredRecipes.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">Nema recepata u ovoj kategoriji.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredRecipes.map(recipe => {
                  const totalFoodCost = recipe.recipe_items?.reduce((sum, item) => {
                    const pricePerUnit = item.products?.price || 0;
                    return sum + (pricePerUnit * item.quantity);
                  }, 0) || 0;

                  const sellingPrice = recipe.selling_price || 0;
                  const foodCostPercentage = sellingPrice > 0 ? (totalFoodCost / sellingPrice) * 100 : 0;
                  const profitMargin = sellingPrice - totalFoodCost;
                  const customLimit = recipe.target_food_cost ?? 33;
                  const isEditingThis = !isCook && editingRecipeId === recipe.id;

                  return (
                    <div key={recipe.id} className="p-5 space-y-4 hover:bg-slate-50/50">
                      <div className="flex items-start justify-between gap-4">
                        {isEditingThis ? (
                          <div className="flex flex-col gap-2 flex-1 bg-slate-50 p-3 rounded-lg border">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="rounded border px-2 py-1 text-sm font-semibold text-slate-900 bg-white"
                              placeholder="Naziv jela"
                            />
                            <div className="grid grid-cols-3 gap-2">
                              <select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                className="rounded border px-2 py-1 text-xs bg-white"
                              >
                                {categories.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                step="0.01"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="rounded border px-2 py-1 text-xs bg-white"
                                placeholder="Cena"
                              />
                              <input
                                type="number"
                                step="0.1"
                                value={editTargetFC}
                                onChange={(e) => setEditTargetFC(e.target.value)}
                                className="rounded border px-2 py-1 text-xs bg-white"
                                placeholder="Max FC %"
                              />
                            </div>
                            <textarea
                              rows={2}
                              value={editPreparation}
                              onChange={(e) => setEditPreparation(e.target.value)}
                              className="rounded border px-2 py-1 text-xs bg-white"
                              placeholder="Način pripreme..."
                            />
                            <div className="flex items-center gap-2">
                              <label className="flex-1 flex items-center gap-2 px-2 py-1 border border-dashed rounded bg-white text-xs text-slate-600 cursor-pointer">
                                <Upload className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="truncate">{editImageFile ? editImageFile.name : 'Promeni sliku...'}</span>
                                <input type="file" accept="image/*" onChange={(e) => e.target.files && setEditImageFile(e.target.files[0])} className="hidden" />
                              </label>
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button onClick={() => handleSaveRecipeEdit(recipe.id, recipe.image_url)} className="px-3 py-1 rounded bg-emerald-600 text-white text-xs font-semibold">Sačuvaj</button>
                              <button onClick={() => setEditingRecipeId(null)} className="px-3 py-1 rounded bg-slate-200 text-slate-700 text-xs font-semibold">Otkaži</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-4 flex-1">
                            {recipe.image_url ? (
                              <img src={recipe.image_url} alt={recipe.name} className="h-14 w-14 rounded-lg object-cover border border-slate-200 shrink-0" />
                            ) : (
                              <div className="h-14 w-14 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shrink-0">
                                <ImageIcon className="h-6 w-6" />
                              </div>
                            )}
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-slate-900 text-sm">{recipe.name}</h3>
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase border">{recipe.category || 'Glavna jela'}</span>
                                {!isCook && <span className="rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-medium border border-emerald-200">Max FC: {customLimit}%</span>}
                              </div>
                              {!isCook && <p className="text-xs text-slate-500">Prodajna cena: <span className="font-semibold text-slate-700">{sellingPrice} RSD</span></p>}
                              
                              {recipe.preparation && (
                                <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 mt-2 flex items-start gap-1.5">
                                  <BookOpen className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                  <span className="italic">{recipe.preparation}</span>
                                </div>
                              )}
                            </div>
                            {!isCook && (
                              <div className="flex items-center gap-1">
                                <button onClick={() => startEditingRecipe(recipe)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Izmeni">
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDeleteRecipe(recipe.id)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors" title="Obriši">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Normativ po tanjiru:</p>
                          {!isCook && (
                            <button
                              onClick={() => setAddingIngredientToId(addingIngredientToId === recipe.id ? null : recipe.id)}
                              className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" /> Dodaj sastojak
                            </button>
                          )}
                        </div>

                        {!isCook && addingIngredientToId === recipe.id && (
                          <div className="flex items-center gap-2 bg-white p-2 rounded border border-emerald-300 shadow-sm">
                            <select
                              value={selectedProductId}
                              onChange={(e) => setSelectedProductId(e.target.value)}
                              className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                            >
                              {products.map(prod => (
                                <option key={prod.id} value={prod.id}>{prod.name} ({prod.price} RSD/{prod.unit})</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              value={ingredientQuantity}
                              onChange={(e) => setIngredientQuantity(e.target.value)}
                              className="w-20 rounded border border-slate-300 px-2 py-1 text-xs text-center"
                              placeholder="Količina"
                            />
                            <button
                              onClick={() => handleAddIngredientToRecipe(recipe.id)}
                              className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                            >
                              Potvrdi
                            </button>
                          </div>
                        )}

                        {recipe.recipe_items && recipe.recipe_items.length > 0 ? (
                          <div className="space-y-1 pt-1">
                            {recipe.recipe_items.map(ri => (
                              <div key={ri.id} className="flex items-center justify-between text-xs text-slate-700 bg-white px-2 py-1 rounded border border-slate-100">
                                <span>{ri.products?.name} ({ri.quantity} {ri.products?.unit})</span>
                                <div className="flex items-center gap-3">
                                  {!isCook && <span className="font-medium">{(ri.products?.price || 0) * ri.quantity} RSD</span>}
                                  {!isCook && (
                                    <button onClick={() => handleDeleteIngredient(ri.id)} className="text-slate-300 hover:text-rose-600" title="Ukloni sastojak">
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic py-1">Nema unesenih sastojaka.</p>
                        )}
                      </div>

                      {!isCook && (
                        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                          <div>
                            <p className="text-[10px] uppercase font-medium text-slate-400">Nabavni trošak</p>
                            <p className="text-sm font-bold text-slate-900">{totalFoodCost.toFixed(2)} RSD</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-medium text-slate-400">Food Cost % (Limit: {customLimit}%)</p>
                            <p className={`text-sm font-bold ${
                              sellingPrice === 0 ? 'text-slate-400' :
                              foodCostPercentage > customLimit ? 'text-rose-600' : 'text-emerald-600'
                            }`}>
                              {sellingPrice > 0 ? `${foodCostPercentage.toFixed(1)}%` : '0%'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-medium text-slate-400">Profit po tanjiru</p>
                            <p className="text-sm font-bold text-slate-900">{profitMargin.toFixed(2)} RSD</p>
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
      </main>
    </div>
  );
}