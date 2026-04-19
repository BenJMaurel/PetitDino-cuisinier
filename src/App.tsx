/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBasket, 
  ChevronRight, 
  Trash2, 
  Users, 
  CheckCircle2, 
  Circle,
  X,
  Plus,
  Minus,
  Check,
  Edit,
  Upload
} from 'lucide-react';

interface Ingredient {
  id: number;
  name: string;
  quantity: number;
  unit: string;
}

interface Recipe {
  id: number;
  name: string;
  base_portions: number;
  instructions?: string;
  image_url?: string;
  ingredients: Ingredient[];
}

interface Selection {
  recipeId: number;
  desiredPortions: number;
}

interface AggregatedIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export default function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [groceryList, setGroceryList] = useState<AggregatedIngredient[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [viewingInstructions, setViewingInstructions] = useState<Recipe | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    try {
      const response = await fetch('/api/recipes');
      const data = await response.json();
      setRecipes(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching recipes:', error);
      setLoading(false);
    }
  };

  const handleToggleSelection = (recipe: Recipe) => {
    setSelections(prev => {
      const exists = prev.find(s => s.recipeId === recipe.id);
      if (exists) {
        return prev.filter(s => s.recipeId !== recipe.id);
      } else {
        return [...prev, { recipeId: recipe.id, desiredPortions: recipe.base_portions }];
      }
    });
  };

  const updatePortions = (recipeId: number, delta: number) => {
    setSelections(prev => prev.map(s => {
      if (s.recipeId === recipeId) {
        const newVal = Math.max(1, s.desiredPortions + delta);
        return { ...s, desiredPortions: newVal };
      }
      return s;
    }));
  };

  const generateGroceryList = async () => {
    if (selections.length === 0) return;
    setGenerating(true);
    setIsSidebarOpen(true);
    try {
      const response = await fetch('/api/generate-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedRecipes: selections })
      });
      const data = await response.json();
      setGroceryList(data);
      setCheckedItems(new Set());
    } catch (error) {
      console.error('Error generating list:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateRecipe = async (updatedRecipe: Recipe) => {
    try {
      const response = await fetch(`/api/recipes/${updatedRecipe.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRecipe)
      });
      if (response.ok) {
        await fetchRecipes();
        setEditingRecipe(null);
      }
    } catch (error) {
      console.error('Error updating recipe:', error);
    }
  };

  const handleCreateRecipe = async (newRecipe: Omit<Recipe, 'id'>) => {
    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecipe)
      });
      if (response.ok) {
        await fetchRecipes();
        setIsCreateModalOpen(false);
      }
    } catch (error) {
      console.error('Error creating recipe:', error);
    }
  };

  const toggleItemCheck = (itemName: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemName)) {
        next.delete(itemName);
      } else {
        next.add(itemName);
      }
      return next;
    });
  };

  const totalRecipesSelected = selections.length;
  const totalPortions = selections.reduce((sum, s) => sum + s.desiredPortions, 0);

  return (
    <div className="min-h-screen bg-page-bg font-sans text-ink selection:bg-primary/20">
      {/* Header */}
      <header className="h-[70px] bg-white border-b-3 border-primary px-8 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2 text-2xl font-black text-primary uppercase italic">
          {/* Custom Dino Logo */}
          <img src="/dino.png" alt="Icône Dino" className="h-10 w-auto" /> 
          <span>LePetitDino cuisinier</span>
        </div>
        
        <div className="hidden md:block text-xs font-bold uppercase tracking-widest text-ink-light">
          Planificateur • {recipes.length} Recettes Disponibles
        </div>

        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="md:hidden p-2 text-primary bg-primary/10 rounded-xl"
        >
          <ShoppingBasket size={24} />
        </button>
      </header>

      <main className="max-w-[1400px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-3xl font-extrabold tracking-tight">Choisi tes <span className="text-primary italic">Recettes</span></h2>
              <p className="text-ink-light text-sm max-w-lg">Choisi tes recettes pour la semaine et on s'occupe des courses !</p>
            </div>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="px-6 py-3 bg-stone-900 text-white rounded-2xl font-black uppercase text-sm shadow-[0_4px_0_var(--color-ink)] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Plus size={18} />
              Nouvelle Recette
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {recipes.map((recipe) => {
                const selection = selections.find(s => s.recipeId === recipe.id);
                const isSelected = !!selection;

                return (
                  <motion.div
                    key={recipe.id}
                    layout
                    whileHover={{ scale: 1.02 }}
                    className={`recipe-card flex flex-col bg-white rounded-[24px] border-2 p-5 gap-3 shadow-[0_4px_0_var(--color-border-subtle)] transition-all ${
                      isSelected 
                        ? 'border-secondary bg-[#F0FFF9] shadow-[0_4px_0_var(--color-secondary)]' 
                        : 'border-border-subtle'
                    }`}
                  >
                    <div className="relative h-32 bg-stone-100 rounded-[16px] flex items-center justify-center text-4xl overflow-hidden group">
                      {/* Image affichée OU Dino si pas d'image */}
                      {recipe.image_url ? (
                        <img 
                          src={recipe.image_url} 
                          alt={recipe.name} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <img 
                          src="/dino.png" 
                          alt="Dino Placeholder" 
                          className="h-24 w-auto object-contain opacity-30 transition-transform duration-500 group-hover:scale-110" 
                        />
                      )}
                      <button 
                        onClick={() => handleToggleSelection(recipe)}
                        className={`absolute top-2 left-2 w-9 h-9 rounded-[8px] border-2 flex items-center justify-center transition-all z-10 pointer-events-auto ${
                          isSelected 
                            ? 'bg-primary border-primary text-white shadow-lg' 
                            : 'bg-white border-primary text-primary hover:bg-primary/5 shadow-sm opacity-100'
                        }`}
                        title={isSelected ? "Retirer du plan" : "Ajouter au plan"}
                      >
                        {isSelected ? <Check size={20} strokeWidth={3} /> : <Plus size={20} />}
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRecipe(recipe);
                        }}
                        className="absolute top-2 right-2 p-2 bg-white/80 hover:bg-white text-ink-light hover:text-primary rounded-xl transition-all shadow-sm opacity-100 pointer-events-auto"
                        title="Modifier la recette"
                      >
                        <Edit size={18} />
                      </button>
                    </div>

                    <div className="recipe-info">
                      <h3 className="text-lg font-bold leading-tight">{recipe.name}</h3>
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-ink-light">
                          Base: {recipe.base_portions} Portions
                        </div>
                        {recipe.instructions && (
                          <button 
                            onClick={() => setViewingInstructions(recipe)}
                            className="text-[10px] font-black uppercase tracking-tighter text-primary border-b border-primary/30 hover:border-primary transition-all"
                          >
                            Voir les étapes
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-start mt-auto">
                      <div className={`flex items-center bg-[#F0F0F0] rounded-[12px] p-1 gap-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <button 
                          onClick={() => updatePortions(recipe.id, -1)}
                          className="w-7 h-7 bg-white rounded-[6px] flex items-center justify-center font-bold text-ink hover:text-primary"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="font-bold text-sm min-w-[24px] text-center">{selection?.desiredPortions}</span>
                        <button 
                          onClick={() => updatePortions(recipe.id, 1)}
                          className="w-7 h-7 bg-white rounded-[6px] flex items-center justify-center font-bold text-ink hover:text-primary"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Persistent Side Panel (Desktop) / Sliding Tray (Mobile) */}
        <div className="hidden lg:block h-[calc(100vh-120px)] sticky top-24">
          <aside className="h-full bg-white rounded-[32px] border-2 border-border-subtle flex flex-col overflow-hidden shadow-xl">
            <div className="panel-header p-6 bg-accent">
              <h2 className="text-xl font-black tracking-tight text-white">Liste de courses</h2>
              {selections.length > 0 ? (
                <p className="text-xs font-bold opacity-80 mt-1 uppercase tracking-wider text-white">
                  {selections.length} Recettes • {totalPortions} Portions au Total
                </p>
              ) : (
                <p className="text-xs font-bold opacity-80 mt-1 uppercase tracking-wider text-white">Commence par choisir tes recettes pardi</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {groceryList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
                  <ShoppingBasket size={80} strokeWidth={1} />
                  <p className="mt-4 font-bold uppercase tracking-widest text-sm">Courses vides...</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {groceryList.map((item, idx) => {
                    const isChecked = checkedItems.has(item.name);
                    return (
                      <li 
                        key={`${item.name}-${idx}`}
                        className={`flex items-center gap-3 py-3 border-b border-dashed border-border-subtle transition-opacity cursor-pointer ${isChecked ? 'opacity-40' : ''}`}
                        onClick={() => toggleItemCheck(item.name)}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isChecked ? 'bg-ink-light' : 'bg-secondary'}`} />
                        <div className={`flex-1 text-sm font-medium ${isChecked ? 'line-through' : ''}`}>
                          {item.name}
                        </div>
                        <div className="text-xs font-bold text-ink-light bg-stone-100 px-2 py-0.5 rounded-md">
                          {item.quantity}{item.unit}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="p-5 bg-[#FAFAFA] border-t border-stone-100">
              <button 
                onClick={generateGroceryList}
                disabled={generating || selections.length === 0}
                className="w-full bg-primary text-white p-4 rounded-[16px] font-black text-lg uppercase shadow-[0_4px_0_var(--color-ink)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generating && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {groceryList.length > 0 ? 'Mettre à jour la liste' : 'Générer la liste'}
              </button>
            </div>
          </aside>
        </div>
      </main>

      {/* Floating Button for Mobile Generate */}
      {totalRecipesSelected > 0 && (
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-48px)]">
          <button
            onClick={generateGroceryList}
            className="w-full bg-primary text-white py-4 rounded-[16px] shadow-2xl font-black text-lg uppercase shadow-[0_4px_0_var(--color-ink)] flex items-center justify-center gap-3"
          >
             <ShoppingBasket size={24} />
             Planifier {totalRecipesSelected} Repas
          </button>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[50]"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-[60] flex flex-col shadow-2xl"
            >
               <div className="panel-header p-6 bg-accent flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-white">Liste de courses</h2>
                  <p className="text-xs font-bold opacity-80 mt-1 uppercase tracking-wider text-white">
                    {totalPortions} Portions au Total
                  </p>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-black/5 rounded-full text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                 {groceryList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                      <ShoppingBasket size={64} />
                      <p className="mt-4 font-bold uppercase tracking-widest text-sm text-ink-light">Plan vide</p>
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {groceryList.map((item, idx) => (
                        <li 
                          key={`${item.name}-${idx}`}
                          onClick={() => toggleItemCheck(item.name)}
                          className={`flex items-center gap-3 py-4 border-b border-dashed border-border-subtle cursor-pointer transition-opacity ${checkedItems.has(item.name) ? 'opacity-40' : ''}`}
                        >
                          <div className={`w-2 h-2 rounded-full shrink-0 ${checkedItems.has(item.name) ? 'bg-ink-light' : 'bg-secondary'}`} />
                          <div className={`flex-1 text-sm font-bold ${checkedItems.has(item.name) ? 'line-through' : ''}`}>
                            {item.name}
                          </div>
                          <div className="text-xs font-black text-ink-light opacity-60">
                            {item.quantity}{item.unit}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>

              <div className="p-6 bg-stone-50 border-t border-stone-200">
                  <button 
                    onClick={() => {
                      setGroceryList([]);
                      setSelections([]);
                      setIsSidebarOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-white border-2 border-border-subtle rounded-xl font-bold text-ink-light hover:bg-stone-100 transition-colors"
                  >
                    <Trash2 size={18} />
                    Réinitialiser la liste
                  </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCreateModalOpen && (
          <RecipeFormModal 
            title="Nouvelle Recette"
            onClose={() => setIsCreateModalOpen(false)} 
            onSave={(data) => handleCreateRecipe(data as Omit<Recipe, 'id'>)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingRecipe && (
          <RecipeFormModal 
            title="Modifier Recette"
            initialData={editingRecipe} 
            onClose={() => setEditingRecipe(null)} 
            onSave={(data) => handleUpdateRecipe({ ...data, id: editingRecipe.id } as Recipe)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingInstructions && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingInstructions(null)}
              className="fixed inset-0 bg-stone-900/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 bg-secondary text-white flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-2xl font-black italic uppercase tracking-tight">Instructions</h2>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-70">{viewingInstructions.name}</p>
                </div>
                <button onClick={() => setViewingInstructions(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={24} /></button>
              </div>
              <div className="p-8 overflow-y-auto">
                <div className="whitespace-pre-wrap font-medium leading-relaxed text-ink/80 text-sm">
                  {viewingInstructions.instructions || "Aucune instruction pour cette recette."}
                </div>
              </div>
              <div className="p-6 bg-stone-50 border-t border-stone-100 shrink-0">
                <button 
                  onClick={() => setViewingInstructions(null)}
                  className="w-full p-4 bg-white border-2 border-border-subtle rounded-2xl font-black uppercase text-ink-light hover:bg-stone-100 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RecipeFormModal({ 
  title,
  initialData, 
  onClose, 
  onSave 
}: { 
  title: string;
  initialData?: Recipe; 
  onClose: () => void; 
  onSave: (recipe: Recipe | Omit<Recipe, 'id'>) => Promise<void> 
}) {
  const [formData, setFormData] = useState<Recipe | Omit<Recipe, 'id'>>(
    initialData 
      ? { ...initialData, ingredients: [...initialData.ingredients], instructions: initialData.instructions || '', image_url: initialData.image_url || '' } 
      : { name: '', base_portions: 2, ingredients: [], instructions: '', image_url: '' }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileFormData = new FormData();
    fileFormData.append('image', file);

    setUploading(true);
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: fileFormData,
      });

      if (response.ok) {
        const data = await response.json();
        setFormData({ ...formData, image_url: data.imageUrl });
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Erreur lors du téléchargement');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Erreur lors du téléchargement');
    } finally {
      setUploading(false);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Le nom est requis';
    if (formData.base_portions < 1) newErrors.portions = 'Minimum 1 portion';
    
    formData.ingredients.forEach((ing, idx) => {
      if (!ing.name.trim()) newErrors[`ing-${idx}-name`] = 'Requis';
      if (ing.quantity <= 0) newErrors[`ing-${idx}-qty`] = ' > 0';
      if (!ing.unit.trim()) newErrors[`ing-${idx}-unit`] = 'Requis';
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const addIngredient = () => {
    setFormData({
      ...formData,
      ingredients: [...formData.ingredients, { id: -Date.now(), name: '', quantity: 1, unit: 'unit' }]
    });
  };

  const removeIngredient = (idx: number) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== idx)
    });
  };

  const updateIngredient = (idx: number, field: keyof Ingredient, value: string | number) => {
    const newIngs = [...formData.ingredients];
    newIngs[idx] = { ...newIngs[idx], [field]: value } as Ingredient;
    setFormData({ ...formData, ingredients: newIngs });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-stone-900/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 bg-accent flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tight text-white">{title}</h2>
            <p className="text-xs font-bold uppercase tracking-widest opacity-70 text-white">Personnalise ton repas</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full text-white"><X size={24} /></button>
        </div>

        <div className="p-8 overflow-y-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-ink-light">Nom de la recette</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full p-4 bg-stone-100 rounded-2xl border-2 font-bold focus:outline-none focus:border-primary transition-colors ${errors.name ? 'border-primary' : 'border-transparent'}`}
                placeholder="Ex: Pâtes Carbonara"
              />
              {errors.name && <p className="text-[10px] text-primary font-bold uppercase">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-ink-light">Image de la recette</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="flex-1 p-4 bg-stone-100 rounded-2xl border-2 border-transparent font-bold focus:outline-none focus:border-primary transition-colors text-xs"
                  placeholder="URL (Unsplash, etc.)"
                />
                <label className="shrink-0 flex items-center justify-center p-4 bg-secondary text-white rounded-2xl cursor-pointer hover:bg-secondary/80 transition-all shadow-sm">
                  {uploading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Upload size={18} />
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-ink-light">Portions de base</label>
              <input 
                type="number" 
                value={formData.base_portions}
                onChange={(e) => setFormData({ ...formData, base_portions: parseInt(e.target.value) || 0 })}
                className={`w-full p-4 bg-stone-100 rounded-2xl border-2 font-bold focus:outline-none focus:border-primary transition-colors ${errors.portions ? 'border-primary' : 'border-transparent'}`}
              />
              {errors.portions && <p className="text-[10px] text-primary font-bold uppercase">{errors.portions}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-ink-light">Instructions de cuisson</label>
            <textarea 
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              rows={4}
              className="w-full p-4 bg-stone-100 rounded-2xl border-2 border-transparent font-medium text-sm focus:outline-none focus:border-primary transition-colors resize-none"
              placeholder="1. Faire bouillir l'eau...&#10;2. Ajouter les pâtes..."
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-ink-light">Ingrédients</label>
              <button 
                onClick={addIngredient}
                className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-secondary hover:text-secondary/80"
              >
                <Plus size={16} /> Ajouter
              </button>
            </div>

            <div className="space-y-3">
              {formData.ingredients.map((ing, idx) => (
                <div key={ing.id} className="flex gap-3 items-start">
                  <div className="flex-1 space-y-1">
                    <input 
                      type="text"
                      value={ing.name}
                      onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                      placeholder="Nom de l'ingrédient"
                      className={`w-full p-3 bg-stone-50 rounded-xl border border-border-subtle text-sm font-semibold focus:border-primary focus:outline-none ${errors[`ing-${idx}-name`] ? 'border-primary' : ''}`}
                    />
                  </div>
                  <div className="w-20 space-y-1">
                     <input 
                      type="number"
                      value={ing.quantity}
                      onChange={(e) => updateIngredient(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      placeholder="Qté"
                      className={`w-full p-3 bg-stone-50 rounded-xl border border-border-subtle text-sm font-semibold focus:border-primary focus:outline-none ${errors[`ing-${idx}-qty`] ? 'border-primary' : ''}`}
                    />
                  </div>
                  <div className="w-20 space-y-1">
                     <input 
                      type="text"
                      value={ing.unit}
                      onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                      placeholder="Unité"
                      className={`w-full p-3 bg-stone-50 rounded-xl border border-border-subtle text-sm font-semibold focus:border-primary focus:outline-none ${errors[`ing-${idx}-unit`] ? 'border-primary' : ''}`}
                    />
                  </div>
                  <button 
                    onClick={() => removeIngredient(idx)}
                    className="p-3 text-ink-light hover:text-primary transition-colors"
                    title="Remove Ingredient"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
              {formData.ingredients.length === 0 && (
                <p className="text-center py-8 text-stone-300 font-bold uppercase tracking-widest text-xs border-2 border-dashed border-stone-100 rounded-2xl">Aucun ingrédient</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-8 bg-stone-50 border-t border-stone-100 flex gap-4 shrink-0">
          <button 
            onClick={onClose}
            className="flex-1 p-4 bg-white border-2 border-border-subtle rounded-2xl font-black uppercase text-ink-light hover:bg-stone-100 transition-colors"
          >
            Annuler
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 p-4 bg-primary text-white rounded-2xl font-black uppercase shadow-[0_4px_0_var(--color-ink)] hover:shadow-none translate-y-0 active:translate-y-1 transition-all"
          >
            Sauvegarder
          </button>
        </div>
      </motion.div>
    </div>
  );
}