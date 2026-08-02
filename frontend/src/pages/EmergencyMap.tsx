import React, { useState, useEffect } from 'react';
import { useMapsLocations, MapMarker } from '../hooks/useMapsLocations';
import { Navigation, Compass, ShieldAlert, Database, Users } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const EmergencyMap: React.FC = () => {
  const [center, setCenter] = useState({ latitude: 28.6139, longitude: 77.209 }); // Delhi/Noida default
  const [radius, setRadius] = useState(25);
  const [showDonors, setShowDonors] = useState(true);
  const [showBanks, setShowBanks] = useState(true);
  const [showRequests, setShowRequests] = useState(true);
  const [activeMarker, setActiveMarker] = useState<MapMarker | null>(null);

  const { data: markers = [], isLoading } = useMapsLocations(center, radius);

  // Attempt live location grab
  const handleLocateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCenter({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        () => {
          // fallback silently
        }
      );
    }
  };

  useEffect(() => {
    handleLocateMe();
  }, []);

  const filteredMarkers = markers.filter((m) => {
    if (m.type === 'DONOR' && !showDonors) return false;
    if (m.type === 'BLOOD_BANK' && !showBanks) return false;
    if (m.type === 'EMERGENCY_REQUEST' && !showRequests) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white font-display">Emergency Match Map</h2>
            <p className="text-xs text-slate-400">Locate compatible donors and blood bank resources within radial coordinates boundaries</p>
          </div>
        </div>

        <Button variant="outline" onClick={handleLocateMe} className="flex items-center gap-2">
          <Navigation className="w-4 h-4" /> Locate Me
        </Button>
      </div>

      {/* Main Map Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Options & Sidebar */}
        <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/10 space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Search Filters</h3>
            
            {/* Radius Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400 font-bold">
                <span>Matching Radius</span>
                <span className="text-rose-400">{radius} km</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full h-1.5 rounded-lg bg-slate-950 accent-rose-500 outline-none cursor-pointer"
              />
            </div>

            {/* Marker Toggles */}
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDonors}
                  onChange={(e) => setShowDonors(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-rose-600 focus:ring-rose-500/20"
                />
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-rose-400" /> Nearby Active Donors
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBanks}
                  onChange={(e) => setShowBanks(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-rose-600 focus:ring-rose-500/20"
                />
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-400" /> Blood Storage Banks
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRequests}
                  onChange={(e) => setShowRequests(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-rose-600 focus:ring-rose-500/20"
                />
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Emergency Patient Requests
                </span>
              </label>
            </div>
          </div>

          {/* Active Marker Details Popup Panel */}
          {activeMarker ? (
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-2.5 animate-fadeIn">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{activeMarker.type}</span>
                {activeMarker.bloodGroup && (
                  <Badge variant="danger">{activeMarker.bloodGroup}</Badge>
                )}
              </div>
              <h4 className="text-sm font-bold text-white font-display">{activeMarker.name}</h4>
              <div className="text-xs text-slate-400 space-y-1">
                {activeMarker.contact && <p>Contact: {activeMarker.contact}</p>}
                {activeMarker.availableBags !== undefined && <p>Available: <span className="font-semibold text-emerald-400">{activeMarker.availableBags} Bags</span></p>}
                <p className="text-[10px] text-slate-600">Location: {activeMarker.latitude.toFixed(4)}°, {activeMarker.longitude.toFixed(4)}°</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic text-center py-6">
              Click on map markers to inspect active resource parameters.
            </p>
          )}
        </div>

        {/* Right Side: Map Canvas Plotter */}
        <div className="lg:col-span-2 relative aspect-[4/3] w-full rounded-2xl border border-slate-800/80 bg-slate-950 overflow-hidden flex items-center justify-center select-none">
          {isLoading ? (
            <div className="text-slate-500 text-sm">Plotting geocoded markers...</div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Radar Coordinate Plane SVG */}
              <svg className="w-full h-full text-slate-850" viewBox="0 0 400 300">
                {/* Geodesic rings */}
                <circle cx="200" cy="150" r="130" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3" />
                <circle cx="200" cy="150" r="90" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3" />
                <circle cx="200" cy="150" r="50" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="200" y1="0" x2="200" y2="300" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2" />
                <line x1="0" y1="150" x2="400" y2="150" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2" />

                {/* Center marker (Locate Me Target) */}
                <circle cx="200" cy="150" r="5" fill="#38bdf8" className="animate-ping" />
                <circle cx="200" cy="150" r="3" fill="#0284c7" />

                {/* Plot filtered markers offset from center */}
                {filteredInventoryCoords(filteredMarkers, center, radius).map((marker) => {
                  const isEmergency = marker.type === 'EMERGENCY_REQUEST';
                  const isBank = marker.type === 'BLOOD_BANK';
                  const color = isEmergency ? '#f43f5e' : isBank ? '#10b981' : '#f59e0b';
                  return (
                    <g key={marker.id} className="cursor-pointer group" onClick={() => setActiveMarker(marker)}>
                      <circle
                        cx={marker.x}
                        cy={marker.y}
                        r={activeMarker?.id === marker.id ? '7' : '5'}
                        fill={color}
                        stroke="#fff"
                        strokeWidth="1"
                        className={isEmergency ? 'animate-pulse' : ''}
                      />
                      {/* Tooltip labels */}
                      <text
                        x={marker.x + 8}
                        y={marker.y + 4}
                        fill="#94a3b8"
                        fontSize="8"
                        fontWeight="bold"
                        className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      >
                        {marker.name}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* HUD controls labels overlay */}
              <div className="absolute top-4 left-4 p-3 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl space-y-1">
                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">HUD Status Channels</span>
                <span className="block text-xs font-semibold text-white">Noida / Delhi Grid active</span>
                <span className="block text-[9px] text-slate-400">Scale: 1 Ring = {(radius / 3).toFixed(1)} km</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

// Helper to plot latitude/longitude offsets inside 400x300 canvas grid
function filteredInventoryCoords(markers: MapMarker[], center: { latitude: number; longitude: number }, radius: number) {
  const scale = 130 / radius; // map radius limit to max ring radius (130px)
  return markers.map((m) => {
    const latDiff = m.latitude - center.latitude;
    const lngDiff = m.longitude - center.longitude;

    // Convert degrees offset to approximate km (1 deg ~ 111km)
    const yOffset = latDiff * 111 * scale;
    const xOffset = lngDiff * 111 * scale;

    return {
      ...m,
      x: 200 + xOffset,
      y: 150 - yOffset, // flip Y because canvas starts top-left
    };
  });
}

// Badge sub-component helper
const Badge: React.FC<{ variant: 'danger' | 'info'; children: React.ReactNode }> = ({ variant, children }) => {
  const bgClass = variant === 'danger' ? 'bg-rose-500/10 text-rose-500' : 'bg-sky-500/10 text-sky-500';
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${bgClass}`}>
      {children}
    </span>
  );
};
export default EmergencyMap;
