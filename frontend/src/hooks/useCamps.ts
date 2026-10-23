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
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampSyncMetadata {
  lastSyncAt: string;
  status: string;
  source: string;
  syncedCount?: number;
  expiredTransitionedCount?: number;
  message?: string;
}

export const useCamps = (options?: { city?: string }) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['camps', options?.city],
    queryFn: async () => {
      try {
        const params = options?.city ? { city: options.city } : {};
        const res = await apiClient.get('/camps', { params }).catch(() => null);

        const syncMetadata: CampSyncMetadata | null = res?.data?.data?.sync || null;

        const rawItems = res?.data?.data?.items || res?.data?.data;
        if (rawItems && Array.isArray(rawItems)) {
          const now = new Date();
          const items: any = rawItems
            .map((item: any) => ({
              id: item.id,
              name: item.name,
              location: item.location || item.address || 'Verified Facility',
              startDate: item.startDate,
              endDate: item.endDate,
              bloodBankId: item.bloodBankId || '',
              bloodBankName: item.bloodBankName || item.organizer || 'Authorized Medical Center',
              latitude: item.latitude || 0,
              longitude: item.longitude || 0,
              externalRegistrationUrl: item.externalRegistrationUrl || null,
              status: item.status || 'UPCOMING',
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
            }))
            .filter((item: DonationCampItem) => {
              // Ensure expired camps are excluded from user-facing active list
              const end = new Date(item.endDate);
              return !isNaN(end.getTime()) && end >= now;
            });
          items.sync = syncMetadata;
          return items as DonationCampItem[];
        }
        const emptyList: any = [];
        emptyList.sync = syncMetadata;
        return emptyList as DonationCampItem[];
      } catch {
        return [] as DonationCampItem[];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes stale time
    refetchInterval: 15 * 60 * 1000, // Revalidate every 15 minutes
    refetchOnWindowFocus: true,
  });

  const sync = (query.data as any)?.sync || null;

  const createCampMutation = useMutation({
    mutationFn: async (data: any) => {
      const location = data?.location || data?.address || '';
      const payload = {
        name: data?.name || '',
        organizer: data?.organizer || 'Red Cross Society & LifeLink',
        address: location,
        city:
          data?.city ||
          (location.toLowerCase().includes('bengaluru') || location.toLowerCase().includes('bangalore')
            ? 'Bengaluru'
            : 'Noida'),
        latitude: Number(data?.latitude) || 0,
        longitude: Number(data?.longitude) || 0,
        startDate: data?.startDate || '',
        endDate: data?.endDate || '',
        externalRegistrationUrl: data?.externalRegistrationUrl || null,
      };
      const res = await apiClient.post('/camps', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camps'] });
      toast.success('Donation camp registered successfully');
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error?.message ||
        (typeof err?.response?.data?.error === 'string' ? err.response.data.error : null) ||
        'Failed to register donation camp';
      toast.error(msg);
    },
  });

  const registerDonorMutation = useMutation({
    mutationFn: async (arg: string | { campId: string; donorProfileId?: string }) => {
      const campId = typeof arg === 'string' ? arg : arg?.campId;
      const body = typeof arg === 'object' && arg?.donorProfileId ? { donorProfileId: arg.donorProfileId } : {};
      const res = await apiClient.post(`/camps/${campId}/register-donor`, body);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Registered to attend camp successfully');
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error?.message ||
        (typeof err?.response?.data?.error === 'string' ? err.response.data.error : null) ||
        'Failed to register for camp';
      toast.error(msg);
    },
  });

  const registerVolunteerMutation = useMutation({
    mutationFn: async (data: {
      campId: string;
      name?: string;
      email?: string;
      phone?: string;
      volunteer?: { name: string; email: string; phone: string };
    }) => {
      const vol = data.volunteer || {
        name: data.name,
        email: data.email,
        phone: data.phone,
      };
      const res = await apiClient.post(`/camps/${data.campId}/volunteer`, vol);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Registered as camp volunteer. System queue updated.');
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error?.message ||
        (typeof err?.response?.data?.error === 'string' ? err.response.data.error : null) ||
        'Failed to register volunteer';
      toast.error(msg);
    },
  });

  const associateHospitalMutation = useMutation({
    mutationFn: async (data: { campId: string; hospitalId?: string; hospitalProfileId?: string }) => {
      const res = await apiClient.post(`/camps/${data.campId}/associate-hospital`, {
        hospitalId: data.hospitalId,
        hospitalProfileId: data.hospitalProfileId,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Hospital associated with camp successfully');
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error?.message ||
        (typeof err?.response?.data?.error === 'string' ? err.response.data.error : null) ||
        'Failed to associate facility';
      toast.error(msg);
    },
  });

  return {
    ...query,
    sync,
    createCamp: createCampMutation.mutateAsync,
    isCreatingCamp: createCampMutation.isPending,
    registerDonor: registerDonorMutation.mutateAsync,
    registerVolunteer: registerVolunteerMutation.mutateAsync,
    associateHospital: associateHospitalMutation.mutateAsync,
  };
};
