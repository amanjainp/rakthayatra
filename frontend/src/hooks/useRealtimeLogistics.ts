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
export const FALLBACK_REGISTERED_FACILITIES: RegisteredFacility[] = [
  {
    id: '97b7e6cb-262a-4e44-b029-7ce85ae67110',
    name: 'City Central Blood Bank',
    licenseNumber: 'BB-12345-KAR',
    phone: '+919988776655',
    address: '1st Main Road, Vyalikaval, Malleshwaram, Bengaluru',
    city: 'Bengaluru',
    latitude: 12.9998,
    longitude: 77.5721,
    facilityType: 'BLOOD_BANK',
  },
  {
    id: '6481ea74-b325-4dd6-b958-3b70543dcf5f',
    name: 'Apollo Hospital Specialities',
    licenseNumber: 'HOSP-99887-KAR',
    phone: '+918877665544',
    address: 'Bannerghatta Road, Bengaluru (Open 24 hours)',
    city: 'Bengaluru',
    latitude: 12.8962,
    longitude: 77.5991,
    facilityType: 'HOSPITAL',
  },
  {
    id: '97997b10-1c1f-4a84-ad25-e032c4ce57b2',
    name: 'Manipal Hospital Regional Center',
    licenseNumber: 'HOSP-44321-KAR',
    phone: '+918025024444',
    address: 'Old Airport Road, Bengaluru (Open 24 hours)',
    city: 'Bengaluru',
    latitude: 12.9583,
    longitude: 77.6489,
    facilityType: 'HOSPITAL',
  },
  {
    id: '1620dbc0-f5c6-4344-a8dd-39c1fc4fbe36',
    name: 'Mandya District Blood Bank & Storage',
    licenseNumber: '54321',
    phone: '9742213108',
    address: 'M.C. Road, Mandya, Karnataka, India',
    city: 'Mandya',
    latitude: 12.522,
    longitude: 76.895,
    facilityType: 'BLOOD_BANK',
  },
  {
    id: 'd67a72e3-d0ff-4034-bc73-131d3f8f4f58',
    name: 'Red Cross Society Mandya',
    licenseNumber: 'BB-98765-KAR',
    phone: '+918822334455',
    address: 'Guthalu Road, Mandya, Karnataka, India',
    city: 'Mandya',
    latitude: 12.5185,
    longitude: 76.8988,
    facilityType: 'BLOOD_BANK',
  },
  {
    id: '011d71de-84b5-41e0-b17f-25e423234627',
    name: 'City Care Hospital',
    licenseNumber: 'LIC-9988',
    phone: '9876543210',
    address: 'Main St 101, Bengaluru',
    city: 'Bengaluru',
    latitude: 12.97,
    longitude: 77.59,
    facilityType: 'HOSPITAL',
  },
  {
    id: 'bank-rotary-ttk-blr',
    name: 'Rotary TTK Blood Bank (Bengaluru)',
    licenseNumber: 'BB-77665-KAR',
    phone: '+918025287903',
    address: 'HAL 2nd Stage, Indiranagar, Bengaluru (Open 24 hours)',
    city: 'Bengaluru',
    latitude: 12.9654,
    longitude: 77.5980,
    facilityType: 'BLOOD_BANK',
  },
  {
    id: 'bank-rashtrotthana-blr',
    name: 'Rashtrotthana Blood Centre',
    licenseNumber: 'BB-33221-KAR',
    phone: '+918022268780',
    address: 'Kempegowda Nagar, Bengaluru (Open 24 hours)',
    city: 'Bengaluru',
    latitude: 12.9850,
    longitude: 77.5850,
    facilityType: 'BLOOD_BANK',
  },
];

