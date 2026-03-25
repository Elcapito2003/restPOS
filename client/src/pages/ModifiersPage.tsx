import { useState } from 'react';
import { useModifierGroups, useCreateModifierGroup, useUpdateModifierGroup, useProducts } from '../hooks/useProducts';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ModifiersPage() {
  const { data: groups } = useModifierGroups();
  const { data: products } = useProducts();
  const createGroup = useCreateModifierGroup();
  const updateGroup = useUpdateModifierGroup();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState('');
  const [minSelect, setMinSelect] = useState(0);
  const [maxSelect, setMaxSelect] = useState(1);
  const [isRequired, setIsRequired] = useState(false);
  const [modifiers, setModifiers] = useState<{ name: string; price_extra: number }[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);

  const openForm = (group?: any) => {
    if (group) {
      setEditing(group);
      setName(group.name);
      setMinSelect(group.min_select);
      setMaxSelect(group.max_select);
      setIsRequired(group.is_required);
      setModifiers(group.modifiers?.map((m: any) => ({ name: m.name, price_extra: parseFloat(m.price_extra) })) || []);
      setSelectedProducts(group.product_ids || []);
    } else {
      setEditing(null);
      setName('');
      setMinSelect(0);
      setMaxSelect(1);
      setIsRequired(false);
      setModifiers([{ name: '', price_extra: 0 }]);
      setSelectedProducts([]);
    }
    setShowForm(true);
  };

  const save = () => {
    const data = {
      name,
      min_select: minSelect,
      max_select: maxSelect,
      is_required: isRequired,
      modifiers: modifiers.filter(m => m.name),
      product_ids: selectedProducts,
    };
    if (editing) {
      updateGroup.mutate({ id: editing.id, ...data }, {
        onSuccess: () => { setShowForm(false); toast.success('Grupo actualizado'); },
      });
    } else {
      createGroup.mutate(data, {
        onSuccess: () => { setShowForm(false); toast.success('Grupo creado'); },
      });
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Grupos de Modificadores</h2>
        <button onClick={() => openForm()} className="btn-primary gap-1 text-sm"><Plus size={16} /> Nuevo</button>
      </div>

      <div className="space-y-3">
        {groups?.map((group: any) => (
          <div key={group.id} className="card p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold">{group.name}</h3>
                <p className="text-xs text-gray-500">
                  {group.is_required ? 'Requerido' : 'Opcional'} | Min: {group.min_select} Max: {group.max_select}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {group.modifiers?.map((m: any) => (
                    <span key={m.id} className="px-2 py-1 bg-gray-100 rounded-lg text-xs">
                      {m.name} {parseFloat(m.price_extra) > 0 ? `+$${parseFloat(m.price_extra).toFixed(2)}` : ''}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => openForm(group)} className="p-2 hover:bg-gray-100 rounded-lg">
                <Edit2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] overflow-auto p-4">
            <h3 className="font-bold mb-3">{editing ? 'Editar Grupo' : 'Nuevo Grupo'}</h3>

            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input mb-3" placeholder="Nombre del grupo" />

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs font-medium">Mín</label>
                <input type="number" value={minSelect} onChange={e => setMinSelect(+e.target.value)} className="input mt-1" min="0" />
              </div>
              <div>
                <label className="text-xs font-medium">Máx</label>
                <input type="number" value={maxSelect} onChange={e => setMaxSelect(+e.target.value)} className="input mt-1" min="1" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 p-3">
                  <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} />
                  <span className="text-sm">Requerido</span>
                </label>
              </div>
            </div>

            <h4 className="font-medium text-sm mb-2">Opciones</h4>
            {modifiers.map((mod, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="text" value={mod.name}
                  onChange={e => { const m = [...modifiers]; m[i].name = e.target.value; setModifiers(m); }}
                  className="input flex-1" placeholder="Nombre"
                />
                <input
                  type="number" value={mod.price_extra}
                  onChange={e => { const m = [...modifiers]; m[i].price_extra = +e.target.value; setModifiers(m); }}
                  className="input w-24" placeholder="Extra $" step="0.01"
                />
                <button onClick={() => setModifiers(modifiers.filter((_, j) => j !== i))} className="p-2 text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button onClick={() => setModifiers([...modifiers, { name: '', price_extra: 0 }])} className="text-blue-600 text-sm mb-4">+ Agregar opción</button>

            <h4 className="font-medium text-sm mb-2">Productos asociados</h4>
            <div className="max-h-32 overflow-auto border rounded-lg p-2 mb-4">
              {products?.map((p: any) => (
                <label key={p.id} className="flex items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(p.id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedProducts([...selectedProducts, p.id]);
                      else setSelectedProducts(selectedProducts.filter(id => id !== p.id));
                    }}
                  />
                  {p.name}
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={save} disabled={!name} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
