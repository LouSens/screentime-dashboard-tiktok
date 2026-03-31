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
const RISK_BG    = { high: 'bg-red-50 border-red-200', medium: 'bg-amber-50 border-amber-200', low: 'bg-emerald-50 border-emerald-200' };
const RISK_TEXT  = { high: 'text-red-600', medium: 'text-amber-600', low: 'text-emerald-600' };
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const PIE_COLORS = ['#ef4444','#3b82f6'];

// ─── Helpers ────────────────────────────────────────────────────────────────
const pct  = (v) => `${(v * 100).toFixed(1)}%`;
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

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ title, value, unit='', sub='', icon: Icon, iconColor='text-blue-500', accent=false }) {
  return (
    <div className={`rounded-2xl p-5 border shadow-sm ${accent ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-semibold uppercase tracking-widest ${accent ? 'text-slate-400' : 'text-slate-500'}`}>{title}</span>
        <Icon className={`w-4 h-4 ${accent ? 'text-slate-400' : iconColor}`} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-3xl font-black tracking-tight ${accent ? 'text-white' : 'text-slate-900'}`}>{value}</span>
        {unit && <span className={`text-sm font-medium ${accent ? 'text-slate-400' : 'text-slate-400'}`}>{unit}</span>}
      </div>
      {sub && <p className={`text-xs mt-2 ${accent ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</p>}
    </div>
  );
}

// ─── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, color='text-blue-600' }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <Icon className={`w-4 h-4 ${color}`} />
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700">{title}</h2>
    </div>
  );
}

