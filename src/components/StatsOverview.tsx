import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { type Statistics, type PeriodStats, type SessionStats } from '../lib/statistics';
import { cn } from '../lib/utils';
import { TradeChart } from './TradeChart';
import { type DailyRecord } from '../types';
import { haptic } from '../lib/utils';
import logo from '../assets/app-logo-new.png';

interface StatsOverviewProps {
  stats: Statistics;
  records: DailyRecord[];
  sessionStats: SessionStats[];
  periodStats: {
    weekly: PeriodStats[];
    monthly: PeriodStats[];
    daily: PeriodStats[];
  };
  initialCapital: number;
  theme: 'light' | 'dark';
}

export function StatsOverview({ stats, periodStats, records, initialCapital, sessionStats, theme }: StatsOverviewProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = (e: Event) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const target = (e.target === document ? document.documentElement : e.target) as HTMLElement;
          const currentScrollY = target.scrollTop || window.scrollY;
          
          setIsScrolled(currentScrollY > 2);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10 px-0 sm:px-4 relative">
      
      {/* iOS Top Fade Effect - Removed background gradients to keep it clean */}
      <div className={cn(
        "fixed top-0 inset-x-0 h-40 z-[90] pointer-events-none transition-opacity duration-500 opacity-0"
      )} />

      {/* Gradient Blur Effect - Unified implementation for all pages */}
      <div className={cn("gradient-blur-header", isScrolled && "is-scrolled")} style={{ zIndex: 90 }} />

      {/* Sticky Header Section - All Cards with Stack Effect */}
      <div className={cn(
        "z-[100] pt-4 transition-all duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] sticky top-0",
        isScrolled ? "sm:scale-[0.98] sm:-translate-y-2" : "sm:scale-100 sm:translate-y-0"
      )}>
        {/* Transparent Mask - Removed solid backgrounds to eliminate the rectangle */}
        <div className={cn(
            "fixed inset-x-0 top-0 h-[120px] -z-10 transition-opacity duration-150 gpu-accelerated will-change-[opacity,backdrop-filter] hidden sm:block",
            isScrolled ? "backdrop-blur-md opacity-100" : "backdrop-blur-0 opacity-0"
          )} style={{ 
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)'
          }} />

        {/* Mobile Scrolled: Logo - Above the Card */}
        <div className={cn(
          "hidden",
          isScrolled && "flex sm:hidden items-center justify-center mb-1 absolute -top-8 left-0 right-0 z-50 animate-in fade-in slide-in-from-top-2 duration-500"
        )}>
           <img 
             src={logo} 
             alt="App Logo" 
             className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] opacity-80" 
           />
        </div>

        {/* iOS Notification Style Stack Container - Main Balance Card */}
        <div className={cn(
          "transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] origin-top relative",
          isScrolled ? "sm:mb-1 sm:scale-[0.8] sm:-translate-y-4 mb-3 scale-100 translate-y-0" : "mb-3 sm:mb-4 scale-100 translate-y-0"
        )}>
          {/* Bottom Stack Layer (The "Ghost" cards underneath) */}
          <div className={cn(
            "absolute -bottom-2 inset-x-6 h-12 rounded-[2.5rem] -z-10 transition-all duration-700 border",
            theme === 'light' ? "bg-white/40 border-white/40" : "bg-white/[0.05] border-white/[0.06]",
            isScrolled ? "sm:opacity-100 sm:translate-y-1 sm:scale-[0.94] opacity-0" : "opacity-0 translate-y-0 scale-100"
          )} />
          <div className={cn(
            "absolute -bottom-4 inset-x-10 h-12 rounded-[2.5rem] -z-20 transition-all duration-700 border",
            theme === 'light' ? "bg-white/20 border-white/20" : "bg-white/[0.005] border-white/[0.05]",
            isScrolled ? "sm:opacity-60 sm:translate-y-2 sm:scale-[0.88] opacity-0" : "opacity-0 translate-y-0 scale-100"
          )} />

          <div className={cn(
            "ios-card shadow-2xl group transition-all duration-700 relative overflow-hidden sm:overflow-visible border",
            theme === 'light' ? "bg-white/60 border-white/60" : "bg-white/[0.05] border-white/[0.05]",
            isScrolled ? "sm:py-2 sm:rounded-[1.5rem] sm:h-[70px] sm:flex sm:items-center py-3 h-auto" : "py-3 sm:py-3 h-auto"
          )}>
            {/* Theme-based Edge Border Overlay */}
            <div className={cn(
              "absolute inset-0 pointer-events-none rounded-[inherit] z-30 transition-all duration-700",
              theme === 'light' ? "border-[0.2px] border-black/5" : "border-[0.2px] border-white/10",
              "shadow-[0_0_1px_rgba(255,255,255,0.05)]"
            )} />

            {/* Glossy Overlay like iOS notifications - Modified for Dark Mode transparency */}
            <div className={cn(
              "absolute inset-0 pointer-events-none",
              theme === 'light' ? "bg-gradient-to-tr from-white/10 to-transparent" : "bg-gradient-to-tr from-white/[0.05] to-transparent"
            )} />
            
            {/* Vertical Side Label - Slimmer for stack effect */}
            <div className={cn(
              "absolute left-0 top-0 bottom-0 w-6 sm:w-8 hidden xs:flex items-center justify-center border-r backdrop-blur-md rounded-l-[2.5rem] overflow-hidden z-20 transition-all duration-500",
              theme === 'light' ? "bg-black/[0.05] border-black/[0.06]" : "bg-white/[0.005] border-white/[0.05]",
              isScrolled && "sm:w-7"
            )}>
              <div className="-rotate-90 whitespace-nowrap">
                <p className={cn(
                  "font-black uppercase tracking-[0.4em] text-primary/70 select-none transition-all duration-500",
                  isScrolled ? "sm:text-[6px] sm:tracking-[0.2em] text-[6px] tracking-[0.4em]" : "text-[6px] sm:text-[8px] tracking-[0.4em] sm:tracking-[0.6em]"
                )}>
                  Net Performance
                </p>
              </div>
            </div>

            {/* Animated Background Gradient Glows */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-rose-500/5 rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
            
            <div className={cn(
              "relative z-10 w-full px-3 sm:px-4 xs:pl-8 sm:pl-12 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 transition-all duration-700",
              isScrolled ? "flex-row items-center justify-between gap-2 p-3 xs:pl-8 sm:p-3" : "p-3 sm:p-4 xs:pl-8 sm:pl-12"
            )}>
              {/* Main Net Profit Section */}
              <div className={cn(
                "transition-all duration-700",
                isScrolled ? "sm:flex-none flex-1" : "flex-1"
              )}>
                <div className={cn("flex items-center gap-2 mb-1 transition-all duration-500", isScrolled ? "hidden sm:flex sm:opacity-0 sm:h-0 sm:overflow-hidden sm:mb-0 opacity-100 h-auto" : "opacity-100 h-auto")}>
                  <div className={cn(
                    "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.1em] border backdrop-blur-xl",
                    stats.totalProfit >= 0 
                      ? (theme === 'light' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-emerald-500/5 border-emerald-500/15 text-emerald-500/60")
                      : (theme === 'light' ? "bg-rose-500/10 border-rose-500/20 text-rose-600" : "bg-rose-500/5 border-rose-500/15 text-rose-500/60")
                  )}>
                    Overall Results
                  </div>
                  <div className={cn(
                    "h-px flex-1 bg-gradient-to-r to-transparent",
                    theme === 'light' ? "from-black/5" : "from-white/5"
                  )} />
                </div>

                <div className="flex items-center gap-3">
                  <div className={cn(
                    "font-black tracking-tighter flex items-baseline gap-1 transition-all duration-700",
                    theme === 'light' ? "text-slate-900" : "text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.03)]",
                    isScrolled ? "text-xl sm:text-2xl" : "text-3xl sm:text-5xl"
                  )}>
                    <span className={cn(
                      "transition-all duration-700",
                      stats.totalProfit >= 0 ? "text-emerald-500" : "text-rose-500",
                      isScrolled ? "text-xl sm:text-lg sm:opacity-60 opacity-60" : "text-xl sm:text-2xl opacity-20"
                    )}>{stats.totalProfit >= 0 ? '+' : ''}</span>
                    {Math.round(stats.totalProfit).toLocaleString()}
                    <span className={cn(
                      "opacity-20 ml-0.5 transition-all duration-700", 
                      theme === 'light' ? "text-slate-900" : "text-white",
                      isScrolled ? "text-lg sm:text-sm" : "text-base sm:text-lg"
                    )}>$</span>
                    
                    {isScrolled && (
                      <span className={cn(
                        "ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-md border hidden sm:inline-block",
                        stats.totalProfit >= 0 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                          : "bg-rose-500/10 border-rose-500/20 text-rose-500"
                      )}>
                        {((stats.totalProfit / initialCapital) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  
                  {/* Visual indicator icon */}
                  <div className={cn(
                    "flex rounded-2xl items-center justify-center border transition-all duration-700 group-hover:scale-105 backdrop-blur-xl shadow-inner",
                    stats.totalProfit >= 0 
                      ? (theme === 'light' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-emerald-500/5 border-emerald-500/10 text-emerald-500")
                      : (theme === 'light' ? "bg-rose-500/10 border-rose-500/20 text-rose-600" : "bg-rose-500/5 border-rose-500/10 text-rose-500"),
                    isScrolled ? "w-8 h-8 rounded-lg sm:w-7 sm:h-7 sm:rounded-lg" : "w-10 h-10 rounded-2xl"
                  )}>
                    {stats.totalProfit >= 0 ? <TrendingUp className={isScrolled ? "w-4 h-4 sm:w-3 sm:h-3" : "w-5 h-5"} /> : <TrendingDown className={isScrolled ? "w-4 h-4 sm:w-3 sm:h-3" : "w-5 h-5"} />}
                  </div>
                </div>
              </div>

              {/* Metrics Breakdown Grid - Now horizontal on scroll */}
              <div className={cn(
                "grid transition-all duration-700",
                isScrolled ? "grid grid-cols-2 gap-2 flex-1 sm:grid sm:grid-cols-2 sm:gap-2 sm:flex-1 sm:max-w-[300px]" : "grid-cols-2 gap-2 sm:gap-3 lg:w-1/3"
              )}>
                {/* Gross Profit Box */}
                <div className={cn(
                  "relative p-2 rounded-2xl border overflow-hidden group/box transition-all duration-300 backdrop-blur-md",
                  theme === 'light' ? "bg-white/30 border-white/50 hover:bg-white/50" : "bg-white/[0.05] border-white/[0.05] hover:bg-white/[0.04]",
                  isScrolled ? "p-1 rounded-lg border-none bg-transparent backdrop-blur-none sm:p-1 sm:rounded-lg sm:border-none sm:bg-transparent sm:backdrop-blur-none flex flex-col items-center justify-center" : "p-2 rounded-2xl"
                )}>
                  <div className={cn("absolute top-0 left-0 w-0.5 h-full bg-emerald-500/30", isScrolled && "hidden sm:hidden")} />
                  <p className={cn(
                    "font-black uppercase tracking-widest mb-0.5 transition-all duration-500", 
                    theme === 'light' ? "text-slate-900/30" : "text-white/20",
                    isScrolled ? "text-[6px] sm:text-[6px] text-center" : "text-[7px]"
                  )}>Revenue</p>
                  <div className={cn("flex items-baseline gap-1", isScrolled && "justify-center")}>
                    <span className={cn(
                      "font-black tracking-tighter transition-all duration-500", 
                      theme === 'light' ? "text-slate-900" : "text-white",
                      isScrolled ? "text-sm sm:text-base" : "text-lg"
                    )}>
                      {Math.round(stats.grossProfit).toLocaleString()}
                    </span>
                    <span className={cn("font-bold text-emerald-500/40 transition-all duration-500", isScrolled ? "text-[7px] sm:text-[7px]" : "text-[8px]")}>$</span>
                  </div>
                </div>

                {/* Gross Loss Box */}
                <div className={cn(
                  "relative p-2 rounded-2xl border overflow-hidden group/box transition-all duration-300 backdrop-blur-md",
                  theme === 'light' ? "bg-white/30 border-white/50 hover:bg-white/50" : "bg-white/[0.05] border-white/[0.05] hover:bg-white/[0.04]",
                  isScrolled ? "p-1 rounded-lg border-none bg-transparent backdrop-blur-none sm:p-1 sm:rounded-lg sm:border-none sm:bg-transparent sm:backdrop-blur-none flex flex-col items-center justify-center" : "p-2 rounded-2xl"
                )}>
                  <div className={cn("absolute top-0 left-0 w-0.5 h-full bg-rose-500/30", isScrolled && "hidden sm:hidden")} />
                  <p className={cn(
                    "font-black uppercase tracking-widest mb-0.5 transition-all duration-500", 
                    theme === 'light' ? "text-slate-900/30" : "text-white/20",
                    isScrolled ? "text-[6px] sm:text-[6px] text-center" : "text-[7px]"
                  )}>Drawdown</p>
                  <div className={cn("flex items-baseline gap-1", isScrolled && "justify-center")}>
                    <span className={cn(
                      "font-black tracking-tighter transition-all duration-500", 
                      theme === 'light' ? "text-slate-900" : "text-white",
                      isScrolled ? "text-sm sm:text-base" : "text-lg"
                    )}>
                      {Math.round(stats.grossLoss).toLocaleString()}
                    </span>
                    <span className={cn("font-bold text-rose-500/40 transition-all duration-500", isScrolled ? "text-[7px] sm:text-[7px]" : "text-[8px]")}>$</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-4 mb-8">
        <StatCard 
          label="WIN RATE" 
          value={`${stats.winRate.toFixed(1)}%`} 
          trend={stats.winRate >= 50 ? 'positive' : 'negative'}
          percentage={stats.winRate}
          theme={theme}
        />
        <StatCard 
          label="EXPECTANCY" 
          value={`$${Math.round(stats.expectedValue)}`} 
          trend={stats.expectedValue > 0 ? 'positive' : 'negative'}
          percentage={50 + (stats.expectedValue / 1000) * 50}
          theme={theme}
        />
        <StatCard 
          label="TRADES" 
          value={stats.totalTrades} 
          trend="neutral"
          percentage={Math.min(stats.totalTrades, 100)}
          theme={theme}
        />
        <StatCard 
          label="AVG WIN" 
          value={`+$${Math.round(stats.averageWin)}`} 
          trend="positive"
          percentage={75}
          theme={theme}
        />
        <StatCard 
          label="AVG LOSS" 
          value={`-$${Math.round(stats.averageLoss)}`} 
          trend="negative"
          percentage={40}
          theme={theme}
        />
        <StatCard 
          label="MAX DRAWDOWN" 
          value={`${stats.maxDrawdown.toFixed(1)}%`} 
          trend="negative"
          percentage={100 - stats.maxDrawdown}
          theme={theme}
        />
      </div>

      {/* Main Content Area - Scrolls under Sticky Header */}
      <div className="space-y-6 pt-4 relative z-10">
        {/* Embedded Portfolio Growth Chart */}
      <div className={cn(
        "ios-card w-full border overflow-hidden sm:overflow-visible p-4 sm:p-10 shadow-2xl relative group",
        theme === 'light' ? "bg-white/60 border-white/60" : "bg-white/[0.05] border-white/[0.05]"
      )}>
        {/* Background Decorative Glow */}
        <div className="absolute -top-12 -right-12 sm:-top-24 sm:-right-24 w-32 sm:w-64 h-32 sm:h-64 bg-primary/10 blur-[60px] sm:blur-[100px] rounded-full pointer-events-none group-hover:bg-primary/15 transition-all duration-700" />
        <div className="absolute -bottom-12 -left-12 sm:-bottom-24 sm:-left-24 w-32 sm:w-64 h-32 sm:h-64 bg-primary/5 blur-[60px] sm:blur-[100px] rounded-full pointer-events-none group-hover:bg-primary/10 transition-all duration-700" />

        <div className="w-full h-[280px] sm:h-[550px] relative z-10">
          <TradeChart data={records} initialCapital={initialCapital} />
        </div>
        
        {/* Subtle Footer info */}
        <div className="mt-4 sm:mt-6 flex items-center justify-between opacity-20 relative z-10">
          <div className="flex gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <div className="w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full bg-primary" />
              <span className={cn("text-[6px] sm:text-[8px] font-black uppercase tracking-widest", theme === 'light' ? "text-slate-900" : "text-white")}>Live Engine</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <div className={cn("w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full", theme === 'light' ? "bg-black/40" : "bg-white/40")} />
              <span className={cn("text-[6px] sm:text-[8px] font-black uppercase tracking-widest", theme === 'light' ? "text-slate-900" : "text-white")}>Quantum Sync</span>
            </div>
          </div>
          <span className={cn("text-[6px] sm:text-[8px] font-black uppercase tracking-widest", theme === 'light' ? "text-slate-900" : "text-white")}>V36.0 Protocol</span>
        </div>
      </div>

      {/* Performance Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weekly Performance */}
        <div className={cn(
          "ios-card border overflow-hidden sm:overflow-visible p-8 shadow-2xl relative group",
          theme === 'light' ? "bg-white/60 border-white/60" : "bg-white/[0.05] border-white/[0.05]"
        )}>
          {/* Background Decorative Glow */}
          <div className="absolute -top-12 -right-12 sm:-top-24 sm:-right-24 w-32 sm:w-64 h-32 sm:h-64 bg-primary/10 blur-[60px] sm:blur-[100px] rounded-full pointer-events-none group-hover:bg-primary/15 transition-all duration-700" />
          
          <div className="flex items-center justify-between relative z-10 mb-8">
            <p className={cn("text-[9px] font-black uppercase tracking-[0.3em]", theme === 'light' ? "text-slate-900/40" : "text-white/30")}>Weekly Performance</p>
            <div className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" />
          </div>
          <div className="h-[200px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodStats.weekly.slice(-6)} margin={{ top: 5, right: 0, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradientPositive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.2} />
                  </linearGradient>
                  <linearGradient id="barGradientNegative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.02)"} vertical={false} />
                <XAxis 
                  dataKey="label" 
                  fontSize={8} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: theme === 'light' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.2)', fontWeight: 900 }}
                />
                <Tooltip 
                  cursor={{ fill: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)' }}
                  contentStyle={{ 
                    backgroundColor: theme === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(10,10,12,0.8)', 
                    backdropFilter: 'blur(16px)',
                    border: theme === 'light' ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    fontSize: '10px',
                    fontWeight: '900',
                    color: theme === 'light' ? '#0f172a' : '#ffffff'
                  }}
                  itemStyle={{ color: theme === 'light' ? '#0f172a' : '#ffffff' }}
                />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]} barSize={24}>
                  {periodStats.weekly.slice(-6).map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.profit >= 0 ? 'url(#barGradientPositive)' : 'url(#barGradientNegative)'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Distribution */}
        <div className={cn(
          "ios-card border overflow-hidden sm:overflow-visible p-8 shadow-2xl relative group",
          theme === 'light' ? "bg-white/60 border-white/60" : "bg-white/[0.05] border-white/[0.05]"
        )}>
          {/* Background Decorative Glow */}
          <div className="absolute -top-12 -right-12 sm:-top-24 sm:-right-24 w-32 sm:w-64 h-32 sm:h-64 bg-primary/10 blur-[60px] sm:blur-[100px] rounded-full pointer-events-none group-hover:bg-primary/15 transition-all duration-700" />
          
          <div className="flex items-center justify-between relative z-10 mb-8">
            <p className={cn("text-[9px] font-black uppercase tracking-[0.3em]", theme === 'light' ? "text-slate-900/40" : "text-white/30")}>Daily Distribution (Last 15 Days)</p>
            <div className={cn("w-2 h-2 rounded-full", theme === 'light' ? "bg-black/10" : "bg-white/10")} />
          </div>
          <div className="h-[200px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodStats.daily.slice(-15)} margin={{ top: 5, right: 0, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradientPositiveDaily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.2} />
                  </linearGradient>
                  <linearGradient id="barGradientNegativeDaily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.02)"} vertical={false} />
                <XAxis 
                  dataKey="label" 
                  fontSize={8} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: theme === 'light' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.2)', fontWeight: 900 }}
                />
                <Tooltip 
                  cursor={{ fill: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)' }}
                  contentStyle={{ 
                    backgroundColor: theme === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(10,10,12,0.8)', 
                    backdropFilter: 'blur(16px)',
                    border: theme === 'light' ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    fontSize: '10px',
                    fontWeight: '900',
                    color: theme === 'light' ? '#0f172a' : '#ffffff'
                  }}
                  itemStyle={{ color: theme === 'light' ? '#0f172a' : '#ffffff' }}
                />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]} barSize={18}>
                  {periodStats.daily.slice(-15).map((entry, index) => (
                    <Cell 
                      key={`cell-daily-${index}`} 
                      fill={entry.profit >= 0 ? 'url(#barGradientPositiveDaily)' : 'url(#barGradientNegativeDaily)'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Session Profitability Analysis */}
      <div className={cn(
        "ios-card border overflow-hidden sm:overflow-visible p-8 shadow-2xl relative group",
        theme === 'light' ? "bg-white/60 border-white/60" : "bg-white/[0.05] border-white/[0.05]"
      )}>
        {/* Background Decorative Glow */}
        <div className="absolute -top-12 -right-12 sm:-top-24 sm:-right-24 w-32 sm:w-64 h-32 sm:h-64 bg-primary/10 blur-[60px] sm:blur-[100px] rounded-full pointer-events-none group-hover:bg-primary/15 transition-all duration-700" />
        
        <div className="flex items-center justify-between relative z-10 mb-8">
          <p className={cn("text-[9px] font-black uppercase tracking-[0.3em]", theme === 'light' ? "text-slate-900/40" : "text-white/30")}>Market Sessions Analysis</p>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
            <span className={cn("text-[8px] font-black uppercase tracking-widest", theme === 'light' ? "text-slate-900/20" : "text-white/20")}>Live Distribution</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          {sessionStats.map((session) => (
            <div 
              key={session.label}
              className={cn(
                "ios-card-mini overflow-visible p-6 border transition-all duration-500 hover:scale-[1.02] group/session",
                theme === 'light' ? "bg-white/40 border-black/[0.06] hover:bg-white/60" : "bg-white/[0.05] border-white/[0.05] hover:bg-white/[0.06]"
              )}
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "p-2.5 rounded-xl transition-colors",
                    theme === 'light' ? "bg-black/[0.06]" : "bg-white/[0.06] group-hover/session:bg-primary/10"
                  )}>
                    <p className={cn("text-[10px] font-black uppercase tracking-widest", theme === 'light' ? "text-slate-900/60" : "text-primary/80")}>{session.label}</p>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black tracking-tighter",
                    session.profit >= 0 
                      ? "bg-emerald-500/10 text-emerald-500" 
                      : "bg-rose-500/10 text-rose-500"
                  )}>
                    {session.profit >= 0 ? '+' : ''}{Math.round(session.profit)}
                  </div>
                </div>
                
                <div className="flex items-end justify-between">
                  <div className="space-y-1">
                    <p className={cn("text-[8px] sm:text-[10px] font-bold uppercase tracking-widest", theme === 'light' ? "text-slate-900/20" : "text-white/10")}>Efficiency</p>
                    <p className={cn("text-xl sm:text-2xl font-black tracking-tighter", theme === 'light' ? "text-slate-900" : "text-white")}>
                      {Math.round(session.winRate)}%
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className={cn("text-[8px] sm:text-[10px] font-bold uppercase tracking-widest", theme === 'light' ? "text-slate-900/20" : "text-white/10")}>Volume</p>
                    <p className={cn("text-base sm:text-lg font-black", theme === 'light' ? "text-slate-900/90" : "text-white/90")}>{session.count}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);  
}

function StatCard({ 
  label, 
  value, 
  trend,
  percentage = 0,
  theme
}: { 
  label: string; 
  value: string | number; 
  trend?: 'positive' | 'negative' | 'neutral';
  percentage?: number;
  theme: 'light' | 'dark';
}) {
  const color = trend === 'positive' ? '#22c55e' : trend === 'negative' ? '#ef4444' : '#3b82f6';

  return (
    <div 
      className={cn(
        "ios-card-mini relative group/stat border p-2 sm:p-4 transition-all duration-500 hover:scale-[1.02]",
        "overflow-hidden sm:overflow-visible",
        theme === 'light' ? "bg-white/60 border-white/60 hover:bg-white/80" : "bg-white/[0.05] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10"
      )}
      onMouseEnter={() => haptic('light')}
    >
      <div className="flex justify-between items-start relative z-10 mb-0.5 sm:mb-1">
        <p className={cn(
          "text-[6px] xs:text-[7px] sm:text-[9px] font-bold uppercase tracking-[0.05em] sm:tracking-[0.1em] truncate pr-1",
          theme === 'light' ? "text-slate-900/40" : "text-white/30"
        )}>
          {label}
        </p>
        <div className={cn(
          "w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full shrink-0",
          trend === 'positive' ? "bg-green-500" : 
          trend === 'negative' ? "bg-red-500" : 
          "bg-blue-500"
        )} />
      </div>

      <div className="flex items-end justify-between relative z-10">
        <div className={cn(
          "text-[11px] xs:text-xs sm:text-xl lg:text-2xl font-black tracking-tighter sm:tracking-tight truncate",
          theme === 'light' ? "text-slate-900" : "text-white"
        )}>
          {value}
        </div>
      </div>

      {/* Clean Progress Bar at the bottom */}
      <div className={cn("absolute bottom-0 left-0 right-0 h-1", theme === 'light' ? "bg-black/[0.05]" : "bg-white/[0.05]")}>
        <div 
          className="h-full transition-all duration-700 ease-out"
          style={{ 
            width: `${Math.min(Math.max(percentage, 0), 100)}%`,
            backgroundColor: color
          }}
        />
      </div>
    </div>
  );
}
