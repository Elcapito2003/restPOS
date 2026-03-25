import { useState, useEffect } from 'react';
import { useFloors, useTables, useCreateFloor, useCreateTable, useUpdateTable, useDeleteTable } from '../hooks/useTables';
import { Plus, Trash2, Save, Move } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FloorEditorPage() {
  const { data: floors } = useFloors();
  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const { data: tables, refetch } = useTables(activeFloor);
  const createFloor = useCreateFloor();
  const createTable = useCreateTable();
  const updateTable = useUpdateTable();
  const deleteTable = useDeleteTable();

  const [newFloorName, setNewFloorName] = useState('');
  const [showNewFloor, setShowNewFloor] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showNewTable, setShowNewTable] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCapacity, setNewCapacity] = useState(4);
  const [newShape, setNewShape] = useState('square');

  useEffect(() => {
    if (floors?.length && !activeFloor) setActiveFloor(floors[0].id);
  }, [floors]);

  const handleMouseDown = (e: React.MouseEvent, tableId: number, posX: number, posY: number) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
    setDragging(tableId);
    setDragOffset({ x: e.clientX - rect.left - posX, y: e.clientY - rect.top - posY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging === null) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, Math.round((e.clientX - rect.left - dragOffset.x) / 10) * 10);
    const y = Math.max(0, Math.round((e.clientY - rect.top - dragOffset.y) / 10) * 10);
    updateTable.mutate({ id: dragging, pos_x: x, pos_y: y }, { onSuccess: () => refetch() });
  };

  const handleMouseUp = () => setDragging(null);

  const addFloor = () => {
    if (!newFloorName) return;
    createFloor.mutate({ name: newFloorName }, {
      onSuccess: () => { setShowNewFloor(false); setNewFloorName(''); toast.success('Planta creada'); },
    });
  };

  const addTable = () => {
    if (!newLabel || !activeFloor) return;
    createTable.mutate({
      floor_id: activeFloor,
      label: newLabel,
      capacity: newCapacity,
      shape: newShape,
      pos_x: 50,
      pos_y: 50,
    }, {
      onSuccess: () => { setShowNewTable(false); setNewLabel(''); refetch(); toast.success('Mesa creada'); },
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Floor tabs + Add */}
      <div className="flex gap-2 p-4 bg-white border-b items-center">
        {floors?.map((f: any) => (
          <button
            key={f.id}
            onClick={() => setActiveFloor(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeFloor === f.id ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
          >
            {f.name}
          </button>
        ))}
        <button onClick={() => setShowNewFloor(true)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"><Plus size={18} /></button>
        <div className="flex-1" />
        <button onClick={() => setShowNewTable(true)} className="btn-primary text-sm gap-1"><Plus size={16} /> Mesa</button>
      </div>

      {/* Canvas */}
      <div
        className="flex-1 relative overflow-auto bg-gray-50 cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ minHeight: 500 }}
      >
        {/* Grid */}
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #ddd 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

        {tables?.map((table: any) => (
          <div
            key={table.id}
            className={`absolute bg-white border-2 border-gray-300 shadow-md flex flex-col items-center justify-center cursor-move hover:border-blue-400 ${
              dragging === table.id ? 'border-blue-500 shadow-lg z-10' : ''
            }`}
            style={{
              left: table.pos_x,
              top: table.pos_y,
              width: table.width || 80,
              height: table.height || 80,
              borderRadius: table.shape === 'round' ? '50%' : '8px',
            }}
            onMouseDown={e => handleMouseDown(e, table.id, table.pos_x, table.pos_y)}
          >
            <span className="text-sm font-bold">{table.label}</span>
            <span className="text-xs text-gray-500">{table.capacity}p</span>
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm('¿Eliminar mesa?')) deleteTable.mutate(table.id, { onSuccess: () => refetch() }); }}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      {/* New Floor Modal */}
      {showNewFloor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xs p-4">
            <h3 className="font-bold mb-3">Nueva Planta</h3>
            <input type="text" value={newFloorName} onChange={e => setNewFloorName(e.target.value)} className="input mb-3" placeholder="Nombre" />
            <div className="flex gap-2">
              <button onClick={() => setShowNewFloor(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={addFloor} className="btn-primary flex-1">Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* New Table Modal */}
      {showNewTable && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xs p-4">
            <h3 className="font-bold mb-3">Nueva Mesa</h3>
            <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="input mb-3" placeholder="Número/Etiqueta" />
            <input type="number" value={newCapacity} onChange={e => setNewCapacity(+e.target.value)} className="input mb-3" placeholder="Capacidad" min="1" />
            <select value={newShape} onChange={e => setNewShape(e.target.value)} className="input mb-3">
              <option value="square">Cuadrada</option>
              <option value="round">Redonda</option>
              <option value="rect">Rectangular</option>
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowNewTable(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={addTable} disabled={!newLabel} className="btn-primary flex-1">Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
