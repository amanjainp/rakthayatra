import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { MessageSquare, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactSupportModal: React.FC<ContactSupportModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [category, setCategory] = useState('TECHNICAL');
  const [urgency, setUrgency] = useState('NORMAL');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !subject.trim()) {
      toast.error('Please complete all required fields');
      return;
    }

    const ticketId = `LL-${Math.floor(100000 + Math.random() * 900000)}`;
    setSubmittedTicket(ticketId);
    toast.success(`Support Ticket #${ticketId} created!`);
  };

  const handleReset = () => {
    setSubmittedTicket(null);
    setSubject('');
    setDescription('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleReset} title="LifeLink Contact & Support Desk">
      {submittedTicket ? (
        <div className="text-center py-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Support Ticket Filed Successfully</h3>
            <p className="text-xs text-slate-400 mt-1">Reference ID: <span className="font-mono font-bold text-rose-400">{submittedTicket}</span></p>
          </div>
          <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
            Our coordination desk has received your report. If this concerns an active emergency patient request, please call the priority helpline <strong className="text-white">104</strong> immediately.
          </p>
          <Button variant="primary" onClick={handleReset} className="w-full">
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Issue Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-rose-500/40"
              >
                <option value="TECHNICAL">Technical / Login Issue</option>
                <option value="DATA_CORRECTION">Data / Profile Correction</option>
                <option value="SUSPICIOUS">Report Suspicious Request</option>
                <option value="HOSPITAL">Hospital Coordination Issue</option>
                <option value="GENERAL">General Platform Question</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Priority Level</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-rose-500/40"
              >
                <option value="NORMAL">Normal (Within 24 Hours)</option>
                <option value="HIGH">High (Within 4 Hours)</option>
                <option value="CRITICAL">Critical (Immediate Escalation)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Your Email / Contact</label>
            <input
              type="text"
              readOnly
              value={user?.email || 'Public Visitor (Guest)'}
              className="w-full bg-slate-900/50 border border-slate-800/80 rounded-xl px-3 py-2 text-slate-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Subject Summary *</label>
            <input
              type="text"
              placeholder="Brief summary of the issue or inquiry"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-rose-500/40"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Detailed Explanation *</label>
            <textarea
              rows={4}
              placeholder="Describe the discrepancy, request ID, facility name, or issue encountered in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-rose-500/40"
              required
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <span>
              False emergency reports delay genuine patient transfusions. All submissions are logged with IP audit trails.
            </span>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Submit Support Ticket
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
export default ContactSupportModal;
