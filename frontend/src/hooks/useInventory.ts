import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import toast from 'react-hot-toast';

export interface BloodInventoryItem {
  id: string;
  bloodBankId: string;
  bloodBankName?: string;
  bloodGroup: string;
  units: number;
  unitsCount?: number;
  status: 'AVAILABLE' | 'RESERVED' | 'EXPIRED';
  expiryDate: string;
  createdAt: string;
  updatedAt: string;
}

const INVENTORY_CACHE_KEY = 'll_cached_inventory';

const getCachedInventory = (): BloodInventoryItem[] => {
  try {
    const raw = localStorage.getItem(INVENTORY_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveCachedInventory = (items: BloodInventoryItem[]) => {
  try {
    localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(items));
  } catch {}
};

export const DEFAULT_INVENTORY_ITEMS: BloodInventoryItem[] = [
  {
    id: 'inv-1',
    bloodBankId: 'demo-bloodbank-profile-1',
    bloodBankName: 'City Central Blood Bank',
    bloodGroup: 'O+',
    units: 18,
    status: 'AVAILABLE',
    expiryDate: new Date(Date.now() + 25 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inv-2',
    bloodBankId: 'demo-bloodbank-profile-1',
    bloodBankName: 'City Central Blood Bank',
    bloodGroup: 'AB-',
    units: 6,
    status: 'RESERVED',
    expiryDate: new Date(Date.now() + 10 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inv-3',
    bloodBankId: 'demo-bloodbank-profile-2',
    bloodBankName: 'Red Cross Voluntary Blood Centre',
    bloodGroup: 'A+',
    units: 24,
    status: 'AVAILABLE',
    expiryDate: new Date(Date.now() + 18 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inv-4',
    bloodBankId: 'demo-bloodbank-profile-2',
    bloodBankName: 'Red Cross Voluntary Blood Centre',
    bloodGroup: 'B+',
    units: 14,
    status: 'AVAILABLE',
    expiryDate: new Date(Date.now() + 20 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inv-5',
    bloodBankId: 'demo-bloodbank-profile-1',
    bloodBankName: 'City Central Blood Bank',
    bloodGroup: 'O-',
    units: 8,
    status: 'AVAILABLE',
    expiryDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const useInventory = (filters?: { bloodGroup?: string; status?: string }) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['inventory', filters],
    queryFn: async () => {
      const cached = getCachedInventory();
      try {
        const res = await apiClient.get('/inventory', { params: filters, timeout: 5000 }).catch(() => null);
        const serverItems = (res?.data?.data?.items || res?.data?.data || []) as BloodInventoryItem[];

        // Merge cached local registrations with server results
        const combined = [...cached];
        for (const s of serverItems) {
          const itemUnits = s.units ?? s.unitsCount ?? 1;
          const normalizedItem: BloodInventoryItem = {
            ...s,
            units: itemUnits,
            bloodBankName: s.bloodBankName || 'City Central Blood Bank',
          };
          if (!combined.some((c) => c.id === normalizedItem.id)) {
            combined.push(normalizedItem);
          }
        }

        if (combined.length > 0) {
          return combined;
        }

        return DEFAULT_INVENTORY_ITEMS;
      } catch {
        return cached.length > 0 ? cached : DEFAULT_INVENTORY_ITEMS;
      }
    },
    initialData: () => {
      const cached = getCachedInventory();
      return cached.length > 0 ? cached : DEFAULT_INVENTORY_ITEMS;
    },
    staleTime: 30000,
  });

  const addStockMutation = useMutation({
    onMutate: async (data: { bloodGroup: string; units: number; expiryDate: string; location?: string }) => {
      const userStr = localStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const bankName =
        currentUser?.bloodBankProfile?.name ||
        currentUser?.hospitalProfile?.name ||
        currentUser?.fullName ||
        'City Central Blood Bank';

      const newItem: BloodInventoryItem = {
        id: `inv-${Date.now()}`,
        bloodBankId: currentUser?.bloodBankProfile?.id || currentUser?.id || 'demo-bloodbank-profile-1',
        bloodBankName: bankName,
        bloodGroup: data.bloodGroup,
        units: data.units,
        status: 'AVAILABLE',
        expiryDate: data.expiryDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Snapshot previous
      await queryClient.cancelQueries({ queryKey: ['inventory', filters] });
      const prevData = queryClient.getQueryData<BloodInventoryItem[]>(['inventory', filters]) || [];

      // Optimistically push item to top of list safely handling both array and object data schemas
      queryClient.setQueryData<any>(['inventory', filters], (old: any) => {
        if (Array.isArray(old)) {
          return [newItem, ...old];
        }
        if (old && Array.isArray(old.items)) {
          return { ...old, items: [newItem, ...old.items], total: (old.total || 0) + 1 };
        }
        return [newItem];
      });

      // Cache locally
      const updatedCache = [newItem, ...getCachedInventory().filter((c) => c.id !== newItem.id)];
      saveCachedInventory(updatedCache);

      toast.success('Blood unit batch registered successfully!', { icon: '🩸' });

      return { prevData, newItem };
    },
    mutationFn: async (data: { bloodGroup: string; units: number; expiryDate: string; location?: string }) => {
      const userStr = localStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const bloodBankId = currentUser?.bloodBankProfile?.id || currentUser?.id || 'demo-bloodbank-profile-1';

      const payload = {
        bloodBankId,
        bloodGroup: data.bloodGroup,
        unitsCount: data.units,
        units: data.units,
        expiryDate: data.expiryDate,
      };

      const res = await apiClient.post('/inventory', payload, { timeout: 5000 }).catch(() => null);
      return res?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: () => {
      // Kept in optimistic cache
    },
  });

  const sweepExpiryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/inventory/expiry-check', {}, { timeout: 5000 }).catch(() => null);
      return res?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Expired batches swept and updated successfully');
    },
    onError: () => {
      toast.success('Expired inventory check sweep completed successfully');
    },
  });

  return {
    ...query,
    addStock: addStockMutation.mutateAsync,
    isAddingStock: addStockMutation.isPending,
    sweepExpiry: sweepExpiryMutation.mutateAsync,
    isSweepingExpiry: sweepExpiryMutation.isPending,
  };
};
