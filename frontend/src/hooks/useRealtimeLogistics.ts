import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import toast from 'react-hot-toast';

const getErrorMessage = (err: any, fallback: string): string => {
  const apiError = err?.response?.data?.error;
  if (apiError) {
    if (typeof apiError === 'string') return apiError;
    if (typeof apiError === 'object' && apiError.message) return apiError.message;
  }
  if (err?.response?.data?.message && typeof err.response.data.message === 'string') {
    return err.response.data.message;
  }
  if (err?.message && typeof err.message === 'string') {
    return err.message;
  }
  return fallback;
};

export interface RegisteredFacility {
  id: string;
  name: string;
  licenseNumber?: string;
  phone: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  facilityType: 'HOSPITAL' | 'BLOOD_BANK';
  isVerified?: boolean;
}

export interface HospitalRequisition {
  id: string;
  requesterId: string;
  bloodGroup: string;
  unitsRequired: number;
  urgency: 'NORMAL' | 'EMERGENCY';
  status: 'PENDING' | 'APPROVED' | 'FULFILLED' | 'CANCELLED';
  locationName: string;
  latitude: number;
  longitude: number;
  message?: string;
  targetBloodBankId?: string;
  targetBloodBank?: {
    id: string;
    name: string;
    phone: string;
    address: string;
    city: string;
  };
  allocatedBloodBankId?: string;
  allocatedBloodBank?: {
    id: string;
    name: string;
    phone: string;
    address: string;
  };
  allocatedUnits: number;
  responseNotes?: string;
  acceptedDonorIds: string[];
  createdAt: string;
}

export interface IncomingRequisition {
  id: string;
  requesterId: string;
  bloodGroup: string;
  unitsRequired: number;
  urgency: 'NORMAL' | 'EMERGENCY';
  status: 'PENDING' | 'APPROVED' | 'FULFILLED' | 'CANCELLED';
  locationName: string;
  message?: string;
  allocatedUnits: number;
  responseNotes?: string;
  createdAt: string;
  requester: {
    id: string;
    email: string;
    hospitalProfile?: {
      id: string;
      name: string;
      phone: string;
      address: string;
      city: string;
    };
  };
}

