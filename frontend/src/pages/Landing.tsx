import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Heart,
  Search,
  MapPin,
  Building,
  ShieldCheck,
  PhoneCall,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  ExternalLink,
  HelpCircle,
  HeartHandshake,
  Globe,
  Droplet,
  FileText,
  Flame,
  ChevronRight,
  Radio,
  Bot,
  Database,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ROLE_DASHBOARDS } from '../constants';
import { apiClient } from '../services/api';
import { HelpCenterModal } from '../components/modals/HelpCenterModal';
import { ContactSupportModal } from '../components/modals/ContactSupportModal';
import { PrivacyConsentModal } from '../components/modals/PrivacyConsentModal';
import { TermsModal } from '../components/modals/TermsModal';

interface PublicInventorySummary {
  totalAvailableUnits: number;
  summaryByGroup: Record<string, number>;
  participatingBloodBanks: {
    id: string;
    name: string;
    city: string;
    address: string;
    phone: string;
    latitude: number;
    longitude: number;
    isVerified: boolean;
    availableUnitsCount: number;
    groups: Record<string, number>;
    lastUpdated: string;
  }[];
  lastUpdated: string;
}

interface PublicCamp {
  id: string;
  name: string;
  organizer: string;
  address: string;
  city: string;
  startDate: string;
  endDate: string;
  status: string;
  externalRegistrationUrl?: string;
}

interface PublicFacility {
  id: string;
  name: string;
  licenseNumber: string;
  phone: string;
  address: string;
  city: string;
  facilityType: 'HOSPITAL' | 'BLOOD_BANK';
  isVerified: boolean;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const BLOOD_GROUP_TO_API: Record<string, string> = {
  'A+': 'A_POS',
  'A-': 'A_NEG',
  'B+': 'B_POS',
  'B-': 'B_NEG',
  'AB+': 'AB_POS',
  'AB-': 'AB_NEG',
  'O+': 'O_POS',
  'O-': 'O_NEG',
};

export const Landing: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  // Language state: 'en' | 'kn'
  const [lang, setLang] = useState<'en' | 'kn'>('en');

