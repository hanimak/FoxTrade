import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { type Statistics, type PeriodStats } from '../lib/statistics';
import { cn } from '../lib/utils';
import { TradeChart } from './TradeChart';
import { type DailyRecord } from '../types';
import { haptic } from '../lib/utils';

interface StatsOverviewProps {
  stats: Statistics;
  records: DailyRecord[];
  periodStats: {
    weekly: PeriodStats[];
    monthly: PeriodStats[];
    daily: PeriodStats[];
  };
  initialCapital: number;
}

export function StatsOverview({ stats, periodStats, records, initialCapital }: StatsOverviewProps) {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10 px-4">
      
      {/* Horizontal Thin Stats Layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
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
      </div>

      {/* Embedded Portfolio Growth Chart */}
      <div className="w-full bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-[2rem] overflow-hidden p-6 shadow-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Portfolio Trajectory</p>
            <h3 className="text-xl font-black text-white tracking-tighter">Growth Analysis</h3>
          </div>
          <div className="px-4 py-1 bg-white/[0.03] border border-white/[0.05] rounded-full">
            <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest">Real-time Data</span>
          </div>
        </div>
        <div className="w-full min-h-[500px]">
          <TradeChart data={records} initialCapital={initialCapital} />
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
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">Daily Distribution</p>
            <div className="w-2 h-2 rounded-full bg-white/10" />
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodStats.daily} margin={{ top: 5, right: 0, left: -30, bottom: 0 }}>
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
                  {periodStats.daily.map((entry, index) => (
                    <Cell 
                      key={`cell-daily-${index}`} 
                      fill={entry.profit >= 0 ? 'url(#barGradientPositive)' : 'url(#barGradientNegative)'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
      className="relative overflow-hidden group/stat bg-white/[0.02] backdrop-blur-md border border-white/[0.05] p-3 sm:p-4 rounded-2xl sm:rounded-[1.8rem] transition-all duration-500 hover:scale-[1.02] hover:bg-white/[0.04] hover:border-white/10"
      onMouseEnter={() => haptic('light')}
    >
      <div className="flex justify-between items-start relative z-10">
        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/30">
          {label}
        </p>
        <div className={cn(
          "w-1 h-1 rounded-full",
          trend === 'positive' ? "bg-green-500" : 
          trend === 'negative' ? "bg-red-500" : 
          "bg-blue-500"
        )} />
      </div>

      <div className="flex items-end justify-between relative z-10">
        <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
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
