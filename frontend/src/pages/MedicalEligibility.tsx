import React from 'react';
import { useEligibility } from '../hooks/useEligibility';
import { useAuth } from '../hooks/useAuth';
import { ClipboardCheck, ShieldAlert, Award, Calendar, HelpCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useForm } from 'react-hook-form';

export const MedicalEligibility: React.FC = () => {
  const { user } = useAuth();
  const { data: status, submitQuestionnaire, isSubmitting } = useEligibility(user?.id);

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      weight: 55,
      hadInfections: false,
      recentTattooOrPiercing: false,
      recentSurgery: false,
      isPregnantOrLactating: false,
      consentDpdp: true,
    }
  });

  const onSubmit = async (values: any) => {
    try {
      await submitQuestionnaire({
        weight: Number(values.weight),
        hadInfections: values.hadInfections,
        recentTattooOrPiercing: values.recentTattooOrPiercing,
        recentSurgery: values.recentSurgery,
        isPregnantOrLactating: values.isPregnantOrLactating,
        consentDpdp: values.consentDpdp,
      });
    } catch {
      // handled
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
          <ClipboardCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display">Medical Eligibility</h2>
          <p className="text-xs text-slate-400">Fill out screening checks to ensure blood transfusion safety guidelines are met</p>
        </div>
      </div>

      {/* Current Status Banner */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/10 space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Current Eligibility</h3>
            <div className="flex items-center gap-3">
              {status.isEligible ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Award className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <span className="block text-lg font-bold text-white font-display">Eligible to Donate</span>
                    <span className="block text-xs text-slate-400">You meet all active safety conditions.</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="block text-lg font-bold text-white font-display">Deferred / Resting</span>
                    <span className="block text-xs text-slate-400">You are deferred from donating.</span>
                  </div>
                </>
              )}
            </div>
            {status.nextEligibleDate && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-2 border-t border-slate-800/60">
                <Calendar className="w-4 h-4 text-slate-500" />
                Next Eligible Donation Date: <span className="font-semibold text-rose-400">{new Date(status.nextEligibleDate).toLocaleDateString()}</span>
              </p>
            )}
          </div>

          <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/10 flex flex-col justify-between">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Deferral Windows</h3>
            <div className="space-y-1.5 text-xs text-slate-400 leading-normal">
              <p>• Standard Donation deferral: <span className="text-rose-400 font-semibold">90 Days</span> interval.</p>
              <p>• Tattoo/Piercing/Surgeries: <span className="text-rose-400 font-semibold">180 Days</span> deferral.</p>
              <p>• Pregnancy or childbirth: <span className="text-rose-400 font-semibold">365 Days</span> deferral.</p>
              <p>• Underweight guidelines: Minimum weight limit is <span className="text-rose-400 font-semibold">50 Kg</span>.</p>
            </div>
          </div>
        </div>
      )}

      {/* Survey Form */}
      <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/10 space-y-6">
        <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-rose-500" /> Screening Questionnaire
        </h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="max-w-md">
            <Input
              label="Weight (in Kg)"
              type="number"
              {...register('weight', {
                required: 'Weight is required',
                min: { value: 50, message: 'Weight must be at least 50 kg' },
                max: { value: 150, message: 'Weight must not exceed 150 kg' }
              })}
              error={errors.weight?.message}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="hadInfections"
                {...register('hadInfections')}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-rose-600 focus:ring-rose-500/20 mt-1"
              />
              <label htmlFor="hadInfections" className="text-sm text-slate-300 select-none leading-normal">
                I have had active infections (e.g. malaria, jaundice, typhoid) in the last 6 months.
              </label>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="recentTattooOrPiercing"
                {...register('recentTattooOrPiercing')}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-rose-600 focus:ring-rose-500/20 mt-1"
              />
              <label htmlFor="recentTattooOrPiercing" className="text-sm text-slate-300 select-none leading-normal">
                I received a tattoo, ear/body piercing, or acupuncture treatment in the last 180 days.
              </label>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="recentSurgery"
                {...register('recentSurgery')}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-rose-600 focus:ring-rose-500/20 mt-1"
              />
              <label htmlFor="recentSurgery" className="text-sm text-slate-300 select-none leading-normal">
                I undergone major dental work or medical surgery treatments in the last 180 days.
              </label>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="isPregnantOrLactating"
                {...register('isPregnantOrLactating')}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-rose-600 focus:ring-rose-500/20 mt-1"
              />
              <label htmlFor="isPregnantOrLactating" className="text-sm text-slate-300 select-none leading-normal">
                I am currently pregnant or lactating (if applicable).
              </label>
            </div>

            <div className="flex items-start gap-3 pt-3 border-t border-slate-800/50">
              <input
                type="checkbox"
                id="consentDpdp"
                {...register('consentDpdp', { required: 'Consent is mandatory' })}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-rose-600 focus:ring-rose-500/20 mt-1"
              />
              <label htmlFor="consentDpdp" className="text-sm font-semibold text-slate-200 select-none leading-normal">
                I declare that the information provided is correct, and I consent to share my health metrics under local DPDP data protection rules.
              </label>
            </div>
          </div>

          <div className="flex justify-start">
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Evaluate Assessment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default MedicalEligibility;