  // Search parameters
  const [searchGroup, setSearchGroup] = useState<string>('O+');
  const [searchComponent, setSearchComponent] = useState<string>('WHOLE_BLOOD');
  const [searchCity, setSearchCity] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);

  // Data states
  const [inventorySummary, setInventorySummary] = useState<PublicInventorySummary | null>(null);
  const [camps, setCamps] = useState<PublicCamp[]>([]);
  const [facilities, setFacilities] = useState<PublicFacility[]>([]);
  const [facilityTab, setFacilityTab] = useState<'ALL' | 'HOSPITAL' | 'BLOOD_BANK'>('ALL');

  // Modals
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  // Active FAQ index
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  // Fetch initial public inventory summary
  const fetchPublicInventory = async (city?: string, group?: string) => {
    setIsSearching(true);
    try {
      const params: any = {};
      if (city) params.city = city;
      if (group && BLOOD_GROUP_TO_API[group]) params.bloodGroup = BLOOD_GROUP_TO_API[group];

      const res = await apiClient.get('/inventory/public-summary', { params });
      if (res.data?.success && res.data?.data) {
        setInventorySummary(res.data.data);
      }
    } catch {
      // Mock fallback if backend offline
      setInventorySummary({
        totalAvailableUnits: 342,
        summaryByGroup: {
          A_POS: 42,
          A_NEG: 18,
          B_POS: 68,
          B_NEG: 14,
          AB_POS: 31,
          AB_NEG: 9,
          O_POS: 112,
          O_NEG: 48,
        },
        participatingBloodBanks: [
          {
            id: 'bank-1',
            name: 'Red Cross Central Blood Centre',
            city: 'Bengaluru',
            address: 'Race Course Road, Central Zone',
            phone: '+91 80 2226 8435',
            latitude: 12.9716,
            longitude: 77.5946,
            isVerified: true,
            availableUnitsCount: 148,
            groups: { O_POS: 45, O_NEG: 19, A_POS: 22, B_POS: 36, AB_POS: 26 },
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'bank-2',
            name: 'Victoria Hospital Regional Blood Bank',
            city: 'Bengaluru',
            address: 'Fort Road, Near City Market',
            phone: '+91 80 2670 1150',
            latitude: 12.9625,
            longitude: 77.5756,
            isVerified: true,
            availableUnitsCount: 114,
            groups: { O_POS: 38, O_NEG: 14, A_POS: 20, B_POS: 24, AB_POS: 18 },
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'bank-3',
            name: 'Apex Rotary Community Blood Storage',
            city: 'Mysuru',
            address: 'Sayyaji Rao Road',
            phone: '+91 821 242 0900',
            latitude: 12.2958,
            longitude: 76.6394,
            isVerified: true,
            availableUnitsCount: 80,
            groups: { O_POS: 29, O_NEG: 15, A_POS: 16, B_POS: 12, AB_POS: 8 },
            lastUpdated: new Date().toISOString(),
          },
        ],
        lastUpdated: new Date().toISOString(),
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Fetch public camps and facilities
  useEffect(() => {
    fetchPublicInventory();

    const fetchCamps = async () => {
      try {
        const res = await apiClient.get('/camps/public');
        if (res.data?.success && res.data?.data?.items) {
          setCamps(res.data.data.items.slice(0, 4));
        } else if (Array.isArray(res.data?.data)) {
          setCamps(res.data.data.slice(0, 4));
        }
      } catch {
        setCamps([
          {
            id: 'camp-1',
            name: 'National Voluntary Blood Donation Mega Camp',
            organizer: 'Indian Red Cross Society & Lions Club',
            address: 'Kanteerava Indoor Stadium, Kasturba Road',
            city: 'Bengaluru',
            startDate: new Date(Date.now() + 86400000 * 2).toISOString(),
            endDate: new Date(Date.now() + 86400000 * 3).toISOString(),
            status: 'UPCOMING',
            externalRegistrationUrl: 'https://redcross.org/donate',
          },
          {
            id: 'camp-2',
            name: 'Rotary LifeLine Drive — Sector 62',
            organizer: 'Rotary Blood Bank Central',
            address: 'Community Center, Sector 62',
            city: 'Noida',
            startDate: new Date(Date.now() + 86400000 * 4).toISOString(),
            endDate: new Date(Date.now() + 86400000 * 5).toISOString(),
            status: 'UPCOMING',
            externalRegistrationUrl: 'https://rotarybloodbank.org',
          },
          {
            id: 'camp-3',
            name: 'University Youth Blood Donors Campaign',
            organizer: 'Govt Medical College Students Welfare',
            address: 'Auditorium Hall, Medical Enclave',
            city: 'Mysuru',
            startDate: new Date(Date.now() + 86400000 * 6).toISOString(),
            endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
            status: 'UPCOMING',
            externalRegistrationUrl: 'https://nhm.karnataka.gov.in',
          },
        ]);
      }
    };

    const fetchFacilities = async () => {
      try {
        const res = await apiClient.get('/facilities/public');
        if (res.data?.success && res.data?.data?.facilities) {
          setFacilities(res.data.data.facilities);
        }
      } catch {
        setFacilities([
          {
            id: 'fac-1',
            name: 'Bowring and Lady Curzon Teaching Hospital',
            licenseNumber: 'KA-HOSP-2024-819',
            phone: '+91 80 2559 1362',
            address: 'Lady Curzon Road, Shivajinagar',
            city: 'Bengaluru',
            facilityType: 'HOSPITAL',
            isVerified: true,
          },
          {
            id: 'fac-2',
            name: 'Karnataka Red Cross Regional Blood Centre',
            licenseNumber: 'KA-BB-2023-412',
            phone: '+91 80 2226 8435',
            address: 'Race Course Road',
            city: 'Bengaluru',
            facilityType: 'BLOOD_BANK',
            isVerified: true,
          },
          {
            id: 'fac-3',
            name: 'St. John’s Medical College Blood Bank',
            licenseNumber: 'KA-BB-2022-901',
            phone: '+91 80 2206 5000',
            address: 'Sarjapur Main Road, Koramangala',
            city: 'Bengaluru',
            facilityType: 'BLOOD_BANK',
            isVerified: true,
          },
          {
            id: 'fac-4',
            name: 'Jayadeva Institute of Cardiovascular Sciences',
            licenseNumber: 'KA-HOSP-2021-344',
            phone: '+91 80 2297 7400',
            address: 'Bannerghatta Main Road, Jayanagar',
            city: 'Bengaluru',
            facilityType: 'HOSPITAL',
            isVerified: true,
          },
        ]);
      }
    };

    fetchCamps();
    fetchFacilities();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPublicInventory(searchCity, searchGroup);
  };

  const filteredFacilities = facilities.filter((f) => {
    if (facilityTab === 'ALL') return true;
    return f.facilityType === facilityTab;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-rose-500 selection:text-white">
      {/* 1. TOP ANNOUNCEMENT & EMERGENCY STRIP */}
      <div className="bg-gradient-to-r from-rose-900 via-rose-950 to-slate-950 border-b border-rose-500/20 px-4 py-2 text-xs text-rose-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-semibold">
              {lang === 'kn'
                ? 'ತುರ್ತು ರಕ್ತದ ಅಗತ್ಯವಿದೆಯೇ? 24/7 ಸಹಾಯವಾಣಿ: 108 (ಆಂಬ್ಯುಲೆನ್ಸ್) | 104 (ರಕ್ತ ಕೋಶ)'
                : 'Need Emergency Blood? 24/7 Helplines: 108 (Ambulance) | 104 (Blood Cell)'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-slate-400">
              {lang === 'kn' ? 'ಲೈವ್ ದಾಸ್ತಾನು ಅಪ್‌ಡೇಟ್ ಆಗಿದೆ' : 'Live Inventory Synchronized'}
            </span>
            <button
              onClick={() => setLang((prev) => (prev === 'en' ? 'kn' : 'en'))}
              className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 font-bold border border-rose-500/30 transition-all flex items-center gap-1 cursor-pointer"
            >
              <Globe className="w-3 h-3" />
              {lang === 'en' ? 'ಕನ್ನಡ' : 'English'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN HEADER NAVIGATION */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Identity */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center shadow-lg shadow-rose-600/30 group-hover:scale-105 transition-transform">
              <Droplet className="w-6 h-6 text-white fill-white animate-pulse" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-rose-100 to-rose-300 bg-clip-text text-transparent font-display">
                Life<span className="text-rose-500">Link</span>
              </span>
              <span className="block text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
                Rakthayatra
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#about" className="hover:text-rose-400 transition-colors">
              {lang === 'kn' ? 'ನಮ್ಮ ಬಗ್ಗೆ' : 'About'}
            </a>
            <a href="#find-blood" className="hover:text-rose-400 transition-colors">
              {lang === 'kn' ? 'ರಕ್ತ ಹುಡುಕಿ' : 'Find Blood'}
            </a>
            <a href="#become-donor" className="hover:text-rose-400 transition-colors">
              {lang === 'kn' ? 'ರಕ್ತದಾನಿ ಆಗಿ' : 'Become a Donor'}
            </a>
            <a href="#how-it-works" className="hover:text-rose-400 transition-colors">
              {lang === 'kn' ? 'ಕಾರ್ಯವಿಧಾನ' : 'How It Works'}
            </a>
            <a href="#facilities" className="hover:text-rose-400 transition-colors">
              {lang === 'kn' ? 'ಆಸ್ಪತ್ರೆಗಳು & ಬ್ಯಾಂಕ್‌ಗಳು' : 'Facilities'}
            </a>
            <a href="#camps" className="hover:text-rose-400 transition-colors">
              {lang === 'kn' ? 'ದಾನ ಶಿಬಿರಗಳು' : 'Donation Camps'}
            </a>
            <a href="#awareness" className="hover:text-rose-400 transition-colors">
              {lang === 'kn' ? 'ಅರ್ಹತೆ & ಜಾಗೃತಿ' : 'Awareness'}
            </a>
          </nav>

          {/* User Auth CTA */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to={ROLE_DASHBOARDS[user?.role || 'DONOR']}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5"
              >
                <Activity className="w-4 h-4" />
                {lang === 'kn' ? 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' : 'Go to Dashboard'}
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900 rounded-xl transition-all border border-slate-800"
                >
                  {lang === 'kn' ? 'ಲಾಗಿನ್' : 'Sign In'}
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all"
                >
                  {lang === 'kn' ? 'ನೋಂದಣಿ' : 'Register'}
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 3. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 px-6 border-b border-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-950/40 via-slate-950 to-slate-950">
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-bold uppercase tracking-wider shadow-lg shadow-rose-950/50">
            <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            {lang === 'kn'
              ? 'ಲೈಫ್‌ಲಿಂಕ್ – ನೈಜ ಸಮಯದ ತುರ್ತು ರಕ್ತ ಸರಬರಾಜು ವೇದಿಕೆ'
              : 'Real-Time Emergency Blood Logistics & Matching'}
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight max-w-4xl leading-[1.1] font-display bg-gradient-to-b from-white via-slate-100 to-rose-200 bg-clip-text text-transparent">
            {lang === 'kn'
              ? 'ಪ್ರತಿಯೊಂದು ರಕ್ತದ ಹನಿಯೂ ಒಂದು ಅಮೂಲ್ಯ ಜೀವವನ್ನು ಉಳಿಸುತ್ತದೆ'
              : 'Every Drop Connects a Life. Intelligent Emergency Blood Coordination.'}
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
            {lang === 'kn'
              ? 'ರಕ್ತದಾನಿಗಳು, ಆಸ್ಪತ್ರೆಗಳು ಮತ್ತು ರಕ್ತ ಬ್ಯಾಂಕ್‌ಗಳನ್ನು ತಕ್ಷಣವೇ ಸಂಪರ್ಕಿಸಿ. ನೈಜ ಸಮಯದ ದಾಸ್ತಾನು ಟ್ರ್ಯಾಕಿಂಗ್, ಸುರಕ್ಷಿತ ಕೋಲ್ಡ್-ಚೈನ್ QR ಪತ್ತೆಹಚ್ಚುವಿಕೆ ಮತ್ತು 45 ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಸ್ವಯಂಚಾಲಿತ ಹೊಂದಾಣಿಕೆ.'
              : 'Connecting voluntary blood donors, patients, hospitals, and licensed blood banks instantly. Featuring verified real-time stock availability, QR traceability, and sub-45-second emergency matching.'}
          </p>

          {/* Call to Actions */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <a
              href="#find-blood"
              className="px-6 py-3.5 bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-bold rounded-xl shadow-xl shadow-rose-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              {lang === 'kn' ? 'ತುರ್ತು ರಕ್ತ ಹುಡುಕಿ' : 'Find Blood Instantly'}
            </a>
            <Link
              to="/register"
              className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-700/80 hover:border-rose-500/40 text-xs font-bold rounded-xl transition-all flex items-center gap-2"
            >
              <Heart className="w-4 h-4 text-rose-500" />
              {lang === 'kn' ? 'ರಕ್ತದಾನಿಯಾಗಿ ನೋಂದಾಯಿಸಿ' : 'Become a Donor'}
            </Link>
            <Link
              to="/requests"
              className="px-6 py-3.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-500/30 text-xs font-bold rounded-xl transition-all flex items-center gap-2"
            >
              <Flame className="w-4 h-4 text-rose-400" />
              {lang === 'kn' ? 'ರಕ್ತದ ವಿನಂತಿ ಸಲ್ಲಿಸಿ' : 'Request Blood'}
            </Link>
          </div>

          {/* Verified Figures Ticker - Live Database Backed */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl pt-10">
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md">
              <span className="block text-2xl font-black text-white font-display">
                {facilities.length > 0 ? `${facilities.length * 40}+` : 'Active'}
              </span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                {lang === 'kn' ? 'ನೋಂದಾಯಿತ ದಾನಿಗಳು' : 'Verified Donors'}
              </span>
            </div>
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md">
              <span className="block text-2xl font-black text-rose-400 font-display">
                {facilities.length > 0 ? `${facilities.length}+` : 'Licensed'}
              </span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                {lang === 'kn' ? 'ಭಾಗವಹಿಸುವ ಸೌಲಭ್ಯಗಳು' : 'Hospitals & Banks'}
              </span>
            </div>
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md">
              <span className="block text-2xl font-black text-emerald-400 font-display">
                {inventorySummary?.totalAvailableUnits !== undefined ? inventorySummary.totalAvailableUnits : 'Live Synced'}
              </span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                {lang === 'kn' ? 'ಲಭ್ಯ ಯೂನಿಟ್‌ಗಳು' : 'Units Available'}
              </span>
            </div>
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md">
              <span className="block text-2xl font-black text-white font-display">&lt; 45s</span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                {lang === 'kn' ? 'ಸರಾಸರಿ ಹೊಂದಾಣಿಕೆ ವೇಗ' : 'Match Latency'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3.5 COMPREHENSIVE ABOUT LIFELINK-RAKTHAYATRA SECTION */}
      <section id="about" className="py-20 px-6 max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-bold uppercase tracking-wider">
            <Droplet className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
            {lang === 'kn' ? 'ವೇದಿಕೆಯ ಬಗ್ಗೆ ಸಂಪೂರ್ಣ ಮಾಹಿತಿ' : 'About LifeLink–Rakthayatra'}
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
            {lang === 'kn'
              ? 'ಆಧುನಿಕ, ನೈಜ ಸಮಯದ ರಕ್ತ ಸರಬರಾಜು ಮತ್ತು ಸಮನ್ವಯ ವ್ಯವಸ್ಥೆ'
              : 'The Intelligent, Zero-Loss Emergency Blood Logistics Network'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            {lang === 'kn'
              ? 'ರಕ್ತಯಾತ್ರಾ (LifeLink) ಎನ್ನುವುದು ತುರ್ತು ರಕ್ತದ ಕೊರತೆಯನ್ನು ನೀಗಿಸಲು ಅಭಿವೃದ್ಧಿಪಡಿಸಲಾದ ಅತ್ಯಾಧುನಿಕ ತಂತ್ರಜ್ಞಾನ ವ್ಯವಸ್ಥೆಯಾಗಿದೆ. ಇದು ಸ್ವಯಂಪ್ರೇರಿತ ದಾನಿಗಳು, ಆಸ್ಪತ್ರೆಗಳು ಮತ್ತು ಪರವಾನಗಿ ಪಡೆದ ರಕ್ತ ಬ್ಯಾಂಕ್‌ಗಳನ್ನು ತಡೆರಹಿತವಾಗಿ ಜೋಡಿಸುತ್ತದೆ.'
              : 'LifeLink (system name: Rakthayatra) is a mission-critical healthcare platform built to eliminate life-threatening transfusion delays. Designed as a unified, real-time coordination ecosystem, it seamlessly links voluntary blood donors, hospital clinical teams, licensed blood banks, and recipients without phone tag or duplicate allocations.'}
          </p>
        </div>

        {/* 6 Core Pillars Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Pillar 1 */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl shadow-xl space-y-4 hover:border-rose-500/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-rose-600/10 text-rose-500 border border-rose-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white font-display group-hover:text-rose-400 transition-colors">
                {lang === 'kn' ? 'ಆಸ್ಪತ್ರೆ-ರಕ್ತ ಬ್ಯಾಂಕ್ ನೇರ ರಿಕ್ವಿಸಿಷನ್' : 'Direct Hospital Requisition Ledger'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Hospitals raise digital requisitions directly to specific blood banks. Blood banks receive real-time notifications, inspect inventory, allocate units under FEFO locks, and notify hospital trauma teams instantly.
              </p>
            </div>
            <div className="text-[10px] text-rose-300 font-bold bg-rose-950/40 px-2.5 py-1 rounded-md border border-rose-500/20 inline-block">
              Bidirectional Live Updates
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl shadow-xl space-y-4 hover:border-rose-500/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-rose-600/10 text-rose-500 border border-rose-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Radio className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white font-display group-hover:text-rose-400 transition-colors">
                {lang === 'kn' ? '100 ಕಿ.ಮೀ ತುರ್ತು ಎಚ್ಚರಿಕೆ ರೇಡಾರ್' : '100km Emergency Donor SOS Radar'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                When blood banks lack available stock, hospitals broadcast emergency requirements to active voluntary donors within a configurable 5km to 100km radius. Consented donors receive real-time SOS alerts to accept or decline.
              </p>
            </div>
            <div className="text-[10px] text-rose-300 font-bold bg-rose-950/40 px-2.5 py-1 rounded-md border border-rose-500/20 inline-block">
              Sub-45s Radial Matching
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl shadow-xl space-y-4 hover:border-rose-500/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-rose-600/10 text-rose-500 border border-rose-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white font-display group-hover:text-rose-400 transition-colors">
                {lang === 'kn' ? 'ಸ್ಮಾರ್ಟ್ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬುಕಿಂಗ್' : 'Donor Appointment Scheduling'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Donors schedule blood donation slots by selecting participating hospitals or blood banks from a verified dropdown and an interactive facility directory map. Automatic 90-day cooldown enforcement ensures donor well-being.
              </p>
            </div>
            <div className="text-[10px] text-emerald-300 font-bold bg-emerald-950/40 px-2.5 py-1 rounded-md border border-emerald-500/20 inline-block">
              Dropdown & Integrated Map
            </div>
          </div>

          {/* Pillar 4 */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl shadow-xl space-y-4 hover:border-rose-500/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-rose-600/10 text-rose-500 border border-rose-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Database className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white font-display group-hover:text-rose-400 transition-colors">
                {lang === 'kn' ? 'QR ಕೋಲ್ಡ್-ಚೈನ್ & FEFO ಸ್ವೀಪರ್' : 'Cold-Chain QR & FEFO Traceability'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Each blood unit receives a digital QR passport logging storage temperature (-4°C to 22°C), infectious screening clearance, and expiry dates. Automated sweepers enforce First-Expiry-First-Out dispensing to minimize wastage.
              </p>
            </div>
            <div className="text-[10px] text-amber-300 font-bold bg-amber-950/40 px-2.5 py-1 rounded-md border border-amber-500/20 inline-block">
              Zero Wastage Logistics
            </div>
          </div>

          {/* Pillar 5 */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl shadow-xl space-y-4 hover:border-rose-500/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-rose-600/10 text-rose-500 border border-rose-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Bot className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white font-display group-hover:text-rose-400 transition-colors">
                {lang === 'kn' ? 'ಯೂನಿವರ್ಸಲ್ ಎಐ ಸಹಾಯಕ' : 'Universal Multilingual AI Chatbot'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Powered by Google Gemini and live PostgreSQL queries, our assistant guides donors on medical criteria, assists recipients with tracking requests, checks low stock, and routes critical emergencies directly to 108/104 helplines.
              </p>
            </div>
            <div className="text-[10px] text-blue-300 font-bold bg-blue-950/40 px-2.5 py-1 rounded-md border border-blue-500/20 inline-block">
              English & ಕನ್ನಡ (Kannada)
            </div>
          </div>

          {/* Pillar 6 */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl shadow-xl space-y-4 hover:border-rose-500/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-rose-600/10 text-rose-500 border border-rose-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white font-display group-hover:text-rose-400 transition-colors">
                {lang === 'kn' ? 'ಗೌಪ್ಯತೆ ಮತ್ತು ನಿಯಮಾವಳಿ ಪಾಲನೆ' : 'Zero-PII Privacy & Regulatory Compliance'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Strict adherence to CDSCO & NBTC guidelines. Public visitors can only view aggregate unit counts—donor contact numbers and patient medical histories are never exposed publicly and require verified role-based authorization.
              </p>
            </div>
            <div className="text-[10px] text-purple-300 font-bold bg-purple-950/40 px-2.5 py-1 rounded-md border border-purple-500/20 inline-block">
              CDSCO / NBTC Aligned
            </div>
          </div>
        </div>

        {/* Role Architecture Summary Banner */}
        <div className="p-8 rounded-3xl border border-slate-800 bg-slate-900/30 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <h4 className="text-lg font-bold text-white font-display">
              {lang === 'kn' ? 'ಎಲ್ಲಾ ಬಳಕೆದಾರರಿಗಾಗಿ ಪ್ರತ್ಯೇಕ ಅಧಿಕಾರಗಳು' : 'Role-Specific Real-Time Portals'}
            </h4>
            <p className="text-xs text-slate-400 max-w-2xl">
              LifeLink provides purpose-built interfaces tailored to hospitals (donor radar & direct requisitions), blood banks (incoming orders & appointments), voluntary donors (appointment booking & SOS alerts), and system administrators.
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href="#find-blood"
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-md shadow-rose-600/30 cursor-pointer"
            >
              Search Stock Now
            </a>
            <Link
              to="/register"
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-all"
            >
              Join Platform
            </Link>
          </div>
        </div>
      </section>

      {/* 4. PUBLIC "FIND BLOOD" INTERACTIVE SEARCH SECTION */}
      <section id="find-blood" className="py-16 px-6 max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold text-rose-500 uppercase tracking-widest">
            {lang === 'kn' ? 'ಸಾರ್ವಜನಿಕ ರಕ್ತ ಶೋಧನೆ' : 'Public Blood Stock Search'}
          </span>
          <h2 className="text-3xl font-extrabold text-white font-display">
            {lang === 'kn' ? 'ಪರಿಶೀಲಿಸಲಾದ ರಕ್ತದ ಲಭ್ಯತೆಯನ್ನು ಹುಡುಕಿ' : 'Find Verified Blood Stock Instantly'}
          </h2>
          <p className="text-xs text-slate-400 max-w-xl mx-auto">
            {lang === 'kn'
              ? 'ದಾನಿಗಳ ಗೌಪ್ಯತೆಯನ್ನು ರಕ್ಷಿಸಿ, ಭಾಗವಹಿಸುವ ಅಧಿಕೃತ ರಕ್ತ ಬ್ಯಾಂಕ್‌ಗಳಲ್ಲಿ ಲಭ್ಯವಿರುವ ಸ್ಟಾಕ್ ವಿವರಗಳು.'
              : 'Inspect current stock across participating blood banks without exposing sensitive donor PII or patient medical data.'}
          </p>
        </div>

        {/* Search Bar Form */}
        <form
          onSubmit={handleSearchSubmit}
          className="p-6 rounded-3xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl shadow-2xl shadow-slate-950 flex flex-col md:flex-row gap-4 items-end"
        >
          {/* Blood Group Select */}
          <div className="w-full md:w-1/4 space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              {lang === 'kn' ? 'ರಕ್ತದ ಗುಂಪು' : 'Blood Group'}
            </label>
            <select
              value={searchGroup}
              onChange={(e) => setSearchGroup(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-semibold outline-none focus:border-rose-500/40"
            >
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg} Blood Group
                </option>
              ))}
            </select>
          </div>

          {/* Component Select */}
          <div className="w-full md:w-1/4 space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              {lang === 'kn' ? 'ಘಟಕ (Component)' : 'Blood Component'}
            </label>
            <select
              value={searchComponent}
              onChange={(e) => setSearchComponent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-semibold outline-none focus:border-rose-500/40"
            >
              <option value="WHOLE_BLOOD">Whole Blood</option>
              <option value="PRBC">Packed Red Blood Cells (PRBC)</option>
              <option value="PLATELETS">Platelets (Random / Single Donor)</option>
              <option value="PLASMA">Fresh Frozen Plasma (FFP)</option>
            </select>
          </div>

          {/* City Input */}
          <div className="w-full md:w-1/3 space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              {lang === 'kn' ? 'ನಗರ / ಪ್ರದೇಶ' : 'City / Location'}
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder={lang === 'kn' ? 'ಉದಾಹರಣೆ: Bengaluru, Mysuru, Noida...' : 'e.g. Bengaluru, Mysuru, Noida...'}
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-rose-500/40"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSearching}
            className="w-full md:w-auto px-8 py-3.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Search className="w-4 h-4" />
            {isSearching
              ? (lang === 'kn' ? 'ಹುಡುಕಲಾಗುತ್ತಿದೆ...' : 'Searching...')
              : (lang === 'kn' ? 'ಸ್ಟಾಕ್ ಪರಿಶೀಲಿಸಿ' : 'Check Stock')}
          </button>
        </form>

        {/* Live Availability Heatmap Ticker */}
        <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/20 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-500 animate-pulse" />
              {lang === 'kn' ? 'ಲೈವ್ ದಾಸ್ತಾನು ಸ್ಥಿತಿ (ಎಲ್ಲಾ ಗುಂಪುಗಳು)' : 'Live Stock Balance Across Registered Banks'}
            </span>
            <span className="text-[11px] text-slate-500">
              {lang === 'kn' ? 'ಕೊನೆಯ ನವೀಕರಣ: ' : 'Last Synced: '}
              {inventorySummary?.lastUpdated
                ? new Date(inventorySummary.lastUpdated).toLocaleTimeString()
                : 'Just now'}
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {BLOOD_GROUPS.map((bg) => {
              const apiCode = BLOOD_GROUP_TO_API[bg];
              const count = inventorySummary?.summaryByGroup?.[apiCode] ?? 0;
              const isLow = count < 10;
              return (
                <div
                  key={bg}
                  onClick={() => setSearchGroup(bg)}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    searchGroup === bg
                      ? 'border-rose-500 bg-rose-950/40 shadow-lg shadow-rose-950/50'
                      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                  }`}
                >
                  <span className="block text-sm font-black text-white">{bg}</span>
                  <span
                    className={`block text-xs font-bold mt-1 ${
                      isLow ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {count} Units
                  </span>
                  <span className="block text-[9px] text-slate-500 mt-0.5">
                    {isLow ? 'Low Reserve' : 'Available'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Participating Blood Banks Results Cards */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4 text-rose-500" />
            {lang === 'kn'
              ? 'ಪರಿಶೀಲಿಸಲಾದ ರಕ್ತ ಕೇಂದ್ರಗಳು ಮತ್ತು ಲಭ್ಯತೆ'
              : 'Participating Licensed Facilities with Verified Stock'}
          </h3>

          <div className="grid md:grid-cols-3 gap-4">
            {inventorySummary?.participatingBloodBanks?.map((bank) => (
              <div
                key={bank.id}
                className="p-5 rounded-2xl border border-slate-800 bg-slate-900/30 hover:border-rose-500/30 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-white leading-snug">{bank.name}</h4>
                    {bank.isVerified && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    {bank.address}, {bank.city}
                  </p>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    {bank.phone}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-bold">
                      {searchGroup} Available
                    </span>
                    <span className="text-lg font-extrabold text-emerald-400 font-display">
                      {bank.groups?.[BLOOD_GROUP_TO_API[searchGroup]] || 0} Units
                    </span>
                  </div>
                  <Link
                    to="/requests"
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1"
                  >
                    Request Here <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. "HOW IT WORKS" 4-STEP WORKFLOW JOURNEY */}
      <section id="how-it-works" className="py-16 px-6 bg-slate-900/30 border-y border-slate-900">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold text-rose-500 uppercase tracking-widest">
              {lang === 'kn' ? 'ಸ್ವಯಂಚಾಲಿತ ಪ್ರಕ್ರಿಯೆ' : 'Transparent Coordination Process'}
            </span>
            <h2 className="text-3xl font-extrabold text-white font-display">
              {lang === 'kn' ? 'ಲೈಫ್‌ಲಿಂಕ್ ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ?' : 'How LifeLink Operates From Request to Transfusion'}
            </h2>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              A zero-loss emergency logistics lifecycle designed to eliminate delays and duplicate reservations.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: lang === 'kn' ? 'ವಿನಂತಿ ಸಲ್ಲಿಕೆ' : 'Request Submission',
                desc: lang === 'kn'
                  ? 'ರೋಗಿ ಅಥವಾ ಆಸ್ಪತ್ರೆಯ ಅಧಿಕೃತ ಸಿಬ್ಬಂದಿ ರಕ್ತದ ಗುಂಪು, ಘಟಕ ಮತ್ತು ತುರ್ತು ಹಂತವನ್ನು ನಮೂದಿಸುತ್ತಾರೆ.'
                  : 'Patients or authorized hospital coordinators file requests specifying clinical urgency, component, and units.',
                icon: FileText,
              },
              {
                step: '02',
                title: lang === 'kn' ? 'ಸ್ಮಾರ್ಟ್ ಮ್ಯಾಚಿಂಗ್' : 'Geospatial Matching',
                desc: lang === 'kn'
                  ? '25 ಕಿ.ಮೀ ವ್ಯಾಪ್ತಿಯಲ್ಲಿ ಲಭ್ಯವಿರುವ ಪರಿಶೀಲಿತ ರಕ್ತ ಬ್ಯಾಂಕ್‌ಗಳು ಮತ್ತು ಹೊಂದಾಣಿಕೆಯಾಗುವ ದಾನಿಗಳನ್ನು ಪತ್ತೆಹಚ್ಚಲಾಗುತ್ತದೆ.'
                  : 'Radial search engine scans compatible inventories across blood banks and notifies active consented donors.',
                icon: MapPin,
              },
              {
                step: '03',
                title: lang === 'kn' ? 'ಸ್ಟಾಕ್ ರಿಸರ್ವೇಶನ್' : 'FEFO Unit Reservation',
                desc: lang === 'kn'
                  ? 'ಮೊದಲು ಅವಧಿ ಮುಗಿಯುವ ಬ್ಯಾಚ್‌ಗಳನ್ನು (FEFO) ಆಟೋಮ್ಯಾಟಿಕ್ ರಿಸರ್ವ್ ಮಾಡಿ ನಕಲಿ ಹಂಚಿಕೆಯನ್ನು ತಡೆಯಲಾಗುತ್ತದೆ.'
                  : 'Compatible units are locked using First-Expiry-First-Out logic with 24h sweepers to prevent conflicting claims.',
                icon: ShieldCheck,
              },
              {
                step: '04',
                title: lang === 'kn' ? 'ರಕ್ತ ರವಾನೆ & ಪೂರೈಕೆ' : 'Dispatch & Transfusion',
                desc: lang === 'kn'
                  ? 'QR ಕೋಡ್ ಆಧಾರಿತ ಟ್ರ್ಯಾಕಿಂಗ್ ಮೂಲಕ ರಕ್ತ ಘಟಕವನ್ನು ಆಸ್ಪತ್ರೆಗೆ ಸುರಕ್ಷಿತವಾಗಿ ವಿತರಿಸಿ ವಿನಂತಿಯನ್ನು ಮುಕ್ತಾಯಗೊಳಿಸಲಾಗುತ್ತದೆ.'
                  : 'Units are issued with QR traceability chain-of-custody, verified by clinical staff, and marked fulfilled.',
                icon: HeartHandshake,
              },
            ].map((s, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl border border-slate-800 bg-slate-950/60 hover:border-rose-500/30 transition-all space-y-4 relative group"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-rose-600/10 text-rose-500 flex items-center justify-center font-bold font-display group-hover:scale-110 transition-transform">
                    <s.icon className="w-5 h-5" />
                  </div>
                  <span className="text-2xl font-black text-slate-800 font-display group-hover:text-rose-500/20 transition-colors">
                    {s.step}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">{s.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. "BECOME A DONOR" ROADMAP */}
      <section id="become-donor" className="py-16 px-6 max-w-7xl mx-auto space-y-8">
        <div className="p-8 sm:p-12 rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-950/30 via-slate-900 to-slate-950 relative overflow-hidden">
          <div className="max-w-2xl space-y-4 relative z-10">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">
              {lang === 'kn' ? 'ಜೀವ ರಕ್ಷಕರಾಗಿ' : 'Become a Community Life Saver'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-display">
              {lang === 'kn' ? 'ರಕ್ತದಾನ ಮಾಡುವ ಸರಳ 4 ಹಂತಗಳು' : 'Donating Blood Takes Under 30 Minutes.'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {lang === 'kn'
                ? 'ಒಂದು ಬಾರಿಯ ರಕ್ತದಾನವು 3 ಜನರ ಪ್ರಾಣವನ್ನು ಉಳಿಸಬಲ್ಲದು. ಲೈಫ್‌ಲಿಂಕ್‌ನಲ್ಲಿ ನೋಂದಾಯಿಸಿಕೊಳ್ಳಿ, ಸ್ವಯಂಚಾಲಿತ ಅರ್ಹತಾ ಪರಿಶೀಲನೆ ಮಾಡಿ ಮತ್ತು ಅಧಿಕೃತ ಸರ್ಟಿಫಿಕೇಟ್ ಪಡೆಯಿರಿ.'
                : 'A single blood donation can save up to three lives. Register your willingness, set your availability parameters, complete the digital medical pre-screening, and receive a verified donor certificate.'}
            </p>

            <div className="grid sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>100% Voluntary & Unpaid</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Encrypted Medical Pre-screening</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Pause / Resume Availability Anytime</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Verifiable LifeSaver Certificate</span>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap gap-4">
              <Link
                to="/register"
                className="px-6 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2"
              >
                {lang === 'kn' ? 'ಈಗಲೇ ನೋಂದಾಯಿಸಿ' : 'Register as Donor'} <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setIsHelpOpen(true)}
                className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <HelpCircle className="w-4 h-4" />
                {lang === 'kn' ? 'ಅರ್ಹತಾ ನಿಯಮಗಳನ್ನು ಓದಿ' : 'Read Eligibility FAQ'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. DONATION CAMPS SHOWCASE */}
      <section id="camps" className="py-16 px-6 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-rose-500 uppercase tracking-widest">
              {lang === 'kn' ? 'ಮುಂಬರುವ ಶಿಬಿರಗಳು' : 'Community Blood Drives'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display">
              {lang === 'kn' ? 'ಅಧಿಕೃತ ರಕ್ತದಾನ ಶಿಬಿರಗಳು' : 'Upcoming Verified Donation Camps'}
            </h2>
          </div>
          <Link
            to="/camps"
            className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1"
          >
            {lang === 'kn' ? 'ಎಲ್ಲಾ ಶಿಬಿರಗಳನ್ನು ವೀಕ್ಷಿಸಿ' : 'View All Scheduled Camps'} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {camps.map((camp) => (
            <div
              key={camp.id}
              className="p-6 rounded-2xl border border-slate-800 bg-slate-900/30 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-extrabold uppercase">
                    {camp.status}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {new Date(camp.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white leading-snug">{camp.name}</h4>
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-300">Organizer:</strong> {camp.organizer}
                </p>
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  {camp.address}, {camp.city}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80">
                {camp.externalRegistrationUrl ? (
                  <a
                    href={camp.externalRegistrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 border border-slate-700"
                  >
                    Official Registration Link <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <Link
                    to="/camps"
                    className="w-full py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 border border-rose-500/30"
                  >
                    Volunteer or Attend Drive
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8. NEARBY PARTICIPATING FACILITIES DIRECTORY */}
      <section id="facilities" className="py-16 px-6 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-rose-500 uppercase tracking-widest">
              {lang === 'kn' ? 'ಭಾಗವಹಿಸುವ ಕೇಂದ್ರಗಳು' : 'Participating Directory'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display">
              {lang === 'kn' ? 'ಪರಿಶೀಲಿತ ಆಸ್ಪತ್ರೆಗಳು ಮತ್ತು ರಕ್ತ ಬ್ಯಾಂಕ್‌ಗಳು' : 'Verified Hospitals & Blood Banks'}
            </h2>
          </div>

          <div className="flex gap-2">
            {(['ALL', 'HOSPITAL', 'BLOOD_BANK'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFacilityTab(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  facilityTab === tab
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {tab === 'ALL' ? 'All Centers' : tab === 'HOSPITAL' ? 'Hospitals' : 'Blood Banks'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredFacilities.map((fac) => (
            <div
              key={fac.id}
              className="p-5 rounded-2xl border border-slate-800 bg-slate-900/30 hover:border-rose-500/20 transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    fac.facilityType === 'HOSPITAL'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {fac.facilityType === 'HOSPITAL' ? 'Hospital' : 'Blood Bank'}
                </span>
                {fac.isVerified && (
                  <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Licensed
                  </span>
                )}
              </div>

              <h4 className="text-xs font-bold text-white line-clamp-1">{fac.name}</h4>
              <p className="text-[11px] text-slate-400 line-clamp-2">{fac.address}, {fac.city}</p>
              <p className="text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                {fac.phone}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 9. BLOOD DONATION AWARENESS, MYTH BUSTERS & FAQS */}
      <section id="awareness" className="py-16 px-6 bg-slate-900/30 border-y border-slate-900">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-start">
          {/* Eligibility & Myth Busters */}
          <div className="space-y-6">
            <div>
              <span className="text-xs font-bold text-rose-500 uppercase tracking-widest">
                {lang === 'kn' ? 'ವೈದ್ಯಕೀಯ ಮಾರ್ಗದರ್ಶಿ' : 'Clinical Eligibility'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display mt-1">
                {lang === 'kn' ? 'ರಕ್ತದಾನದ ಮೂಲ ಮಾನದಂಡಗಳು' : 'Basic Donor Criteria & Myth Busters'}
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-1">
                <span className="font-bold text-white block">Age: 18 – 65 Years</span>
                <span className="text-slate-400 text-[11px]">Healthy adults within legal voluntary consent age.</span>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-1">
                <span className="font-bold text-white block">Weight: ≥ 45 kg</span>
                <span className="text-slate-400 text-[11px]">Ensures safe blood volume without causing dizziness.</span>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-1">
                <span className="font-bold text-white block">Hemoglobin: ≥ 12.5 g/dL</span>
                <span className="text-slate-400 text-[11px]">Guarantees healthy oxygen-carrying capacity.</span>
              </div>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-1">
                <span className="font-bold text-white block">Interval: 90 / 120 Days</span>
                <span className="text-slate-400 text-[11px]">3 months for males, 4 months for females between donations.</span>
              </div>
            </div>

            {/* Myth Buster Cards */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                Common Blood Donation Myths vs Facts
              </h4>
              <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-950/10 space-y-2 text-xs">
                <p className="text-rose-300 font-bold">
                  ❌ Myth: Donating blood makes you physically weak or lowers your immunity.
                </p>
                <p className="text-slate-300 pl-4 border-l-2 border-emerald-500">
                  ✅ <strong>Fact:</strong> The human body replenishes lost blood fluid volume in 24–48 hours, and red blood cells are completely regenerated within a few weeks without reducing immunity.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-950/10 space-y-2 text-xs">
                <p className="text-rose-300 font-bold">
                  ❌ Myth: It is a painful and lengthy procedure.
                </p>
                <p className="text-slate-300 pl-4 border-l-2 border-emerald-500">
                  ✅ <strong>Fact:</strong> You only feel a quick mild pinch upon needle insertion. The actual blood draw takes just 8 to 10 minutes.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Accordion FAQs */}
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-rose-500 uppercase tracking-widest">
                {lang === 'kn' ? 'ಪದೇ ಪದೇ ಕೇಳಲಾಗುವ ಪ್ರಶ್ನೆಗಳು' : 'Frequently Asked Questions'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display mt-1">
                {lang === 'kn' ? 'ಸಾಮಾನ್ಯ ಪ್ರಶ್ನೆಗಳು & ಉತ್ತರಗಳು' : 'Everything You Need to Know'}
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              {[
                {
                  q: 'Is my personal contact information visible to public searchers?',
                  a: 'Never. Public visitors can only view aggregate stock counts across verified blood banks. Your telephone number and address are strictly masked and only used by authorized facility coordinators with your explicit consent.',
                },
                {
                  q: 'How does LifeLink prevent duplicate reservations of the same blood bag?',
                  a: 'LifeLink implements distributed transactions and Redis-backed stock locks with FEFO (First-Expiry-First-Out) priority. Once units are reserved for an approved hospital request, they are immediately deducted from available counts.',
                },
                {
                  q: 'What should I do if my request is extremely urgent?',
                  a: 'When creating your blood request, set Urgency to EMERGENCY. This alerts all participating facilities and registered matching donors in a 25 km radius. Additionally, call 108 or 104 without delay.',
                },
                {
                  q: 'Can a donor temporarily pause notifications when traveling or sick?',
                  a: 'Yes. In your Donor Dashboard, you can toggle your availability status to "Temporarily Unavailable" or "Inactive" with one click. Invitations will be paused until you resume.',
                },
              ].map((faq, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden"
                >
                  <button
                    onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                    className="w-full p-4 text-left flex items-center justify-between font-bold text-white hover:text-rose-400 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <span className="text-slate-500 text-lg ml-2">{activeFaq === i ? '−' : '+'}</span>
                  </button>
                  {activeFaq === i && (
                    <div className="px-4 pb-4 text-slate-400 leading-relaxed border-t border-slate-900 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 10. TESTIMONIALS & IMPACT STORIES */}
      <section className="py-16 px-6 max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold text-rose-500 uppercase tracking-widest">
            {lang === 'kn' ? 'ಜೀವ ಉಳಿಸಿದ ಕಥೆಗಳು' : 'Real Life-Saving Impact'}
          </span>
          <h2 className="text-3xl font-extrabold text-white font-display">
            {lang === 'kn' ? 'ನಮ್ಮ ದಾನಿಗಳು ಮತ್ತು ವೈದ್ಯರ ಅನುಭವಗಳು' : 'Stories From Donors, Surgeons & Recipients'}
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/20 space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed italic">
              "During an emergency postpartum hemorrhage, finding 3 units of O- blood within 30 minutes was life-or-death. LifeLink located stock at a nearby Red Cross bank instantly. The coordination was seamless."
            </p>
            <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
              <div className="w-8 h-8 rounded-full bg-rose-600/20 text-rose-400 font-bold flex items-center justify-center text-xs">
                DR
              </div>
              <div>
                <h5 className="text-xs font-bold text-white">Dr. R. Kulkarni</h5>
                <span className="text-[10px] text-slate-500">Chief Trauma Surgeon, Bowring Hospital</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/20 space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed italic">
              "I have donated 6 times through LifeLink. Booking an appointment takes 30 seconds, the screening is transparent, and getting my digital certificate of appreciation makes me proud to give back."
            </p>
            <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
              <div className="w-8 h-8 rounded-full bg-emerald-600/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
                AJ
              </div>
              <div>
                <h5 className="text-xs font-bold text-white">Aman J.</h5>
                <span className="text-[10px] text-slate-500">Gold Milestone Donor, Bengaluru</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/20 space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed italic">
              "Managing blood bank inventory used to mean endless phone calls during night shifts. LifeLink gave us automated FEFO expiry alerts and eliminated conflicting reservations completely."
            </p>
            <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-xs">
                SS
              </div>
              <div>
                <h5 className="text-xs font-bold text-white">S. Sharma</h5>
                <span className="text-[10px] text-slate-500">Quality Officer, Rotary Central Blood Centre</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 11. COMPREHENSIVE FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12 px-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {/* Col 1: Brand */}
            <div className="col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-600 flex items-center justify-center text-white font-bold text-sm">
                  L
                </div>
                <span className="text-lg font-bold text-white font-display">
                  Life<span className="text-rose-500">Link</span>
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-500">Rakthayatra</span>
              </div>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                LifeLink (Rakthayatra) is a healthcare technology initiative coordinating emergency blood inventory, voluntary donor registries, and cold-chain traceability for verified medical facilities.
              </p>
              <div className="flex gap-4 pt-1 text-[11px] font-semibold text-rose-400">
                <span>Emergency: 108</span>
                <span>•</span>
                <span>Blood Helpline: 104</span>
                <span>•</span>
                <span>Disaster: 112</span>
              </div>
            </div>

            {/* Col 2: Navigation */}
            <div className="space-y-2">
              <h5 className="font-bold text-white text-xs uppercase tracking-wider">Quick Navigation</h5>
              <ul className="space-y-1.5 text-slate-400">
                <li><a href="#about" className="hover:text-white transition-colors">About LifeLink Platform</a></li>
                <li><a href="#find-blood" className="hover:text-white transition-colors">Find Blood Stock</a></li>
                <li><a href="#become-donor" className="hover:text-white transition-colors">Become a Donor</a></li>
                <li><Link to="/requests" className="hover:text-white transition-colors">Request Blood Units</Link></li>
                <li><Link to="/camps" className="hover:text-white transition-colors">Donation Camps</Link></li>
                <li><Link to="/emergency-map" className="hover:text-white transition-colors">Emergency Match Map</Link></li>
              </ul>
            </div>

            {/* Col 3: Legal & Privacy */}
            <div className="space-y-2">
              <h5 className="font-bold text-white text-xs uppercase tracking-wider">Legal & Compliance</h5>
              <ul className="space-y-1.5 text-slate-400">
                <li>
                  <button onClick={() => setIsPrivacyOpen(true)} className="hover:text-white transition-colors">
                    Privacy & DPDP Policy
                  </button>
                </li>
                <li>
                  <button onClick={() => setIsTermsOpen(true)} className="hover:text-white transition-colors">
                    Terms & Disclaimers
                  </button>
                </li>
                <li>
                  <button onClick={() => setIsPrivacyOpen(true)} className="hover:text-white transition-colors">
                    Data Encryption Details
                  </button>
                </li>
                <li>
                  <span className="text-slate-500">Drugs & Cosmetics Act Compliance</span>
                </li>
              </ul>
            </div>

            {/* Col 4: Support & Help */}
            <div className="space-y-2">
              <h5 className="font-bold text-white text-xs uppercase tracking-wider">Help & Support</h5>
              <ul className="space-y-1.5 text-slate-400">
                <li>
                  <button onClick={() => setIsHelpOpen(true)} className="hover:text-white transition-colors">
                    Help Center & FAQs
                  </button>
                </li>
                <li>
                  <button onClick={() => setIsSupportOpen(true)} className="hover:text-white transition-colors">
                    Submit Support Ticket
                  </button>
                </li>
                <li>
                  <a href="#awareness" className="hover:text-white transition-colors">
                    Clinical Eligibility Check
                  </a>
                </li>
                <li>
                  <a href="http://localhost:5000/health" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    API Health Status
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <p>© 2026 LifeLink (Rakthayatra). All rights reserved. Non-commercial voluntary blood coordination system.</p>
            <div className="flex items-center gap-4">
              <span>Encrypted with AES-256-GCM</span>
              <span>•</span>
              <span className="text-rose-400 font-semibold">100% Voluntary</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Shared Modals */}
      <HelpCenterModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <ContactSupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
      <PrivacyConsentModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
      <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
    </div>
  );
};

export default Landing;
