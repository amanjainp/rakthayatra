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
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  createdAt: string;
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
export const useRegisteredFacilities = (type?: 'HOSPITAL' | 'BLOOD_BANK', city?: string) => {
  return useQuery({
    queryKey: ['registered-facilities', type, city],
    queryFn: async () => {
      const params: any = {};
      if (type) params.type = type;
      if (city) params.city = city;
      const res = await apiClient.get('/facilities/public', { params });
      return (res.data?.data?.facilities || []) as RegisteredFacility[];
    },
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
      const res = await apiClient.get('/appointments');
      return (res.data?.data || []) as AppointmentItem[];
    },
    refetchInterval: 15000,
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
      const res = await apiClient.post('/appointments', payload);
      return res.data;
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
      status: 'COMPLETED' | 'CANCELLED';
    }) => {
      const res = await apiClient.patch(`/appointments/${payload.appointmentId}/status`, {
        status: payload.status,
      });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
      if (variables.status === 'COMPLETED') {
        toast.success('Donation completed! Record and certificate updated.');
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
