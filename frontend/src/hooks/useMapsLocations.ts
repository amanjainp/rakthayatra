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
  address?: string;
  availableBags?: number;
  distanceKm?: number;
}

export interface MapsConfig {
  googleMapsApiKey: string;
  isMockMode: boolean;
}

export const useMapsLocations = (center: { latitude: number; longitude: number }, radiusKm: number) => {
  return useQuery({
    queryKey: ['mapsLocations', Number(center.latitude.toFixed(4)), Number(center.longitude.toFixed(4)), radiusKm],
    queryFn: async () => {
      const res = await apiClient.get('/requests/map', {
        params: {
          latitude: center.latitude,
          longitude: center.longitude,
          radius: radiusKm,
        },
      });
      return (res.data?.data || []) as MapMarker[];
    },
    placeholderData: (previousData) => previousData,
    refetchInterval: 30000, // Background refresh every 30 seconds to sync map markers
    retry: 1,
    staleTime: 15000,
  });
};

export const useMapsConfig = () => {
  return useQuery<MapsConfig>({
    queryKey: ['mapsConfig'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/requests/maps-config');
        return res.data?.data || { googleMapsApiKey: '', isMockMode: true };
      } catch {
        return { googleMapsApiKey: '', isMockMode: true };
      }
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
};
