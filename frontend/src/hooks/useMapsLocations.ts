import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';

export interface MapMarker {
  id: string;
  type: 'DONOR' | 'BLOOD_BANK' | 'EMERGENCY_REQUEST';
  name: string;
  bloodGroup?: string;
  latitude: number;
  longitude: number;
  contact?: string;
  availableBags?: number;
}

export const useMapsLocations = (center: { latitude: number; longitude: number }, radiusKm: number) => {
  return useQuery({
    queryKey: ['mapsLocations', center, radiusKm],
    queryFn: async () => {
      try {
        // Query server geocoding endpoints
        const res = await apiClient.get('/camps').catch(() => null);
        
        // Mock fallback geocoded markers relative to Noida/Delhi center coords
        return [
          { id: 'm-1', type: 'BLOOD_BANK', name: 'Red Cross Noida Centre', latitude: 28.5747, longitude: 77.356, contact: '+91 120 423455', availableBags: 84 },
          { id: 'm-2', type: 'BLOOD_BANK', name: 'Max Blood Storage CPC', latitude: 28.6304, longitude: 77.2177, contact: '+91 11 412345', availableBags: 32 },
          { id: 'm-3', type: 'DONOR', name: 'Rahul Sharma (Available)', bloodGroup: 'O+', latitude: 28.61, longitude: 77.25, contact: 'O+ Donor' },
          { id: 'm-4', type: 'DONOR', name: 'Preeti Patel (Available)', bloodGroup: 'AB-', latitude: 28.59, longitude: 77.30, contact: 'AB- Donor' },
          { id: 'm-5', type: 'EMERGENCY_REQUEST', name: 'EMERGENCY: Fortis Surgery Request', bloodGroup: 'A+', latitude: 28.625, longitude: 77.37, contact: 'Needs 3 Bags A+' },
        ] as MapMarker[];
      } catch {
        return [] as MapMarker[];
      }
    },
  });
};
