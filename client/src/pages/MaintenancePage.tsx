import { useState } from 'react';
import { Database, RefreshCw, Info } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MaintenancePage() {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Mantenimiento</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-6 text-center">
          <Database size={40} className="mx-auto text-blue-500 mb-3" />
          <h3 className="font-bold mb-2">Base de Datos</h3>
          <p className="text-sm text-gray-500 mb-4">Respaldo y mantenimiento de la base de datos</p>
          <button onClick={() => toast.success('Respaldo de BD no disponible en esta versión. Usar pg_dump directamente.')} className="btn-primary w-full text-sm">Respaldar BD</button>
        </div>

        <div className="card p-6 text-center">
          <RefreshCw size={40} className="mx-auto text-amber-500 mb-3" />
          <h3 className="font-bold mb-2">Recalcular Totales</h3>
          <p className="text-sm text-gray-500 mb-4">Recalcula totales de ordenes abiertas</p>
          <button onClick={() => toast.success('Función en desarrollo')} className="btn-secondary w-full text-sm">Ejecutar</button>
        </div>
      </div>

      <div className="card p-4">
        <button onClick={() => setShowInfo(!showInfo)} className="flex items-center gap-2 font-bold">
          <Info size={18} /> Información del Sistema
        </button>
        {showInfo && (
          <div className="mt-3 space-y-1 text-sm text-gray-600">
            <p><strong>Sistema:</strong> restPOS v1.0.0</p>
            <p><strong>Frontend:</strong> React + Vite + TypeScript + Tailwind</p>
            <p><strong>Backend:</strong> Node.js + Express + TypeScript</p>
            <p><strong>Base de datos:</strong> PostgreSQL 16</p>
            <p><strong>Impresión:</strong> ESC/POS via TCP</p>
          </div>
        )}
      </div>
    </div>
  );
}