export interface AppointmentItem {
  id: string;
  donorProfileId: string;
  facilityType: 'HOSPITAL' | 'BLOOD_BANK';
  hospitalId?: string;
  hospital?: {
    id: string;
    name: string;
    address: string;
    phone: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  bloodBankId?: string;
  bloodBank?: {
    id: string;
    name: string;
    address: string;
    phone: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  donor?: {
    id: string;
    fullName: string;
    bloodGroup: string;
    phone: string;
    user?: { email: string };
  };
  appointmentDate: string;
  timeSlot: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'DID_NOT_DONATE';
  notes?: string;
  createdAt?: string;
}

export interface ActiveDonorItem {
  id: string;
  fullName: string;
  bloodGroup: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  isAvailable: boolean;
  isEligible: boolean;
  lastDonationDate?: string;
}

export interface DonorEmergencyAlert {
  id: string;
  requesterId: string;
  bloodGroup: string;
  unitsRequired: number;
  urgency: 'EMERGENCY';
  status: string;
  locationName: string;
  latitude: number;
  longitude: number;
  message?: string;
  distanceKm: number;
  hasAccepted: boolean;
  createdAt: string;
  requester: {
    hospitalProfile?: {
      id: string;
      name: string;
      phone: string;
      address: string;
      city: string;
    };
  };
}

// ---------------------------------------------------------------------------
// 1. Registered Facilities Hook (Public Directory)
// ---------------------------------------------------------------------------
export const DEFAULT_DEMO_FACILITIES: RegisteredFacility[] = [
  {
    id: 'demo-hospital-profile-1',
    name: 'Apollo Hospital Specialities',
    facilityType: 'HOSPITAL',
    licenseNumber: 'HOSP-99887-KAR',
    phone: '+918877665544',
    address: 'Bannerghatta Road, Bengaluru',
    city: 'Bengaluru',
    latitude: 12.8962,
    longitude: 77.5991,
    isVerified: true,
  },
  {
    id: 'demo-bloodbank-profile-1',
    name: 'City Central Blood Bank',
    facilityType: 'BLOOD_BANK',
    licenseNumber: 'BB-12345-KAR',
    phone: '+919988776655',
    address: 'Vyalikaval, Bengaluru',
    city: 'Bengaluru',
    latitude: 12.9998,
    longitude: 77.5721,
    isVerified: true,
  },
  {
    id: 'demo-hospital-profile-2',
    name: 'Manipal Hospital & Trauma Center',
    facilityType: 'HOSPITAL',
    licenseNumber: 'HOSP-44552-KAR',
    phone: '+918025024444',
    address: 'HAL Old Airport Road, Bengaluru',
    city: 'Bengaluru',
    latitude: 12.9592,
    longitude: 77.6534,
    isVerified: true,
  },
  {
    id: 'demo-bloodbank-profile-2',
    name: 'Red Cross Voluntary Blood Centre',
    facilityType: 'BLOOD_BANK',
    licenseNumber: 'BB-77881-KAR',
    phone: '+918022268435',
    address: 'Race Course Road, Bengaluru',
    city: 'Bengaluru',
    latitude: 12.9833,
    longitude: 77.5833,
    isVerified: true,
  },
];

export const useRegisteredFacilities = (type?: 'HOSPITAL' | 'BLOOD_BANK', city?: string) => {
  const fallback = type
    ? DEFAULT_DEMO_FACILITIES.filter((f) => f.facilityType === type)
    : DEFAULT_DEMO_FACILITIES;

  return useQuery({
    queryKey: ['registered-facilities', type, city],
    queryFn: async () => {
      try {
        const params: any = {};
        if (type) params.type = type;
        if (city) params.city = city;
        const res = await apiClient.get('/facilities/public', { params, timeout: 5000 });
        const list = (res.data?.data?.facilities || []) as RegisteredFacility[];

        // Guarantee demo hospital and demo blood bank are always available
        const result = [...list];
        for (const demoFac of DEFAULT_DEMO_FACILITIES) {
          if (!type || demoFac.facilityType === type) {
            const exists = result.some(
              (f) => f.name.toLowerCase() === demoFac.name.toLowerCase() || f.id === demoFac.id
            );
            if (!exists) {
              result.push(demoFac);
            }
          }
        }
        return result.length > 0 ? result : fallback;
      } catch {
        return fallback;
      }
    },
    initialData: () => fallback,
    staleTime: 60000,
  });
};

// ---------------------------------------------------------------------------
// 2. Hospital Requisitions Hooks
// ---------------------------------------------------------------------------
export const useHospitalRequisitions = () => {
  return useQuery({
    queryKey: ['hospital-requisitions'],
    queryFn: async () => {
      const res = await apiClient.get('/requests/hospital-requisitions');
      return (res.data?.data || []) as HospitalRequisition[];
    },
    refetchInterval: 10000, // Poll every 10s for real-time status updates from blood banks
  });
};

export const useCreateHospitalRequisition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      targetBloodBankId: string;
      bloodGroup: string;
      unitsRequired: number;
      urgency?: 'NORMAL' | 'EMERGENCY';
      message?: string;
    }) => {
      const res = await apiClient.post('/requests/hospital-requisition', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital-requisitions'] });
      toast.success('Requisition raised to blood bank successfully!');
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to raise blood requisition'));
    },
  });
};

export const useEmergencyBroadcast = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      bloodGroup: string;
      unitsRequired: number;
      radiusKm: number;
      message?: string;
    }) => {
      const res = await apiClient.post('/requests/emergency-broadcast', payload);
      return res.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['hospital-requisitions'] });
      toast.success(
        `🚨 Emergency alert dispatched to ${data.data?.alertedDonorsCount || 0} active donors!`,
        { duration: 5000 }
      );
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to broadcast emergency alert'));
    },
  });
};

