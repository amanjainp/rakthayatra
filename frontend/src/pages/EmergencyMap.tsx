import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMapsLocations, useMapsConfig, MapMarker } from '../hooks/useMapsLocations';
import { Navigation, Compass, ShieldAlert, Database, Users, MapPin, AlertCircle, RefreshCw, Info } from 'lucide-react';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';
import { apiClient } from '../services/api';

// Dark Theme Configuration for Google Maps JS API
const GOOGLE_MAPS_DARK_THEME: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#090d16' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#090d16' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020617' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
];

// Safe helper to read client environmental variables across both Vite and Jest
const getClientApiKey = (): string => {
  try {
    const getImportMetaEnv = new Function('try { return import.meta.env; } catch { return undefined; }');
    const env = getImportMetaEnv();
    if (env && env.VITE_GOOGLE_MAPS_API_KEY) return env.VITE_GOOGLE_MAPS_API_KEY;
  } catch {}
  if (typeof process !== 'undefined' && process.env && (process.env as any).VITE_GOOGLE_MAPS_API_KEY) {
    return (process.env as any).VITE_GOOGLE_MAPS_API_KEY;
  }
  return '';
};

export const EmergencyMap: React.FC = () => {
  const [center, setCenter] = useState({ latitude: 28.6139, longitude: 77.209 }); // Delhi/Noida fallback
  const [radius, setRadius] = useState(25);
  const [showDonors, setShowDonors] = useState(true);
  const [showBanks, setShowBanks] = useState(true);
  const [showRequests, setShowRequests] = useState(true);
  const [activeMarker, setActiveMarker] = useState<MapMarker | null>(null);
  const [address, setAddress] = useState('Default Location: Connaught Place, New Delhi');
  const [isLocating, setIsLocating] = useState(false);
  const [hasUserLocation, setHasUserLocation] = useState(false);

  // Google Maps SDK state
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(false);
  const [googleMapsError, setGoogleMapsError] = useState<string | null>(null);

  const isLocatingRef = useRef(false);
  const hasUserLocationRef = useRef(false);
  const activeRequestIdRef = useRef(0);
  const googleMapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circleRef = useRef<any>(null);
  const centerMarkerRef = useRef<any>(null);

  // Load locations and maps configuration
  const { data: config } = useMapsConfig();
  const {
    data: markers = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useMapsLocations(center, radius);

  // Resolve active Google Maps API key (client env or backend config)
  const resolvedApiKey = getClientApiKey() || config?.googleMapsApiKey || '';

  // 1. Google Maps JS API Dynamic Loader
  useEffect(() => {
    if (!resolvedApiKey) {
      setIsGoogleMapsReady(false);
      return;
    }

    if ((window as any).google && (window as any).google.maps) {
      setIsGoogleMapsReady(true);
      return;
    }

    const scriptId = 'google-maps-js-api-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${resolvedApiKey}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        setIsGoogleMapsReady(true);
        setGoogleMapsError(null);
      };

      script.onerror = () => {
        setGoogleMapsError('Failed to load Google Maps SDK. Displaying Radar Vector Map.');
        setIsGoogleMapsReady(false);
      };

      document.head.appendChild(script);
    } else {
      script.addEventListener('load', () => setIsGoogleMapsReady(true));
      script.addEventListener('error', () => {
        setGoogleMapsError('Failed to load Google Maps SDK. Displaying Radar Vector Map.');
        setIsGoogleMapsReady(false);
      });
    }
  }, [resolvedApiKey]);

  // 2. Reverse Geocoding Lookup for Active Center
  useEffect(() => {
    let isMounted = true;
    const fetchAddress = async () => {
      try {
        const res = await apiClient.get('/requests/reverse-geocode', {
          params: {
            latitude: center.latitude,
            longitude: center.longitude,
          },
        });
        if (isMounted && res.data?.data?.address) {
          const rawAddress = res.data.data.address;
          setAddress(hasUserLocation ? rawAddress : `Default Location: ${rawAddress}`);
        }
      } catch (err) {
        if (isMounted) {
          setAddress(`Coordinates (${center.latitude.toFixed(4)}°, ${center.longitude.toFixed(4)}°)`);
        }
      }
    };
    fetchAddress();
    return () => {
      isMounted = false;
    };
  }, [center, hasUserLocation]);

  // 3. User Geolocation Detection with High-to-Standard Accuracy Fallback
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.', { id: 'geo' });
      return;
    }

    if (isLocatingRef.current) return;
    isLocatingRef.current = true;
    setIsLocating(true);

    const requestId = ++activeRequestIdRef.current;
    toast.loading('Detecting live location...', { id: 'geo' });

    const onPositionSuccess = (pos: GeolocationPosition) => {
      if (activeRequestIdRef.current !== requestId) return;
      isLocatingRef.current = false;
      setIsLocating(false);
      hasUserLocationRef.current = true;
      setHasUserLocation(true);
      setCenter({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      toast.success('Location updated successfully', { id: 'geo' });
    };

    const onPositionError = (err: GeolocationPositionError) => {
      if (activeRequestIdRef.current !== requestId) return;
      isLocatingRef.current = false;
      setIsLocating(false);

      let msg = 'Location access failed. Please try again.';
      if (err.code === err.PERMISSION_DENIED) {
        msg = 'Location access denied. Please enable location permissions in your browser settings.';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        msg = 'Location unavailable. Unable to determine device position.';
      } else if (err.code === err.TIMEOUT) {
        msg = 'Location request timed out. Please click "Locate Me" to retry.';
      }

      if (!hasUserLocationRef.current) {
        toast.error(`${msg} Using default map view.`, { id: 'geo', duration: 4000 });
      } else {
        toast.error(`${msg} Keeping current map position.`, { id: 'geo', duration: 4000 });
      }
    };

    // Primary High Accuracy Attempt (10s timeout)
    navigator.geolocation.getCurrentPosition(
      onPositionSuccess,
      (err) => {
        // Fallback to standard network triangulation if high accuracy times out
        if (err.code === err.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(
            onPositionSuccess,
            onPositionError,
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
          );
        } else {
          onPositionError(err);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    handleLocateMe();
  }, [handleLocateMe]);

  // Filter markers based on active category checkboxes
  const filteredMarkers = markers.filter((m) => {
    if (m.type === 'DONOR' && !showDonors) return false;
    if (m.type === 'BLOOD_BANK' && !showBanks) return false;
    if (m.type === 'EMERGENCY_REQUEST' && !showRequests) return false;
    return true;
  });

  // 4. Initialize and Synchronize Google Maps Instance
  useEffect(() => {
    if (!isGoogleMapsReady || !googleMapRef.current || !(window as any).google?.maps) {
      return;
    }

    const google = (window as any).google;
    const mapPos = { lat: center.latitude, lng: center.longitude };

    // Initialize map instance if not already created
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(googleMapRef.current, {
        center: mapPos,
        zoom: 11,
        styles: GOOGLE_MAPS_DARK_THEME,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
      });
    } else {
      mapInstanceRef.current.setCenter(mapPos);
    }

    const map = mapInstanceRef.current;

    // Render / update radius coverage circle
    if (circleRef.current) {
      circleRef.current.setMap(null);
    }
    circleRef.current = new google.maps.Circle({
      strokeColor: '#38bdf8',
      strokeOpacity: 0.6,
      strokeWeight: 1.5,
      fillColor: '#38bdf8',
      fillOpacity: 0.08,
      map,
      center: mapPos,
      radius: radius * 1000, // convert km to meters
    });

    // Render / update center user marker
    if (centerMarkerRef.current) {
      centerMarkerRef.current.setMap(null);
    }
    centerMarkerRef.current = new google.maps.Marker({
      position: mapPos,
      map,
      title: 'Current Location',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: '#38bdf8',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });

    // Clear old resource markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Fit bounds container
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(mapPos);

    // Plot filtered markers
    filteredMarkers.forEach((marker) => {
      const isEmergency = marker.type === 'EMERGENCY_REQUEST';
      const isBank = marker.type === 'BLOOD_BANK';
      const pinColor = isEmergency ? '#f43f5e' : isBank ? '#10b981' : '#f59e0b';

      const gMarker = new google.maps.Marker({
        position: { lat: marker.latitude, lng: marker.longitude },
        map,
        title: marker.name,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 5.5,
          fillColor: pinColor,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 1.5,
        },
      });

      gMarker.addListener('click', () => {
        setActiveMarker(marker);
      });

      bounds.extend({ lat: marker.latitude, lng: marker.longitude });
      markersRef.current.push(gMarker);
    });

    // Auto-fit bounds if markers exist
    if (filteredMarkers.length > 0) {
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
      // Prevent over-zooming on single markers
      google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
        if (map.getZoom() > 14) {
          map.setZoom(13);
        }
      });
    }
  }, [isGoogleMapsReady, center, radius, filteredMarkers]);

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
            <p className="text-xs text-slate-400">Locate compatible donors and blood bank resources within radial coordinates</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleLocateMe}
            disabled={isLocating}
            className="flex items-center gap-2"
          >
            <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin text-rose-400' : ''}`} />
            {isLocating ? 'Locating...' : 'Locate Me'}
          </Button>

          {isError && (
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="flex items-center gap-2 border-rose-500/50 text-rose-400 hover:bg-rose-500/10"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Search
            </Button>
          )}
        </div>
      </div>

      {/* Main Map Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Search Options & Active Marker Detail Panel */}
        <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/20 backdrop-blur-md space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Search Filters</h3>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded-full">
                {filteredMarkers.length} Found
              </span>
            </div>
            
            {/* Radius Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400 font-bold">
                <span>Matching Radius</span>
                <span className="text-rose-400 font-mono font-semibold">{radius} km</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full h-1.5 rounded-lg bg-slate-950 accent-rose-500 outline-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>5 km</span>
                <span>50 km</span>
                <span>100 km</span>
              </div>
            </div>

            {/* Marker Category Toggles */}
            <div className="space-y-3 pt-1 border-t border-slate-800/60">
              <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={showDonors}
                    onChange={(e) => setShowDonors(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-rose-600 focus:ring-rose-500/20"
                  />
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-rose-400" /> Nearby Active Donors
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {markers.filter((m) => m.type === 'DONOR').length}
                </span>
              </label>

              <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={showBanks}
                    onChange={(e) => setShowBanks(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-rose-600 focus:ring-rose-500/20"
                  />
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-400" /> Blood Storage Banks
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {markers.filter((m) => m.type === 'BLOOD_BANK').length}
                </span>
              </label>

              <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={showRequests}
                    onChange={(e) => setShowRequests(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-rose-600 focus:ring-rose-500/20"
                  />
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Emergency Patient Requests
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {markers.filter((m) => m.type === 'EMERGENCY_REQUEST').length}
                </span>
              </label>
            </div>
          </div>

          {/* Active Marker Details Popup Panel */}
          {activeMarker ? (
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/90 space-y-3 animate-fadeIn shadow-lg">
              <div className="flex justify-between items-start gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-400" />
                  {activeMarker.type.replace('_', ' ')}
                </span>
                {activeMarker.bloodGroup && (
                  <Badge variant={activeMarker.type === 'EMERGENCY_REQUEST' ? 'danger' : 'info'}>
                    {activeMarker.bloodGroup.replace('_', ' ')}
                  </Badge>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-white font-display">{activeMarker.name}</h4>
                {activeMarker.distanceKm !== undefined && (
                  <p className="text-[11px] font-medium text-rose-400 mt-0.5">
                    Approx {activeMarker.distanceKm.toFixed(1)} km away
                  </p>
                )}
              </div>

              <div className="text-xs text-slate-400 space-y-1.5 pt-1 border-t border-slate-800/60">
                {activeMarker.contact && <p className="leading-tight"><span className="text-slate-500 font-medium">Contact:</span> {activeMarker.contact}</p>}
                {activeMarker.address && <p className="leading-tight"><span className="text-slate-500 font-medium">Address:</span> {activeMarker.address}</p>}
                {activeMarker.availableBags !== undefined && (
                  <p className="leading-tight">
                    <span className="text-slate-500 font-medium">Available Units:</span>{' '}
                    <span className="font-semibold text-emerald-400">{activeMarker.availableBags} Bags</span>
                  </p>
                )}
                <p className="text-[10px] text-slate-600 font-mono pt-1">
                  Coords: {activeMarker.latitude.toFixed(4)}°, {activeMarker.longitude.toFixed(4)}°
                </p>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-xl border border-dashed border-slate-800/80 bg-slate-950/40 text-center space-y-1.5">
              <MapPin className="w-5 h-5 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 font-medium">No marker selected</p>
              <p className="text-[11px] text-slate-500 leading-normal">
                Click any marker on the map to inspect live availability and contact details.
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Map Canvas Plotter (Google Maps or Fallback Radar Vector Map) */}
        <div className="lg:col-span-2 relative aspect-[4/3] w-full rounded-2xl border border-slate-800/80 bg-slate-950 overflow-hidden flex items-center justify-center select-none shadow-2xl">
          
          {/* Mode 1: Real Google Maps Container */}
          <div
            ref={googleMapRef}
            className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
              isGoogleMapsReady && !isLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          />

          {/* Mode 2: Radar Vector Map Fallback (Active when Google Maps key is not present or SDK is loading/offline) */}
          {!isGoogleMapsReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Radar Coordinate Plane SVG */}
              <svg className="w-full h-full" viewBox="0 0 400 300">
                {/* Geodesic rings */}
                <circle cx="200" cy="150" r="130" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
                <circle cx="200" cy="150" r="90" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,3" />
                <circle cx="200" cy="150" r="50" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="200" y1="0" x2="200" y2="300" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
                <line x1="0" y1="150" x2="400" y2="150" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />

                {/* Center marker (Locate Me Target) */}
                <circle cx="200" cy="150" r="7" fill="#38bdf8" fillOpacity="0.25" className="animate-ping" />
                <circle cx="200" cy="150" r="4" fill="#0284c7" stroke="#ffffff" strokeWidth="1.5" />

                {/* Plot filtered markers offset from center */}
                {!isLoading &&
                  filteredInventoryCoords(filteredMarkers, center, radius).map((marker) => {
                    const isEmergency = marker.type === 'EMERGENCY_REQUEST';
                    const isBank = marker.type === 'BLOOD_BANK';
                    const color = isEmergency ? '#f43f5e' : isBank ? '#10b981' : '#f59e0b';
                    const isSelected = activeMarker?.id === marker.id;

                    return (
                      <g key={marker.id} className="cursor-pointer group" onClick={() => setActiveMarker(marker)}>
                        {isSelected && (
                          <circle cx={marker.x} cy={marker.y} r="10" fill={color} fillOpacity="0.3" className="animate-pulse" />
                        )}
                        <circle
                          cx={marker.x}
                          cy={marker.y}
                          r={isSelected ? '6.5' : '5'}
                          fill={color}
                          stroke="#ffffff"
                          strokeWidth="1.2"
                          className={isEmergency ? 'animate-pulse' : ''}
                        />
                        {/* Hover Tooltip Label */}
                        <text
                          x={marker.x + 8}
                          y={marker.y + 4}
                          fill="#f8fafc"
                          fontSize="9"
                          fontWeight="600"
                          className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none drop-shadow"
                        >
                          {marker.name}
                        </text>
                      </g>
                    );
                  })}
              </svg>
            </div>
          )}

          {/* HUD Overlay: Address, Coords, and Scale Status */}
          <div className="absolute top-4 left-4 p-3 bg-slate-900/90 backdrop-blur-md border border-slate-800/80 rounded-xl space-y-1 max-w-[220px] sm:max-w-[280px] z-10 shadow-lg pointer-events-none">
            <div className="flex items-center justify-between gap-2">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">HUD Status</span>
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {isGoogleMapsReady ? 'Google Maps' : 'Radar Vector'}
              </span>
            </div>
            <span className="block text-xs font-semibold text-white truncate" title={address}>{address}</span>
            <div className="flex items-center justify-between text-[9px] text-slate-400 pt-0.5">
              <span>{center.latitude.toFixed(4)}°, {center.longitude.toFixed(4)}°</span>
              <span>1 Ring = {(radius / 3).toFixed(1)} km</span>
            </div>
          </div>

          {/* Notice banner when running in fallback radar mode */}
          {!isGoogleMapsReady && !isLoading && (
            <div className="absolute bottom-3 inset-x-3 sm:inset-x-auto sm:left-4 sm:right-4 p-2.5 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl flex items-center justify-between text-[11px] text-slate-400 z-10">
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span className="truncate">
                  {googleMapsError || 'Interactive Radar Vector Map active. To enable Google Maps satellite view, configure VITE_GOOGLE_MAPS_API_KEY.'}
                </span>
              </div>
            </div>
          )}

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20">
              <div className="w-10 h-10 rounded-full border-2 border-rose-500/20 border-t-rose-500 animate-spin flex items-center justify-center">
                <Compass className="w-5 h-5 text-rose-400" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-slate-200">Plotting geocoded markers...</p>
                <p className="text-xs text-slate-500">Scanning {radius} km radius for active blood resources</p>
              </div>
            </div>
          )}

          {/* Empty State: Zero Results within Radius */}
          {!isLoading && !isError && filteredMarkers.length === 0 && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-15 pointer-events-auto">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
                <AlertCircle className="w-6 h-6 text-amber-500/80" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">No Blood Resources Found in Radius</h4>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                There are no active donors, storage banks, or emergency requests within {radius} km of this location.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRadius((prev) => Math.min(prev + 25, 100))}
                  className="text-xs"
                >
                  Expand Radius to {Math.min(radius + 25, 100)} km
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLocateMe}
                  className="text-xs"
                >
                  Locate Me
                </Button>
              </div>
            </div>
          )}

          {/* API Failure State */}
          {!isLoading && isError && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20 pointer-events-auto">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Failed to Load Location Resources</h4>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                {(error as any)?.message || 'Could not connect to the blood logistics API. Please verify network or retry.'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="text-xs flex items-center gap-2 border-rose-500/50 text-rose-400 hover:bg-rose-500/10"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Loading Map
              </Button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

// Helper to plot latitude/longitude offsets inside 400x300 canvas grid with dispersion
function filteredInventoryCoords(markers: MapMarker[], center: { latitude: number; longitude: number }, radius: number) {
  const scale = 130 / radius; // map radius limit to max ring radius (130px)
  
  // 1. Calculate raw offsets
  const rawPlotted = markers.map((m) => {
    const latDiff = m.latitude - center.latitude;
    const lngDiff = m.longitude - center.longitude;

    // Convert degrees offset to approximate km (1 deg ~ 111km)
    const yOffset = latDiff * 111 * scale;
    const xOffset = lngDiff * 111 * scale;

    return {
      ...m,
      x: 200 + xOffset,
      y: 150 - yOffset,
    };
  });

  // 2. Disperse overlapping coordinates in pixels (min 18px separation)
  const dispersed: typeof rawPlotted = [];
  const minDistance = 18;
  
  for (const marker of rawPlotted) {
    let currentX = marker.x;
    let currentY = marker.y;
    let angle = 0;
    let step = 15; // starting pixel offset distance
    let iterations = 0;
    
    const conflicts = () => {
      // Prevent overlapping directly on the center radar target (200, 150)
      const distToCenter = Math.sqrt(Math.pow(currentX - 200, 2) + Math.pow(currentY - 150, 2));
      if (distToCenter < 12) return true;

      // Prevent overlapping with already placed markers
      return dispersed.some((d) => {
        const dist = Math.sqrt(Math.pow(currentX - d.x, 2) + Math.pow(currentY - d.y, 2));
        return dist < minDistance;
      });
    };

    while (conflicts() && iterations < 32) {
      currentX = marker.x + Math.cos(angle) * step;
      currentY = marker.y + Math.sin(angle) * step;
      angle += Math.PI / 4; // check in 8 radial directions
      if (angle >= 2 * Math.PI) {
        angle = 0;
        step += 10; // grow search radius if still overlapping
      }
      iterations++;
    }
    
    dispersed.push({
      ...marker,
      x: currentX,
      y: currentY,
    });
  }

  return dispersed;
}

// Badge sub-component helper
const Badge: React.FC<{ variant: 'danger' | 'info'; children: React.ReactNode }> = ({ variant, children }) => {
  const bgClass = variant === 'danger' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${bgClass}`}>
      {children}
    </span>
  );
};

export default EmergencyMap;
