import { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { type DailyRecord } from '../types';
import { Activity } from 'lucide-react';

interface TradeChartProps {
  data: DailyRecord[];
  initialCapital: number;
}

export function TradeChart({ data, initialCapital }: TradeChartProps) {
  const chartData = useMemo(() => {
    if (data.length === 0) return [];

    const sortedRecords = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const groupedByDate = sortedRecords.reduce((acc: Record<string, { date: string, profit: number }>, curr) => {
      const dateKey = new Date(curr.date).toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          profit: 0
        };
      }
      acc[dateKey].profit += curr.profitLoss;
      return acc;
    }, {});

    let runningCapital = initialCapital;
    
    const result = [{
      displayDate: 'Start',
      fullDate: 'initial',
      profit: 0,
      capital: initialCapital,
      isStart: true
    }];

    const chartPoints = Object.values(groupedByDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(group => {
        runningCapital += group.profit;
        return {
          displayDate: new Date(group.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
          fullDate: group.date,
          profit: group.profit,
          capital: parseFloat(runningCapital.toFixed(2)),
          isStart: false
        };
      });

    return [...result, ...chartPoints];
  }, [data, initialCapital]);

  if (chartData.length <= 1) {
    return (
      <div className="h-[300px] w-full ios-card flex flex-col items-center justify-center text-muted-foreground opacity-50">
        <Activity className="w-10 h-10 mb-4 opacity-20" />
        <p className="font-black uppercase tracking-[0.2em] text-[10px]">Waiting for more data...</p>
      </div>
    );
  }

  const capitals = chartData.map(d => d.capital);
  const minCap = Math.min(...capitals);
  const maxCap = Math.max(...capitals);
  const padding = (maxCap - minCap) * 0.1 || initialCapital * 0.05;

  return (
    <div className="h-[280px] w-full ios-card flex flex-col !p-4 !rounded-[2rem]">
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-xl backdrop-blur-md border border-primary/10">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 mb-0.5">Portfolio Growth</h3>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tighter text-white drop-shadow-sm">${capitals[capitals.length - 1].toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis 
              dataKey="displayDate" 
              fontSize={8} 
              tickLine={false} 
              axisLine={false}
              tick={{ fill: 'rgba(255,255,255,0.2)', fontWeight: 'bold' }}
              minTickGap={20}
            />
            <YAxis 
              orientation="right"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'rgba(255,255,255,0.6)', fontWeight: '900' }}
              domain={[minCap - padding, maxCap + padding]}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
              width={60}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(28, 28, 30, 0.9)', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '16px',
                fontSize: '10px',
                fontWeight: '900',
                backdropFilter: 'blur(10px)'
              }}
              itemStyle={{ color: '#fff', padding: '0' }}
              labelStyle={{ color: 'rgba(255,255,255,0.4)', marginBottom: '4px', fontSize: '8px' }}
              cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area 
              type="monotone" 
              dataKey="capital" 
              stroke="hsl(var(--primary))" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorCapital)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
