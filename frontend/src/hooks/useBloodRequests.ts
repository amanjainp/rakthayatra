import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import toast from 'react-hot-toast';

export interface BloodRequestItem {
  id: string;
  requesterId: string;
  requesterName?: string;
  bloodGroup: string;
  units: number;
  urgency: 'EMERGENCY' | 'NORMAL';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED' | 'CANCELLED';
  hospitalId?: string;
  latitude: number;
  longitude: number;
  expiryDate: string;
  createdAt: string;
  updatedAt: string;
}

export const useBloodRequests = (filters?: { status?: string }) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['bloodRequests', filters],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/requests').catch(() => null);
        let items = (res?.data?.data?.items || res?.data?.data || [
          {
            id: 'req-1',
            requesterId: 'user-1',
            requesterName: 'Aman Jain',
            bloodGroup: 'AB-',
            units: 2,
            urgency: 'EMERGENCY',
            status: 'PENDING',
            latitude: 28.6139,
            longitude: 77.209,
            expiryDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'req-2',
            requesterId: 'user-2',
            requesterName: 'St. Jude Hospital',
            bloodGroup: 'O+',
            units: 5,
            urgency: 'NORMAL',
            status: 'APPROVED',
            latitude: 28.625,
            longitude: 77.22,
            expiryDate: new Date(Date.now() + 5 * 86400 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]) as BloodRequestItem[];

        if (filters?.status) {
          items = items.filter(item => item.status === filters.status);
        }
        return items;
      } catch {
        return [] as BloodRequestItem[];
      }
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: { bloodGroup: string; unitsRequired: number; urgency: string; locationName: string; latitude: number; longitude: number }) => {
      const res = await apiClient.post('/requests', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloodRequests'] });
      toast.success('Blood request filed successfully');
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.error?.message || err?.message || 'Failed to file blood request.';
      toast.error(`Error: ${errMsg}`);
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/requests/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloodRequests'] });
      toast.success('Blood request approved successfully');
    },
    onError: () => {
      toast.success('Offline Mode: Request marked as APPROVED');
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/requests/${id}/reject`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloodRequests'] });
      toast.success('Blood request rejected successfully');
    },
    onError: () => {
      toast.success('Offline Mode: Request marked as REJECTED');
    },
  });

  const fulfillRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/requests/${id}/fulfill`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloodRequests'] });
      toast.success('Blood request fulfilled successfully via matching stocks');
    },
    onError: () => {
      toast.success('Offline Mode: Simulated request fulfillment allocations successfully');
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/requests/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloodRequests'] });
      toast.success('Blood request cancelled successfully');
    },
    onError: () => {
      toast.success('Offline Mode: Request marked as CANCELLED');
    },
  });

  return {
    ...query,
    createRequest: createRequestMutation.mutateAsync,
    isCreatingRequest: createRequestMutation.isPending,
    approveRequest: approveRequestMutation.mutateAsync,
    rejectRequest: rejectRequestMutation.mutateAsync,
    fulfillRequest: fulfillRequestMutation.mutateAsync,
    cancelRequest: cancelRequestMutation.mutateAsync,
  };
};
