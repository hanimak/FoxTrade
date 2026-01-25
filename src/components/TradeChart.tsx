import { useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Bar } from 'recharts';
import { type DailyRecord } from '../types';
import { Activity, CandlestickChart, LineChart } from 'lucide-react';
import { cn } from '../lib/utils';

interface TradeChartProps {
  data: DailyRecord[];
  initialCapital: number;
  className?: string;
}

export function TradeChart({ data, initialCapital, className }: TradeChartProps) {
  const [viewMode, setViewMode] = useState<'line' | 'candle'>('line');

  const chartData = useMemo(() => {
    if (data.length === 0) return { realData: [], futureData: [] };

    const sortedRecords = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const groupedByDate = sortedRecords.reduce((acc: Record<string, { date: string, profit: number, records: DailyRecord[] }>, curr) => {
      const dateKey = new Date(curr.date).toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          profit: 0,
          records: []
        };
      }
      acc[dateKey].profit += curr.profitLoss;
      acc[dateKey].records.push(curr);
      return acc;
    }, {});

    let runningCapital = initialCapital;
    
    const initialPoint = {
      displayDate: 'Start',
      fullDate: 'initial',
      profit: 0,
      capital: initialCapital,
      open: initialCapital,
      close: initialCapital,
      high: initialCapital,
      low: initialCapital,
      isStart: true,
      isFuture: false
    };

    const sortedGroups = Object.values(groupedByDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const allPoints = sortedGroups.map(group => {
      const open = runningCapital;
      let dayHigh = open;
      let dayLow = open;
      let tempCap = open;
      
      group.records.forEach(r => {
        const profit = r.profitLoss || 0;
        tempCap += profit;
        dayHigh = Math.max(dayHigh, tempCap);
        dayLow = Math.min(dayLow, tempCap);
      });

      runningCapital += (group.profit || 0);
      const close = runningCapital;

      return {
        displayDate: new Date(group.date).toLocaleDateString('en-US', { day: 'numeric', month: 'numeric' }),
        fullDate: group.date,
        profit: group.profit || 0,
        capital: Number(runningCapital.toFixed(2)) || 0,
        open: Number(open.toFixed(2)) || 0,
        close: Number(close.toFixed(2)) || 0,
        high: Number(dayHigh.toFixed(2)) || 0,
        low: Number(dayLow.toFixed(2)) || 0,
        isStart: false,
        isFuture: false
      };
    });

    const combined = [initialPoint, ...allPoints];
    
    // Create a copy for future data (used for candle view)
    const futureData = [...combined];
    if (futureData.length > 0) {
      const lastPoint = futureData[futureData.length - 1];
      const lastDate = new Date(lastPoint.fullDate === 'initial' ? new Date() : lastPoint.fullDate);
      
      for (let i = 1; i <= 30; i++) {
        const futureDate = new Date(lastDate);
        futureDate.setDate(lastDate.getDate() + i);
        
        futureData.push({
          displayDate: futureDate.toLocaleDateString('en-US', { day: 'numeric', month: 'numeric' }),
          fullDate: futureDate.toISOString().split('T')[0],
          profit: null,
          capital: null,
          open: null,
          close: null,
          high: null,
          low: null,
          isStart: false,
          isFuture: true
        } as any);
      }
    }

    return { realData: combined, futureData };
  }, [data, initialCapital]);

  const activeData = useMemo(() => {
    return viewMode === 'line' ? chartData.realData : chartData.futureData;
  }, [chartData, viewMode]);

  // Always use real data for stats and header
  const realData = chartData.realData;
  const capitals = useMemo(() => realData.map(d => d.capital).filter(v => v !== null) as number[], [realData]);
  const lows = useMemo(() => realData.map(d => d.low).filter(v => v !== null) as number[], [realData]);
  const highs = useMemo(() => realData.map(d => d.high).filter(v => v !== null) as number[], [realData]);
  
  const stats = useMemo(() => {
    if (activeData.length <= 1) return { 
      minCap: 0, 
      maxCap: 0, 
      ath: 0, 
      padding: 0, 
      candleGap: "15%",
      yDomain: [0, 100]
    };
    
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    
    // Dynamic domain: always start from 0 to show the full context from bottom
    // The top is determined by the maximum high reached, plus more padding for "higher" feel
    const yMin = 0;
    const yMax = Math.max(max * 1.3, initialCapital * 1.5);
    
    const range = max - min || initialCapital * 0.1;
    
    // Fixed values for tight packing and consistent view
    const zoomLevel = 1;
    const dateSpacing = 0;
    
    // We adjust the gap based on both zoom and dateSpacing for a fluid feel
    const gapPercentage = Math.min(85, Math.max(0, (5 / zoomLevel) + (dateSpacing * 5)));
    
    return {
      minCap: min,
      maxCap: max,
      ath: max,
      padding: range * 0.1,
      candleGap: `${gapPercentage}%`,
      yDomain: [yMin, yMax]
    };
  }, [activeData, lows, highs, initialCapital, capitals]);

  // Calculate gradient stops for the line color (green for up, red for down)
  const lineStops = useMemo(() => {
    if (activeData.length <= 1) return null;
    return activeData.map((point, i) => {
      const percentage = (i / (activeData.length - 1)) * 100;
      let color = '#22c55e'; // Green (Positive)
      
      if (i > 0) {
        // If current capital is less than previous, it's a "retreat" (red)
        if (point.capital !== null && activeData[i-1].capital !== null && point.capital < activeData[i-1].capital) {
          color = '#ff3b30'; // Red (Negative)
        }
      } else if (activeData.length > 1 && activeData[1].capital !== null && activeData[0].capital !== null && activeData[1].capital < activeData[0].capital) {
        // Special case for first point if the second point is a drop
        color = '#ff3b30';
      }
      
      return (
        <stop key={i} offset={`${percentage}%`} stopColor={color} />
      );
    });
  }, [activeData]);

  if (activeData.length <= 1) {
    return (
      <div className={cn(
        "h-full w-full flex flex-col items-center justify-center text-muted-foreground bg-transparent backdrop-blur-xl border border-white/[0.05] rounded-[2.5rem]",
        className
      )}>
        <Activity className="w-10 h-10 mb-4 opacity-10" />
        <p className="font-black uppercase tracking-[0.2em] text-[10px] opacity-20">Waiting for more data...</p>
      </div>
    );
  }

  const { candleGap, yDomain } = stats;

  return (
    <div className={cn(
      "w-full h-full flex flex-col p-2 sm:p-6 pb-4 sm:pb-12 bg-transparent",
      className
    )}>
      <div className="flex items-center justify-between mb-2 sm:mb-4 relative z-10 px-2">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/[0.03] rounded-lg flex items-center justify-center border border-white/[0.05]">
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary/60" />
          </div>
          <div className="text-left">
            <h3 className="text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-white/20 mb-0.5">Portfolio Growth</h3>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-sm sm:text-xl font-black tracking-tighter text-white">${capitals[capitals.length - 1]?.toLocaleString() || '0'}</span>
              {realData.length > 1 && realData[realData.length - 1].close !== null && realData[realData.length - 2]?.close !== null && (
                <span className={cn(
                  "text-[8px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-lg",
                  realData[realData.length - 1].close >= realData[realData.length - 2].close 
                    ? "text-green-500/80 bg-green-500/5" 
                    : "text-red-500/80 bg-red-500/5"
                )}>
                  {realData[realData.length - 1].close >= realData[realData.length - 2].close ? '+' : ''}
                  {((realData[realData.length - 1].close - realData[realData.length - 2].close) / realData[realData.length - 2].close * 100).toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-black/40 p-0.5 sm:p-1 rounded-xl sm:rounded-2xl border border-white/5 shadow-inner">
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setViewMode('line');
            }}
            className={cn(
              "px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl transition-all duration-300 flex items-center gap-1 sm:gap-2",
              viewMode === 'line' 
                ? "bg-white/[0.05] text-white border border-white/10 shadow-lg" 
                : "text-white/20 hover:text-white/40"
            )}
          >
            <LineChart className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="text-[7px] sm:text-[9px] font-black uppercase tracking-wider hidden xs:inline">Line</span>
          </button>
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setViewMode('candle');
            }}
            className={cn(
              "px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl transition-all duration-300 flex items-center gap-1 sm:gap-2",
              viewMode === 'candle' 
                ? "bg-white/[0.05] text-white border border-white/10 shadow-lg" 
                : "text-white/20 hover:text-white/40"
            )}
          >
            <CandlestickChart className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="text-[7px] sm:text-[9px] font-black uppercase tracking-wider hidden xs:inline">Candle</span>
          </button>
        </div>
      </div>

      <div className="w-full relative z-10 flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'line' ? (
            <AreaChart 
              key="line-view"
              data={activeData} 
              margin={{ top: 5, right: 5, left: -25, bottom: 20 }}
            >
              <defs>
                <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  {lineStops}
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="1 1" stroke="rgba(255,255,255,0.05)" vertical={true} />
              <XAxis 
                dataKey="displayDate" 
                fontSize={8} 
                tickLine={false} 
                axisLine={false}
                tick={{ fill: 'rgba(255,255,255,0.4)', fontWeight: 700 }}
                dy={15}
                height={30}
                type="category"
                interval="preserveStartEnd"
                minTickGap={25}
              />
              <YAxis 
                orientation="right"
                fontSize={8}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontWeight: 800 }}
                domain={yDomain}
                tickFormatter={(value) => `$${Math.round(value).toLocaleString()}`}
                width={45}
              />

              <Tooltip 
                cursor={{ stroke: '#22c55e', strokeWidth: 1, strokeDasharray: '4 4' }}
                contentStyle={{ 
                  backgroundColor: 'rgba(10,10,12,0.8)', 
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '1.2rem',
                  fontSize: '10px',
                  fontWeight: '900',
                  color: '#ffffff',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                }}
                itemStyle={{ color: '#ffffff', padding: '0' }}
                labelStyle={{ color: 'rgba(255,255,255,0.4)', marginBottom: '4px', fontSize: '8px', fontWeight: 'bold' }}
                formatter={(value: any) => [`$${Math.round(value || 0)}`, 'Balance']}
              />
              <Area 
                type="monotone" 
                dataKey="capital" 
                stroke="url(#lineGradient)" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorCapital)" 
                animationDuration={1500}
              />
            </AreaChart>
          ) : (
            <ComposedChart 
              key="candle-view"
              data={activeData} 
              margin={{ top: 5, right: 10, left: -20, bottom: 40 }}
              barGap={0}
              barCategoryGap={candleGap}
            >
              <CartesianGrid strokeDasharray="1 1" stroke="rgba(255,255,255,0.05)" vertical={true} />
              <XAxis 
                dataKey="displayDate" 
                fontSize={8} 
                tickLine={false} 
                axisLine={false}
                tick={{ fill: 'rgba(255,255,255,0.4)', fontWeight: 700 }}
                dy={15}
                height={30}
                type="category"
                interval="preserveStartEnd"
                minTickGap={25}
              />
              <YAxis 
                orientation="right"
                fontSize={8}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontWeight: 800 }}
                domain={yDomain}
                tickFormatter={(value) => `$${Math.round(value).toLocaleString()}`}
                width={45}
              />

              <Tooltip 
                cursor={{ stroke: '#22c55e', strokeWidth: 1, strokeDasharray: '4 4' }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    if (data.isStart) return null;
                    if (data.isFuture) {
                      return (
                        <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-2 rounded-xl shadow-2xl">
                          <span className="text-[10px] font-black text-white/40">{label}</span>
                          <div className="text-[9px] text-white/20 font-black uppercase tracking-widest mt-1">Empty Space</div>
                        </div>
                      );
                    }
                    const isBullish = data.close >= data.open;

                    return (
                      <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl min-w-[140px]">
                        <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-1">
                          <span className="text-[10px] font-black text-white/40">{label}</span>
                          <span className={cn(
                            "text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest",
                            isBullish ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#ff3b30]/10 text-[#ff3b30]"
                          )}>
                            {isBullish ? 'Bullish' : 'Bearish'}
                          </span>
                        </div>
                        <div className="space-y-1.5 font-sans">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-white/40">O:</span>
                            <span className="text-white font-bold">${data.open.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-white/40">H:</span>
                            <span className="text-[#22c55e] font-bold">${data.high.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-white/40">L:</span>
                            <span className="text-[#ff3b30] font-bold">${data.low.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[10px] border-t border-white/5 pt-1 mt-1">
                            <span className="text-white/40">C:</span>
                            <span className={cn("font-black", isBullish ? "text-[#22c55e]" : "text-[#ff3b30]")}>
                              ${data.close.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey={(d: any) => [d.low ?? 0, d.high ?? 0]}
                isAnimationActive={false}
                shape={(props: any) => {
                  const { x, y, width, height, payload } = props;
                  if (!payload || payload.isStart || payload.isFuture || isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) return null;
                  
                  const open = payload.open ?? 0;
                  const close = payload.close ?? 0;
                  const high = payload.high ?? 0;
                  const low = payload.low ?? 0;

                  const isBullish = close >= open;
                  const color = isBullish ? '#22c55e' : '#ff3b30';
                  
                  const diff = high - low || 1;
                  const ratio = height / diff;
                  
                  const bodyTopY = y + (high - Math.max(open, close)) * ratio;
                  const bodyBottomY = y + (high - Math.min(open, close)) * ratio;
                  const bodyHeight = Math.max(Math.abs(bodyBottomY - bodyTopY), 2);
                  
                  const centerX = x + width / 2;

                  return (
                    <g>
                      {/* Top Wick */}
                      <line 
                        x1={centerX} 
                        y1={y} 
                        x2={centerX} 
                        y2={bodyTopY} 
                        stroke={color} 
                        strokeWidth={1} 
                      />
                      {/* Bottom Wick */}
                      <line 
                        x1={centerX} 
                        y1={bodyBottomY} 
                        x2={centerX} 
                        y2={y + height} 
                        stroke={color} 
                        strokeWidth={1} 
                      />
                      {/* Candle Body */}
                      <rect
                        x={x}
                        y={bodyTopY}
                        width={width}
                        height={bodyHeight}
                        fill={isBullish ? 'rgba(34, 197, 94, 0.2)' : color}
                        stroke={color}
                        strokeWidth={1}
                        rx={1}
                      />
                    </g>
                  );
                }}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
