import { useState, useRef, useEffect } from 'react';
import { MapPin, ZoomIn, ZoomOut, Locate } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  status: string;
  latitude: string;
  longitude: string;
  city: string;
  state: string;
  owner_name: string;
  plan: string;
  modules: any[];
}

interface Props {
  tenants: Tenant[];
  onEnterTenant: (tenantId: string) => void;
}

// Tile math helpers
function lng2tile(lng: number, zoom: number) { return ((lng + 180) / 360) * Math.pow(2, zoom); }
function lat2tile(lat: number, zoom: number) {
  return ((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2) * Math.pow(2, zoom);
}

const statusColors: Record<string, string> = {
  active: '#22c55e', trial: '#eab308', suspended: '#ef4444', pending: '#6b7280',
};

export default function MexicoMap({ tenants, onEnterTenant }: Props) {
  const [zoom, setZoom] = useState(5);
  const [center, setCenter] = useState({ lat: 23.6345, lng: -102.5528 }); // Mexico center
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const MAP_WIDTH = containerRef.current?.clientWidth || 1100;
  const MAP_HEIGHT = 520;
  const TILE_SIZE = 256;

  // Convert lat/lng to pixel position relative to map center
  function toPixel(lat: number, lng: number) {
    const scale = Math.pow(2, zoom) * TILE_SIZE;
    const centerX = lng2tile(center.lng, zoom) * TILE_SIZE;
    const centerY = lat2tile(center.lat, zoom) * TILE_SIZE;
    const pointX = lng2tile(lng, zoom) * TILE_SIZE;
    const pointY = lat2tile(lat, zoom) * TILE_SIZE;
    return {
      x: MAP_WIDTH / 2 + (pointX - centerX),
      y: MAP_HEIGHT / 2 + (pointY - centerY),
    };
  }

  // Generate tile URLs for visible area
  function getTiles() {
    const tiles: { x: number; y: number; url: string; left: number; top: number }[] = [];
    const centerTileX = lng2tile(center.lng, zoom);
    const centerTileY = lat2tile(center.lat, zoom);

    const tilesX = Math.ceil(MAP_WIDTH / TILE_SIZE) + 2;
    const tilesY = Math.ceil(MAP_HEIGHT / TILE_SIZE) + 2;

    const startTileX = Math.floor(centerTileX - tilesX / 2);
    const startTileY = Math.floor(centerTileY - tilesY / 2);
    const maxTile = Math.pow(2, zoom);

    for (let x = startTileX; x < startTileX + tilesX; x++) {
      for (let y = startTileY; y < startTileY + tilesY; y++) {
        if (y < 0 || y >= maxTile) continue;
        const wrappedX = ((x % maxTile) + maxTile) % maxTile;
        const left = MAP_WIDTH / 2 + (x - centerTileX) * TILE_SIZE;
        const top = MAP_HEIGHT / 2 + (y - centerTileY) * TILE_SIZE;

        // Google Maps-style satellite/roadmap tiles (free via OpenStreetMap)
        const url = `https://mt1.google.com/vt/lyrs=r&x=${wrappedX}&y=${y}&z=${zoom}`;
        tiles.push({ x: wrappedX, y, url, left, top });
      }
    }
    return tiles;
  }

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const scale = Math.pow(2, zoom) * TILE_SIZE;

    setCenter(prev => ({
      lat: prev.lat + (dy / scale) * 180,
      lng: prev.lng - (dx / scale) * 360,
    }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(18, Math.max(3, z + (e.deltaY < 0 ? 1 : -1))));
  };

  const tiles = getTiles();
  const tenantsWithCoords = tenants.filter(t => t.latitude && t.longitude);

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden border border-slate-700 cursor-grab active:cursor-grabbing select-none"
      style={{ height: MAP_HEIGHT }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Tile layer */}
      <div className="absolute inset-0 overflow-hidden">
        {tiles.map((tile, i) => (
          <img
            key={`${zoom}-${tile.x}-${tile.y}`}
            src={tile.url}
            alt=""
            className="absolute pointer-events-none"
            style={{ left: tile.left, top: tile.top, width: TILE_SIZE, height: TILE_SIZE }}
            draggable={false}
          />
        ))}
      </div>

      {/* Dark overlay for better pin visibility */}
      <div className="absolute inset-0 bg-slate-900/20 pointer-events-none" />

      {/* Pins */}
      {tenantsWithCoords.map(tenant => {
        const { x, y } = toPixel(parseFloat(tenant.latitude), parseFloat(tenant.longitude));
        const color = statusColors[tenant.status] || '#6b7280';
        const isHovered = hoveredId === tenant.id;

        if (x < -50 || x > MAP_WIDTH + 50 || y < -50 || y > MAP_HEIGHT + 50) return null;

        return (
          <div key={tenant.id} className="absolute z-10" style={{ left: x - 16, top: y - 40 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onEnterTenant(tenant.id); }}
              onMouseEnter={() => setHoveredId(tenant.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="relative transition-transform hover:scale-125"
            >
              <div style={{
                width: 32, height: 32,
                background: color,
                border: '3px solid white',
                borderRadius: '50% 50% 50% 0',
                transform: 'rotate(-45deg)',
                boxShadow: `0 2px 12px ${color}80`,
              }}>
                <div style={{ transform: 'rotate(45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <MapPin size={14} color="white" />
                </div>
              </div>
              {tenant.status === 'active' && (
                <div className="absolute top-1 left-1 w-6 h-6 rounded-full animate-ping opacity-30" style={{ background: color }} />
              )}
            </button>

            {isHovered && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border border-slate-600 rounded-xl p-3 shadow-2xl z-20 min-w-[200px] pointer-events-none">
                <div className="font-bold text-white text-sm">{tenant.name}</div>
                <div className="text-xs text-slate-400">{tenant.city}, {tenant.state}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-xs text-slate-300">
                    {tenant.status === 'active' ? 'Activo' : tenant.status === 'trial' ? 'Prueba' : tenant.status}
                  </span>
                  {tenant.plan && <span className="text-xs text-blue-400">• {tenant.plan}</span>}
                </div>
                <div className="text-xs text-slate-500 mt-1">{tenant.modules?.filter((m: any) => m.enabled).length || 0} módulos</div>
                <div className="text-[10px] text-blue-400 mt-2">Click para entrar →</div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-slate-600" />
              </div>
            )}
          </div>
        );
      })}

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-20">
        <button onClick={() => setZoom(z => Math.min(18, z + 1))} className="w-8 h-8 bg-white/90 hover:bg-white rounded-lg shadow flex items-center justify-center text-slate-700">
          <ZoomIn size={16} />
        </button>
        <button onClick={() => setZoom(z => Math.max(3, z - 1))} className="w-8 h-8 bg-white/90 hover:bg-white rounded-lg shadow flex items-center justify-center text-slate-700">
          <ZoomOut size={16} />
        </button>
        <button onClick={() => { setCenter({ lat: 23.6345, lng: -102.5528 }); setZoom(5); }}
          className="w-8 h-8 bg-white/90 hover:bg-white rounded-lg shadow flex items-center justify-center text-slate-700">
          <Locate size={16} />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur rounded-lg px-3 py-2 shadow z-20">
        <div className="flex items-center gap-3 text-xs text-slate-700">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Activo</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Prueba</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Suspendido</span>
        </div>
      </div>

      {/* Zoom level indicator */}
      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur rounded-lg px-2 py-1 shadow z-20 text-xs text-slate-600">
        Zoom: {zoom}
      </div>
    </div>
  );
}
