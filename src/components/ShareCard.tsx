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
        {/* Background Overlay to match app's 92% dark overlay */}
        <div className="absolute inset-0 bg-black/92 z-0" />

        {/* Top Section: Logo & Brand */}
        <div className="z-10 flex flex-col items-center space-y-6 mt-24">
          <div className="relative">
            <div className={cn(
              "w-48 h-48 rounded-[3rem] border flex items-center justify-center p-6 relative z-10 shadow-2xl",
              "bg-white/[0.05] border-white/[0.05]"
            )}>
              <img src={logo} alt="Fox Trade" className="w-full h-full object-contain" />
            </div>
          </div>
          <div className="flex flex-col items-center space-y-4">
            <h1 className={cn(
              "text-6xl font-black tracking-[0.6em] uppercase translate-x-[0.3em]",
              "text-white"
            )}>Fox Trade</h1>
            <div className="h-[2px] w-48 bg-white/10" />
          </div>
        </div>

        {/* Main Content: Profit/Loss */}
        <div className="z-10 flex flex-col items-center space-y-10 w-full">
          <div className={cn(
            "px-10 py-4 border rounded-full",
            "bg-white/[0.05] border-white/[0.05]"
          )}>
            <span className={cn(
              "text-2xl font-black uppercase tracking-[0.5em]",
              "text-white/30"
            )}>{data.period} Performance</span>
          </div>

          <div className="relative flex flex-col items-center space-y-4">
            <span className={cn(
              "text-[180px] font-black tracking-tighter leading-none",
              isPositive ? "text-green-500" : "text-red-500"
            )}>
              {isPositive ? '+' : ''}{data.totalProfit.toLocaleString()}
              <span className={cn(
                "text-5xl font-light ml-4 opacity-50 text-white"
              )}>$</span>
            </span>
          </div>

          <div className={cn(
            "flex items-center gap-6 px-12 py-6 rounded-[3rem] border transition-all duration-500",
            isPositive 
              ? "bg-green-500/10 border-green-500/10 text-green-500"
              : "bg-red-500/10 border-red-500/10 text-red-500"
          )}>
            {isPositive ? <TrendingUp className="w-12 h-12" /> : <TrendingDown className="w-12 h-12" />}
            <span className="text-5xl font-black tracking-tight">
              {isPositive ? '+' : ''}{data.growthPercentage.toFixed(1)}% Growth
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="z-10 grid grid-cols-2 gap-10 w-full px-16">
          <div className={cn(
            "border rounded-[3rem] p-12 flex flex-col items-center space-y-5",
            "bg-white/[0.05] border-white/[0.05]"
          )}>
            <div className="p-5 bg-white/[0.05] rounded-3xl border border-white/[0.05]">
              <Trophy className="w-12 h-12 text-primary" />
            </div>
            <div className="text-center w-full overflow-hidden">
              <p className={cn(
                "text-xl font-black uppercase tracking-[0.3em] mb-2 text-white/20"
              )}>Win Rate</p>
              <p className={cn(
                "text-6xl font-black truncate px-2 text-white"
              )}>{Math.round(data.winRate)}%</p>
            </div>
          </div>

          <div className={cn(
            "border rounded-[3rem] p-12 flex flex-col items-center space-y-5",
            "bg-white/[0.05] border-white/[0.05]"
          )}>
            <div className="p-5 bg-white/[0.05] rounded-3xl border border-white/[0.05]">
              <Sparkles className="w-12 h-12 text-amber-500" />
            </div>
            <div className="text-center w-full overflow-hidden">
              <p className={cn(
                "text-xl font-black uppercase tracking-[0.3em] mb-2 text-white/20"
              )}>Health Score</p>
              <p className={cn(
                "text-6xl font-black truncate px-2 text-white"
              )}>{Math.round(data.healthScore)}%</p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Footer */}
        <div className="z-10 w-full flex flex-col items-center space-y-10 mb-16">
          <div className={cn(
            "flex items-center gap-6 px-10 py-5 border rounded-full",
            "bg-white/[0.05] border-white/[0.05]"
          )}>
            <Wallet className="w-8 h-8 text-white/20" />
            <span className={cn(
              "text-2xl font-black uppercase tracking-[0.4em] text-white/30"
            )}>
              Portfolio Value: <span className="text-white">${data.currentCapital.toLocaleString()}</span>
            </span>
          </div>

          <div className="flex flex-col items-center space-y-4">
            <p className={cn(
              "text-xl font-black uppercase tracking-[0.8em] text-white/10"
            )}>Professional Trading Companion</p>
            <div className="h-[2px] w-64 bg-white/[0.05]" />
          </div>
        </div>

        {/* Decorative Corner Elements - Minimalist */}
        <div className="absolute top-0 right-0 w-96 h-96 border-t-[2px] border-r-[2px] border-white/[0.03] rounded-tr-[12rem] -translate-x-12 translate-y-12" />
        <div className="absolute bottom-0 left-0 w-96 h-96 border-b-[2px] border-l-[2px] border-white/[0.03] rounded-bl-[12rem] translate-x-12 -translate-y-12" />
      </div>
    </div>
  );
};
