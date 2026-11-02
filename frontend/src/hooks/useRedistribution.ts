import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import toast from 'react-hot-toast';

export type BloodGroupCode =
  | 'A_POS'
  | 'A_NEG'
  | 'B_POS'
  | 'B_NEG'
  | 'AB_POS'
  | 'AB_NEG'
  | 'O_POS'
  | 'O_NEG';

export type BloodComponentCode =
  | 'WHOLE_BLOOD'
  | 'PACKED_RBC'
  | 'PLASMA'
  | 'PLATELETS'
  | 'CRYOPRECIPITATE';

export type RedistributionUrgencyCode = 'ROUTINE' | 'URGENT' | 'CRITICAL';

export type RedistributionStatusCode =
  | 'REQUESTED'
  | 'MATCHING'
  | 'PROPOSED'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'RESERVED'
  | 'READY_FOR_DISPATCH'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';

export interface RedistributionSummary {
  activeRedistributionRequests: number;
  incomingTransferRequests: number;
  outgoingTransferRequests: number;
  unitsAwaitingDispatch: number;
  unitsCurrentlyInTransit: number;
  unitsReceivedInPeriod: number;
  urgentAndCriticalRequests: number;
  completedTransfers: number;
}

export interface RedistributionFilters {
  bloodGroup?: string;
  componentType?: string;
  urgency?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const formatBloodGroup = (bg?: string) => {
  if (!bg) return '';
  return bg.replace('_POS', '+').replace('_NEG', '-');
};

export const formatComponentType = (comp?: string) => {
  switch (comp) {
    case 'WHOLE_BLOOD':
      return 'Whole Blood';
    case 'PACKED_RBC':
      return 'Packed RBC (PRBC)';
    case 'PLASMA':
      return 'Fresh Frozen Plasma (FFP)';
    case 'PLATELETS':
      return 'Platelets (RDP/SDP)';
    case 'CRYOPRECIPITATE':
      return 'Cryoprecipitate';
    default:
      return comp || 'Whole Blood';
  }
};

function extractApiError(err: any, fallback: string): string {
  return (
    err?.response?.data?.error?.message ||
    (Array.isArray(err?.response?.data?.error?.details)
      ? err.response.data.error.details.map((d: any) => d.message).join(', ')
      : null) ||
    err?.message ||
    fallback
  );
}

export const useRedistributionDashboard = (filters?: RedistributionFilters) => {
  return useQuery({
    queryKey: ['redistribution', 'dashboard', filters],
    queryFn: async () => {
      const cleanParams: Record<string, any> = {};
      if (filters?.bloodGroup) cleanParams.bloodGroup = filters.bloodGroup;
      if (filters?.componentType) cleanParams.componentType = filters.componentType;
      if (filters?.urgency) cleanParams.urgency = filters.urgency;
      if (filters?.status) cleanParams.status = filters.status;
      if (filters?.search) cleanParams.search = filters.search;
      if (filters?.page) cleanParams.page = filters.page;
      if (filters?.limit) cleanParams.limit = filters.limit;

      const res = await apiClient.get('/redistribution', { params: cleanParams });
      return res.data.data;
    },
  });
};

export const useInstitutionInventory = (filters?: {
  bloodGroup?: string;
  componentType?: string;
  status?: string;
}) => {
  return useQuery({
    queryKey: ['redistribution', 'inventory', filters],
    queryFn: async () => {
      const res = await apiClient.get('/redistribution/inventory', { params: filters });
      return res.data.data;
    },
  });
};

export const useAddInstitutionInventory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      bloodGroup: BloodGroupCode;
      componentType: BloodComponentCode;
      unitsCount: number;
      expiryDate: string;
      batchNumber?: string;
      storageTemp?: string;
      targetHospitalId?: string;
      targetBloodBankId?: string;
    }) => {
      const res = await apiClient.post('/redistribution/inventory', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redistribution'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Institutional blood inventory registered.');
    },
    onError: (err: any) => {
      toast.error(extractApiError(err, 'Failed to register inventory stock.'));
    },
  });
};

export const useCreateRedistributionRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      bloodGroup: BloodGroupCode;
      componentType: BloodComponentCode;
      unitsRequired: number;
      urgency: RedistributionUrgencyCode;
      requiredBy: string;
      minRemainingShelfLifeDays?: number;
      deliveryAddress?: string;
      reason: string;
      specialHandlingNotes?: string;
      additionalNotes?: string;
      destinationHospitalId?: string;
      destinationBloodBankId?: string;
    }) => {
      const res = await apiClient.post('/redistribution/requests', payload);
      return res.data.data.request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redistribution'] });
      toast.success('Redistribution request created and source matching initiated.');
    },
    onError: (err: any) => {
      toast.error(extractApiError(err, 'Failed to create redistribution request.'));
    },
  });
};

export const useRedistributionRequestDetails = (requestId: string | null) => {
  return useQuery({
    queryKey: ['redistribution', 'request', requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const res = await apiClient.get(`/redistribution/requests/${requestId}`);
      return res.data.data.request;
    },
  });
};

export const useRedistributionMatches = (requestId: string | null) => {
  return useQuery({
    queryKey: ['redistribution', 'matches', requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const res = await apiClient.get(`/redistribution/requests/${requestId}/matches`);
      return res.data.data;
    },
  });
};

