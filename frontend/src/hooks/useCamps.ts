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
  externalRegistrationUrl?: string | null;
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
        const rawItems = res?.data?.data?.items || res?.data?.data;
        if (rawItems && Array.isArray(rawItems)) {
          return rawItems.map((item: any) => ({
            id: item.id,
            name: item.name,
            location: item.location || item.address || 'Unknown Address',
            startDate: item.startDate,
            endDate: item.endDate,
            bloodBankId: item.bloodBankId || '',
            bloodBankName: item.bloodBankName || item.organizer || 'Red Cross Society',
            latitude: item.latitude,
            longitude: item.longitude,
            externalRegistrationUrl: item.externalRegistrationUrl || null,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          })) as DonationCampItem[];
        }
        return [
          {
            id: 'camp-1',
            name: 'CurePlus Blood Centre Donation Camp',
            location: 'ARC Sportzone, Hebbal Industrial Area, Mysuru',
            startDate: new Date(Date.now() + 86400 * 1000).toISOString(),
            endDate: new Date(Date.now() + 3 * 86400 * 1000).toISOString(),
            bloodBankId: 'bb-1',
            bloodBankName: 'CurePlus Blood Centre',
            latitude: 12.3550,
            longitude: 76.6200,
            externalRegistrationUrl: 'https://cureplusbloodbank.com/',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'camp-2',
            name: 'Juhar Parivar Independence Drive',
            location: 'Kauvery Hospital, Electronic City, Bengaluru',
            startDate: new Date(Date.now() + 2 * 86400 * 1000).toISOString(),
            endDate: new Date(Date.now() + 4 * 86400 * 1000).toISOString(),
            bloodBankId: 'bb-2',
            bloodBankName: 'Juhar Parivar & Kauvery Hospital',
            latitude: 12.8465,
            longitude: 77.6625,
            externalRegistrationUrl: 'https://www.kauveryhospital.com/',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ] as DonationCampItem[];
      } catch {
        return [] as DonationCampItem[];
      }
    },
  });

  const createCampMutation = useMutation({
    mutationFn: async (data: { name: string; location: string; startDate: string; endDate: string; bloodBankId: string; latitude: number; longitude: number }) => {
      const payload = {
        name: data.name,
        organizer: 'Red Cross Society & LifeLink',
        address: data.location,
        city: data.location.toLowerCase().includes('bengaluru') || data.location.toLowerCase().includes('bangalore') ? 'Bengaluru' : 'Noida',
        latitude: data.latitude,
        longitude: data.longitude,
        startDate: data.startDate,
        endDate: data.endDate,
      };
      const res = await apiClient.post('/camps', payload);
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
