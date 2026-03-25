import { useState, useEffect, useMemo } from 'react';
import {
  useCategoryTree, useAllProducts, useProduct,
  useCreateProduct, useUpdateProduct, useCreateCategory, useUpdateCategory,
  useModifierGroups,
} from '../hooks/useProducts';
import {
  FilePlus, Save, Search, Trash2, X, Plus, Edit2, Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProductsPage() {
  // ── Data hooks ──
  const { data: categoryTree } = useCategoryTree();
  const { data: allProducts } = useAllProducts();
  const { data: modifierGroups } = useModifierGroups();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  // ── Filters ──
  const [filterGrupo, setFilterGrupo] = useState('');
  const [filterSubgrupo, setFilterSubgrupo] = useState('');
  const [filterEstado, setFilterEstado] = useState<'activos' | 'suspendidos' | 'todos'>('activos');
  const [searchText, setSearchText] = useState('');

  // ── Selection & editing ──
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);
  const { data: productDetail } = useProduct(selectedId);

  // ── Tabs ──
  const [activeTab, setActiveTab] = useState<'principal' | 'comentarios' | 'compuesto'>('principal');

  // ── Form fields ──
  const [fName, setFName] = useState('');
  const [fDescription, setFDescription] = useState('');
  const [fGrupo, setFGrupo] = useState('');
  const [fSubgrupo, setFSubgrupo] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fTaxRate, setFTaxRate] = useState('0.16');
  const [fIsAvailable, setFIsAvailable] = useState(true);
  const [fIsComposite, setFIsComposite] = useState(false);
  const [fPrinterTarget, setFPrinterTarget] = useState('');
  const [fLinkedGroups, setFLinkedGroups] = useState<Record<number, { linked: boolean; is_forced: boolean }>>({});

  // ── Inline add grupo/subgrupo ──
  const [showAddGrupo, setShowAddGrupo] = useState(false);
  const [addGrupoDep, setAddGrupoDep] = useState('');
  const [addGrupoName, setAddGrupoName] = useState('');
  const [showAddSubgrupo, setShowAddSubgrupo] = useState(false);
  const [addSubgrupoGrupo, setAddSubgrupoGrupo] = useState('');
  const [addSubgrupoName, setAddSubgrupoName] = useState('');

  // ── Derived: all grupos (top-level categories) ──
  const allGrupos = useMemo(() => {
    if (!categoryTree) return [];
    return categoryTree;
  }, [categoryTree]);

  // ── Derived: subgrupos of selected form grupo ──
  const formSubgrupos = useMemo(() => {
    if (!fGrupo || !categoryTree) return [];
    const grupo = categoryTree.find((c: any) => c.id === Number(fGrupo));
    return grupo?.children || [];
  }, [categoryTree, fGrupo]);

  // ── Derived: subgrupos for filter ──
  const filterSubgrupos = useMemo(() => {
    if (!filterGrupo || !categoryTree) return [];
    const grupo = categoryTree.find((c: any) => c.id === Number(filterGrupo));
    return grupo?.children || [];
  }, [categoryTree, filterGrupo]);

  // ── Derived: map category_id → grupo info ──
  const grupoMap = useMemo(() => {
    const map: Record<number, { id: number; name: string }> = {};
    if (!categoryTree) return map;
    for (const g of categoryTree) {
      map[g.id] = { id: g.id, name: g.name };
      for (const s of g.children || []) {
        map[s.id] = { id: g.id, name: g.name };
      }
    }
    return map;
  }, [categoryTree]);

  // ── Derived: filtered products ──
  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    let list = allProducts;

    if (filterEstado === 'activos') list = list.filter((p: any) => p.is_available);
    else if (filterEstado === 'suspendidos') list = list.filter((p: any) => !p.is_available);

    if (filterGrupo) {
      const gId = Number(filterGrupo);
      list = list.filter((p: any) => grupoMap[p.category_id]?.id === gId);
    }
    if (filterSubgrupo) {
      const sId = Number(filterSubgrupo);
      list = list.filter((p: any) => p.category_id === sId);
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter((p: any) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [allProducts, filterEstado, filterGrupo, filterSubgrupo, searchText, grupoMap]);

  const activeCount = allProducts?.filter((p: any) => p.is_available).length || 0;
  const suspendedCount = allProducts?.filter((p: any) => !p.is_available).length || 0;

  // ── Derived: price without tax ──
  const priceWithoutTax = useMemo(() => {
    const p = parseFloat(fPrice);
    const r = parseFloat(fTaxRate);
    if (isNaN(p) || isNaN(r)) return '';
    return (p / (1 + r)).toFixed(2);
  }, [fPrice, fTaxRate]);


  // ── Find category path for a product ──
  const findCategoryPath = (catId: number) => {
    if (!categoryTree) return { grupoId: '', subId: '' };
    // Check if it's a top-level grupo
    const asGrupo = categoryTree.find((c: any) => c.id === catId);
    if (asGrupo) return { grupoId: String(asGrupo.id), subId: '' };
    // Check if it's a subgrupo (child of a grupo)
    for (const g of categoryTree) {
      const sub = g.children?.find((c: any) => c.id === catId);
      if (sub) return { grupoId: String(g.id), subId: String(sub.id) };
    }
    return { grupoId: '', subId: '' };
  };

  // ── Populate form when selecting a product ──
  const selectProduct = (p: any) => {
    setSelectedId(p.id);
    setIsNew(false);
    setFName(p.name);
    setFDescription(p.description || '');
    const { grupoId, subId } = findCategoryPath(p.category_id);
    setFGrupo(grupoId);
    setFSubgrupo(subId);
    setFPrice(String(p.price));
    setFTaxRate(String(p.tax_rate ?? 0.16));
    setFIsAvailable(p.is_available);
    setFIsComposite(p.is_composite || false);
    setFPrinterTarget(p.printer_target || '');
    setFLinkedGroups({});
    setActiveTab('principal');
  };

  // ── Populate modifier links from detail ──
  useEffect(() => {
    if (productDetail && selectedId && !isNew) {
      const links: Record<number, { linked: boolean; is_forced: boolean }> = {};
      productDetail.modifier_groups?.forEach((mg: any) => {
        links[mg.id] = { linked: true, is_forced: mg.is_forced || false };
      });
      setFLinkedGroups(links);
    }
  }, [productDetail, selectedId, isNew]);

  // ── Handlers ──
  const handleNew = () => {
    setSelectedId(null);
    setIsNew(true);
    setFName('');
    setFDescription('');
    setFGrupo('');
    setFSubgrupo('');
    setFPrice('');
    setFTaxRate('0.16');
    setFIsAvailable(true);
    setFIsComposite(false);
    setFPrinterTarget('');
    setFLinkedGroups({});
    setActiveTab('principal');
  };

  const getCategoryId = () => {
    if (fSubgrupo) return parseInt(fSubgrupo);
    if (fGrupo) return parseInt(fGrupo);
    return 0;
  };

  const handleSave = () => {
    const categoryId = getCategoryId();
    if (!fName || !fPrice || !categoryId) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    const linkedMGs = Object.entries(fLinkedGroups)
      .filter(([, v]) => v.linked)
      .map(([gId, v], idx) => ({ group_id: parseInt(gId), is_forced: v.is_forced, sort_order: idx }));

    const data: any = {
      name: fName,
      price: parseFloat(fPrice),
      tax_rate: parseFloat(fTaxRate),
      category_id: categoryId,
      is_available: fIsAvailable,
      is_composite: fIsComposite,
      description: fDescription || undefined,
      printer_target: fPrinterTarget || undefined,
      modifier_groups: fIsComposite ? linkedMGs : undefined,
    };

    if (isNew) {
      createProduct.mutate(data, {
        onSuccess: (created: any) => {
          toast.success('Producto creado');
          setIsNew(false);
          setSelectedId(created.id);
        },
      });
    } else if (selectedId) {
      updateProduct.mutate({ id: selectedId, ...data }, {
        onSuccess: () => toast.success('Producto guardado'),
      });
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    if (!confirm('Suspender este producto?')) return;
    updateProduct.mutate({ id: selectedId, is_available: false }, {
      onSuccess: () => {
        toast.success('Producto suspendido');
        setSelectedId(null);
      },
    });
  };

  const handleSaveGrupo = () => {
    if (!addGrupoName) return;
    createCategory.mutate({
      name: addGrupoName,
      color: '#6366F1',
      printer_target: 'kitchen',
    }, {
      onSuccess: () => {
        toast.success('Grupo creado');
        setAddGrupoName('');
        setShowAddGrupo(false);
      },
    });
  };

  const handleSaveSubgrupo = () => {
    const parentGrupo = addSubgrupoGrupo || fGrupo;
    if (!addSubgrupoName || !parentGrupo) return;
    const grupo = categoryTree?.find((c: any) => c.id === Number(parentGrupo));
    createCategory.mutate({
      name: addSubgrupoName,
      parent_id: parseInt(parentGrupo),
      color: grupo?.color || '#6366F1',
      printer_target: grupo?.printer_target || 'kitchen',
    }, {
      onSuccess: () => {
        toast.success('Subgrupo creado');
        setAddSubgrupoName('');
        setAddSubgrupoGrupo('');
        setShowAddSubgrupo(false);
      },
    });
  };

  const toggleLink = (gId: number) => {
    setFLinkedGroups(prev => {
      if (prev[gId]?.linked) { const n = { ...prev }; delete n[gId]; return n; }
      return { ...prev, [gId]: { linked: true, is_forced: false } };
    });
  };
  const toggleForced = (gId: number) => {
    setFLinkedGroups(prev => ({ ...prev, [gId]: { ...prev[gId], is_forced: !prev[gId]?.is_forced } }));
  };

  const hasForm = isNew || selectedId !== null;

  // ── Render ──
  return (
    <div className="h-full flex flex-col">
      {/* ═══ Filter Bar ═══ */}
      <div className="shrink-0 bg-orange-50 border-b border-orange-200 px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <label className="flex items-center gap-1.5 font-medium">
            Grupo
            <select value={filterGrupo} onChange={e => { setFilterGrupo(e.target.value); setFilterSubgrupo(''); }}
              className="border border-orange-300 rounded px-2 py-1 text-sm bg-white min-w-[140px]">
              <option value="">(TODOS)</option>
              {allGrupos.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 font-medium">
            Subgrupo
            <select value={filterSubgrupo} onChange={e => setFilterSubgrupo(e.target.value)}
              disabled={!filterSubgrupos.length}
              className="border border-orange-300 rounded px-2 py-1 text-sm bg-white min-w-[140px] disabled:opacity-50">
              <option value="">(TODOS)</option>
              {filterSubgrupos.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <span className="text-gray-600">Activos: <b>{activeCount}</b></span>
          <label className="flex items-center gap-1.5 font-medium">
            Estado
            <select value={filterEstado} onChange={e => setFilterEstado(e.target.value as any)}
              className="border border-orange-300 rounded px-2 py-1 text-sm bg-white">
              <option value="activos">ACTIVOS</option>
              <option value="suspendidos">SUSPENDIDOS</option>
              <option value="todos">TODOS</option>
            </select>
          </label>
          <span className="text-gray-600">Suspendidos: <b>{suspendedCount}</b></span>
          <div className="flex items-center gap-1 ml-auto">
            <Search size={14} className="text-gray-400" />
            <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
              className="border border-orange-300 rounded px-2 py-1 text-sm bg-white w-40" placeholder="Buscar..." />
          </div>
        </div>
      </div>

      {/* ═══ Toolbar ═══ */}
      <div className="shrink-0 bg-gradient-to-b from-orange-100 to-orange-50 border-b border-orange-300 px-2 py-1 flex gap-1">
        {[
          { label: 'Nuevo', icon: FilePlus, action: handleNew },
          { label: 'Guardar', icon: Save, action: handleSave, disabled: !hasForm },
          { label: 'Eliminar', icon: Trash2, action: handleDelete, disabled: !selectedId || isNew },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action} disabled={btn.disabled}
            className="flex flex-col items-center px-4 py-1.5 rounded hover:bg-orange-200 active:bg-orange-300 transition-colors disabled:opacity-40 disabled:hover:bg-transparent min-w-[60px]">
            <btn.icon size={22} className="text-orange-800" />
            <span className="text-xs font-medium text-orange-900 mt-0.5">{btn.label}</span>
          </button>
        ))}
        {/* Separator */}
        <div className="w-px bg-orange-300 mx-1 self-stretch" />
        <button onClick={() => { setAddGrupoDep(''); setAddGrupoName(''); setShowAddGrupo(true); }}
          className="flex flex-col items-center px-4 py-1.5 rounded hover:bg-orange-200 active:bg-orange-300 transition-colors min-w-[60px]">
          <Plus size={22} className="text-orange-800" />
          <span className="text-xs font-medium text-orange-900 mt-0.5">Grupo</span>
        </button>
        <button onClick={() => { setAddSubgrupoGrupo(''); setAddSubgrupoName(''); setShowAddSubgrupo(true); }}
          className="flex flex-col items-center px-4 py-1.5 rounded hover:bg-orange-200 active:bg-orange-300 transition-colors min-w-[60px]">
          <Plus size={22} className="text-orange-800" />
          <span className="text-xs font-medium text-orange-900 mt-0.5">Subgrupo</span>
        </button>
      </div>

      {/* ═══ Main Split ═══ */}
      <div className="flex-1 flex min-h-0">
        {/* ─── Left: Product Table ─── */}
        <div className="w-[42%] flex flex-col border-r border-orange-200">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-orange-100 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-2 py-1.5 border-b border-r border-orange-300 font-semibold w-[60px]">Clave</th>
                  <th className="text-left px-2 py-1.5 border-b border-r border-orange-300 font-semibold w-[50px]">Grupo</th>
                  <th className="text-left px-2 py-1.5 border-b border-r border-orange-300 font-semibold">Descripción</th>
                  <th className="text-right px-2 py-1.5 border-b border-orange-300 font-semibold w-[80px]">Precio</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p: any) => {
                  const isSelected = p.id === selectedId;
                  const gInfo = grupoMap[p.category_id];
                  return (
                    <tr key={p.id} onClick={() => selectProduct(p)}
                      className={`cursor-pointer border-b border-gray-100 ${isSelected ? 'bg-orange-400 text-white' : 'hover:bg-orange-50'} ${!p.is_available ? 'opacity-60' : ''}`}>
                      <td className="px-2 py-1 border-r border-gray-100 font-mono text-xs">
                        {String(p.id).padStart(5, '0')}
                      </td>
                      <td className="px-2 py-1 border-r border-gray-100 text-xs">
                        {gInfo ? String(gInfo.id).padStart(2, '0') : '--'}
                      </td>
                      <td className="px-2 py-1 border-r border-gray-100 truncate max-w-0">
                        {p.name}
                        {p.is_composite && <Layers size={12} className="inline ml-1 opacity-70" />}
                      </td>
                      <td className="px-2 py-1 text-right font-mono">${parseFloat(p.price).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Right: Edit Panel ─── */}
        <div className="w-[58%] flex flex-col bg-white">
          {!hasForm ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <p>Selecciona un producto o haz clic en Nuevo</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b border-orange-200 bg-gray-50 shrink-0">
                {([
                  ['principal', 'Principal / Varios'],
                  ['comentarios', 'Comentarios de preparación'],
                  ['compuesto', 'Producto compuesto'],
                ] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setActiveTab(key)}
                    className={`px-4 py-2 text-sm font-medium border-r border-orange-200 transition-colors
                      ${activeTab === key ? 'bg-orange-100 text-orange-900 border-b-2 border-b-orange-500' : 'text-gray-600 hover:bg-orange-50'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-auto p-4">
                {/* ── Tab: Principal ── */}
                {activeTab === 'principal' && (
                  <div className="grid grid-cols-[110px_1fr] gap-y-3 gap-x-3 items-center text-sm max-w-lg">
                    <label className="font-medium text-right">Grupo</label>
                    <div className="flex gap-1 items-center">
                      <select value={fGrupo} onChange={e => { setFGrupo(e.target.value); setFSubgrupo(''); }}
                        className="border rounded px-2 py-1.5 text-sm flex-1 min-w-0">
                        <option value="">Seleccionar</option>
                        {allGrupos.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      <button onClick={() => setShowAddGrupo(true)}
                        className="w-7 h-7 flex items-center justify-center bg-orange-400 hover:bg-orange-500 text-white rounded shrink-0">
                        <Plus size={14} />
                      </button>
                    </div>

                    <label className="font-medium text-right">Subgrupo</label>
                    <div className="flex gap-1 items-center">
                      <select value={fSubgrupo} onChange={e => setFSubgrupo(e.target.value)}
                        disabled={!formSubgrupos.length}
                        className="border rounded px-2 py-1.5 text-sm flex-1 min-w-0 disabled:opacity-50">
                        <option value="">(sin subgrupo)</option>
                        {formSubgrupos.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <button onClick={() => { if (fGrupo) setShowAddSubgrupo(true); else toast.error('Selecciona un grupo primero'); }}
                        className="w-7 h-7 flex items-center justify-center bg-orange-400 hover:bg-orange-500 text-white rounded shrink-0">
                        <Plus size={14} />
                      </button>
                    </div>

                    <label className="font-medium text-right">Clave</label>
                    <input type="text" value={selectedId ? String(selectedId).padStart(5, '0') : '(nuevo)'} readOnly
                      className="border rounded px-2 py-1.5 text-sm bg-gray-50 text-gray-500 w-28" />

                    <label className="font-medium text-right">Descripción</label>
                    <input type="text" value={fName} onChange={e => setFName(e.target.value)}
                      className="border rounded px-2 py-1.5 text-sm" placeholder="Nombre del producto" />

                    <label className="font-medium text-right">Precio</label>
                    <div className="flex items-center gap-3">
                      <input type="number" value={fPrice} onChange={e => setFPrice(e.target.value)}
                        className="border rounded px-2 py-1.5 text-sm w-28" placeholder="0.00" step="0.01" min="0" />
                      <span className="text-xs text-gray-500">Precio sin imp.:</span>
                      <input type="text" value={priceWithoutTax} readOnly
                        className="border rounded px-2 py-1.5 text-sm bg-gray-50 text-gray-500 w-24" placeholder="—" />
                    </div>

                    <label className="font-medium text-right">IVA</label>
                    <div className="flex items-center gap-2">
                      <select value={fTaxRate} onChange={e => setFTaxRate(e.target.value)}
                        className="border rounded px-2 py-1.5 text-sm w-24">
                        <option value="0">0%</option>
                        <option value="0.08">8%</option>
                        <option value="0.16">16%</option>
                      </select>
                      <label className="flex items-center gap-1.5 text-xs text-gray-600">
                        <input type="checkbox" checked={fTaxRate === '0'}
                          onChange={e => setFTaxRate(e.target.checked ? '0' : '0.16')}
                          className="rounded border-gray-300" />
                        Exento de impuestos
                      </label>
                    </div>

                    <label className="font-medium text-right">Área de imp.</label>
                    <select value={fPrinterTarget} onChange={e => setFPrinterTarget(e.target.value)}
                      className="border rounded px-2 py-1.5 text-sm w-40">
                      <option value="">(Heredar de categoría)</option>
                      <option value="kitchen">Cocina</option>
                      <option value="bar">Bar</option>
                      <option value="both">Ambos</option>
                      <option value="none">Ninguno</option>
                    </select>

                    <label className="font-medium text-right">Estado</label>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setFIsAvailable(!fIsAvailable)}
                        className={`relative w-10 h-6 rounded-full transition-colors ${fIsAvailable ? 'bg-emerald-500' : 'bg-red-400'}`}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${fIsAvailable ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                      <span className={`text-sm font-medium ${fIsAvailable ? 'text-emerald-700' : 'text-red-600'}`}>
                        {fIsAvailable ? 'Activo' : 'Suspendido'}
                      </span>
                    </div>
                  </div>
                )}

                {/* ── Tab: Comentarios ── */}
                {activeTab === 'comentarios' && (
                  <div className="space-y-3 max-w-lg">
                    <label className="text-sm font-medium">Comentarios de preparación / Notas</label>
                    <textarea value={fDescription} onChange={e => setFDescription(e.target.value)}
                      className="border rounded px-3 py-2 text-sm w-full min-h-[150px] resize-y"
                      placeholder="Instrucciones de preparación, alérgenos, notas internas..." />
                  </div>
                )}

                {/* ── Tab: Producto compuesto ── */}
                {activeTab === 'compuesto' && (
                  <div className="space-y-4 max-w-lg">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setFIsComposite(!fIsComposite)}
                        className={`relative w-10 h-6 rounded-full transition-colors ${fIsComposite ? 'bg-orange-500' : 'bg-gray-300'}`}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${fIsComposite ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                      <span className="text-sm font-medium">Este producto es compuesto</span>
                    </div>

                    {fIsComposite && (
                      <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
                        {(!modifierGroups || modifierGroups.length === 0) && (
                          <p className="text-sm text-gray-400 text-center py-2">No hay grupos de modificadores</p>
                        )}
                        {modifierGroups?.map((group: any) => {
                          const isLinked = fLinkedGroups[group.id]?.linked || false;
                          const isForced = fLinkedGroups[group.id]?.is_forced || false;
                          return (
                            <div key={group.id} className={`p-3 rounded-lg border transition-colors ${isLinked ? 'border-orange-300 bg-white' : 'border-gray-200 bg-white/50'}`}>
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer flex-1">
                                  <input type="checkbox" checked={isLinked} onChange={() => toggleLink(group.id)}
                                    className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
                                  <div>
                                    <span className="font-medium text-sm">{group.name}</span>
                                    <span className="text-xs text-gray-500 ml-2">
                                      {group.is_required ? 'Obligatorio' : 'Opcional'} · {group.min_select}-{group.max_select}
                                    </span>
                                  </div>
                                </label>
                                {isLinked && (
                                  <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                                    <input type="checkbox" checked={isForced} onChange={() => toggleForced(group.id)}
                                      className="w-3.5 h-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                                    <span className={isForced ? 'text-red-600 font-medium' : 'text-gray-500'}>Forzar captura</span>
                                  </label>
                                )}
                              </div>
                              {isLinked && group.modifiers?.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {group.modifiers.slice(0, 6).map((m: any) => (
                                    <span key={m.id} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{m.name}</span>
                                  ))}
                                  {group.modifiers.length > 6 && <span className="px-2 py-0.5 text-xs text-gray-400">+{group.modifiers.length - 6}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ Add Grupo Modal ═══ */}
      {showAddGrupo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-sm p-4 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">Nuevo Grupo</h3>
              <button onClick={() => setShowAddGrupo(false)}><X size={18} /></button>
            </div>
            <label className="text-sm font-medium">Nombre del grupo</label>
            <input type="text" value={addGrupoName} onChange={e => setAddGrupoName(e.target.value)}
              className="input mt-1 mb-3" placeholder="Ej: Bebidas Frías"
              onKeyDown={e => e.key === 'Enter' && handleSaveGrupo()} />
            <div className="flex gap-2">
              <button onClick={() => setShowAddGrupo(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSaveGrupo} disabled={!addGrupoName} className="btn-primary flex-1">Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Add Subgrupo Modal ═══ */}
      {showAddSubgrupo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-sm p-4 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">Nuevo Subgrupo</h3>
              <button onClick={() => setShowAddSubgrupo(false)}><X size={18} /></button>
            </div>
            <label className="text-sm font-medium">Grupo</label>
            <select value={addSubgrupoGrupo || fGrupo} onChange={e => setAddSubgrupoGrupo(e.target.value)} className="input mt-1 mb-3">
              <option value="">Seleccionar grupo</option>
              {allGrupos.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <label className="text-sm font-medium">Nombre del subgrupo</label>
            <input type="text" value={addSubgrupoName} onChange={e => setAddSubgrupoName(e.target.value)}
              className="input mt-1 mb-3" placeholder="Ej: 10 oz"
              onKeyDown={e => e.key === 'Enter' && handleSaveSubgrupo()} />
            <div className="flex gap-2">
              <button onClick={() => setShowAddSubgrupo(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSaveSubgrupo} disabled={!addSubgrupoName || !(addSubgrupoGrupo || fGrupo)} className="btn-primary flex-1">Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
