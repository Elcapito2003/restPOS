import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFloors, useTables } from '../hooks/useTables';
import { useSocket } from '../context/SocketContext';
import { TABLE_STATUS } from '../config/constants';
import { DoorOpen, Coffee, Bath, Flame, Snowflake } from 'lucide-react';

const CANVAS_W = 950;
const CANVAS_H = 630;

// Background zones representing the floor plan
function FloorPlanBackground() {
  return (
    <>
      {/* Outer walls */}
      <div className="absolute inset-0 border-2 border-gray-300 rounded-lg" />

      {/* INGRESO (Entrance) - left side */}
      <div className="absolute flex items-center justify-center"
        style={{ left: -1, top: 280, width: 30, height: 100 }}>
        <div className="bg-amber-100 border border-amber-300 rounded-r-lg px-1 py-6 flex flex-col items-center gap-1 shadow-sm">
          <DoorOpen size={16} className="text-amber-700" />
          <span className="text-[9px] font-bold text-amber-800 writing-vertical" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>INGRESO</span>
        </div>
      </div>

      {/* COFFEE BAR - center block */}
      <div className="absolute bg-indigo-100/60 border-2 border-indigo-300 rounded-lg flex items-center justify-center"
        style={{ left: 180, top: 230, width: 440, height: 200 }}>
        <div className="text-center">
          <Coffee size={28} className="text-indigo-500 mx-auto mb-1" />
          <span className="text-sm font-bold text-indigo-700 tracking-wider">COFFEE BAR</span>
          <div className="text-[10px] text-indigo-500 mt-1">Caja · Cafetería · Frigobar</div>
        </div>
      </div>

      {/* BAÑO - right of coffee bar */}
      <div className="absolute bg-sky-100/60 border-2 border-sky-300 rounded-lg flex items-center justify-center"
        style={{ left: 640, top: 230, width: 140, height: 200 }}>
        <div className="text-center">
          <Bath size={24} className="text-sky-500 mx-auto mb-1" />
          <span className="text-xs font-bold text-sky-700">BAÑO</span>
        </div>
      </div>

      {/* COCINA CALIENTE - far right top */}
      <div className="absolute bg-red-100/50 border-2 border-red-300 rounded-lg flex items-center justify-center"
        style={{ left: 800, top: 10, width: 140, height: 290 }}>
        <div className="text-center">
          <Flame size={22} className="text-red-500 mx-auto mb-1" />
          <span className="text-[10px] font-bold text-red-700 leading-tight block">COCINA</span>
          <span className="text-[10px] font-bold text-red-700">CALIENTE</span>
        </div>
      </div>

      {/* COCINA FRÍA - far right bottom */}
      <div className="absolute bg-pink-100/50 border-2 border-pink-300 rounded-lg flex items-center justify-center"
        style={{ left: 800, top: 320, width: 140, height: 160 }}>
        <div className="text-center">
          <Snowflake size={22} className="text-pink-500 mx-auto mb-1" />
          <span className="text-[10px] font-bold text-pink-700 leading-tight block">COCINA</span>
          <span className="text-[10px] font-bold text-pink-700">FRÍA</span>
        </div>
      </div>

      {/* Decorative wall lines */}
      {/* Top wall */}
      <div className="absolute bg-gray-200" style={{ left: 0, top: 0, width: CANVAS_W, height: 4 }} />
      {/* Bottom wall */}
      <div className="absolute bg-gray-200" style={{ left: 0, top: CANVAS_H - 4, width: CANVAS_W, height: 4 }} />
      {/* Left wall */}
      <div className="absolute bg-gray-200" style={{ left: 0, top: 0, width: 4, height: CANVAS_H }} />
      {/* Right wall */}
      <div className="absolute bg-gray-200" style={{ left: CANVAS_W - 4, top: 0, width: 4, height: CANVAS_H }} />
    </>
  );
}

export default function TableMapPage() {
  const navigate = useNavigate();
  const socket = useSocket();
  const { data: floors } = useFloors();
  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const { data: tables } = useTables(activeFloor);

  useEffect(() => {
    if (floors?.length && !activeFloor) setActiveFloor(floors[0].id);
  }, [floors]);

  useEffect(() => {
    if (socket && activeFloor) {
      socket.emit('join:floor', String(activeFloor));
    }
  }, [socket, activeFloor]);

  const handleTableClick = useCallback((table: any) => {
    if (table.status === 'blocked') return;
    navigate(`/orders?table=${table.id}`);
  }, [navigate]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Floor tabs */}
      <div className="flex items-center gap-2 p-3 bg-white border-b overflow-x-auto shrink-0">
        {floors?.map((floor: any) => (
          <button
            key={floor.id}
            onClick={() => setActiveFloor(floor.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeFloor === floor.id ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {floor.name}
          </button>
        ))}
        <div className="ml-auto flex gap-3 text-xs">
          {Object.entries(TABLE_STATUS).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-full ${val.color}`} />
              <span className="text-gray-600">{val.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table map */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-lg border"
          style={{ width: CANVAS_W, height: CANVAS_H, minWidth: CANVAS_W, minHeight: CANVAS_H }}>

          <FloorPlanBackground />

          {/* Tables */}
          {tables?.map((table: any) => {
            const status = TABLE_STATUS[table.status as keyof typeof TABLE_STATUS];
            const isBar = table.label.startsWith('B');
            return (
              <button
                key={table.id}
                onClick={() => handleTableClick(table)}
                className={`absolute flex flex-col items-center justify-center transition-all
                  hover:scale-110 active:scale-95 shadow-md z-10
                  ${table.status === 'free' ? 'border-2 border-emerald-400 bg-emerald-50 hover:bg-emerald-100' : ''}
                  ${table.status === 'occupied' ? 'border-2 border-red-400 bg-red-50 hover:bg-red-100 ring-2 ring-red-200' : ''}
                  ${table.status === 'reserved' ? 'border-2 border-amber-400 bg-amber-50 hover:bg-amber-100' : ''}
                  ${table.status === 'blocked' ? 'border-2 border-gray-400 bg-gray-200 opacity-50 cursor-not-allowed' : ''}
                `}
                style={{
                  left: table.pos_x,
                  top: table.pos_y,
                  width: table.width || 80,
                  height: table.height || 80,
                  borderRadius: table.shape === 'round' ? '50%' : '12px',
                }}
              >
                <span className={`font-bold ${isBar ? 'text-sm' : 'text-lg'}`}>{table.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white ${status.color} leading-none`}>
                  {status.label}
                </span>
                {table.waiter_name && (
                  <span className="text-[9px] text-gray-500 mt-0.5 truncate max-w-full px-1">{table.waiter_name}</span>
                )}
                {table.daily_number && (
                  <span className="text-[9px] text-gray-400">#{table.daily_number}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
