import React, { useState, useCallback } from 'react';

import {
  UploadCloud, FileType, Activity, Clock, FileText,
  ChevronRight, ShieldAlert, BarChart3, LineChart,
  Target, Zap, LayoutDashboard, Menu, Shield,
  TrendingUp, TrendingDown, Minus, Eye, Moon, Sunrise,
  RefreshCcw, Flame, AlertTriangle, CheckCircle2, X
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, PieChart, Pie, Cell, Legend,
  LineChart as RechartLine, Line
} from 'recharts';

// ─── Design tokens ──────────────────────────────────────────────────────────
const RISK_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
const RISK_BG = { high: 'bg-red-500/10 border-red-500/20', medium: 'bg-amber-500/10 border-amber-500/20', low: 'bg-emerald-500/10 border-emerald-500/20' };
const RISK_TEXT = { high: 'text-red-400', medium: 'text-amber-400', low: 'text-emerald-400' };
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PIE_COLORS = ['#ef4444', '#3b82f6'];

// ─── Sample Data ──────────────────────────────────────────────────────────────
const SAMPLE_DATA = {
  statistics: {
    total_events: 12450,
    total_watch_hours: 145,
    total_sessions: 342,
    binge_sessions: 84,
    binge_rate: 0.245,
    avg_session_minutes: 18.5,
    longest_session_minutes: 184,
    avg_velocity: 8.2,
    avg_late_night_clips: 45,
    avg_morning_clips: 12,
    bad_days_ratio: 0.18,
    max_binge_streak: 4,
    rewatched_ratio: 0.08,
    peak_day: "Sunday",
    peak_hour: 23
  },
  forecast: {
    risk_level: "high",
    risk_score: 0.82,
    trend: "worsening"
  },
  charts: {
    dates: ["2023-10-01", "2023-10-02", "2023-10-03", "2023-10-04", "2023-10-05", "2023-10-06", "2023-10-07"],
    scores: [4, 5, 8, 3, 2, 9, 10],
    clips: [120, 150, 400, 80, 60, 500, 600],
    watch_minutes: [45, 60, 180, 20, 15, 200, 250],
    velocity: [6, 7.5, 12, 4, 3, 14, 15],
    radar_values: [12, 14, 10, 8, 16, 24, 28],
    radar_clips: [100, 150, 80, 60, 200, 450, 600],
    weekly_bar: [80, 90, 75, 60, 150, 300, 400],
    session_dist: { binge: 84, normal: 258 },
    heatmap_z: Array.from({length: 7}, () => Array.from({length: 24}, () => Math.floor(Math.random() * 50)))
  },
  gemini: "**Clinical Assessment: High Risk Profile**\n\nThe user displays significant signs of algorithmic lock-in, particularly during the late-night hours (11 PM - 2 AM). The doomscroll velocity peaks at an alarming 15 clips/min on weekends, indicating a shift from active consumption to passive, hypnotic scrolling.\n\n**Key Interventions:**\n- Implement hard screen locks past 10:30 PM.\n- Introduce physical friction (e.g., leaving the device in another room)."
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const fmt1 = (v) => Number(v).toFixed(1);
const fmtHour = (h) => {
  const ampm = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 || 12;
  return `${hour}:00 ${ampm}`;
};

function TrendIcon({ trend }) {
  if (trend === 'worsening') return <TrendingUp className="w-4 h-4 text-red-500" />;
  if (trend === 'improving') return <TrendingDown className="w-4 h-4 text-emerald-500" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

// ─── Floating Card Component ────────────────────────────────────────────────
export function FloatingCard({ children, className = '', ...props }) {
  return (
    <div {...props} className={`transition-all duration-300 ease-out hover:-translate-y-[10px] hover:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.8)] ${className}`}>
      {children}
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ title, value, unit = '', sub = '', icon: Icon, iconColor = 'text-blue-500', accent = false }) {
  return (
    <FloatingCard className={`rounded-2xl p-5 border shadow-lg ${accent ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#0f172a] border-white/5 hover:border-white/10'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-semibold uppercase tracking-widest ${accent ? 'text-blue-200' : 'text-slate-400'}`}>{title}</span>
        <Icon className={`w-4 h-4 ${accent ? 'text-white' : iconColor}`} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-3xl font-black tracking-tight text-white`}>{value}</span>
        {unit && <span className={`text-sm font-medium ${accent ? 'text-blue-200' : 'text-slate-500'}`}>{unit}</span>}
      </div>
      {sub && <p className={`text-xs mt-2 ${accent ? 'text-blue-100' : 'text-slate-500'}`}>{sub}</p>}
    </FloatingCard>
  );
}

// ─── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, color = 'text-blue-500' }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <Icon className={`w-4 h-4 ${color}`} />
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">{title}</h2>
    </div>
  );
}

// ─── Landing Page ────────────────────────────────────────────────────────────
function LandingPage({ onStart, onDemo }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#030712] font-sans text-white selection:bg-blue-500/30 overflow-x-hidden">
      {/* Background Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[150px]" />
        <div className="absolute top-[40%] left-[50%] w-[30%] h-[30%] rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="fixed w-full border-b border-white/10 bg-[#030712]/80 backdrop-blur-xl z-50 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold tracking-tight text-xl text-white">Neural Void</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#target-section" className="hover:text-white transition-colors">Platform</a>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={onStart} className="hidden md:block bg-white text-slate-900 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:bg-slate-200">
              Start Free Audit
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Nav Overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-20 left-0 right-0 bg-[#030712] border-b border-white/10 px-4 py-6 flex flex-col gap-2 z-40">
            <a href="#target-section" onClick={() => setMobileMenuOpen(false)} className="text-base font-medium text-slate-300 hover:text-white px-4 py-3 rounded-xl transition-all">Platform</a>
            <div className="h-px bg-white/10 my-2"></div>
            <button onClick={() => { setMobileMenuOpen(false); onStart(); }} className="bg-white text-slate-900 px-4 py-3.5 rounded-lg text-base font-semibold transition-all mt-2 w-full">
              Start Free Audit
            </button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <main className="relative z-10 pt-32 pb-20 md:pt-48 md:pb-32 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-8 items-center">
          
          {/* Left Text Column */}
          <div className="text-left animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-8 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Neural Void Platform
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight mb-8">
              Map your <span className="text-blue-500">cognitive bandwidth</span> with clinical precision.
            </h1>
    
            <p className="text-lg text-slate-400 mb-10 max-w-xl leading-relaxed">
              Neural Void extracts 25 behavioural signals from your TikTok export—sessions, binge streaks, doomscroll velocity—framing them into an actionable enterprise dashboard.
            </p>
    
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
              <button onClick={onStart}
                className="w-full sm:w-auto bg-white text-slate-900 px-8 py-3.5 rounded-lg font-semibold text-base transition-all hover:bg-slate-200 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                Analyze My Data <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
              <button onClick={onDemo}
                className="w-full sm:w-auto bg-transparent border border-white/20 text-white hover:bg-white/5 px-8 py-3.5 rounded-lg font-semibold text-base transition-all flex items-center justify-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" /> View Sample Report
              </button>
            </div>
            <div className="text-center sm:text-left">
              <a href="#target-section" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors duration-300 font-medium group">
                <span className="group-hover:translate-y-1 transition-transform duration-300">↓</span> Explore architectural details
              </a>
            </div>
          </div>

          {/* Right Visual Column (Bento Cards) */}
          <div className="relative h-[500px] sm:h-[600px] w-full animate-in fade-in slide-in-from-right-16 duration-1000 delay-200 perspective-1000">
            {/* Main Center Card */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[340px] bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl hover:-translate-y-[52%] transition-transform duration-500 z-20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="font-bold text-slate-200">Doomscroll Velocity</span>
                </div>
                <span className="text-xs font-bold text-red-400 bg-red-400/10 px-2 py-1 rounded-md mt-1">High Risk</span>
              </div>
              <div className="text-5xl font-black text-white mb-2">15.2<span className="text-2xl text-slate-500 ml-1">clips/m</span></div>
              <div className="w-full h-24 mt-6 flex items-end gap-1">
                {/* Dummy chart bars */}
                {[40, 20, 60, 80, 100, 70, 90, 40, 50, 100, 120, 80].map((h, i) => (
                  <div key={i} className="flex-1 bg-gradient-to-t from-blue-500/20 to-blue-400 rounded-t-sm" style={{ height: `${h}%` }}></div>
                ))}
              </div>
            </div>

            {/* Floating Card 1 - Top Left */}
            <div className="absolute top-[10%] left-[5%] w-48 bg-[#0f172a]/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl animate-bounce" style={{animationDuration: '6s'}}>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Peak AI Alert</div>
              <div className="text-lg font-bold text-white flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400"/> Binge Streak</div>
            </div>

            {/* Floating Card 2 - Bottom Right */}
            <div className="absolute bottom-[10%] right-[5%] w-56 bg-[#0f172a]/60 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-xl animate-bounce" style={{animationDuration: '7s', animationDelay: '1s'}}>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Sessions Parsed</div>
              <div className="text-3xl font-black text-white">342</div>
              <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="w-[75%] h-full bg-indigo-500 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature grid */}
        <div id="target-section" className="mt-32 md:mt-48 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          {[
            {
              icon: Clock, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'hover:border-cyan-500/50',
              title: 'Session Parsing', desc: 'Detects minute-level gap sessions and flags any continuous binge loop safely and intelligently.',
              svgBg: (
                <svg viewBox="0 0 100 100" className="absolute -right-10 -bottom-10 w-48 h-48 opacity-[0.05] pointer-events-none text-cyan-400">
                  <path d="M50 10 A40 40 0 1 1 49.9 10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="10 20" className="origin-center motion-safe:animate-[spin_20s_linear_infinite]" />
                  <path d="M50 20 L50 50 L75 75" fill="none" stroke="currentColor" strokeWidth="3" />
                </svg>
              )
            },
            {
              icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'hover:border-blue-500/50',
              title: 'Velocity Tracking', desc: 'Calculates doomscroll velocity (clips/min) and consecutive binge streaks with clinical precision.',
              svgBg: (
                <svg viewBox="0 0 100 100" className="absolute -right-10 -bottom-10 w-48 h-48 opacity-[0.05] pointer-events-none text-blue-400">
                  <path d="M20 50 L40 50 L50 20 L60 80 L70 50 L90 50" fill="none" stroke="currentColor" strokeWidth="3" className="origin-center motion-safe:animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite]" />
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 15" className="origin-center motion-safe:animate-[spin_15s_linear_infinite_reverse]" />
                </svg>
              )
            },
            {
              icon: Shield, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'hover:border-indigo-500/50',
              title: 'Relapse Forecasting', desc: 'Enterprise-grade ensemble ML models score your behavioural probability with continuous learning.',
              svgBg: (
                <svg viewBox="0 0 100 100" className="absolute -right-10 -bottom-10 w-48 h-48 opacity-[0.05] pointer-events-none text-indigo-400">
                  <polygon points="50,10 90,30 90,70 50,90 10,70 10,30" fill="none" stroke="currentColor" strokeWidth="2" className="origin-center motion-safe:animate-[spin_25s_linear_infinite]" />
                  <circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="2" className="origin-center motion-safe:animate-pulse" />
                </svg>
              )
            },
          ].map(({ icon: Icon, color, bg, border, title, desc, svgBg }) => (
            <FloatingCard key={title} className={`group relative overflow-hidden p-8 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 ${border} cursor-default`}>
              {svgBg}
              <div className={`relative z-10 w-14 h-14 ${bg} border border-white/5 rounded-2xl flex items-center justify-center mb-6`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
              <h3 className="relative z-10 text-xl font-bold text-white mb-3">{title}</h3>
              <p className="relative z-10 text-slate-400 leading-relaxed">{desc}</p>
            </FloatingCard>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/10 bg-[#030712] py-8 relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            <span className="font-bold text-white tracking-tight">Neural Void</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">
            © {new Date().getFullYear()} Neural Void Inc. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm font-medium text-slate-500">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Upload Panel ─────────────────────────────────────────────────────────────
function UploadPanel({ onBack, onComplete }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDrag] = useState(false);
  const [error, setError] = useState('');

  const onDrag = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setDrag(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setDrag(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  }, []);

  const analyze = async () => {
    if (!file) return;
    setLoading(true); setError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const API = import.meta.env.VITE_API_URL || 'https://fortunate-perception-production-341b.up.railway.app';
      const r = await fetch(`${API}/analyze`, { method: 'POST', body: fd });
      if (!r.ok) throw new Error(`Server error: ${r.status}`);
      onComplete(await r.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-4 sm:p-6 transition-colors">
      <button onClick={onBack} className="absolute top-4 sm:top-6 left-4 sm:left-6 text-sm text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
        <X className="w-4 h-4" /> Back
      </button>
      <div className="max-w-lg w-full bg-[#0f172a] rounded-2xl shadow-xl border border-white/10 p-6 sm:p-10 mt-8 sm:mt-0 transition-all">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-blue-600 p-1.5 rounded-lg"><Activity className="w-4 h-4 text-white" /></div>
          <span className="font-bold text-white">Neural Void</span>
        </div>
        <h1 className="text-2xl font-bold text-white mt-4 mb-1">Upload Data Export</h1>
        <p className="text-slate-400 text-sm mb-8">Your TikTok <code className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-xs border border-slate-700">Watch History.txt</code> export file.</p>

        <div
          className={`rounded-xl p-6 sm:p-10 flex flex-col items-center cursor-pointer transition-all border-2 border-dashed ${dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-900/50'}`}
          onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop}
          onClick={() => document.getElementById('fu').click()}
        >
          <input id="fu" type="file" accept=".txt" className="hidden" onChange={e => setFile(e.target.files[0])} />
          <div className={`p-4 rounded-full mb-4 transition-colors ${file ? 'bg-blue-500/20' : 'bg-slate-800'}`}>
            {file ? <FileType size={28} className="text-blue-400" /> : <UploadCloud size={28} className="text-slate-400" />}
          </div>
          <p className="font-medium text-slate-200 text-center">{file ? file.name : 'Click or drag & drop'}</p>
          <p className="text-xs text-slate-500 mt-1">.txt files only</p>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        <button onClick={analyze} disabled={!file || loading}
          className={`mt-6 w-full py-3.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2
            ${!file || loading ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'}`}>
          {loading
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Running ML Analysis...</>
            : 'Run Full Analysis'}
        </button>

        <p className="text-center text-xs text-slate-500 mt-4">25 features extracted · 96% model accuracy · Gemini AI insights</p>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ data, onReset }) {
  const { statistics: s, forecast: f, charts: c, gemini } = data;
  const [tab, setTab] = useState('overview');

  // chart formatters
  const trendData = c.dates.map((d, i) => ({
    date: new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: c.scores[i],
    clips: c.clips[i],
    watch: c.watch_minutes[i],
    velocity: c.velocity[i],
  }));

  const radarData = DAY_LABELS.map((day, i) => ({
    subject: day,
    score: c.radar_values[i] ?? 0,
    clips: c.radar_clips[i] ?? 0,
    fullMark: Math.max(...c.radar_values, 10),
  }));

  const weeklyData = DAY_LABELS.map((day, i) => ({
    day: day,
    clips: c.weekly_bar[i] ?? 0,
  }));

  const pieData = [
    { name: 'Binge Sessions', value: c.session_dist.binge },
    { name: 'Normal Sessions', value: c.session_dist.normal },
  ];

  const riskLevel = f.risk_level;

  return (
    <div className="min-h-screen bg-[#030712] font-sans text-slate-200">
      {/* Sticky header */}
      <header className="bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 md:h-16 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-1.5 rounded-lg"><Activity className="w-4 h-4 text-white" /></div>
              <div>
                <h1 className="font-bold text-white text-sm leading-none">Neural Void</h1>
                <p className="text-xs text-slate-400 mt-0.5">Behaviour Intelligence</p>
              </div>
            </div>
            <button onClick={onReset}
              className="md:hidden flex items-center p-2 rounded-lg bg-slate-900 border border-white/10 text-slate-400 hover:bg-slate-800 transition-colors">
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Tab nav */}
          <div className="flex w-full md:w-auto items-center gap-1 bg-slate-900/50 rounded-lg p-1 font-sans border border-white/5">
            {[['overview', 'Overview'], ['sessions', 'Sessions'], ['patterns', 'Patterns']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 md:flex-none px-3 md:px-4 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all whitespace-nowrap
                  ${tab === id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>

          <button onClick={onReset}
            className="hidden md:flex items-center gap-1.5 text-sm text-slate-400 hover:text-white border border-white/10 bg-slate-900 px-3 py-1.5 rounded-lg transition-colors">
            <RefreshCcw className="w-3.5 h-3.5" /> New Analysis
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Risk banner ── */}
        <div className={`rounded-2xl border p-5 flex items-center justify-between flex-wrap gap-4 ${RISK_BG[riskLevel]}`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${riskLevel === 'high' ? 'bg-red-100' : riskLevel === 'medium' ? 'bg-amber-100' : 'bg-emerald-100'}`}>
              {riskLevel === 'high' ? <ShieldAlert className="w-6 h-6 text-red-600" />
                : riskLevel === 'low' ? <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  : <AlertTriangle className="w-6 h-6 text-amber-600" />}
            </div>
            <div>
              <p className={`font-bold text-base ${RISK_TEXT[riskLevel]}`}>
                {riskLevel === 'high' ? 'High Relapse Risk Detected' : riskLevel === 'medium' ? 'Moderate Risk — Monitor Closely' : 'Low Risk — Patterns Look Stable'}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                Score: <strong>{(f.risk_score * 10).toFixed(1)}/10</strong> ·
                Trend: <strong className="flex-inline items-center gap-1">{f.trend}</strong> ·
                Peak day: <strong>{s.peak_day}</strong> at <strong>{fmtHour(s.peak_hour)}</strong>
              </p>
            </div>
          </div>
          <TrendIcon trend={f.trend} />
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <>
            {/* KPI row 1 – Events & Watch */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title="Total Events" value={s.total_events.toLocaleString()} icon={Activity} iconColor="text-blue-500"
                sub={`~${s.total_watch_hours}h total watch time`} />
              <KpiCard title="Total Sessions" value={s.total_sessions.toLocaleString()} icon={BarChart3} iconColor="text-indigo-500"
                sub={`${s.binge_sessions} binge sessions (${pct(s.binge_rate)})`} />
              <KpiCard title="Avg Session" value={fmt1(s.avg_session_minutes)} unit="min" icon={Clock} iconColor="text-violet-500"
                sub={`Longest: ${s.longest_session_minutes} min`} />
              <KpiCard title="Relapse Risk" value={(f.risk_score * 10).toFixed(1)} unit="/ 10" icon={ShieldAlert}
                iconColor={RISK_TEXT[riskLevel]} accent sub={`${riskLevel.toUpperCase()} — trend ${f.trend}`} />
            </div>

            {/* KPI row 2 – Behaviour signals */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title="Doomscroll Velocity" value={fmt1(s.avg_velocity)} unit="clips/min" icon={Zap} iconColor="text-amber-500"
                sub="Average across all sessions" />
              <KpiCard title="Late-Night Avg" value={fmt1(s.avg_late_night_clips)} unit="clips/day" icon={Moon} iconColor="text-purple-500"
                sub="Midnight → 7am window" />
              <KpiCard title="Morning Trigger" value={fmt1(s.avg_morning_clips)} unit="clips/day" icon={Sunrise} iconColor="text-orange-500"
                sub="7am → 11am window" />
              <KpiCard title="Bad-Habit Days" value={pct(s.bad_days_ratio)} icon={Flame} iconColor="text-red-500"
                sub={`Max binge streak: ${s.max_binge_streak} sessions`} />
            </div>

            {/* Area chart + Radar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#0f172a] border border-white/5 rounded-2xl p-6 shadow-lg">
                <SectionHeader icon={LineChart} title="Daily Habit Score (Smoothed)" />
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={20} dy={6} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #1e293b', background: '#0f172a', color: '#f8fafc', fontSize: 12 }} />
                      <Area type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2.5} fill="url(#gs)" dot={false} name="Habit Score" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-6 shadow-lg">
                <SectionHeader icon={Activity} title="Day-of-Week Pattern" color="text-indigo-600" />
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="68%" data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <PolarRadiusAxis tick={false} axisLine={false} />
                      <Radar name="Habit Score" dataKey="score" stroke="#4f46e5" strokeWidth={2} fill="#4f46e5" fillOpacity={0.2} />
                      <Radar name="Clips" dataKey="clips" stroke="#06b6d4" strokeWidth={1.5} fill="#06b6d4" fillOpacity={0.1} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Velocity trend + Weekly bar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-6 shadow-lg">
                <SectionHeader icon={Zap} title="Doomscroll Velocity Over Time" color="text-amber-500" />
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartLine data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={20} dy={6} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #1e293b', background: '#0f172a', color: '#f8fafc', fontSize: 12 }} />
                      <Line type="monotone" dataKey="velocity" stroke="#f59e0b" strokeWidth={2} dot={false} name="clips/min" />
                    </RechartLine>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-6 shadow-lg">
                <SectionHeader icon={BarChart3} title="Avg Clips by Day of Week" color="text-blue-600" />
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #1e293b', background: '#0f172a', color: '#f8fafc', fontSize: 12 }} />
                      <Bar dataKey="clips" fill="#2563eb" radius={[4, 4, 0, 0]} name="Avg Clips" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* AI Report */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-blue-500 p-1.5 rounded-lg"><FileText className="w-4 h-4 text-white" /></div>
                <h2 className="font-bold text-white text-sm uppercase tracking-widest">Gemini AI — Clinical Assessment</h2>
              </div>
              <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line font-mono">{gemini}</div>
            </div>
          </>
        )}

        {/* ── SESSIONS TAB ── */}
        {tab === 'sessions' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title="Total Sessions" value={s.total_sessions} icon={Activity} iconColor="text-blue-500" />
              <KpiCard title="Binge Sessions" value={s.binge_sessions} icon={Flame} iconColor="text-red-500"
                sub={`${pct(s.binge_rate)} of all sessions`} />
              <KpiCard title="Max Binge Streak" value={s.max_binge_streak} icon={TrendingUp} iconColor="text-orange-500"
                sub="Consecutive binge sessions" />
              <KpiCard title="Longest Session" value={s.longest_session_minutes} unit="min" icon={Clock} iconColor="text-purple-500"
                sub={`Avg: ${s.avg_session_minutes} min`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie: binge vs normal */}
              <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-6 shadow-lg">
                <SectionHeader icon={Target} title="Session Type Distribution" color="text-red-500" />
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%"
                        paddingAngle={3} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Watch time area */}
              <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-6 shadow-lg">
                <SectionHeader icon={Clock} title="Daily Watch Time (minutes)" color="text-violet-500" />
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gw" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={20} dy={6} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #1e293b', background: '#0f172a', color: '#f8fafc', fontSize: 12 }} />
                      <Area type="monotone" dataKey="watch" stroke="#7c3aed" strokeWidth={2} fill="url(#gw)" dot={false} name="Watch min" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Re-watch & late-night stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-5 shadow-lg">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Re-watch Ratio</p>
                <p className="text-4xl font-black text-white">{pct(s.rewatched_ratio)}</p>
                <p className="text-xs text-slate-400 mt-2">Duplicate video views in same day session</p>
                <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${s.rewatched_ratio * 100}%` }} />
                </div>
              </div>
              <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-5 shadow-lg">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Late-Night Impact</p>
                <p className="text-4xl font-black text-white">{fmt1(s.avg_late_night_clips)}<span className="text-lg text-slate-400 ml-1">clips/day</span></p>
                <p className="text-xs text-slate-400 mt-2">Average clips in 12am–7am window</p>
              </div>
              <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-5 shadow-lg">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Morning Trigger</p>
                <p className="text-4xl font-black text-white">{fmt1(s.avg_morning_clips)}<span className="text-lg text-slate-400 ml-1">clips/day</span></p>
                <p className="text-xs text-slate-400 mt-2">Average clips in 7am–11am window</p>
              </div>
            </div>
          </>
        )}

        {/* ── PATTERNS TAB ── */}
        {tab === 'patterns' && (
          <>
            {/* Heatmap */}
            <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-6 shadow-lg overflow-x-auto">
              <SectionHeader icon={Eye} title="Activity Heatmap (Hour × Day)" color="text-slate-600" />
              <div className="min-w-[700px]">
                <div className="flex text-xs text-slate-400 mb-1 ml-12 gap-px">
                  {Array.from({ length: 24 }, (_, i) => (
                    <div key={i} className="w-7 text-center">{i % 3 === 0 ? `${i}h` : ''}</div>
                  ))}
                </div>
                {c.heatmap_z.map((row, di) => {
                  const maxVal = Math.max(...c.heatmap_z.flat(), 1);
                  return (
                    <div key={di} className="flex items-center gap-px mb-px">
                      <div className="text-xs text-slate-400 w-12 text-right pr-2 shrink-0">{DAY_LABELS[di]}</div>
                      {row.map((val, hi) => {
                        const intensity = val / maxVal;
                        const bg = val === 0 ? 'bg-slate-800' : intensity > 0.75 ? 'bg-red-500' : intensity > 0.5 ? 'bg-orange-400' : intensity > 0.25 ? 'bg-amber-300' : 'bg-blue-200';
                        return (
                          <div key={hi} className={`w-7 h-6 rounded-sm ${bg} transition-all`}
                            title={`${DAY_LABELS[di]} ${hi}:00 — ${val} clips`} />
                        );
                      })}
                    </div>
                  );
                })}
                {/* Legend */}
                <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                  <span>Low</span>
                  <div className="flex gap-1">
                    {['bg-slate-800', 'bg-blue-200', 'bg-amber-300', 'bg-orange-400', 'bg-red-500'].map(c => (
                      <div key={c} className={`w-5 h-3 rounded-sm ${c}`} />
                    ))}
                  </div>
                  <span>High</span>
                </div>
              </div>
            </div>

            {/* Daily clip count area */}
            <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-6 shadow-lg">
              <SectionHeader icon={BarChart3} title="Daily Clip Count" />
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={20} dy={6} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #1e293b', background: '#0f172a', color: '#f8fafc', fontSize: 12 }} />
                    <Area type="monotone" dataKey="clips" stroke="#06b6d4" strokeWidth={2} fill="url(#gc)" dot={false} name="Clips" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Peak info cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-6 shadow-lg flex items-start gap-4">
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                  <Clock className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Peak Activity Hour</p>
                  <p className="text-2xl font-black text-white">{fmtHour(s.peak_hour)}</p>
                  <p className="text-sm text-slate-500 mt-1">Single highest-volume hour across your dataset</p>
                </div>
              </div>
              <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-6 shadow-lg flex items-start gap-4">
                <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl">
                  <BarChart3 className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Peak Activity Day</p>
                  <p className="text-2xl font-black text-white">{s.peak_day}</p>
                  <p className="text-sm text-slate-500 mt-1">Highest average clips across all tracked weeks</p>
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState('landing');
  const [data, setData] = useState(null);

  if (view === 'landing') {
    return (
      <LandingPage 
        onStart={() => setView('upload')} 
        onDemo={() => {
          setData(SAMPLE_DATA);
          setView('dashboard');
        }} 
      />
    );
  }

  if (view === 'dashboard' && data) {
    return (
      <Dashboard 
        data={data} 
        onReset={() => {
          setData(null);
          setView('landing');
        }} 
      />
    );
  }

  return (
    <UploadPanel 
      onBack={() => setView('landing')} 
      onComplete={(d) => {
        setData(d);
        setView('dashboard');
      }} 
    />
  );
}
