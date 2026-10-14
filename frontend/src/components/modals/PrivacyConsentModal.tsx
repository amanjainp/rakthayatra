import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Shield, Lock, EyeOff, FileText, CheckCircle2 } from 'lucide-react';

interface PrivacyConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyConsentModal: React.FC<PrivacyConsentModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="LifeLink Privacy Policy & Data Consent">
      <div className="space-y-5 text-slate-200 text-xs leading-relaxed max-h-[480px] overflow-y-auto pr-2">
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-950/20 flex gap-3 items-center">
          <Shield className="w-8 h-8 text-rose-400 shrink-0" />
          <div>
            <h4 className="font-bold text-white text-sm">Healthcare-Grade Data Privacy</h4>
            <p className="text-[11px] text-slate-300">
              Rakthayatra LifeLink is engineered to protect donor confidentiality and patient health records at all times.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h5 className="font-bold text-white flex items-center gap-1.5 text-xs uppercase tracking-wider text-rose-400">
            <Lock className="w-3.5 h-3.5" /> 1. Medical Data Cryptographic Encryption
          </h5>
          <p className="text-slate-300">
            All medical eligibility screening responses are encrypted using **AES-256-GCM** before touching our persistent database. Encryption keys undergo automated lifecycle rotation with versioned cryptographic envelopes, guaranteeing that unauthorized actors cannot read plaintext medical answers.
          </p>
        </div>

        <div className="space-y-3">
          <h5 className="font-bold text-white flex items-center gap-1.5 text-xs uppercase tracking-wider text-rose-400">
            <EyeOff className="w-3.5 h-3.5" /> 2. Privacy-Preserving Location & PII Masking
          </h5>
          <p className="text-slate-300">
            Public visitors cannot view donor telephone numbers, full addresses, or patient records. Location matching is computed using radial geospatial distance without exposing exact donor residential coordinates to the public web.
          </p>
        </div>

        <div className="space-y-3">
          <h5 className="font-bold text-white flex items-center gap-1.5 text-xs uppercase tracking-wider text-rose-400">
            <FileText className="w-3.5 h-3.5" /> 3. Immutable Audit Trails
          </h5>
          <p className="text-slate-300">
            Every access to medical records, inventory reservation, and profile verification is recorded in structured, immutable audit logs with correlation IDs for healthcare regulatory compliance.
          </p>
        </div>

        <div className="space-y-3">
          <h5 className="font-bold text-white flex items-center gap-1.5 text-xs uppercase tracking-wider text-rose-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> 4. User Consent & Right to Erasure
          </h5>
          <p className="text-slate-300">
            Donors maintain complete control over their availability. You can pause notifications, toggle availability to inactive, or request complete account erasure directly from your settings at any time.
          </p>
        </div>

        <div className="pt-2 flex justify-end">
          <Button variant="primary" onClick={onClose} className="px-6">
            Understood & Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
export default PrivacyConsentModal;