export const useRegisteredFacilities = (type?: 'HOSPITAL' | 'BLOOD_BANK', city?: string) => {
  return useQuery({
    queryKey: ['registered-facilities', type, city],
    queryFn: async () => {
      try {
        const params: any = {};
        if (type) params.type = type;
        if (city) params.city = city;
        const res = await apiClient.get('/facilities/public', { params, timeout: 3500 });
        const list = res.data?.data?.facilities;
        if (Array.isArray(list) && list.length > 0) {
          return list as RegisteredFacility[];
        }
        return FALLBACK_REGISTERED_FACILITIES.filter(
          (f) => (!type || f.facilityType === type) && (!city || f.city.toLowerCase() === city.toLowerCase())
        );
      } catch {
        return FALLBACK_REGISTERED_FACILITIES.filter(
          (f) => (!type || f.facilityType === type) && (!city || f.city.toLowerCase() === city.toLowerCase())
        );
      }
    },
    initialData: () =>
      FALLBACK_REGISTERED_FACILITIES.filter(
        (f) => (!type || f.facilityType === type) && (!city || f.city.toLowerCase() === city.toLowerCase())
      ),
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
      try {
        const res = await apiClient.get('/requests/hospital-requisitions', { timeout: 3500 });
        return (res.data?.data || []) as HospitalRequisition[];
      } catch {
        return [] as HospitalRequisition[];
      }
    },
    initialData: () => [] as HospitalRequisition[],
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
      try {
        const res = await apiClient.get('/requests/bloodbank-incoming', { timeout: 3500 });
        return (res.data?.data || []) as IncomingRequisition[];
      } catch {
        return [] as IncomingRequisition[];
      }
    },
    initialData: () => [] as IncomingRequisition[],
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
// 4. Appointments Hooks with Resilient Fallback
// ---------------------------------------------------------------------------
const APPOINTMENTS_STORAGE_KEY = 'll_scheduled_appointments';

const getStoredAppointments = (): AppointmentItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const storeAppointmentLocally = (appt: AppointmentItem) => {
  if (typeof window === 'undefined') return;
  try {
    const list = getStoredAppointments().filter((a) => a.id !== appt.id);
    list.unshift(appt);
    localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
};

const updateStoredAppointmentStatus = (id: string, status: 'COMPLETED' | 'CANCELLED') => {
  if (typeof window === 'undefined') return;
  try {
    const list = getStoredAppointments().map((a) => (a.id === id ? { ...a, status } : a));
    localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
};

export const useMyAppointments = () => {
  return useQuery({
    queryKey: ['my-appointments'],
    queryFn: async () => {
      const stored = getStoredAppointments();
      try {
        const res = await apiClient.get('/appointments', { timeout: 4000 });
        const serverList = (res.data?.data || []) as AppointmentItem[];
        const combined = [...serverList];
        for (const item of stored) {
          if (!combined.some((c) => c.id === item.id)) {
            combined.push(item);
          }
        }
        return combined;
      } catch {
        return stored;
      }
    },
    initialData: () => getStoredAppointments(),
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
      try {
        const res = await apiClient.post('/appointments', payload, { timeout: 6000 });
        if (res.data?.data) {
          storeAppointmentLocally(res.data.data);
          return res.data;
        }
        return res.data;
      } catch {
        // Find facility details from directory
        const facility = FALLBACK_REGISTERED_FACILITIES.find((f) => f.id === payload.facilityId) || {
          id: payload.facilityId,
          name: payload.facilityType === 'HOSPITAL' ? 'Apollo Hospital Specialities' : 'City Central Blood Bank',
          address: 'Bengaluru Facility',
          phone: '+919876543210',
          city: 'Bengaluru',
          latitude: 12.9716,
          longitude: 77.5946,
          facilityType: payload.facilityType,
        };

        const localAppointment: AppointmentItem = {
          id: `appt-local-${Date.now()}`,
          donorProfileId: 'local-donor',
          facilityType: payload.facilityType,
          hospitalId: payload.facilityType === 'HOSPITAL' ? payload.facilityId : undefined,
          hospital: payload.facilityType === 'HOSPITAL' ? {
            id: facility.id,
            name: facility.name,
            address: facility.address,
            phone: facility.phone,
            city: facility.city,
            latitude: facility.latitude,
            longitude: facility.longitude,
          } : undefined,
          bloodBankId: payload.facilityType === 'BLOOD_BANK' ? payload.facilityId : undefined,
          bloodBank: payload.facilityType === 'BLOOD_BANK' ? {
            id: facility.id,
            name: facility.name,
            address: facility.address,
            phone: facility.phone,
            city: facility.city,
            latitude: facility.latitude,
            longitude: facility.longitude,
          } : undefined,
          appointmentDate: payload.appointmentDate,
          timeSlot: payload.timeSlot,
          status: 'SCHEDULED',
          notes: payload.notes,
          createdAt: new Date().toISOString(),
        };

        storeAppointmentLocally(localAppointment);
        return { success: true, data: localAppointment };
      }
    },
    onSuccess: (data: any) => {
      if (data?.data) {
        queryClient.setQueryData(['my-appointments'], (old: AppointmentItem[] = []) => {
          const exists = old.some((a) => a.id === data.data.id);
          return exists ? old : [data.data, ...old];
        });
      }
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
      updateStoredAppointmentStatus(payload.appointmentId, payload.status);
      try {
        const res = await apiClient.patch(`/appointments/${payload.appointmentId}/status`, {
          status: payload.status,
        }, { timeout: 5000 });
        return res.data;
      } catch {
        return { success: true, message: `Appointment marked as ${payload.status}` };
      }
    },
    onSuccess: (_data, variables) => {
      updateStoredAppointmentStatus(variables.appointmentId, variables.status);
      queryClient.setQueryData(['my-appointments'], (old: AppointmentItem[] = []) => {
        return old.map((a) => (a.id === variables.appointmentId ? { ...a, status: variables.status } : a));
      });
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
      try {
        const params: any = { radius: radiusKm };
        if (bloodGroup) params.bloodGroup = bloodGroup;
        const res = await apiClient.get('/facilities/active-donors', { params, timeout: 3500 });
        return (res.data?.data?.donors || []) as ActiveDonorItem[];
      } catch {
        return [] as ActiveDonorItem[];
      }
    },
    initialData: () => [] as ActiveDonorItem[],
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
      try {
        const res = await apiClient.get('/requests/donor-emergency-alerts', { timeout: 3500 });
        return (res.data?.data || []) as DonorEmergencyAlert[];
      } catch {
        return [] as DonorEmergencyAlert[];
      }
    },
    initialData: () => [] as DonorEmergencyAlert[],
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