// ─── Landing Page ────────────────────────────────────────────────────────────
function LandingPage({ onStart }) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Nav */}
      <nav className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg"><Activity className="w-5 h-5 text-white" /></div>
            <span className="font-bold text-lg text-slate-900">Neural Void</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <a href="#" className="hover:text-slate-900 transition-colors">Platform</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Methodology</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Enterprise</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-sm font-medium text-slate-500 hidden md:block hover:text-slate-900">Sign in</button>
            <button onClick={onStart} className="bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
              Start Free Audit
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-6 py-24 md:py-36 text-center relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-radial from-blue-100/60 to-transparent" />
          <div className="absolute top-20 right-10 w-80 h-80 bg-indigo-100/50 rounded-full blur-3xl" />
          <div className="absolute top-40 left-10 w-64 h-64 bg-blue-100/50 rounded-full blur-3xl" />
        </div>

        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-8">
          <Zap className="w-3 h-3" /> 25-Feature ML Engine · 96% Accuracy
        </span>

        <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight leading-[1.08] mb-6 max-w-4xl mx-auto">
          Map your{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
            cognitive bandwidth
          </span>{' '}
          with clinical precision.
        </h1>

        <p className="text-lg md:text-xl text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed">
          Neural Void extracts 25 behavioural signals from your TikTok data export — sessions, binge streaks,
          doomscroll velocity, late-night ratios — and forecasts relapse risk with ensemble ML.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button onClick={onStart}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-9 py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/25 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2">
            Analyze My Data <ChevronRight className="w-5 h-5" />
          </button>
          <button className="w-full sm:w-auto bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-9 py-4 rounded-xl font-semibold text-lg transition-all">
            View Sample Report
          </button>
        </div>

        {/* Feature grid */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 text-left border-t border-slate-100 pt-16">
          {[
            { icon: Clock,      color:'text-blue-600',    bg:'bg-blue-50 border-blue-100',
              title:'Session Parsing', desc:'Detects 10-minute gap sessions and flags any binge exceeding 45 minutes, giving you a full session timeline.' },
            { icon: Zap,        color:'text-indigo-600',  bg:'bg-indigo-50 border-indigo-100',
              title:'Velocity Tracking', desc:'Calculates doomscroll velocity (clips/min) and consecutive binge streaks — the real markers of algorithmic lock-in.' },
            { icon: Shield,     color:'text-emerald-600', bg:'bg-emerald-50 border-emerald-100',
              title:'Relapse Forecasting', desc:'Ensemble of Logistic Regression, Random Forest, and XGBoost scores tomorrow\'s relapse probability at 96% accuracy.' },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title}>
              <div className={`w-12 h-12 ${bg} border rounded-xl flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-slate-100 bg-white py-10 mt-16 text-center text-slate-400 text-sm">
        © {new Date().getFullYear()} Neural Void Inc. — Precision Behavioural Analytics
      </footer>
    </div>
  );
}

// ─── Upload Panel ─────────────────────────────────────────────────────────────
function UploadPanel({ onBack }) {
  const [file, setFile]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [dragActive, setDrag]   = useState(false);
  const [data, setData]         = useState(null);
  const [error, setError]       = useState('');

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
      const r = await fetch('http://localhost:8000/analyze', { method: 'POST', body: fd });
      if (!r.ok) throw new Error(`Server error: ${r.status}`);
      setData(await r.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (data) return <Dashboard data={data} onReset={() => setData(null)} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center p-6">
      <button onClick={onBack} className="absolute top-6 left-6 text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors">
        <X className="w-4 h-4" /> Back
      </button>
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-blue-600 p-1.5 rounded-lg"><Activity className="w-4 h-4 text-white" /></div>
          <span className="font-bold text-slate-900">Neural Void</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 mt-4 mb-1">Upload Data Export</h1>
        <p className="text-slate-500 text-sm mb-8">Your TikTok <code className="bg-slate-100 px-1 rounded text-xs">Watch History.txt</code> export file.</p>

        <div
          className={`rounded-xl p-10 flex flex-col items-center cursor-pointer transition-all border-2 border-dashed ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
          onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop}
          onClick={() => document.getElementById('fu').click()}
        >
          <input id="fu" type="file" accept=".txt" className="hidden" onChange={e => setFile(e.target.files[0])} />
          <div className={`p-4 rounded-full mb-4 ${file ? 'bg-blue-100' : 'bg-slate-100'}`}>
            {file ? <FileType size={28} className="text-blue-600" /> : <UploadCloud size={28} className="text-slate-400" />}
          </div>
          <p className="font-semibold text-slate-800">{file ? file.name : 'Click or drag & drop'}</p>
          <p className="text-xs text-slate-400 mt-1">.txt files only</p>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        <button onClick={analyze} disabled={!file || loading}
          className={`mt-6 w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
            ${!file || loading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20'}`}>
          {loading
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Running ML Analysis...</>
            : 'Run Full Analysis'}
        </button>

        <p className="text-center text-xs text-slate-400 mt-4">25 features extracted · 96% model accuracy · Gemini AI insights</p>
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
    date:     new Date(d).toLocaleDateString(undefined, { month:'short', day:'numeric' }),
    score:    c.scores[i],
    clips:    c.clips[i],
    watch:    c.watch_minutes[i],
    velocity: c.velocity[i],
  }));

  const radarData = DAY_LABELS.map((day, i) => ({
    subject: day,
    score:   c.radar_values[i] ?? 0,
    clips:   c.radar_clips[i]  ?? 0,
    fullMark: Math.max(...c.radar_values, 10),
  }));

  const weeklyData = DAY_LABELS.map((day, i) => ({
    day:   day,
    clips: c.weekly_bar[i] ?? 0,
  }));

  const pieData = [
    { name: 'Binge Sessions',  value: c.session_dist.binge  },
    { name: 'Normal Sessions', value: c.session_dist.normal },
  ];

  const riskLevel = f.risk_level;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Sticky header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-1.5 rounded-lg"><Activity className="w-4 h-4 text-white" /></div>
            <div>
              <h1 className="font-bold text-slate-900 text-sm leading-none">Neural Void</h1>
              <p className="text-xs text-slate-400 mt-0.5">Behaviour Intelligence Dashboard</p>
            </div>
          </div>

          {/* Tab nav */}
          <div className="hidden md:flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {[['overview','Overview'],['sessions','Sessions'],['patterns','Patterns']].map(([id,label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all
                  ${tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                {label}
              </button>
            ))}
          </div>

          <button onClick={onReset}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 border border-slate-200 bg-white px-3 py-1.5 rounded-lg transition-colors">
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
                : riskLevel === 'low'  ? <CheckCircle2 className="w-6 h-6 text-emerald-600" />
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
              <KpiCard title="Total Events"   value={s.total_events.toLocaleString()} icon={Activity}  iconColor="text-blue-500"
                sub={`~${s.total_watch_hours}h total watch time`} />
              <KpiCard title="Total Sessions" value={s.total_sessions.toLocaleString()} icon={BarChart3} iconColor="text-indigo-500"
                sub={`${s.binge_sessions} binge sessions (${pct(s.binge_rate)})`} />
              <KpiCard title="Avg Session"   value={fmt1(s.avg_session_minutes)} unit="min" icon={Clock}    iconColor="text-violet-500"
                sub={`Longest: ${s.longest_session_minutes} min`} />
              <KpiCard title="Relapse Risk"  value={(f.risk_score * 10).toFixed(1)} unit="/ 10" icon={ShieldAlert}
                iconColor={RISK_TEXT[riskLevel]} accent sub={`${riskLevel.toUpperCase()} — trend ${f.trend}`} />
            </div>

            {/* KPI row 2 – Behaviour signals */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title="Doomscroll Velocity" value={fmt1(s.avg_velocity)} unit="clips/min" icon={Zap}     iconColor="text-amber-500"
                sub="Average across all sessions" />
              <KpiCard title="Late-Night Avg"      value={fmt1(s.avg_late_night_clips)} unit="clips/day" icon={Moon}    iconColor="text-purple-500"
                sub="Midnight → 7am window" />
              <KpiCard title="Morning Trigger"     value={fmt1(s.avg_morning_clips)}    unit="clips/day" icon={Sunrise} iconColor="text-orange-500"
                sub="7am → 11am window" />
              <KpiCard title="Bad-Habit Days"      value={pct(s.bad_days_ratio)} icon={Flame} iconColor="text-red-500"
                sub={`Max binge streak: ${s.max_binge_streak} sessions`} />
            </div>

            {/* Area chart + Radar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <SectionHeader icon={LineChart} title="Daily Habit Score (Smoothed)" />
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top:5, right:5, left:-20, bottom:0 }}>
                      <defs>
                        <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }} minTickGap={20} dy={6} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }} />
                      <Tooltip contentStyle={{ borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:12 }} />
                      <Area type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2.5} fill="url(#gs)" dot={false} name="Habit Score" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <SectionHeader icon={Activity} title="Day-of-Week Pattern" color="text-indigo-600" />
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="68%" data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill:'#64748b', fontSize:11 }} />
                      <PolarRadiusAxis tick={false} axisLine={false} />
                      <Radar name="Habit Score" dataKey="score" stroke="#4f46e5" strokeWidth={2} fill="#4f46e5" fillOpacity={0.2} />
                      <Radar name="Clips"       dataKey="clips" stroke="#06b6d4" strokeWidth={1.5} fill="#06b6d4" fillOpacity={0.1} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Velocity trend + Weekly bar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <SectionHeader icon={Zap} title="Doomscroll Velocity Over Time" color="text-amber-500" />
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartLine data={trendData} margin={{ top:5, right:5, left:-20, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }} minTickGap={20} dy={6} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }} />
                      <Tooltip contentStyle={{ borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:12 }} />
                      <Line type="monotone" dataKey="velocity" stroke="#f59e0b" strokeWidth={2} dot={false} name="clips/min" />
                    </RechartLine>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <SectionHeader icon={BarChart3} title="Avg Clips by Day of Week" color="text-blue-600" />
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} margin={{ top:5, right:5, left:-20, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }} />
                      <Tooltip contentStyle={{ borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:12 }} />
                      <Bar dataKey="clips" fill="#2563eb" radius={[4,4,0,0]} name="Avg Clips" />
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
              <KpiCard title="Total Sessions"    value={s.total_sessions} icon={Activity}  iconColor="text-blue-500" />
              <KpiCard title="Binge Sessions"    value={s.binge_sessions} icon={Flame}     iconColor="text-red-500"
                sub={`${pct(s.binge_rate)} of all sessions`} />
              <KpiCard title="Max Binge Streak"  value={s.max_binge_streak} icon={TrendingUp} iconColor="text-orange-500"
                sub="Consecutive binge sessions" />
              <KpiCard title="Longest Session"   value={s.longest_session_minutes} unit="min" icon={Clock} iconColor="text-purple-500"
                sub={`Avg: ${s.avg_session_minutes} min`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie: binge vs normal */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <SectionHeader icon={Target} title="Session Type Distribution" color="text-red-500" />
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%"
                        paddingAngle={3} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                        labelLine={false}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Watch time area */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <SectionHeader icon={Clock} title="Daily Watch Time (minutes)" color="text-violet-500" />
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top:5, right:5, left:-20, bottom:0 }}>
                      <defs>
                        <linearGradient id="gw" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }} minTickGap={20} dy={6} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }} />
                      <Tooltip contentStyle={{ borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:12 }} />
                      <Area type="monotone" dataKey="watch" stroke="#7c3aed" strokeWidth={2} fill="url(#gw)" dot={false} name="Watch min" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Re-watch & late-night stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Re-watch Ratio</p>
                <p className="text-4xl font-black text-slate-900">{pct(s.rewatched_ratio)}</p>
                <p className="text-xs text-slate-400 mt-2">Duplicate video views in same day session</p>
                <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width:`${s.rewatched_ratio * 100}%` }} />
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Late-Night Impact</p>
                <p className="text-4xl font-black text-slate-900">{fmt1(s.avg_late_night_clips)}<span className="text-lg text-slate-400 ml-1">clips/day</span></p>
                <p className="text-xs text-slate-400 mt-2">Average clips in 12am–7am window</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Morning Trigger</p>
                <p className="text-4xl font-black text-slate-900">{fmt1(s.avg_morning_clips)}<span className="text-lg text-slate-400 ml-1">clips/day</span></p>
                <p className="text-xs text-slate-400 mt-2">Average clips in 7am–11am window</p>
              </div>
            </div>
          </>
        )}

        {/* ── PATTERNS TAB ── */}
        {tab === 'patterns' && (
          <>
            {/* Heatmap */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-x-auto">
              <SectionHeader icon={Eye} title="Activity Heatmap (Hour × Day)" color="text-slate-600" />
              <div className="min-w-[700px]">
                <div className="flex text-xs text-slate-400 mb-1 ml-12 gap-px">
                  {Array.from({length:24},(_,i)=> (
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
                        const bg = val === 0 ? 'bg-slate-50' : intensity > 0.75 ? 'bg-red-500' : intensity > 0.5 ? 'bg-orange-400' : intensity > 0.25 ? 'bg-amber-300' : 'bg-blue-200';
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
                    {['bg-slate-50','bg-blue-200','bg-amber-300','bg-orange-400','bg-red-500'].map(c=>(
                      <div key={c} className={`w-5 h-3 rounded-sm ${c}`} />
                    ))}
                  </div>
                  <span>High</span>
                </div>
              </div>
            </div>

            {/* Daily clip count area */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <SectionHeader icon={BarChart3} title="Daily Clip Count" />
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top:5, right:5, left:-20, bottom:0 }}>
                    <defs>
                      <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }} minTickGap={20} dy={6} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill:'#94a3b8', fontSize:11 }} />
                    <Tooltip contentStyle={{ borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:12 }} />
                    <Area type="monotone" dataKey="clips" stroke="#06b6d4" strokeWidth={2} fill="url(#gc)" dot={false} name="Clips" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Peak info cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-start gap-4">
                <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl">
                  <Clock className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Peak Activity Hour</p>
                  <p className="text-2xl font-black text-slate-900">{fmtHour(s.peak_hour)}</p>
                  <p className="text-sm text-slate-500 mt-1">Single highest-volume hour across your dataset</p>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-start gap-4">
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl">
                  <BarChart3 className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Peak Activity Day</p>
                  <p className="text-2xl font-black text-slate-900">{s.peak_day}</p>
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
  if (view === 'landing') return <LandingPage onStart={() => setView('upload')} />;
  return <UploadPanel onBack={() => setView('landing')} />;
}
