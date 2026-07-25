import { Activity, Shield, HeartHandshake, MapPin } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900 text-white flex flex-col justify-between font-sans">
      {/* Header */}
      <header className="border-b border-rose-500/10 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Activity className="w-6 h-6 text-white animate-pulse" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-rose-200 bg-clip-text text-transparent">
              LifeLink <span className="text-xs font-semibold text-rose-500 tracking-widest uppercase ml-1">Rakthayatra</span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-emerald-400" /> SECURE CONTEXT</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-6 flex flex-col justify-center items-center text-center py-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose-500/30 bg-rose-500/5 text-rose-400 text-xs font-medium uppercase tracking-wider mb-8 animate-fade-in">
          <Activity className="w-3.5 h-3.5 animate-pulse" /> Milestone 1 Active: Project Scaffolding
        </div>
        
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-b from-white via-rose-100 to-rose-300 bg-clip-text text-transparent leading-none">
          Connecting Donors, Hospitals & Blood Banks
        </h1>
        
        <p className="text-lg text-slate-300 max-w-2xl mb-12 leading-relaxed">
          LifeLink (Rakthayatra) is a FAANG-grade real-time emergency blood logistics coordination platform. Scaffolding is booted successfully.
        </p>

        {/* Feature Cards Grid */}
        <div className="grid md:grid-cols-3 gap-6 w-full max-w-3xl mb-12">
          <div className="p-6 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm hover:border-rose-500/20 transition-all text-left">
            <HeartHandshake className="w-8 h-8 text-rose-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-rose-100">Dynamic Matching</h3>
            <p className="text-sm text-slate-400 leading-normal">Intelligent search matches eligible donors and compatible groups instantly.</p>
          </div>
          <div className="p-6 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm hover:border-rose-500/20 transition-all text-left">
            <Activity className="w-8 h-8 text-rose-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-rose-100">Live Inventory</h3>
            <p className="text-sm text-slate-400 leading-normal">Real-time stock sync across hospitals and blood banks with under 30s latency.</p>
          </div>
          <div className="p-6 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm hover:border-rose-500/20 transition-all text-left">
            <MapPin className="w-8 h-8 text-rose-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-rose-100">Location Aware</h3>
            <p className="text-sm text-slate-400 leading-normal">Expanding radius search coordinates nearby emergency logistics dynamically.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <div className="px-6 py-3 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-medium rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-default">
            System Operational
          </div>
          <a
            href="http://localhost:5000/health"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 border border-white/10 hover:border-rose-500/30 bg-white/5 hover:bg-rose-500/5 text-slate-200 font-medium rounded-xl transition-all"
          >
            Check API Health
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 px-6 text-center text-sm text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Rakthayatra (LifeLink). All rights reserved.</p>
          <div className="flex gap-6">
            <span className="text-slate-400">Environment: Development</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
