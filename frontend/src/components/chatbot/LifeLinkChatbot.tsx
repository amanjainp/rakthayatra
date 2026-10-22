import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Globe,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/api';
import toast from 'react-hot-toast';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  language: 'en' | 'kn';
  suggestedActions?: { label: string; action: 'NAVIGATE' | 'QUERY'; payload: string }[];
  authorizedData?: any;
  feedback?: 'like' | 'dislike' | null;
}

export const LifeLinkChatbot: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [language, setLanguage] = useState<'en' | 'kn'>('en');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasUnread(false);
    }
  }, [messages, isOpen]);

  // Initial welcome message based on role and language
  useEffect(() => {
    const role = user?.role || 'GUEST';
    let welcomeText = '';
    let initialSuggestions: { label: string; action: 'NAVIGATE' | 'QUERY'; payload: string }[] = [];

    if (language === 'kn') {
      if (role === 'DONOR') {
        welcomeText = `ನಮಸ್ಕಾರ **${user?.fullName || 'ರಕ್ತದಾನಿ'}**! ನೀವು ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬುಕ್ ಮಾಡಲು, ನಿಮ್ಮ ಅರ್ಹತೆ ಪರಿಶೀಲಿಸಲು ಅಥವಾ ಇತ್ತೀಚಿನ ದಾನದ ದಾಖಲೆ ತಿಳಿಯಲು ನಾನು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ.`;
        initialSuggestions = [
          { label: 'ನನ್ನ ದಾನದ ದಾಖಲೆ', action: 'QUERY', payload: 'ನನ್ನ ದಾನ' },
          { label: 'ಅರ್ಹತಾ ಮಾನದಂಡಗಳು', action: 'QUERY', payload: 'ಅರ್ಹತೆ' },
          { label: 'ರಕ್ತದಾನ ಶಿಬಿರಗಳು', action: 'NAVIGATE', payload: '/camps' },
        ];
      } else if (role === 'PATIENT') {
        welcomeText = `ನಮಸ್ಕಾರ **${user?.fullName || 'ಸ್ವೀಕರ್ತರು'}**! ನಿಮ್ಮ ರಕ್ತದ ವಿನಂತಿ ಸ್ಥಿತಿ ತಿಳಿಯಲು ಅಥವಾ ಹತ್ತಿರದ ಲಭ್ಯತೆಯನ್ನು ಪತ್ತೆಹಚ್ಚಲು ಕೇಳಿ.`;
        initialSuggestions = [
          { label: 'ನನ್ನ ವಿನಂತಿ ಸ್ಥಿತಿ', action: 'QUERY', payload: 'ನನ್ನ ವಿನಂತಿ' },
          { label: 'ರಕ್ತ ಹುಡುಕಿ', action: 'NAVIGATE', payload: '/#find-blood' },
          { label: 'ತುರ್ತು ಸಹಾಯವಾಣಿ', action: 'QUERY', payload: 'ತುರ್ತು' },
        ];
      } else if (role === 'HOSPITAL') {
        welcomeText = `ಸ್ವಾಗತ **${user?.fullName || 'ಆಸ್ಪತ್ರೆ ಸಿಬ್ಬಂದಿ'}**! ತುರ್ತು ರಕ್ತದ ಅಗತ್ಯತೆಗಳನ್ನು ಕಳುಹಿಸಲು ಅಥವಾ ರಕ್ತ ಬ್ಯಾಂಕ್ ದಾಸ್ತಾನು ಪರಿಶೀಲಿಸಲು ನಾನು ಸಿದ್ಧನಿದ್ದೇನೆ.`;
        initialSuggestions = [
          { label: 'ದಾಸ್ತಾನು ಪರಿಶೀಲನೆ', action: 'NAVIGATE', payload: '/inventory' },
          { label: 'ತುರ್ತು ವಿನಂತಿ', action: 'NAVIGATE', payload: '/requests' },
        ];
      } else if (role === 'BLOOD_BANK') {
        welcomeText = `ಸ್ವಾಗತ **${user?.fullName || 'ರಕ್ತ ಬ್ಯಾಂಕ್ ಅಧಿಕಾರಿ'}**! ಕಡಿಮೆ ದಾಸ್ತಾನು ಮತ್ತು ಅವಧಿ ಮುಗಿಯುವ ಬ್ಯಾಚ್‌ಗಳ ವಿಶ್ಲೇಷಣೆ ಇಲ್ಲಿದೆ.`;
        initialSuggestions = [
          { label: 'ದಾಸ್ತಾನು ಸ್ಥಿತಿ', action: 'QUERY', payload: 'ದಾಸ್ತಾನು' },
          { label: 'ಇನ್ವೆಂಟರಿ ನಿರ್ವಹಣೆ', action: 'NAVIGATE', payload: '/inventory' },
        ];
      } else if (role === 'ADMIN') {
        welcomeText = `ನಮಸ್ಕಾರ **ಸಿಸ್ಟಮ್ ಅಡ್ಮಿನ್**! ಸಿಸ್ಟಮ್ ಮೇಲ್ವಿಚಾರಣೆ, ಆಸ್ಪತ್ರೆ ಪರಿಶೀಲನೆ ಮತ್ತು ಲಾಗ್ ವಿವರಗಳನ್ನು ಕೇಳಬಹುದು.`;
        initialSuggestions = [
          { label: 'ಬಾಕಿ ಪರಿಶೀಲನೆಗಳು', action: 'QUERY', payload: 'pending verification' },
          { label: 'ಅಡ್ಮಿನ್ ಸೆಂಟರ್', action: 'NAVIGATE', payload: '/admin/management' },
        ];
      } else {
        welcomeText = `ನಮಸ್ಕಾರ! ನಾನು **LifeLink (Rakthayatra)** ಎಐ ಸಹಾಯಕ. ನೀವು ರಕ್ತ ಹುಡುಕಲು, ರಕ್ತದಾನ ಮಾಡಲು ನೋಂದಾಯಿಸಲು ಅಥವಾ ತುರ್ತು ಮಾಹಿತಿ ಪಡೆಯಲು ಕೇಳಬಹುದು.`;
        initialSuggestions = [
          { label: 'ರಕ್ತ ಹುಡುಕಿ (Find Blood)', action: 'NAVIGATE', payload: '/#find-blood' },
          { label: 'ಯಾರು ರಕ್ತದಾನ ಮಾಡಬಹುದು?', action: 'QUERY', payload: 'Who can donate blood?' },
          { label: 'ತುರ್ತು ಸಹಾಯವಾಣಿ 108/104', action: 'QUERY', payload: 'Emergency helplines' },
          { label: 'ರಕ್ತದಾನ ಶಿಬಿರಗಳು', action: 'NAVIGATE', payload: '/camps' },
        ];
      }
    } else {
      if (role === 'DONOR') {
        welcomeText = `Hello **${user?.fullName || 'Donor'}**! I can help you check your donation history, review medical eligibility, or book your next donation slot.`;
        initialSuggestions = [
          { label: 'My Donation Summary', action: 'QUERY', payload: 'my donation' },
          { label: 'Eligibility Guidelines', action: 'QUERY', payload: 'Who is eligible to donate?' },
          { label: 'Book Appointment', action: 'NAVIGATE', payload: '/donations' },
          { label: 'Browse Camps', action: 'NAVIGATE', payload: '/camps' },
        ];
      } else if (role === 'PATIENT') {
        welcomeText = `Hello **${user?.fullName || 'Recipient'}**! I am here to guide you through filing blood requests, tracking real-time fulfillment, and finding nearby storage banks.`;
        initialSuggestions = [
          { label: 'Track My Requests', action: 'QUERY', payload: 'my request' },
          { label: 'Search Blood Stock', action: 'NAVIGATE', payload: '/#find-blood' },
          { label: 'Emergency Helpline 108/104', action: 'QUERY', payload: 'emergency' },
        ];
      } else if (role === 'HOSPITAL') {
        welcomeText = `Welcome **${user?.fullName || 'Hospital Coordinator'}**! Coordinate patient blood transfusions, search participating blood banks, and track emergency requests.`;
        initialSuggestions = [
          { label: 'Check Blood Bank Stock', action: 'NAVIGATE', payload: '/inventory' },
          { label: 'Create Blood Request', action: 'NAVIGATE', payload: '/requests' },
          { label: 'Emergency Map', action: 'NAVIGATE', payload: '/emergency-map' },
        ];
      } else if (role === 'BLOOD_BANK') {
        welcomeText = `Welcome **${user?.fullName || 'Blood Bank Officer'}**! Monitor cold-chain inventory, FEFO batch expiry alerts, and pending reservation claims.`;
        initialSuggestions = [
          { label: 'Stock & Expiry Overview', action: 'QUERY', payload: 'expiring low stock' },
          { label: 'Open Inventory', action: 'NAVIGATE', payload: '/inventory' },
          { label: 'Fulfill Requests', action: 'NAVIGATE', payload: '/requests' },
        ];
      } else if (role === 'ADMIN') {
        welcomeText = `Welcome **Platform Admin**! Inspect unresolved hospital verifications, platform health metrics, and audit logs.`;
        initialSuggestions = [
          { label: 'Pending Verifications', action: 'QUERY', payload: 'pending verification' },
          { label: 'Admin Management', action: 'NAVIGATE', payload: '/admin/management' },
        ];
      } else {
        welcomeText = `Welcome to **LifeLink (Rakthayatra)**! I am your AI platform assistant. Ask me how to find blood, register as a donor, check medical criteria, or find nearby camps.`;
        initialSuggestions = [
          { label: 'Find Blood Online', action: 'NAVIGATE', payload: '/#find-blood' },
          { label: 'Eligibility Requirements', action: 'QUERY', payload: 'Who can donate blood?' },
          { label: 'Emergency Helplines (108/104)', action: 'QUERY', payload: 'Emergency helplines' },
          { label: 'Upcoming Donation Camps', action: 'NAVIGATE', payload: '/camps' },
        ];
      }
    }

    setMessages([
      {
        id: 'msg-welcome',
        sender: 'bot',
        text: welcomeText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language,
        suggestedActions: initialSuggestions,
      },
    ]);
  }, [user, language, location.pathname]);

  const handleSend = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await apiClient.post('/chatbot/message', {
        message: textToSend,
        language,
        page: location.pathname,
      });

      if (res.data?.success && res.data?.data) {
        const botData = res.data.data;
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: botData.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          language: botData.language || language,
          suggestedActions: botData.suggestedActions,
          authorizedData: botData.authorizedData,
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        throw new Error('Unexpected response structure');
      }
    } catch {
      // Smart contextual fallback when offline or during network latency
      const lower = textToSend.toLowerCase().trim();
      let fallbackReply = '';
      let fallbackActions = [
        { label: 'Find Blood Online', action: 'NAVIGATE' as const, payload: '/#find-blood' },
        { label: 'Donation Eligibility', action: 'QUERY' as const, payload: 'Who is eligible to donate blood?' },
        { label: 'Emergency Helplines', action: 'QUERY' as const, payload: 'Emergency helpline numbers' },
      ];

      if (lower === 'hi' || lower === 'hello' || lower === 'hey' || lower.includes('namaste') || lower.includes('ನಮಸ್ಕಾರ')) {
        fallbackReply = language === 'kn'
          ? 'ನಮಸ್ಕಾರ! ನಾನು **LifeLink (Rakthayatra)** ಎಐ ಸಹಾಯಕ. ನೀವು ರಕ್ತ ಹುಡುಕಲು, ದಾನ ಮಾಡಲು, ಅರ್ಹತೆ ಪರಿಶೀಲಿಸಲು ಅಥವಾ ತುರ್ತು ಮಾಹಿತಿ ಪಡೆಯಲು ಕೇಳಬಹುದು.'
          : 'Hello! I am your **LifeLink (Rakthayatra) AI Assistant**. I can help you search compatible blood stock, understand donation eligibility, book appointments, or file emergency requests.\n\nHow can I help you today?';
      } else if (lower.includes('eligible') || lower.includes('who can donate') || lower.includes('weight') || lower.includes('age')) {
        fallbackReply = language === 'kn'
          ? 'ರಕ್ತದಾನದ ಮೂಲ ಮಾನದಂಡಗಳು:\n- ವಯಸ್ಸು: 18 - 65 ವರ್ಷಗಳು\n- ತೂಕ: ಕನಿಷ್ಠ 45 ಕೆಜಿ\n- ಹಿಮೋಗ್ಲೋಬಿನ್: ಕನಿಷ್ಠ 12.5 g/dL\n- ದಾನದ ನಡುವಿನ ಅಂತರ: ಪುರುಷರಿಗೆ 90 ದಿನಗಳು, ಮಹಿಳೆಯರಿಗೆ 120 ದಿನಗಳು.'
          : 'Basic Blood Donor Eligibility Criteria:\n- Age: 18 – 65 years\n- Weight: Minimum 45 kg\n- Hemoglobin: At least 12.5 g/dL\n- Interval: 90 days for men, 120 days for women.\n\nEnsure you are well-hydrated and have had a light meal before donating.';
      } else if (lower.includes('emergency') || lower.includes('urgent') || lower.includes('108') || lower.includes('104')) {
        fallbackReply = language === 'kn'
          ? 'ತುರ್ತು ಸಹಾಯವಾಣಿಗಳು:\n- ರಾಷ್ಟ್ರೀಯ ಆಂಬ್ಯುಲೆನ್ಸ್: **108**\n- ರಕ್ತ ಸಹಾಯವಾಣಿ: **104**\n- ತಕ್ಷಣದ ತುರ್ತು ರಕ್ತಕ್ಕಾಗಿ ಲೈಫ್‌ಲಿಂಕ್‌ನಲ್ಲಿ Emergency Blood Request ಸಲ್ಲಿಸಿ.'
          : '🚨 **24/7 Emergency Helplines:**\n- **National Ambulance:** **108**\n- **State Blood Cell:** **104**\n- **Emergency Dispatch:** File an **EMERGENCY** request on LifeLink to alert all nearby blood banks and active donors within 100km immediately.';
      } else {
        fallbackReply = language === 'kn'
          ? 'ನಾನು ರಿಯಲ್-ಟೈಮ್‌ನಲ್ಲಿ ರಕ್ತ ಹುಡುಕಾಟ, ದಾನಿಗಳ ಹೊಂದಾಣಿಕೆ ಮತ್ತು ತುರ್ತು ಮಾಹಿತಿಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. ಹೆಚ್ಚಿನ ವಿವರಗಳಿಗೆ ದಯವಿಟ್ಟು 108 ಅಥವಾ 104 ಗೆ ಕರೆ ಮಾಡಿ.'
          : 'I can assist you with live blood inventory searches, voluntary donor matching, scheduled appointments, and emergency logistics. If you need immediate clinical assistance, please call 108 or 104.';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: fallbackReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          language,
          suggestedActions: fallbackActions,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action: { label: string; action: 'NAVIGATE' | 'QUERY'; payload: string }) => {
    if (action.action === 'NAVIGATE') {
      if (action.payload.startsWith('/#')) {
        const hash = action.payload.replace('/', '');
        navigate('/');
        setTimeout(() => {
          const element = document.querySelector(hash);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        }, 150);
      } else {
        navigate(action.payload);
      }
      setIsMinimized(true);
    } else if (action.action === 'QUERY') {
      handleSend(action.payload);
    }
  };

  const handleFeedback = (msgId: string, type: 'like' | 'dislike') => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedback: type } : m))
    );
    toast.success(type === 'like' ? 'Thank you for your feedback!' : 'Feedback noted. We are improving.');
  };

  const handleReset = () => {
    setMessages([]);
    toast.success('Conversation cleared');
  };

  return (
    <>
      {/* Persistent Floating Chatbot Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="bg-slate-900/90 text-rose-300 text-xs px-3 py-1.5 rounded-xl border border-rose-500/20 shadow-xl backdrop-blur-md animate-fade-in flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              Need blood help? Ask LifeLink AI
            </span>
          </div>
          <button
            id="lifelink-chatbot-trigger"
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
            }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-rose-400 text-white flex items-center justify-center shadow-2xl shadow-rose-600/40 hover:scale-105 active:scale-95 transition-all duration-200 group relative cursor-pointer"
            title="Open LifeLink Universal AI Chatbot"
          >
            <div className="absolute -inset-1 rounded-2xl bg-rose-500/30 animate-ping opacity-75 pointer-events-none" />
            <MessageSquare className="w-7 h-7 group-hover:scale-110 transition-transform relative z-10" />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse" />
            )}
          </button>
        </div>
      )}

      {/* Chat Window Modal */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 w-full sm:w-[420px] transition-all duration-300 ease-in-out flex flex-col ${
            isMinimized ? 'h-16' : 'h-[620px] max-h-[88vh]'
          }`}
        >
          <div className="w-full h-full rounded-2xl bg-slate-950/95 border border-rose-500/30 shadow-2xl shadow-rose-950/50 backdrop-blur-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3.5 bg-gradient-to-r from-rose-950/60 via-slate-900/80 to-slate-950 border-b border-rose-500/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-400 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-tight font-display">
                      LifeLink <span className="text-rose-400 font-semibold">AI Assistant</span>
                    </h3>
                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      {user?.role || 'Visitor'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online • Platform & Logistics Guide
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                {/* Language Toggle */}
                <button
                  onClick={() => setLanguage((prev) => (prev === 'en' ? 'kn' : 'en'))}
                  className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-colors flex items-center gap-1"
                  title="Toggle Kannada / English"
                >
                  <Globe className="w-3 h-3 text-rose-400" />
                  <span>{language === 'en' ? 'ಕನ್ನಡ' : 'EN'}</span>
                </button>

                {/* Reset History */}
                <button
                  onClick={handleReset}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
                  title="Clear conversation"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Minimize */}
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
                  title={isMinimized ? 'Expand' : 'Minimize'}
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`} />
                </button>

                {/* Close */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
                  title="Close Assistant"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Body (Hidden when minimized) */}
            {!isMinimized && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed ${
                          m.sender === 'user'
                            ? 'bg-rose-600 text-white rounded-br-none shadow-md shadow-rose-600/20'
                            : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{m.text}</div>

                        {/* Optional Authorized Data Metrics Card */}
                        {m.authorizedData && (
                          <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[10px]">
                            {m.authorizedData.totalCompleted !== undefined && (
                              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                                <span className="block text-slate-400">Total Donated</span>
                                <span className="font-bold text-white text-xs">{m.authorizedData.totalCompleted} Bags</span>
                              </div>
                            )}
                            {m.authorizedData.totalUnits !== undefined && (
                              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                                <span className="block text-slate-400">Available Units</span>
                                <span className="font-bold text-emerald-400 text-xs">{m.authorizedData.totalUnits} Units</span>
                              </div>
                            )}
                            {m.authorizedData.pendingHospitals !== undefined && (
                              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                                <span className="block text-slate-400">Pending Hospitals</span>
                                <span className="font-bold text-amber-400 text-xs">{m.authorizedData.pendingHospitals}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Suggested Actions within Bot Message */}
                        {m.suggestedActions && m.suggestedActions.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                            {m.suggestedActions.map((act, i) => (
                              <button
                                key={i}
                                onClick={() => handleActionClick(act)}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 hover:border-rose-500/40 text-[11px] font-semibold transition-all flex items-center gap-1 active:scale-95"
                              >
                                {act.action === 'NAVIGATE' && <ExternalLink className="w-2.5 h-2.5" />}
                                {act.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Timestamp & Feedback (Bot only) */}
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                          <span>{m.timestamp}</span>
                          {m.sender === 'bot' && (
                            <div className="flex items-center gap-1 ml-2">
                              <button
                                onClick={() => handleFeedback(m.id, 'like')}
                                className={`p-1 rounded hover:bg-slate-800 ${
                                  m.feedback === 'like' ? 'text-emerald-400' : 'text-slate-500'
                                }`}
                                title="Helpful"
                              >
                                <ThumbsUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleFeedback(m.id, 'dislike')}
                                className={`p-1 rounded hover:bg-slate-800 ${
                                  m.feedback === 'dislike' ? 'text-rose-400' : 'text-slate-500'
                                }`}
                                title="Not helpful"
                              >
                                <ThumbsDown className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex items-start gap-2">
                      <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-bounce" />
                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-bounce [animation-delay:0.2s]" />
                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-bounce [animation-delay:0.4s]" />
                        <span className="text-[11px] ml-1">Analyzing logistics...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-3.5 bg-slate-950/90 border-t border-slate-800/80 space-y-2 shrink-0">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={
                        language === 'kn'
                          ? 'ರಕ್ತದ ದಾಸ್ತಾನು, ಅರ್ಹತೆ ಅಥವಾ ತುರ್ತು ಸಹಾಯ ಕೇಳಿ...'
                          : 'Ask about blood stock, eligibility, or emergency help...'
                      }
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/30 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim() || isLoading}
                      className="w-10 h-10 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white flex items-center justify-center transition-all shadow-md shadow-rose-600/30 cursor-pointer shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>

                  {/* Safe Medical Disclaimer */}
                  <p className="text-[9px] text-slate-500 text-center leading-tight">
                    LifeLink Assistant is an informational platform guide. For life-threatening emergencies, call{' '}
                    <span className="text-rose-400 font-bold">108</span> or{' '}
                    <span className="text-rose-400 font-bold">104</span> immediately.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
export default LifeLinkChatbot;
