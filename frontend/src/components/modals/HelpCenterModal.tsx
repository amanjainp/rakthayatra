import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { HelpCircle, Search, ChevronRight, BookOpen, ShieldCheck, HeartHandshake, PhoneCall } from 'lucide-react';

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const faqs = [
    {
      category: 'donation',
      q: 'Who can donate blood on LifeLink?',
      a: 'Any individual aged 18–65, weighing at least 45kg, with a hemoglobin level of 12.5 g/dL or higher, in good general health, and who has not donated blood in the last 90 days (males) or 120 days (females).',
    },
    {
      category: 'donation',
      q: 'How long does a blood donation take?',
      a: 'The actual blood collection takes only 8–10 minutes. The entire appointment, including brief health screening and post-donation rest with refreshments, takes about 30–40 minutes.',
    },
    {
      category: 'requests',
      q: 'How quickly are emergency blood requests matched?',
      a: 'Emergency requests trigger automated geospatial radial matching within 25 km, notifying matching available donors and participating blood banks with compatible inventory in under 45 seconds.',
    },
    {
      category: 'requests',
      q: 'What is the difference between Normal and Emergency urgency?',
      a: 'Normal requests are for scheduled surgeries or chronic transfusions needed within 24–72 hours. Emergency requests require urgent life-saving transfusion (trauma, postpartum hemorrhage, acute surgery) and receive highest routing priority.',
    },
    {
      category: 'security',
      q: 'Is my personal and medical data protected?',
      a: 'Yes. Rakthayatra LifeLink employs AES-256-GCM encryption for all sensitive medical eligibility responses and enforces strict role-based access control. Public visitors cannot see donor phone numbers or patient private records.',
    },
    {
      category: 'facilities',
      q: 'How are blood banks and hospitals verified?',
      a: 'Every participating blood bank and hospital must submit their government accreditation and drug control license number. Platform administrators verify official credentials before approving their access.',
    },
  ];

  const filteredFaqs = faqs.filter((item) => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="LifeLink Help Center & FAQs">
      <div className="space-y-6 text-slate-200">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search questions, eligibility, or request guides..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/40"
          />
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Topics', icon: BookOpen },
            { id: 'donation', label: 'Donation & Health', icon: HeartHandshake },
            { id: 'requests', label: 'Blood Requests', icon: HelpCircle },
            { id: 'security', label: 'Privacy & Security', icon: ShieldCheck },
            { id: 'facilities', label: 'Hospitals & Banks', icon: PhoneCall },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-rose-600 text-white font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <cat.icon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          ))}
        </div>

        {/* FAQ List */}
        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {filteredFaqs.length === 0 ? (
            <p className="text-center py-8 text-xs text-slate-500">No matching questions found.</p>
          ) : (
            filteredFaqs.map((faq, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all space-y-1.5"
              >
                <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  {faq.q}
                </h4>
                <p className="text-[11px] text-slate-300 pl-5 leading-relaxed">{faq.a}</p>
              </div>
            ))
          )}
        </div>

        {/* Emergency Box */}
        <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-950/20 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-rose-300">Still have questions?</span>
            <p className="text-[10px] text-slate-400">Our medical emergency helplines are active 24/7.</p>
          </div>
          <div className="flex gap-2">
            <span className="px-2.5 py-1 rounded-md bg-rose-600 font-bold text-white text-[11px]">Ambulance: 108</span>
            <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-200 text-[11px] font-bold border border-slate-700">Blood: 104</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
export default HelpCenterModal;
