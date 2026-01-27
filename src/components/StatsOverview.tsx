import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, YAxis } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { type Statistics, type PeriodStats, type SessionStats } from '../lib/statistics';
import { cn } from '../lib/utils';
import { TradeChart } from './TradeChart';
import { type DailyRecord } from '../types';
import { haptic } from '../lib/utils';
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
  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10 px-4">
      
      {/* Modern Unified PnL Overview */}
      <div className="mb-4 sm:mb-6">
        <div className={cn(
          "group relative overflow-hidden backdrop-blur-2xl rounded-[2.5rem] transition-all duration-700 shadow-2xl",
          theme === 'light' ? "bg-white/60 border border-white/60 hover:border-white/80" : "bg-[#0A0A0B]/40 border border-white/[0.05] hover:border-white/10"
        )}>
          {/* Animated Background Gradient Glows */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-rose-500/10 rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
          
          <div className="relative z-10 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-10">
            {/* Main Net Profit Section */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border backdrop-blur-xl",
                  stats.totalProfit >= 0 
                    ? (theme === 'light' ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600" : "bg-emerald-500/5 border-emerald-500/20 text-emerald-500/70")
                    : (theme === 'light' ? "bg-rose-500/15 border-rose-500/30 text-rose-600" : "bg-rose-500/5 border-rose-500/20 text-rose-500/70")
                )}>
                  Net Performance
                </div>
                <div className={cn(
                  "h-px flex-1 bg-gradient-to-r to-transparent",
                  theme === 'light' ? "from-black/10" : "from-white/10"
                )} />
              </div>

              <div className="flex items-center gap-4">
                <div className={cn(
                  "text-5xl sm:text-7xl font-black tracking-tighter flex items-baseline gap-1",
                  theme === 'light' ? "text-slate-900" : "text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.05)]"
                )}>
                  <span className={cn(
                    "text-3xl sm:text-4xl opacity-20",
                    stats.totalProfit >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}>{stats.totalProfit >= 0 ? '+' : ''}</span>
                  {Math.round(stats.totalProfit).toLocaleString()}
                  <span className={cn("text-xl sm:text-2xl opacity-20 ml-1", theme === 'light' ? "text-slate-900" : "text-white")}>$</span>
                </div>
                
                {/* Visual indicator icon */}
                <div className={cn(
                  "hidden sm:flex w-14 h-14 rounded-2xl items-center justify-center border transition-transform duration-500 group-hover:scale-110 backdrop-blur-xl",
                  stats.totalProfit >= 0 
                    ? (theme === 'light' ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 shadow-sm" : "bg-emerald-500/5 border-emerald-500/10 text-emerald-500")
                    : (theme === 'light' ? "bg-rose-500/15 border-rose-500/30 text-rose-600 shadow-sm" : "bg-rose-500/5 border-rose-500/10 text-rose-500")
                )}>
                  {stats.totalProfit >= 0 ? <TrendingUp className="w-7 h-7" /> : <TrendingDown className="w-7 h-7" />}
                </div>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:w-1/3">
              {/* Gross Profit Box */}
              <div className={cn(
                "relative p-4 rounded-3xl border overflow-hidden group/box transition-all duration-300 backdrop-blur-xl",
                theme === 'light' ? "bg-white/40 border-white/60 shadow-sm hover:bg-white/60" : "bg-white/[0.02] border-white/[0.03] hover:bg-white/[0.04]"
              )}>
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/40" />
                <p className={cn("text-[9px] font-black uppercase tracking-widest mb-2", theme === 'light' ? "text-slate-900/40" : "text-white/30")}>Revenue</p>
                <div className="flex items-baseline gap-1">
                  <span className={cn("text-2xl font-black tracking-tighter", theme === 'light' ? "text-slate-900" : "text-white")}>
                    {Math.round(stats.grossProfit).toLocaleString()}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-500/50">$</span>
                </div>
              </div>

              {/* Gross Loss Box */}
              <div className={cn(
                "relative p-4 rounded-3xl border overflow-hidden group/box transition-all duration-300 backdrop-blur-xl",
                theme === 'light' ? "bg-white/40 border-white/60 shadow-sm hover:bg-white/60" : "bg-white/[0.02] border-white/[0.03] hover:bg-white/[0.04]"
              )}>
                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500/40" />
                <p className={cn("text-[9px] font-black uppercase tracking-widest mb-2", theme === 'light' ? "text-slate-900/40" : "text-white/30")}>Drawdown</p>
                <div className="flex items-baseline gap-1">
                  <span className={cn("text-2xl font-black tracking-tighter", theme === 'light' ? "text-slate-900" : "text-white")}>
                    {Math.round(stats.grossLoss).toLocaleString()}
                  </span>
                  <span className="text-[10px] font-bold text-rose-500/50">$</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal Thin Stats Layout */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
        <StatCard 
          label="NET PROFIT" 
          value={`$${Math.round(stats.totalProfit).toLocaleString()}`} 
          trend={stats.totalProfit >= 0 ? 'positive' : 'negative'}
          percentage={Math.min(Math.max((stats.totalProfit / initialCapital) * 100, 0), 100)}
          theme={theme}
        />
        <StatCard 
          label="WIN RATE" 
          value={`${stats.winRate.toFixed(1)}%`} 
          trend={stats.winRate >= 50 ? 'positive' : 'negative'}
          percentage={stats.winRate}
          theme={theme}
        />
        <StatCard 
          label="PROFIT FACTOR" 
          value={stats.profitFactor.toFixed(2)} 
          trend={stats.profitFactor >= 1.5 ? 'positive' : stats.profitFactor >= 1 ? 'neutral' : 'negative'}
          percentage={(stats.profitFactor / 3) * 100}
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
          label="DRAWDOWN" 
          value={`${stats.maxDrawdown.toFixed(1)}%`} 
          trend="negative"
          percentage={100 - stats.maxDrawdown}
          theme={theme}
        />
      </div>

      {/* Embedded Portfolio Growth Chart */}
      <div className={cn(
        "w-full backdrop-blur-[40px] border rounded-[1.8rem] sm:rounded-[2.5rem] overflow-hidden p-4 sm:p-10 shadow-2xl relative group",
        theme === 'light' ? "bg-white/60 border-white/60" : "bg-white/[0.01] border-white/[0.05]"
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
          "backdrop-blur-xl border rounded-[2rem] p-8 space-y-8",
          theme === 'light' ? "bg-white/60 border-white/60" : "bg-white/[0.02] border-white/[0.05]"
        )}>
          <div className="flex items-center justify-between">
            <p className={cn("text-[9px] font-black uppercase tracking-[0.3em]", theme === 'light' ? "text-slate-900/40" : "text-white/30")}>Weekly Performance</p>
            <div className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" />
          </div>
          <div className="h-[200px] w-full">
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
          "backdrop-blur-xl border rounded-[2rem] p-8 space-y-8",
          theme === 'light' ? "bg-white/60 border-white/60" : "bg-white/[0.02] border-white/[0.05]"
        )}>
          <div className="flex items-center justify-between">
            <p className={cn("text-[9px] font-black uppercase tracking-[0.3em]", theme === 'light' ? "text-slate-900/40" : "text-white/30")}>Daily Distribution (Last 15 Days)</p>
            <div className={cn("w-2 h-2 rounded-full", theme === 'light' ? "bg-black/10" : "bg-white/10")} />
          </div>
          <div className="h-[200px] w-full">
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
        "backdrop-blur-[40px] border rounded-[1.8rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl relative group",
        theme === 'light' ? "bg-white/60 border-white/60" : "bg-white/[0.01] border-white/[0.05]"
      )}>
        {/* Background Decorative Glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary/5 blur-[60px] rounded-full pointer-events-none group-hover:bg-primary/10 transition-all duration-700" />
        
        <div className="mb-8 flex flex-row items-center justify-between gap-2 relative z-10">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5">
              <div className="w-1 h-1 rounded-full bg-primary/60 shadow-[0_0_8px_rgba(212,175,55,0.4)]" />
              <p className={cn("text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em]", theme === 'light' ? "text-slate-900/20" : "text-white/10")}>Time Distribution</p>
            </div>
            <h3 className={cn("text-base sm:text-2xl font-black tracking-tighter leading-tight", theme === 'light' ? "text-slate-900" : "text-white")}>
              Session <span className="text-primary/70">Profitability</span>
            </h3>
          </div>
          <div className="flex gap-4 sm:gap-6">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-green-500/50" />
              <span className={cn("text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em]", theme === 'light' ? "text-slate-900/30" : "text-white/30")}>Profitable</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-red-500/50" />
              <span className={cn("text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em]", theme === 'light' ? "text-slate-900/30" : "text-white/30")}>Loss Making</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 relative z-10">
          {sessionStats.map((session) => (
            <div 
              key={session.label}
              className={cn(
                "p-6 sm:p-8 rounded-[2rem] border transition-all group relative overflow-hidden flex flex-col justify-between min-h-[180px]",
                theme === 'light' ? "bg-black/[0.02] border-black/[0.05] hover:bg-black/[0.04]" : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
              )}
            >
              <div className="flex justify-between items-center mb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    session.profit >= 0 ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                  )} />
                  <span className={cn(
                    "text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] transition-colors",
                    theme === 'light' ? "text-slate-900/40 group-hover:text-primary/60" : "text-white/40 group-hover:text-primary/60"
                  )}>
                    {session.label} Session
                  </span>
                </div>
              </div>
              
              <div className="space-y-4 relative z-10">
                <span className={cn(
                  "text-2xl sm:text-4xl font-black tracking-tighter block",
                  session.profit >= 0 ? "text-green-500/80" : "text-red-500/80"
                )}>
                  {session.profit >= 0 ? '+' : ''}{session.profit.toLocaleString()}$
                </span>
                
                <div className={cn("grid grid-cols-2 gap-4 border-t pt-4", theme === 'light' ? "border-black/5" : "border-white/5")}>
                  <div className="space-y-1">
                    <p className={cn("text-[8px] sm:text-[10px] font-bold uppercase tracking-widest", theme === 'light' ? "text-slate-900/20" : "text-white/10")}>Efficiency</p>
                    <p className={cn("text-base sm:text-lg font-black", theme === 'light' ? "text-slate-900/90" : "text-white/90")}>{Math.round(session.winRate)}%</p>
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
        "relative overflow-hidden group/stat backdrop-blur-md border p-2 sm:p-4 rounded-xl sm:rounded-[1.8rem] transition-all duration-500 hover:scale-[1.02]",
        theme === 'light' ? "bg-white/60 border-white/60 hover:bg-white/80" : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10"
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
      <div className={cn("absolute bottom-0 left-0 right-0 h-1", theme === 'light' ? "bg-black/[0.05]" : "bg-white/[0.02]")}>
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
