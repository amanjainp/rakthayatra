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
        const res = await apiClient.get('/requests/map', {
          params: {
            latitude: center.latitude,
            longitude: center.longitude,
            radius: radiusKm,
          },
        });
        return (res.data?.data || []) as MapMarker[];
      } catch {
        return [] as MapMarker[];
      }
    },
  });
};
