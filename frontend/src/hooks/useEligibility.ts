import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import toast from 'react-hot-toast';

export interface EligibilityStatus {
  isEligible: boolean;
  nextEligibleDate?: string;
  lastDonationDate?: string;
}

export const useEligibility = (donorId?: string) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['eligibility', donorId],
    queryFn: async () => {
      try {
        if (!donorId) return null;
        const res = await apiClient.get(`/eligibility/donor/${donorId}`).catch(() => null);
        return (res?.data?.data?.eligibility || {
          isEligible: true,
          nextEligibleDate: null,
          lastDonationDate: null,
        }) as EligibilityStatus;
      } catch {
        return null;
      }
    },
    enabled: !!donorId,
  });

  const submitQuestionnaireMutation = useMutation({
    mutationFn: async (data: {
      weight: number;
      hadInfections: boolean;
      recentTattooOrPiercing: boolean;
      recentSurgery: boolean;
      isPregnantOrLactating: boolean;
      consentDpdp: boolean;
    }) => {
      const payload = {
        weight: data.weight,
        hasInfections: data.hadInfections,
        recentTattooOrPiercing: data.recentTattooOrPiercing,
        recentSurgery: data.recentSurgery,
        isPregnantOrBreastfeeding: data.isPregnantOrLactating,
      };
      const res = await apiClient.post('/eligibility', payload);
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ['eligibility'] });
      queryClient.invalidateQueries({ queryKey: ['donorDashboard'] });
      
      const isEligible = resData?.data?.eligibility?.isEligible;
      if (isEligible) {
        toast.success('Congratulations! You are medically eligible to donate blood.');
      } else {
        toast.error('You are currently deferred from blood donation due to safety standards.');
      }
    },
    onError: (err: any) => {
      const errorMsg = err?.response?.data?.error?.message || err?.message || 'Failed to submit medical eligibility screening.';
      toast.error(`Submission Failed: ${errorMsg}`);
    },
  });

  return {
    ...query,
    submitQuestionnaire: submitQuestionnaireMutation.mutateAsync,
    isSubmitting: submitQuestionnaireMutation.isPending,
  };
};
