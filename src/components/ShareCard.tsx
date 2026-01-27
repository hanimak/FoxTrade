import React from 'react';
import { Sparkles, TrendingUp, TrendingDown, Trophy, Wallet } from 'lucide-react';
import { cn } from '../lib/utils';
const logo = "app-logo-new.png";

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
  theme: 'light' | 'dark';
}

export const ShareCard: React.FC<ShareCardProps> = ({ cardRef, data, theme }) => {
  const isPositive = data.totalProfit >= 0;

  return (
    <div className={cn("fixed left-[-9999px] top-[-9999px]", theme === 'light' ? "bg-white" : "bg-[#030303]")}>
      <div 
        ref={cardRef}
        className={cn(
          "w-[1080px] h-[1920px] flex flex-col items-center justify-between p-20 relative overflow-hidden",
          theme === 'light' ? "bg-white" : "bg-[#030303]"
        )}
        style={{
          imageRendering: 'crisp-edges',
          WebkitFontSmoothing: 'antialiased'
        }}
      >
        {/* Background Elements */}
        <div className={cn(
          "absolute top-[-5%] left-[-5%] w-[60%] h-[40%] blur-[180px] rounded-full",
          theme === 'light' ? "bg-primary/20" : "bg-primary/30"
        )} />
        <div className={cn(
          "absolute bottom-[-5%] right-[-5%] w-[60%] h-[40%] blur-[180px] rounded-full",
          theme === 'light' ? "bg-primary/10" : "bg-primary/20"
        )} />
        
        {/* Top Section: Logo & Brand */}
        <div className="z-10 flex flex-col items-center space-y-8 mt-16">
          <div className="relative">
            <div className={cn(
              "absolute inset-0 blur-3xl rounded-full scale-150",
              theme === 'light' ? "bg-primary/20" : "bg-primary/40"
            )} />
            <div className={cn(
              "w-48 h-48 backdrop-blur-3xl rounded-[3rem] border flex items-center justify-center p-6 relative z-10 shadow-2xl",
              theme === 'light' ? "bg-white/60 border-black/5" : "bg-white/5 border-white/10"
            )}>
              <img src={logo} alt="Fox Trade" className="w-full h-full object-contain filter drop-shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]" />
            </div>
          </div>
          <div className="flex flex-col items-center space-y-4">
            <h1 className={cn(
              "text-7xl font-black tracking-[0.6em] uppercase translate-x-[0.3em]",
              theme === 'light' ? "text-slate-900" : "text-white"
            )}>Fox Trade</h1>
            <div className="h-1.5 w-60 bg-gradient-to-r from-transparent via-primary to-transparent" />
          </div>
        </div>

        {/* Main Content: Profit/Loss */}
        <div className="z-10 flex flex-col items-center space-y-8 w-full">
          <div className={cn(
            "px-10 py-4 border rounded-full backdrop-blur-3xl",
            theme === 'light' ? "bg-black/[0.03] border-black/[0.05]" : "bg-white/[0.03] border-white/[0.05]"
          )}>
            <span className={cn(
              "text-3xl font-black uppercase tracking-[0.4em]",
              theme === 'light' ? "text-slate-900/40" : "text-white/40"
            )}>{data.period} Performance</span>
          </div>

          <div className="relative group">
            <div className={cn(
              "absolute inset-0 blur-[100px] opacity-30 scale-150",
              isPositive ? "bg-green-500" : "bg-red-500"
            )} />
            <div className="relative flex flex-col items-center space-y-2">
              <span className={cn(
                "text-[240px] font-black tracking-tighter leading-none",
                isPositive ? "text-green-500" : "text-red-500"
              )}>
                {isPositive ? '+' : ''}{data.totalProfit.toLocaleString()}
                <span className={cn(
                  "text-6xl font-light ml-4 opacity-50",
                  theme === 'light' ? "text-slate-900" : "text-white"
                )}>$</span>
              </span>
            </div>
          </div>

          <div className={cn(
            "flex items-center gap-6 px-12 py-6 rounded-[3rem] border-2 backdrop-blur-3xl transition-all duration-500",
            isPositive 
              ? (theme === 'light' ? "bg-green-500/5 border-green-500/10 text-green-600" : "bg-green-500/10 border-green-500/20 text-green-500")
              : (theme === 'light' ? "bg-red-500/5 border-red-500/10 text-red-600" : "bg-red-500/10 border-red-500/20 text-red-500")
          )}>
            {isPositive ? <TrendingUp className="w-16 h-16" /> : <TrendingDown className="w-16 h-16" />}
            <span className="text-7xl font-black tracking-tight">
              {isPositive ? '+' : ''}{data.growthPercentage.toFixed(1)}% Growth
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="z-10 grid grid-cols-2 gap-10 w-full px-10">
          <div className={cn(
            "border rounded-[4rem] p-12 flex flex-col items-center space-y-6 backdrop-blur-xl",
            theme === 'light' ? "bg-black/[0.02] border-black/[0.05]" : "bg-white/[0.02] border-white/[0.05]"
          )}>
            <div className="p-6 bg-primary/10 rounded-3xl">
              <Trophy className="w-14 h-14 text-primary" />
            </div>
            <div className="text-center w-full overflow-hidden">
              <p className={cn(
                "text-3xl font-black uppercase tracking-widest mb-2",
                theme === 'light' ? "text-slate-900/20" : "text-white/20"
              )}>Win Rate</p>
              <p className={cn(
                "text-7xl font-black truncate px-2",
                theme === 'light' ? "text-slate-900" : "text-white"
              )}>{Math.round(data.winRate)}%</p>
            </div>
          </div>

          <div className={cn(
            "border rounded-[4rem] p-12 flex flex-col items-center space-y-6 backdrop-blur-xl",
            theme === 'light' ? "bg-black/[0.02] border-black/[0.05]" : "bg-white/[0.02] border-white/[0.05]"
          )}>
            <div className="p-6 bg-amber-500/10 rounded-3xl">
              <Sparkles className="w-14 h-14 text-amber-500" />
            </div>
            <div className="text-center w-full overflow-hidden">
              <p className={cn(
                "text-3xl font-black uppercase tracking-widest mb-2",
                theme === 'light' ? "text-slate-900/20" : "text-white/20"
              )}>Health Score</p>
              <p className={cn(
                "text-7xl font-black truncate px-2",
                theme === 'light' ? "text-slate-900" : "text-white"
              )}>{Math.round(data.healthScore)}%</p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Footer */}
        <div className="z-10 w-full flex flex-col items-center space-y-10 mb-10">
          <div className={cn(
            "flex items-center gap-6 px-10 py-5 border rounded-full",
            theme === 'light' ? "bg-black/[0.02] border-black/[0.05]" : "bg-white/[0.02] border-white/[0.05]"
          )}>
            <Wallet className={cn("w-8 h-8", theme === 'light' ? "text-slate-900/20" : "text-white/20")} />
            <span className={cn(
              "text-3xl font-black uppercase tracking-[0.3em]",
              theme === 'light' ? "text-slate-900/40" : "text-white/40"
            )}>
              Portfolio Value: <span className={theme === 'light' ? "text-slate-900" : "text-white"}>${data.currentCapital.toLocaleString()}</span>
            </span>
          </div>

          <div className="flex flex-col items-center space-y-4">
            <p className={cn(
              "text-2xl font-black uppercase tracking-[0.6em]",
              theme === 'light' ? "text-slate-900/10" : "text-white/10"
            )}>Professional Trading Companion</p>
            <div className="flex items-center gap-4">
              <div className="h-[2px] w-20 bg-gradient-to-r from-transparent to-primary/30" />
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse shadow-[0_0_15px_rgba(var(--primary-rgb),1)]" />
              <div className="h-[2px] w-20 bg-gradient-to-l from-transparent to-primary/30" />
            </div>
          </div>
        </div>

        {/* Decorative Corner Elements */}
        <div className="absolute top-0 right-0 w-80 h-80 border-t-4 border-r-4 border-primary/20 rounded-tr-[10rem] -translate-x-10 translate-y-10" />
        <div className="absolute bottom-0 left-0 w-80 h-80 border-b-4 border-l-4 border-primary/20 rounded-bl-[10rem] translate-x-10 -translate-y-10" />
      </div>
    </div>
  );
};
