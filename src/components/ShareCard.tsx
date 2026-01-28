import React from 'react';
import { Sparkles, TrendingUp, TrendingDown, Trophy, Wallet } from 'lucide-react';
import { cn } from '../lib/utils';
import logo from '../assets/app-logo-new.png';
import background from '../assets/background.png';

interface ShareCardProps {
  cardRef: React.RefObject<HTMLDivElement | null>;
  data: {
    totalProfit: number;
    growthPercentage: number;
    winRate: number;
    currentCapital: number;
    period: string;
    healthScore: number;
  };
  theme?: 'light' | 'dark';
}

export const ShareCard: React.FC<ShareCardProps> = ({ cardRef, data }) => {
  const isPositive = data.totalProfit >= 0;
  const theme = 'dark';

  return (
    <div className={cn("fixed left-[-9999px] top-[-9999px]", "bg-black")}>
      <div 
        ref={cardRef}
        className={cn(
          "w-[1080px] h-[1920px] flex flex-col items-center justify-between p-20 relative overflow-hidden",
          "bg-black bg-cover bg-center"
        )}
        style={{
          backgroundImage: `url(${background})`,
          imageRendering: 'crisp-edges',
          WebkitFontSmoothing: 'antialiased'
        }}
      >
        {/* Background Overlay - Identical to app overlay */}
        <div className="absolute inset-0 bg-black/92 z-0" />

        {/* Top Section: App Identity */}
        <div className="z-10 flex flex-col items-center space-y-8 mt-32">
          <div className="relative">
            <div className={cn(
              "w-56 h-56 rounded-[3.5rem] border flex items-center justify-center p-8 relative z-10 shadow-2xl",
              "bg-white/[0.05] border-white/[0.05]"
            )}>
              <img src={logo} alt="Fox Trade" className="w-full h-full object-contain" />
            </div>
          </div>
          <div className="flex flex-col items-center space-y-4">
            <h1 className={cn(
              "text-7xl font-black tracking-[0.6em] uppercase translate-x-[0.3em]",
              "text-white"
            )}>Fox Trade</h1>
            <div className="h-[1px] w-64 bg-white/10" />
          </div>
        </div>

        {/* Story Focus: The Big Win/Result */}
        <div className="z-10 flex flex-col items-center w-full">
          <div className={cn(
            "px-12 py-5 border rounded-full mb-12",
            "bg-white/[0.05] border-white/[0.05]"
          )}>
            <span className={cn(
              "text-3xl font-black uppercase tracking-[0.6em] text-white/30"
            )}>{data.period} Report</span>
          </div>

          <div className="relative flex flex-col items-center mb-16">
            <div className="absolute -top-16 text-xl font-black uppercase tracking-[0.5em] text-white/10">Net Profit</div>
            <span className={cn(
              "text-[240px] font-black tracking-tighter leading-none filter drop-shadow-2xl",
              isPositive ? "text-green-500" : "text-red-500"
            )}>
              {isPositive ? '+' : ''}{data.totalProfit.toLocaleString()}
              <span className="text-6xl font-light ml-4 opacity-30 text-white">$</span>
            </span>
          </div>

          <div className={cn(
            "flex items-center gap-8 px-16 py-8 rounded-[4rem] border transition-all duration-500",
            isPositive 
              ? "bg-green-500/10 border-green-500/10 text-green-500"
              : "bg-red-500/10 border-red-500/10 text-red-500"
          )}>
            {isPositive ? <TrendingUp className="w-16 h-16" /> : <TrendingDown className="w-16 h-16" />}
            <span className="text-6xl font-black tracking-tight">
              {isPositive ? '+' : ''}{data.growthPercentage.toFixed(1)}% Growth
            </span>
          </div>
        </div>

        {/* Grid: Identical to StatsOverview Cards */}
        <div className="z-10 grid grid-cols-2 gap-12 w-full px-20">
          <div className={cn(
            "border rounded-[3rem] p-16 flex flex-col items-center space-y-6",
            "bg-white/[0.05] border-white/[0.05]"
          )}>
            <div className="p-6 bg-white/[0.05] rounded-[2rem] border border-white/[0.05]">
              <Trophy className="w-16 h-16 text-primary" />
            </div>
            <div className="text-center w-full overflow-hidden">
              <p className="text-2xl font-black uppercase tracking-[0.4em] mb-3 text-white/20">Win Rate</p>
              <p className="text-7xl font-black text-white">{Math.round(data.winRate)}%</p>
            </div>
          </div>

          <div className={cn(
            "border rounded-[3rem] p-16 flex flex-col items-center space-y-6",
            "bg-white/[0.05] border-white/[0.05]"
          )}>
            <div className="p-6 bg-white/[0.05] rounded-[2rem] border border-white/[0.05]">
              <Sparkles className="w-16 h-16 text-amber-500" />
            </div>
            <div className="text-center w-full overflow-hidden">
              <p className="text-2xl font-black uppercase tracking-[0.4em] mb-3 text-white/20">Score</p>
              <p className="text-7xl font-black text-white">{Math.round(data.healthScore)}%</p>
            </div>
          </div>
        </div>

        {/* Footer: Portfolio Value */}
        <div className="z-10 w-full flex flex-col items-center space-y-12 mb-24">
          <div className={cn(
            "flex items-center gap-8 px-12 py-6 border rounded-full",
            "bg-white/[0.05] border-white/[0.05]"
          )}>
            <Wallet className="w-10 h-10 text-white/20" />
            <span className="text-3xl font-black uppercase tracking-[0.4em] text-white/30">
              Equity: <span className="text-white">${data.currentCapital.toLocaleString()}</span>
            </span>
          </div>

          <div className="flex flex-col items-center space-y-6">
            <p className="text-2xl font-black uppercase tracking-[1em] text-white/5">Fox Trade Professional</p>
            <div className="h-[1px] w-80 bg-white/[0.05]" />
          </div>
        </div>

        {/* Subtle Decorative Accents */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] border-t-[1px] border-r-[1px] border-white/[0.02] rounded-tr-[15rem] -translate-x-16 translate-y-16" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] border-b-[1px] border-l-[1px] border-white/[0.02] rounded-bl-[15rem] translate-x-16 -translate-y-16" />
      </div>
    </div>
  );
};
