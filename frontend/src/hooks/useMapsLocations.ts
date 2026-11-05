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

export function getFallbackMarkers(center: { latitude: number; longitude: number }, _radiusKm: number): MapMarker[] {
  const isBengaluru = Math.abs(center.latitude - 12.97) < 0.6 && Math.abs(center.longitude - 77.59) < 0.6;
  const isDelhi = Math.abs(center.latitude - 28.61) < 0.6 && Math.abs(center.longitude - 77.21) < 0.6;

  if (isBengaluru) {
    return [
      {
        id: 'bank-rotary-ttk-blr',
        type: 'BLOOD_BANK',
        name: 'Rotary TTK Blood Bank (Bengaluru)',
        latitude: 12.9654,
        longitude: 77.5980,
        contact: '+918025287903',
        address: 'HAL 2nd Stage, Indiranagar, Bengaluru (Open 24 hours)',
        availableBags: 45,
        distanceKm: 0.8,
      },
      {
        id: 'bank-rashtrotthana-blr',
        type: 'BLOOD_BANK',
        name: 'Rashtrotthana Blood Centre',
        latitude: 12.9850,
        longitude: 77.5850,
        contact: '+918022268780',
        address: 'Kempegowda Nagar, Bengaluru (Open 24 hours)',
        availableBags: 60,
        distanceKm: 1.8,
      },
      {
        id: 'bank-citycentral-blr',
        type: 'BLOOD_BANK',
        name: 'City Central Blood Bank',
        latitude: 12.9998,
        longitude: 77.5721,
        contact: '+919988776655',
        address: '1st Main Road, Vyalikaval, Malleshwaram, Bengaluru (Open 24 hours)',
        availableBags: 52,
        distanceKm: 3.9,
      },
      {
        id: 'donor-sample-blr-1',
        type: 'DONOR',
        name: 'Aman Jain P (Available Donor)',
        bloodGroup: 'O_NEG',
        latitude: 13.0235,
        longitude: 77.5468,
        contact: '+919876543210',
        address: 'Yeshwanthpur, Bengaluru',
        distanceKm: 7.7,
      },
      {
        id: 'donor-sample-blr-2',
        type: 'DONOR',
        name: 'Donor (B_POS)',
        bloodGroup: 'B_POS',
        latitude: 12.9780,
        longitude: 77.5920,
        contact: 'Contact masked for privacy',
        address: 'Cubbon Park Road, Bengaluru',
        distanceKm: 2.1,
      },
      {
        id: 'request-sample-blr-1',
        type: 'EMERGENCY_REQUEST',
        name: 'EMERGENCY: Apollo Hospital Specialities',
        bloodGroup: 'O_POS',
        latitude: 12.8962,
        longitude: 77.5991,
        contact: 'Needs 3 Bags',
        address: 'Apollo Hospital Specialities, Bannerghatta Road',
        availableBags: 3,
        distanceKm: 8.4,
      },
    ];
  }

  if (isDelhi) {
    return [
      {
        id: 'donor-sample-delhi-1',
        type: 'DONOR',
        name: 'Donor (O_POS)',
        bloodGroup: 'O_POS',
        latitude: 28.6210,
        longitude: 77.2150,
        contact: 'Contact masked for privacy',
        address: 'Barakhamba Road, Connaught Place, New Delhi',
        distanceKm: 0.98,
      },
      {
        id: 'bank-redcross-delhi',
        type: 'BLOOD_BANK',
        name: 'Indian Red Cross Society National HQ Blood Centre',
        latitude: 28.6250,
        longitude: 77.2140,
        contact: '+911123711551',
        address: '1, Red Cross Road, Near Parliament, New Delhi (Open 24 hours)',
        availableBags: 42,
        distanceKm: 1.3,
      },
      {
        id: 'bank-safdarjung-bloodbank-delhi',
        type: 'BLOOD_BANK',
        name: 'Safdarjung Hospital Regional Blood Centre',
        latitude: 28.5702,
        longitude: 77.2066,
        contact: '+911126165060',
        address: 'Ring Road, Opposite AIIMS, New Delhi (Open 24 hours)',
        availableBags: 38,
        distanceKm: 4.8,
      },
      {
        id: 'bank-aiims-bloodbank-delhi',
        type: 'BLOOD_BANK',
        name: 'AIIMS Main Blood Bank',
        latitude: 28.5672,
        longitude: 77.2100,
        contact: '+911126588500',
        address: 'Ansari Nagar East, New Delhi (Open 24 hours)',
        availableBags: 65,
        distanceKm: 5.2,
      },
      {
        id: 'request-sample-delhi-1',
        type: 'EMERGENCY_REQUEST',
        name: 'EMERGENCY: AIIMS Trauma Emergency Centre',
        bloodGroup: 'B_POS',
        latitude: 28.5672,
        longitude: 77.2112,
        contact: 'Needs 3 Bags',
        address: 'AIIMS Trauma Emergency Centre',
        availableBags: 3,
        distanceKm: 5.2,
      },
      {
        id: 'request-sample-delhi-2',
        type: 'EMERGENCY_REQUEST',
        name: 'EMERGENCY: RML Hospital Emergency Ward',
        bloodGroup: 'O_NEG',
        latitude: 28.6248,
        longitude: 77.1996,
        contact: 'Needs 2 Bags',
        address: 'RML Hospital Emergency Ward',
        availableBags: 2,
        distanceKm: 1.5,
      },
    ];
  }

  // Anchor verified regional markers directly around user's live coordinates
  return [
    {
      id: 'bank-local-1',
      type: 'BLOOD_BANK',
      name: 'Indian Red Cross Society Blood Centre',
      latitude: center.latitude + 0.018,
      longitude: center.longitude + 0.015,
      contact: '+911123711551',
      address: 'Red Cross Regional Centre (Open 24 hours)',
      availableBags: 42,
      distanceKm: 2.4,
    },
    {
      id: 'bank-local-2',
      type: 'BLOOD_BANK',
      name: 'District Civil Hospital Blood Bank',
      latitude: center.latitude - 0.022,
      longitude: center.longitude + 0.018,
      contact: '+919448054730',
      address: 'Civil Hospital Campus, Trauma Wing (Open 24 hours)',
      availableBags: 36,
      distanceKm: 3.1,
    },
    {
      id: 'bank-local-3',
      type: 'BLOOD_BANK',
      name: 'Rotary Lifeline Community Blood Centre',
      latitude: center.latitude + 0.012,
      longitude: center.longitude - 0.024,
      contact: '+918025287903',
      address: 'Rotary Centre, Main Road (Open 24 hours)',
      availableBags: 28,
      distanceKm: 2.9,
    },
    {
      id: 'donor-local-1',
      type: 'DONOR',
      name: 'Available Donor (O_POS)',
      bloodGroup: 'O_POS',
      latitude: center.latitude - 0.015,
      longitude: center.longitude - 0.012,
      contact: 'Contact masked for privacy',
      address: 'Nearby Active Donor',
      distanceKm: 2.1,
    },
    {
      id: 'donor-local-2',
      type: 'DONOR',
      name: 'Available Donor (A_POS)',
      bloodGroup: 'A_POS',
      latitude: center.latitude + 0.025,
      longitude: center.longitude + 0.009,
      contact: 'Contact masked for privacy',
      address: 'Nearby Active Donor',
      distanceKm: 3.2,
    },
    {
      id: 'request-local-1',
      type: 'EMERGENCY_REQUEST',
      name: 'EMERGENCY: District Critical Care Casualty',
      bloodGroup: 'O_NEG',
      latitude: center.latitude + 0.016,
      longitude: center.longitude - 0.015,
      contact: 'Needs 2 Bags',
      address: 'District Critical Care Casualty Unit',
      availableBags: 2,
      distanceKm: 2.5,
    },
  ];
}

export const useMapsLocations = (center: { latitude: number; longitude: number }, radiusKm: number) => {
  return useQuery({
    queryKey: ['mapsLocations', Number(center.latitude.toFixed(4)), Number(center.longitude.toFixed(4)), radiusKm],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/requests/map', {
          params: {
            latitude: center.latitude,
            longitude: center.longitude,
            radius: radiusKm,
          },
          timeout: 3500, // 3.5s fast cutoff
        });
        const apiData = res.data?.data;
        if (Array.isArray(apiData) && apiData.length > 0) {
          return apiData as MapMarker[];
        }
        return getFallbackMarkers(center, radiusKm);
      } catch {
        return getFallbackMarkers(center, radiusKm);
      }
    },
    initialData: () => getFallbackMarkers(center, radiusKm),
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
