import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, YAxis } from 'recharts';
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
}

export function StatsOverview({ stats, periodStats, records, initialCapital, sessionStats }: StatsOverviewProps) {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10 px-4">
      
      {/* Horizontal Thin Stats Layout */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
        <StatCard 
          label="WIN RATE" 
          value={`${stats.winRate.toFixed(1)}%`} 
          trend={stats.winRate >= 50 ? 'positive' : 'negative'}
          percentage={stats.winRate}
        />
        <StatCard 
          label="PROFIT FACTOR" 
          value={stats.profitFactor.toFixed(2)} 
          trend={stats.profitFactor >= 1.5 ? 'positive' : stats.profitFactor >= 1 ? 'neutral' : 'negative'}
          percentage={(stats.profitFactor / 3) * 100}
        />
        <StatCard 
          label="EXPECTANCY" 
          value={`$${Math.round(stats.expectedValue)}`} 
          trend={stats.expectedValue > 0 ? 'positive' : 'negative'}
          percentage={50 + (stats.expectedValue / 1000) * 50}
        />
        <StatCard 
          label="TRADES" 
          value={stats.totalTrades} 
          trend="neutral"
          percentage={Math.min(stats.totalTrades, 100)}
        />
        <StatCard 
          label="AVG WIN" 
          value={`+$${Math.round(stats.averageWin)}`} 
          trend="positive"
          percentage={75}
        />
        <StatCard 
          label="AVG LOSS" 
          value={`-$${Math.round(stats.averageLoss)}`} 
          trend="negative"
          percentage={40}
        />
        <StatCard 
          label="DRAWDOWN" 
          value={`${stats.maxDrawdown.toFixed(1)}%`} 
          trend="negative"
          percentage={100 - stats.maxDrawdown}
        />
        {/* Placeholder to fill gap on mobile if odd number, but here we have 7. 
            On mobile 7 cards in 2 columns = 3 rows + 1 card. 
            Let's add a special "Growth" or "Health" small card for mobile to fill the 8th slot. */}
        <div className="sm:hidden">
          <StatCard 
            label="STATUS" 
            value={stats.winRate >= 50 ? 'BULLISH' : 'BEARISH'} 
            trend={stats.winRate >= 50 ? 'positive' : 'negative'}
            percentage={stats.winRate}
          />
        </div>
      </div>

      {/* Embedded Portfolio Growth Chart */}
      <div className="w-full bg-white/[0.01] backdrop-blur-[40px] border border-white/[0.05] rounded-[1.8rem] sm:rounded-[2.5rem] overflow-hidden p-4 sm:p-10 shadow-2xl relative group">
        {/* Background Decorative Glow */}
        <div className="absolute -top-12 -right-12 sm:-top-24 sm:-right-24 w-32 sm:w-64 h-32 sm:h-64 bg-primary/10 blur-[60px] sm:blur-[100px] rounded-full pointer-events-none group-hover:bg-primary/15 transition-all duration-700" />
        <div className="absolute -bottom-12 -left-12 sm:-bottom-24 sm:-left-24 w-32 sm:w-64 h-32 sm:h-64 bg-primary/5 blur-[60px] sm:blur-[100px] rounded-full pointer-events-none group-hover:bg-primary/10 transition-all duration-700" />

        <div className="mb-4 sm:mb-8 flex flex-row items-center justify-between gap-2 relative z-10">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5">
              <div className="w-1 h-1 rounded-full bg-primary/60 shadow-[0_0_8px_rgba(212,175,55,0.4)]" />
              <p className="text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-white/10">Trajectory</p>
            </div>
            <h3 className="text-base sm:text-2xl font-black text-white tracking-tighter leading-tight">
              Growth <span className="text-primary/70">Analysis</span>
            </h3>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-8">
            <div className="flex flex-col items-end">
              <p className="text-[6px] sm:text-[7px] font-black text-white/10 uppercase tracking-widest mb-0.5">Balance</p>
              <p className="text-sm sm:text-xl font-black text-white/90 tracking-tighter">
                <span className="text-primary/40 text-[10px] sm:text-sm mr-0.5">$</span>
                {(initialCapital + stats.totalProfit).toLocaleString()}
              </p>
            </div>
            <div className="w-px h-5 sm:h-6 bg-white/5" />
            <div className="flex flex-col items-end">
              <p className="text-[6px] sm:text-[7px] font-black text-white/10 uppercase tracking-widest mb-0.5">P/L</p>
              <p className={cn(
                "text-sm sm:text-xl font-black tracking-tighter",
                stats.totalProfit >= 0 ? "text-green-500/60" : "text-red-500/60"
              )}>
                {stats.totalProfit >= 0 ? '+' : '-'}${Math.abs(stats.totalProfit).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="w-full h-[280px] sm:h-[550px] relative z-10">
          <TradeChart data={records} initialCapital={initialCapital} />
        </div>
        
        {/* Subtle Footer info */}
        <div className="mt-4 sm:mt-6 flex items-center justify-between opacity-20 relative z-10">
          <div className="flex gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <div className="w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full bg-primary" />
              <span className="text-[6px] sm:text-[8px] font-black uppercase tracking-widest text-white">Live Engine</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <div className="w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full bg-white/40" />
              <span className="text-[6px] sm:text-[8px] font-black uppercase tracking-widest text-white">Quantum Sync</span>
            </div>
          </div>
          <span className="text-[6px] sm:text-[8px] font-black uppercase tracking-widest text-white">V36.0 Protocol</span>
        </div>
      </div>

      {/* Performance Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weekly Performance */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-[2rem] p-8 space-y-8">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">Weekly Performance</p>
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  fontSize={8} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.2)', fontWeight: 900 }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  contentStyle={{ 
                    backgroundColor: 'rgba(10,10,12,0.8)', 
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    fontSize: '10px',
                    fontWeight: '900',
                    color: '#ffffff'
                  }}
                  itemStyle={{ color: '#ffffff' }}
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
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-[2rem] p-8 space-y-8">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">Daily Distribution (Last 15 Days)</p>
            <div className="w-2 h-2 rounded-full bg-white/10" />
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  fontSize={8} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.2)', fontWeight: 900 }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  contentStyle={{ 
                    backgroundColor: 'rgba(10,10,12,0.8)', 
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    fontSize: '10px',
                    fontWeight: '900',
                    color: '#ffffff'
                  }}
                  itemStyle={{ color: '#ffffff' }}
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
      <div className="bg-white/[0.01] backdrop-blur-[40px] border border-white/[0.05] rounded-[1.8rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl relative group">
        {/* Background Decorative Glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary/5 blur-[60px] rounded-full pointer-events-none group-hover:bg-primary/10 transition-all duration-700" />
        
        <div className="mb-8 flex flex-row items-center justify-between gap-2 relative z-10">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5">
              <div className="w-1 h-1 rounded-full bg-primary/60 shadow-[0_0_8px_rgba(212,175,55,0.4)]" />
              <p className="text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-white/10">Time Distribution</p>
            </div>
            <h3 className="text-base sm:text-2xl font-black text-white tracking-tighter leading-tight">
              Session <span className="text-primary/70">Profitability</span>
            </h3>
          </div>
          <div className="flex gap-4 sm:gap-6">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-green-500/50" />
              <span className="text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Profitable</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-red-500/50" />
              <span className="text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Loss Making</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 relative z-10">
          {sessionStats.map((session) => (
            <div 
              key={session.label}
              className="p-6 sm:p-8 rounded-[2rem] bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all group relative overflow-hidden flex flex-col justify-between min-h-[180px]"
            >
              <div className="flex justify-between items-center mb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    session.profit >= 0 ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                  )} />
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-white/40 group-hover:text-primary/60 transition-colors">
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
                
                <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                  <div className="space-y-1">
                    <p className="text-[8px] sm:text-[10px] font-bold text-white/10 uppercase tracking-widest">Efficiency</p>
                    <p className="text-base sm:text-lg font-black text-white/90">{Math.round(session.winRate)}%</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[8px] sm:text-[10px] font-bold text-white/10 uppercase tracking-widest">Volume</p>
                    <p className="text-base sm:text-lg font-black text-white/90">{session.count}</p>
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
  percentage = 0
}: { 
  label: string; 
  value: string | number; 
  trend?: 'positive' | 'negative' | 'neutral';
  percentage?: number;
}) {
  const color = trend === 'positive' ? '#22c55e' : trend === 'negative' ? '#ef4444' : '#3b82f6';

  return (
    <div 
      className="relative overflow-hidden group/stat bg-white/[0.02] backdrop-blur-md border border-white/[0.05] p-2 sm:p-4 rounded-xl sm:rounded-[1.8rem] transition-all duration-500 hover:scale-[1.02] hover:bg-white/[0.04] hover:border-white/10"
      onMouseEnter={() => haptic('light')}
    >
      <div className="flex justify-between items-start relative z-10 mb-0.5 sm:mb-1">
        <p className="text-[6px] xs:text-[7px] sm:text-[9px] font-bold uppercase tracking-[0.05em] sm:tracking-[0.1em] text-white/30 truncate pr-1">
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
        <div className="text-[11px] xs:text-xs sm:text-xl lg:text-2xl font-black text-white tracking-tighter sm:tracking-tight truncate">
          {value}
        </div>
      </div>

      {/* Clean Progress Bar at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/[0.02]">
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