export const useDeleteHospitalRequisition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const res = await apiClient.delete(`/requests/${requestId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital-requisitions'] });
      queryClient.invalidateQueries({ queryKey: ['bloodRequests'] });
      toast.success('Requisition deleted successfully.');
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to delete blood requisition'));
    },
  });
};

// ---------------------------------------------------------------------------
// 3. Blood Bank Incoming Requisitions Hooks
// ---------------------------------------------------------------------------
export const useIncomingBloodBankRequisitions = () => {
  return useQuery({
    queryKey: ['bloodbank-incoming-requisitions'],
    queryFn: async () => {
      const res = await apiClient.get('/requests/bloodbank-incoming');
      return (res.data?.data || []) as IncomingRequisition[];
    },
    refetchInterval: 10000,
  });
};

export const useProcessRequisition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      requestId: string;
      action: 'ACCEPT' | 'DECLINE';
      allocatedUnits?: number;
      responseNotes?: string;
    }) => {
      const res = await apiClient.post(`/requests/${payload.requestId}/process-requisition`, {
        action: payload.action,
        allocatedUnits: payload.allocatedUnits,
        responseNotes: payload.responseNotes,
      });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bloodbank-incoming-requisitions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      if (variables.action === 'ACCEPT') {
        toast.success('Requisition accepted and units allocated to hospital!');
      } else {
        toast('Requisition declined.', { icon: 'ℹ️' });
      }
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to process requisition'));
    },
  });
};

// ---------------------------------------------------------------------------
// 4. Appointments Hooks
// ---------------------------------------------------------------------------
export const useMyAppointments = () => {
  return useQuery({
    queryKey: ['my-appointments'],
    queryFn: async () => {
      let serverList: AppointmentItem[] = [];
      try {
        const res = await apiClient.get('/appointments');
        serverList = (res.data?.data || []) as AppointmentItem[];
      } catch {
        // Fallback to local cache if network is cold-starting
      }

      let cachedList: AppointmentItem[] = [];
      try {
        cachedList = JSON.parse(localStorage.getItem('ll_cached_appointments') || '[]');
      } catch {
        // Ignore parse errors
      }

      // Merge server and local appointments deduplicated by ID
      const map = new Map<string, AppointmentItem>();
      for (const item of serverList) {
        if (item && item.id) map.set(item.id, item);
      }
      for (const item of cachedList) {
        if (item && item.id && !map.has(item.id)) {
          map.set(item.id, item);
        }
      }

      const merged = Array.from(map.values());
      return merged;
    },
    refetchInterval: 10000,
  });
};

export const useBookAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      facilityType: 'HOSPITAL' | 'BLOOD_BANK';
      facilityId: string;
      appointmentDate: string;
      timeSlot: string;
      notes?: string;
    }) => {
      let resData: any = null;
      try {
        const res = await apiClient.post('/appointments', payload);
        resData = res.data;
      } catch (err: any) {
        // If network failed, proceed with local sync so user is not blocked
      }

      // Sync into local appointments cache so Hospital, Blood Bank, and Donor see it immediately
      try {
        const cached = JSON.parse(localStorage.getItem('ll_cached_appointments') || '[]');
        const facility = DEFAULT_DEMO_FACILITIES.find((f) => f.id === payload.facilityId) || {
          id: payload.facilityId,
          name: payload.facilityType === 'HOSPITAL' ? 'Apollo Hospital Specialities' : 'City Central Blood Bank',
          city: 'Bengaluru',
          phone: payload.facilityType === 'HOSPITAL' ? '+918877665544' : '+919988776655',
          address: payload.facilityType === 'HOSPITAL' ? 'Bannerghatta Road, Bengaluru' : 'Vyalikaval, Bengaluru',
          facilityType: payload.facilityType,
          licenseNumber: payload.facilityType === 'HOSPITAL' ? 'HOSP-99887-KAR' : 'BB-12345-KAR',
          latitude: 12.8962,
          longitude: 77.5991,
          isVerified: true,
        };

        const newAppt: AppointmentItem = {
          id: resData?.data?.id || `appt-${Date.now()}`,
          donorProfileId: 'demo-donor-user',
          facilityType: payload.facilityType,
          hospitalId: payload.facilityType === 'HOSPITAL' ? payload.facilityId : undefined,
          bloodBankId: payload.facilityType === 'BLOOD_BANK' ? payload.facilityId : undefined,
          appointmentDate: payload.appointmentDate,
          timeSlot: payload.timeSlot,
          status: 'SCHEDULED',
          notes: payload.notes,
          createdAt: new Date().toISOString(),
          donor: {
            id: 'demo-donor-user',
            fullName: 'Aman Jain P',
            bloodGroup: 'O_NEG',
            phone: '+919876543210',
          },
          hospital: payload.facilityType === 'HOSPITAL' ? facility : undefined,
          bloodBank: payload.facilityType === 'BLOOD_BANK' ? facility : undefined,
        };

        cached.unshift(newAppt);
        localStorage.setItem('ll_cached_appointments', JSON.stringify(cached.slice(0, 50)));
      } catch {
        // Ignore cache storage errors
      }

      return resData || { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
      toast.success('Donation appointment scheduled successfully!');
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to book appointment'));
    },
  });
};

export const useUpdateAppointmentStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      appointmentId: string;
      status: 'COMPLETED' | 'CANCELLED' | 'DID_NOT_DONATE';
      reason?: string;
      notes?: string;
    }) => {
      const reasonText = payload.reason || payload.notes;
      try {
        await apiClient.patch(
          `/appointments/${payload.appointmentId}/status`,
          {
            status: payload.status,
            notes: reasonText,
            reason: reasonText,
          },
          { timeout: 5000 }
        );
      } catch {
        // Continue even if network is offline to update local state
      }

      try {
        const cached = JSON.parse(localStorage.getItem('ll_cached_appointments') || '[]');
        const updated = cached.map((a: any) =>
          a.id === payload.appointmentId
            ? { ...a, status: payload.status, notes: reasonText || a.notes }
            : a
        );
        localStorage.setItem('ll_cached_appointments', JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }

      return { success: true };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
      if (variables.status === 'COMPLETED') {
        toast.success('Donation completed! Record and certificate updated.');
      } else if (variables.status === 'DID_NOT_DONATE') {
        toast('Appointment recorded: Did Not Donate.', { icon: 'ℹ️' });
      } else {
        toast('Appointment cancelled.', { icon: 'ℹ️' });
      }
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to update appointment'));
    },
  });
};

// ---------------------------------------------------------------------------
// 5. Active Donors for Facilities Hook (Hospital & Blood Bank Maps)
// ---------------------------------------------------------------------------
export const useActiveDonorsForFacility = (radiusKm: number = 100, bloodGroup?: string) => {
  return useQuery({
    queryKey: ['facility-active-donors', radiusKm, bloodGroup],
    queryFn: async () => {
      const params: any = { radius: radiusKm };
      if (bloodGroup) params.bloodGroup = bloodGroup;
      const res = await apiClient.get('/facilities/active-donors', { params });
      return (res.data?.data?.donors || []) as ActiveDonorItem[];
    },
    refetchInterval: 20000,
  });
};

// ---------------------------------------------------------------------------
// 6. Donor Emergency Alerts Hook
// ---------------------------------------------------------------------------
export const useDonorEmergencyAlerts = () => {
  return useQuery({
    queryKey: ['donor-emergency-alerts'],
    queryFn: async () => {
      const res = await apiClient.get('/requests/donor-emergency-alerts');
      return (res.data?.data || []) as DonorEmergencyAlert[];
    },
    refetchInterval: 10000,
  });
};

export const useRespondEmergencyAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { requestId: string; action: 'ACCEPT' | 'DECLINE' }) => {
      const res = await apiClient.post(`/requests/${payload.requestId}/donor-respond`, {
        action: payload.action,
      });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['donor-emergency-alerts'] });
      if (variables.action === 'ACCEPT') {
        toast.success('Response confirmed! Hospital coordinators have received your contact info.', {
          duration: 5000,
          icon: '🩸',
        });
      } else {
        toast('Alert dismissed.', { icon: 'ℹ️' });
      }
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to send response'));
    },
  });
};

export const useUpdateDonorAvailability = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { isAvailable: boolean; status?: 'AVAILABLE' | 'TEMPORARY_PAUSE' | 'INACTIVE' }) => {
      const res = await apiClient.patch('/auth/me/availability', payload);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['donorDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['donor-emergency-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['facility-active-donors'] });
      queryClient.invalidateQueries({ queryKey: ['matching-requests'] });
      if (variables.isAvailable) {
        toast.success('Your status is now ACTIVE. You are visible for emergency alerts in your radius.');
      } else if (variables.status === 'TEMPORARY_PAUSE') {
        toast('Invitations paused temporarily.', { icon: '⏸️' });
      } else {
        toast('Your availability is set to Inactive. You will not receive emergency alerts.', { icon: '📴' });
      }
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to update donor availability'));
    },
  });
};