export const useCreateRedistributionProposal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      requestId: string;
      sourceFacilityType?: 'HOSPITAL' | 'BLOOD_BANK';
      sourceHospitalId?: string;
      sourceBloodBankId?: string;
      bloodGroup?: BloodGroupCode;
      unitsProposed: number;
      proposedInventoryIds?: string[];
      notes?: string;
    }) => {
      const { requestId, ...body } = payload;
      const res = await apiClient.post(`/redistribution/requests/${requestId}/proposals`, body);
      return res.data.data.proposal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redistribution'] });
      toast.success('Transfer proposal submitted successfully.');
    },
    onError: (err: any) => {
      toast.error(extractApiError(err, 'Failed to submit transfer proposal.'));
    },
  });
};

export const useApproveRedistributionProposal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { proposalId: string; notes?: string; idempotencyKey?: string }) => {
      const { proposalId, ...body } = payload;
      const res = await apiClient.post(`/redistribution/proposals/${proposalId}/approve`, body);
      return res.data.data.transfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redistribution'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Proposal approved and blood units atomically reserved.');
    },
    onError: (err: any) => {
      toast.error(extractApiError(err, 'Failed to approve proposal and reserve inventory.'));
    },
  });
};

export const useRejectRedistributionProposal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { proposalId: string; reason: string }) => {
      const res = await apiClient.post(`/redistribution/proposals/${payload.proposalId}/reject`, {
        reason: payload.reason,
      });
      return res.data.data.proposal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redistribution'] });
      toast.success('Transfer proposal rejected.');
    },
    onError: (err: any) => {
      toast.error(extractApiError(err, 'Failed to reject proposal.'));
    },
  });
};

export const useDispatchTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      transferId: string;
      shipmentReference?: string;
      dispatcherName: string;
      unitsDispatched?: number;
      transportVehicleDetails?: string;
      temperatureCheckConfirmed: boolean;
      coldChainNotes?: string;
      expectedArrivalAt?: string;
    }) => {
      const { transferId, ...body } = payload;
      const res = await apiClient.post(`/redistribution/transfers/${transferId}/dispatch`, body);
      return res.data.data.transfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redistribution'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Shipment dispatch recorded with cold-chain verification.');
    },
    onError: (err: any) => {
      toast.error(extractApiError(err, 'Failed to record shipment dispatch.'));
    },
  });
};

export const useMarkTransferInTransit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      transferId: string;
      inTransitNotes: string;
      expectedArrivalAt?: string;
    }) => {
      const { transferId, ...body } = payload;
      const res = await apiClient.post(`/redistribution/transfers/${transferId}/in-transit`, body);
      return res.data.data.transfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redistribution'] });
      toast.success('Manual in-transit status update recorded.');
    },
    onError: (err: any) => {
      toast.error(extractApiError(err, 'Failed to update transit status.'));
    },
  });
};

export const useReceiveTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      transferId: string;
      unitsReceived: number;
      damagedUnits?: number;
      receiverStaffName: string;
      conditionVerified: boolean;
      discrepancyReason?: string;
      autoComplete?: boolean;
    }) => {
      const { transferId, ...body } = payload;
      const res = await apiClient.post(`/redistribution/transfers/${transferId}/receive`, body);
      return res.data.data.transfer;
    },
    onSuccess: (transfer) => {
      queryClient.invalidateQueries({ queryKey: ['redistribution'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      if (transfer?.hasDiscrepancy) {
        toast.error('Receipt recorded with discrepancy; transfer flagged for review.');
      } else {
        toast.success('Shipment received, reconciled, and added to facility inventory.');
      }
    },
    onError: (err: any) => {
      toast.error(extractApiError(err, 'Failed to record shipment receipt.'));
    },
  });
};

export const useCompleteTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { transferId: string; resolutionNotes?: string }) => {
      const res = await apiClient.post(`/redistribution/transfers/${payload.transferId}/complete`, {
        resolutionNotes: payload.resolutionNotes,
      });
      return res.data.data.transfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redistribution'] });
      toast.success('Transfer reconciliation finalized and marked COMPLETED.');
    },
    onError: (err: any) => {
      toast.error(extractApiError(err, 'Failed to complete transfer.'));
    },
  });
};

export const useCancelRedistributionRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { requestId: string; reason: string }) => {
      const res = await apiClient.post(`/redistribution/requests/${payload.requestId}/cancel`, {
        reason: payload.reason,
      });
      return res.data.data.request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redistribution'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Redistribution request cancelled.');
    },
    onError: (err: any) => {
      toast.error(extractApiError(err, 'Failed to cancel redistribution request.'));
    },
  });
};

export const useCancelTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { transferId: string; reason: string }) => {
      const res = await apiClient.post(`/redistribution/transfers/${payload.transferId}/cancel`, {
        reason: payload.reason,
      });
      return res.data.data.transfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redistribution'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Transfer cancelled and reserved units restored to available stock.');
    },
    onError: (err: any) => {
      toast.error(extractApiError(err, 'Failed to cancel transfer.'));
    },
  });
};

export const useRedistributionHistory = (filters?: {
  status?: string;
  bloodGroup?: string;
  componentType?: string;
  startDate?: string;
  endDate?: string;
}) => {
  return useQuery({
    queryKey: ['redistribution', 'history', filters],
    queryFn: async () => {
      const res = await apiClient.get('/redistribution/history', { params: filters });
      return res.data.data;
    },
  });
};

export const useRedistributionAnalytics = () => {
  return useQuery({
    queryKey: ['redistribution', 'analytics'],
    queryFn: async () => {
      const res = await apiClient.get('/redistribution/analytics');
      return res.data.data;
    },
  });
};

