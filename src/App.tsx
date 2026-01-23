import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, History, Trash2, RotateCcw, Download, Upload, Lock, LayoutGrid, BarChart3, Settings, Calendar, ChevronRight, X } from 'lucide-react';
import { cn, haptic } from './lib/utils';
import { type DailyRecord } from './types';
import { TradeChart } from './components/TradeChart';
import { calculateStatistics, getPeriodStats } from './lib/statistics';
import { StatsOverview } from './components/StatsOverview';
import logo from '/app-logo-new.png';
import { LockScreen } from './components/LockScreen';

type Tab = 'home' | 'analytics' | 'history' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [isLocked, setIsLocked] = useState(true);
  const [, setPassword] = useState(() => localStorage.getItem('app_passcode') || '2525');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [newPass, setNewPass] = useState('');

  const [records, setRecords] = useState<DailyRecord[]>(() => {
    const saved = localStorage.getItem('trade_records');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [initialCapital, setInitialCapital] = useState<number>(() => {
    const saved = localStorage.getItem('initial_capital');
    return saved ? parseFloat(saved) : 1000;
  });

  const [currentCapital, setCurrentCapital] = useState<number>(initialCapital);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProfitLoss, setNewProfitLoss] = useState('');
  const [newCapitalInput, setNewCapitalInput] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [isEditingInitial, setIsEditingInitial] = useState(false);

  useEffect(() => {
    // Force cache refresh by checking version
    const CURRENT_VERSION = 'v17.4';
    const savedVersion = localStorage.getItem('app_version');
    if (savedVersion !== CURRENT_VERSION) {
      localStorage.setItem('app_version', CURRENT_VERSION);
      // Clear any service workers if possible
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (let registration of registrations) {
            registration.unregister();
          }
        });
      }
      // Clear session storage but keep local storage for data
      sessionStorage.clear();
      window.location.reload();
    }

    const totalPL = records.reduce((acc, curr) => acc + curr.profitLoss, 0);
    setCurrentCapital(parseFloat((initialCapital + totalPL).toFixed(2)));
    
    localStorage.setItem('trade_records', JSON.stringify(records));
    localStorage.setItem('initial_capital', initialCapital.toString());
    localStorage.setItem('current_capital', (initialCapital + totalPL).toString());
  }, [records, initialCapital]);

  const stats = useMemo(() => calculateStatistics(records), [records]);
  const periodStats = useMemo(() => getPeriodStats(records), [records]);

  const recordsWithBalance = useMemo(() => {
    const sorted = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let running = initialCapital;
    const withBalance = sorted.map(r => {
      running += r.profitLoss;
      return { ...r, capitalAfter: parseFloat(running.toFixed(2)) };
    });
    return withBalance.reverse();
  }, [records, initialCapital]);

  const handlePLChange = (val: string) => {
    setNewProfitLoss(val);
    const pl = parseFloat(val);
    if (!isNaN(pl)) {
      setNewCapitalInput((currentCapital + pl).toFixed(2));
    } else {
      setNewCapitalInput('');
    }
  };

  const handleCapitalChange = (val: string) => {
    setNewCapitalInput(val);
    const cap = parseFloat(val);
    if (!isNaN(cap)) {
      setNewProfitLoss((cap - currentCapital).toFixed(2));
    } else {
      setNewProfitLoss('');
    }
  };

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const pl = parseFloat(newProfitLoss);
    if (isNaN(pl)) return;

    haptic('medium');

    const record: DailyRecord = {
      id: crypto.randomUUID(),
      date: new Date(newDate).toISOString(),
      profitLoss: pl,
      capitalBefore: 0,
      capitalAfter: 0,
      notes: newNotes
    };

    setRecords([record, ...records]);
    setNewProfitLoss('');
    setNewCapitalInput('');
    setNewNotes('');
    setNewDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(false);
  };

  const handleDeleteRecord = (id: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      setRecords(records.filter(r => r.id !== id));
    }
  };

  const handleExportJSON = () => {
    if (records.length === 0) return;
    const dataStr = JSON.stringify(records, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fox-trade-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          if (confirm(`Do you want to import ${data.length} records? They will be added to your current data.`)) {
            setRecords(prev => [...data, ...prev]);
          }
        }
      } catch (err) {
        alert('Invalid file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetAllData = () => {
    if (confirm('⚠️ Warning: All records will be deleted and capital reset. This cannot be undone! Are you sure?')) {
      setRecords([]);
      setInitialCapital(1000);
      localStorage.clear();
      window.location.reload();
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="space-y-8 animate-fade-in pb-32">
            {/* Balance Card */}
            <div className="ios-card-highlight">
              <div className="flex justify-between items-start mb-8">
                <div className="text-left">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80 mb-1">Total Balance</p>
                  <h2 className="text-5xl font-black tracking-tighter text-white drop-shadow-2xl">${currentCapital.toLocaleString()}</h2>
                </div>
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className={cn("px-4 py-2 rounded-xl flex items-center gap-2 backdrop-blur-md border border-white/5", stats.totalProfit >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                  {stats.totalProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="text-sm font-bold">{stats.totalProfit >= 0 ? '+' : ''}{stats.totalProfit.toLocaleString()}</span>
                </div>
                <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
                  Win Rate {stats.winRate.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="ios-card-mini">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Profit Factor</p>
                <p className="text-2xl font-black text-primary">{stats.profitFactor.toFixed(2)}</p>
              </div>
              <div className="ios-card-mini">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Total Trades</p>
                <p className="text-2xl font-black text-white">{records.length}</p>
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="text-lg font-black uppercase tracking-tighter text-foreground/80">Recent Activity</h3>
                <button onClick={() => { setActiveTab('history'); haptic('light'); }} className="text-primary text-xs font-bold uppercase tracking-widest active:opacity-50 transition-opacity">View All</button>
              </div>
              <div className="space-y-3">
                {recordsWithBalance.slice(0, 3).map(record => (
                  <div key={record.id} className="ios-card !p-4 flex items-center justify-between !rounded-[2rem]">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", record.profitLoss >= 0 ? "bg-green-500/10" : "bg-red-500/10")}>
                        {record.profitLoss >= 0 ? <TrendingUp className="w-6 h-6 text-green-500" /> : <TrendingDown className="w-6 h-6 text-red-500" />}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black text-white">{new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate max-w-[120px]">{record.notes || 'No notes'}</p>
                      </div>
                    </div>
                    <div className={cn("text-lg font-black", record.profitLoss >= 0 ? "text-green-400" : "text-red-400")}>
                      {record.profitLoss >= 0 ? '+' : ''}${record.profitLoss}
                    </div>
                  </div>
                ))}
                {records.length === 0 && (
                  <div className="text-center py-10 opacity-30">
                    <p className="text-xs font-black uppercase tracking-[0.3em]">No activity yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case 'analytics':
        return (
          <div className="space-y-6 animate-fade-in pb-32">
            <TradeChart data={records} initialCapital={initialCapital} />
            <StatsOverview stats={stats} periodStats={periodStats} records={records} />
          </div>
        );
      case 'history':
        return (
          <div className="space-y-6 animate-fade-in pb-32">
            <div className="flex justify-center -mt-2 mb-2">
              <span className="text-[7px] font-black tracking-widest text-primary/20 uppercase">Core v17.0 - Production</span>
            </div>
            <div className="px-2">
              {recordsWithBalance.map(record => (
                <div key={record.id} className="ios-card !p-5 flex flex-col gap-4 !rounded-[2.5rem]">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3 text-left">
                      <div className="bg-white/5 p-3 rounded-2xl backdrop-blur-md border border-white/5">
                        <Calendar className="w-5 h-5 text-primary/80" />
                      </div>
                      <div>
                        <p className="text-sm font-black uppercase text-white tracking-tight">{new Date(record.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Balance: ${record.capitalAfter.toLocaleString()}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteRecord(record.id)} className="p-2.5 bg-white/5 rounded-xl text-muted-foreground/30 hover:text-red-500 transition-colors active:scale-90">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex justify-between items-center bg-white/[0.03] p-4 rounded-3xl border border-white/[0.05]">
                    <div className={cn("text-2xl font-black tracking-tighter", record.profitLoss >= 0 ? "text-green-400" : "text-red-400")}>
                      {record.profitLoss >= 0 ? '+' : ''}${record.profitLoss.toLocaleString()}
                    </div>
                    {record.notes && (
                      <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest max-w-[50%] line-clamp-1 text-right italic">"{record.notes}"</p>
                    )}
                  </div>
                </div>
              ))}
              {records.length === 0 && (
                <div className="text-center py-20 opacity-20">
                  <History className="w-16 h-16 mx-auto mb-4" />
                  <p className="text-sm font-black uppercase tracking-[0.3em]">History is empty</p>
                </div>
              )}
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="space-y-8 animate-fade-in pb-32 px-2">
            <div className="space-y-4">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/60 ml-2 text-left">App & Security</p>
              <div className="ios-card !p-0 divide-y divide-white/5">
                <button 
                  onClick={() => { setIsChangingPass(true); haptic('medium'); }}
                  className="w-full p-5 flex items-center justify-between hover:bg-primary/[0.05] transition-colors group"
                >
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-primary">Change Passcode</p>
                      <p className="text-[10px] font-bold text-muted-foreground">Update access password</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-primary/30" />
                </button>
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-black">Initial Capital</p>
                      <p className="text-[10px] font-bold text-muted-foreground">Started with: ${initialCapital}</p>
                    </div>
                  </div>
                  <button onClick={() => setIsEditingInitial(true)} className="ios-button-secondary !py-2 !px-4 !text-xs active:scale-95 transition-transform">Edit</button>
                </div>
              </div>

              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/60 ml-2 mt-8 text-left">Data Management</p>
              <div className="ios-card !p-0 divide-y divide-white/5">
                <button onClick={handleExportJSON} className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center">
                      <Download className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-black">Export Backup (JSON)</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                </button>
                <label className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer">
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-black">Import Backup</p>
                  </div>
                  <input type="file" className="hidden" accept=".json" onChange={handleImportJSON} />
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                </label>

                {/* Password Change Modal */}
                {isChangingPass && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-sm glass-morphism rounded-[2.5rem] p-8 border border-white/10 shadow-2xl scale-in-center">
                      <h3 className="text-xl font-black text-white mb-2 tracking-tighter">Change Password</h3>
                      <p className="text-xs font-bold text-muted-foreground mb-6">Enter new 4-digit security code</p>
                      
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="••••"
                        value={newPass}
                        onChange={(e) => setNewPass(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-center text-2xl tracking-[1em] font-black text-primary focus:outline-none focus:border-primary/50 transition-colors mb-6"
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => { setIsChangingPass(false); setNewPass(''); haptic('light'); }}
                          className="p-4 rounded-2xl bg-white/5 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => {
                            if (newPass.length === 4) {
                              localStorage.setItem('app_passcode', newPass);
                              setPassword(newPass);
                              setIsChangingPass(false);
                              setNewPass('');
                              haptic('medium');
                              alert('Password updated successfully!');
                            }
                          }}
                          className="p-4 rounded-2xl bg-primary text-black text-xs font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
                        >
                          Update
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <button onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.href = window.location.origin + window.location.pathname + '?force=' + Date.now();
                }} className="w-full p-5 flex items-center justify-between hover:bg-primary/[0.05] transition-colors group">
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <RotateCcw className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-primary">Force Clear Cache</p>
                      <p className="text-[10px] font-bold text-muted-foreground">Fixes update issues</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-primary/30" />
                </button>
                <button onClick={handleResetAllData} className="w-full p-5 flex items-center justify-between hover:bg-red-500/[0.05] transition-colors group">
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center">
                      <RotateCcw className="w-5 h-5 text-red-500" />
                    </div>
                    <p className="text-sm font-black text-red-500">Reset All Data</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-red-500/30" />
                </button>
              </div>
            </div>

            <div className="text-center pt-10 opacity-60">
              {/* Settings footer logo and info removed per user request */}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-screen bg-[#050507] font-sans selection:bg-primary/30 antialiased relative flex flex-col overflow-hidden">
      {/* Background Watermark Logo */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.03] overflow-hidden">
        <img src={logo} alt="" className="w-[120%] max-w-none grayscale rotate-12" />
      </div>

      {isLocked && <LockScreen onUnlock={() => setIsLocked(false)} />}
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-6 pt-6 custom-scroll pb-44 relative">
        <div className="relative z-10">
          {renderTabContent()}
        </div>
      </main>

      {/* iOS 26 Tab Bar */}
      <nav className="ios-tab-bar">
        <button onClick={() => { setActiveTab('home'); haptic('light'); }} className={cn("ios-tab-item", activeTab === 'home' && "active")}>
          <LayoutGrid className="w-6 h-6" />
        </button>
        <button onClick={() => { setActiveTab('analytics'); haptic('light'); }} className={cn("ios-tab-item", activeTab === 'analytics' && "active")}>
          <BarChart3 className="w-6 h-6" />
        </button>
        
        {/* Central Add Button - Now Inside Bar & Larger */}
        <div className="flex items-center justify-center">
          <button 
            onClick={() => { setIsModalOpen(true); haptic('medium'); }}
            className="w-16 h-16 glass-morphism !rounded-full p-2.5 shadow-xl border border-white/10 active:scale-90 transition-all duration-300 flex items-center justify-center relative group"
          >
            <div className="absolute inset-0 bg-primary/15 rounded-full blur-md group-active:blur-lg transition-all" />
            <img src={logo} alt="Logo" className="w-full h-full object-contain relative z-10" />
          </button>
        </div>

        <button onClick={() => { setActiveTab('history'); haptic('light'); }} className={cn("ios-tab-item", activeTab === 'history' && "active")}>
          <History className="w-6 h-6" />
        </button>
        <button onClick={() => { setActiveTab('settings'); haptic('light'); }} className={cn("ios-tab-item", activeTab === 'settings' && "active")}>
          <Settings className="w-6 h-6" />
        </button>
      </nav>

        {/* iOS Sheet Modal for Adding Record */}
        {isModalOpen && (
          <>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[90] animate-fade-in" onClick={() => setIsModalOpen(false)} />
            <div className="ios-sheet animate-slide-up max-w-[430px] mx-auto left-0 right-0 absolute bottom-0">
              <div className="ios-sheet-handle" />
              <div className="flex justify-between items-center mb-8 mt-2 relative">
                <div /> {/* Spacer */}
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white/5 rounded-full text-muted-foreground active:scale-90 transition-transform relative z-10">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddRecord} className="space-y-5 pb-10">
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1 py-2 bg-white/[0.03] rounded-2xl border border-white/[0.05] mb-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-3 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-primary/70" />
                      Date
                    </label>
                    <input 
                      type="date" 
                      value={newDate} 
                      onChange={(e) => setNewDate(e.target.value)} 
                      className="bg-transparent text-white font-bold text-sm outline-none pr-3 py-1 cursor-pointer" 
                      required 
                    />
                  </div>
                  
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 ml-1">Profit / Loss ($)</label>
                    <input type="number" step="0.01" value={newProfitLoss} onChange={(e) => handlePLChange(e.target.value)} className="ios-input w-full font-black text-primary text-lg" required />
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 ml-1">New Balance ($)</label>
                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground/30 font-black text-xl">$</div>
                    <input type="number" step="0.01" value={newCapitalInput} onChange={(e) => handleCapitalChange(e.target.value)} className="ios-input w-full font-black text-2xl pl-10" />
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 ml-1">Notes (Optional)</label>
                  <textarea placeholder="Strategy, mistakes, or insights..." value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className="ios-input w-full min-h-[80px] py-3 resize-none font-medium text-sm" />
                </div>

                <button type="submit" disabled={!newProfitLoss} className="ios-button-primary w-full py-5 !rounded-3xl uppercase tracking-[0.2em] text-xs mt-4 disabled:opacity-30 active:scale-95 transition-transform">
                  Save Record
                </button>
              </form>
            </div>
          </>
        )}

      {/* Initial Capital Edit Modal */}
      {isEditingInitial && (
        <>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[110] animate-fade-in" onClick={() => setIsEditingInitial(false)} />
          <div className="ios-sheet !bottom-auto !top-1/2 !-translate-y-1/2 !rounded-[2.5rem] !max-w-xs !mx-auto animate-fade-in z-[120] absolute left-0 right-0">
            <h3 className="text-xl font-black text-center mb-6 text-white">Initial Capital</h3>
            <input 
              type="number" 
              value={initialCapital} 
              onChange={(e) => setInitialCapital(parseFloat(e.target.value) || 0)}
              className="ios-input w-full text-center text-2xl font-black mb-6"
              autoFocus
            />
            <button onClick={() => setIsEditingInitial(false)} className="ios-button-primary w-full py-4 active:scale-95 transition-transform">Update Capital</button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
