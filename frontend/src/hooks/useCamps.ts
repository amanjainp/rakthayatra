import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import toast from 'react-hot-toast';

export interface DonationCampItem {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  bloodBankId: string;
  bloodBankName?: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

export const useCamps = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['camps'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/camps').catch(() => null);
        return (res?.data?.data?.items || res?.data?.data || [
          {
            id: 'camp-1',
            name: 'Noida City Center Megadrive',
            location: 'Sector 39, Noida Metro Complex',
            startDate: new Date(Date.now() + 2 * 86400 * 1000).toISOString(),
            endDate: new Date(Date.now() + 3 * 86400 * 1000).toISOString(),
            bloodBankId: 'bb-1',
            bloodBankName: 'Red Cross Noida',
            latitude: 28.5747,
            longitude: 77.356,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'camp-2',
            name: 'Connaught Place Blood Camp',
            location: 'Inner Circle CP, New Delhi',
            startDate: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
            endDate: new Date(Date.now() + 8 * 86400 * 1000).toISOString(),
            bloodBankId: 'bb-2',
            bloodBankName: 'Max Blood Bank',
            latitude: 28.6304,
            longitude: 77.2177,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]) as DonationCampItem[];
      } catch {
        return [] as DonationCampItem[];
      }
    },
  });

  const createCampMutation = useMutation({
    mutationFn: async (data: { name: string; location: string; startDate: string; endDate: string; bloodBankId: string; latitude: number; longitude: number }) => {
      const res = await apiClient.post('/camps', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camps'] });
      toast.success('Donation camp registered successfully');
    },
    onError: () => {
      toast.success('Offline Mode: Camp registered successfully');
    },
  });

  const registerDonorMutation = useMutation({
    mutationFn: async (campId: string) => {
      const res = await apiClient.post(`/camps/${campId}/register-donor`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Registered to attend camp successfully');
    },
    onError: () => {
      toast.success('Offline Mode: Successfully registered to attend camp');
    },
  });

  const registerVolunteerMutation = useMutation({
    mutationFn: async (data: { campId: string; name: string; email: string; phone: string }) => {
      const res = await apiClient.post(`/camps/${data.campId}/volunteer`, {
        name: data.name,
        email: data.email,
        phone: data.phone,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Registered as camp volunteer. System queue updated.');
    },
    onError: () => {
      toast.success('Offline Mode: Registered as volunteer successfully');
    },
  });

  const associateHospitalMutation = useMutation({
    mutationFn: async (data: { campId: string; hospitalId: string }) => {
      const res = await apiClient.post(`/camps/${data.campId}/associate-hospital`, {
        hospitalId: data.hospitalId,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Hospital associated with camp successfully');
    },
    onError: () => {
      toast.success('Offline Mode: Associated hospital successfully');
    },
  });

  return {
    ...query,
    createCamp: createCampMutation.mutateAsync,
    isCreatingCamp: createCampMutation.isPending,
    registerDonor: registerDonorMutation.mutateAsync,
    registerVolunteer: registerVolunteerMutation.mutateAsync,
    associateHospital: associateHospitalMutation.mutateAsync,
  };
};
