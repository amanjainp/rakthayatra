import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FileCheck, AlertTriangle } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Terms of Service & Clinical Disclaimers">
      <div className="space-y-5 text-slate-200 text-xs leading-relaxed max-h-[480px] overflow-y-auto pr-2">
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-950/20 flex gap-3 items-center">
          <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
          <div>
            <h4 className="font-bold text-white text-sm">Non-Commercial Voluntary Platform</h4>
            <p className="text-[11px] text-slate-300">
              Commercial sale or purchase of human blood is strictly illegal under the Drugs and Cosmetics Act. Rakthayatra LifeLink supports 100% voluntary, unpaid blood donation.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h5 className="font-bold text-white text-xs uppercase tracking-wider text-rose-400">
            1. Role of the Software Platform
          </h5>
          <p className="text-slate-300">
            LifeLink is a digital coordination and inventory tracking tool connecting donors, patients, hospitals, and licensed blood banks. LifeLink does not independently store, test, or physically dispense blood units.
          </p>
        </div>

        <div className="space-y-2">
          <h5 className="font-bold text-white text-xs uppercase tracking-wider text-rose-400">
            2. Clinical Compatibility & Testing Responsibility
          </h5>
          <p className="text-slate-300">
            Blood-group matching alone does not establish clinical compatibility. Cross-matching, infectious disease screening (HIV, Hepatitis B & C, Syphilis, Malaria), and component separation must be performed exclusively by authorized blood bank and hospital clinical staff before transfusion.
          </p>
        </div>

        <div className="space-y-2">
          <h5 className="font-bold text-white text-xs uppercase tracking-wider text-rose-400">
            3. Accuracy of User Declarations
          </h5>
          <p className="text-slate-300">
            Donors and requesters agree to provide truthful and accurate information. Intentionally submitting counterfeit medical records, fraudulent licenses, or malicious emergency requests is a criminal offense and will result in immediate permanent suspension and referral to authorities.
          </p>
        </div>

        <div className="space-y-2">
          <h5 className="font-bold text-white text-xs uppercase tracking-wider text-rose-400">
            4. Emergency Situations
          </h5>
          <p className="text-slate-300">
            In active medical emergencies where immediate life-saving care is required, users must directly engage local emergency medical services (<strong className="text-rose-400">108</strong> / <strong className="text-rose-400">104</strong>) or visit the nearest emergency trauma center without sole reliance on software notifications.
          </p>
        </div>

        <div className="pt-2 flex justify-end">
          <Button variant="primary" onClick={onClose} className="px-6 flex items-center gap-1.5">
            <FileCheck className="w-3.5 h-3.5" /> Accept & Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
export default TermsModal;
