import { useState, useEffect } from 'react';
import { Delete, ShieldCheck } from 'lucide-react';
import { cn, haptic } from '../lib/utils';
const logo = "app-logo-new.png";
import { BackgroundSplitLogo } from './BackgroundSplitLogo';

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);
  const [isSettingInitial, setIsSettingInitial] = useState(false);
  const [confirmPasscode, setConfirmPasscode] = useState('');

  const savedPasscode = localStorage.getItem('app_passcode');

  useEffect(() => {
    if (!savedPasscode) {
      setIsSettingInitial(true);
    }
  }, [savedPasscode]);

  const handleNumberClick = (num: string) => {
    if (passcode.length < 4) {
      const newPasscode = passcode + num;
      setPasscode(newPasscode);
      setError(false);

      if (newPasscode.length === 4) {
        if (isSettingInitial) {
          // Handled in useEffect
        } else {
          if (newPasscode === savedPasscode) {
            onUnlock();
          } else {
            setTimeout(() => {
              setPasscode('');
              setError(true);
            }, 200);
          }
        }
      }
    }
  };

  const handleSetPasscode = () => {
    if (isSettingInitial && passcode.length === 4) {
      if (!confirmPasscode) {
        setConfirmPasscode(passcode);
        setPasscode('');
      } else {
        if (passcode === confirmPasscode) {
          localStorage.setItem('app_passcode', passcode);
          onUnlock();
        } else {
          setError(true);
          setPasscode('');
          setConfirmPasscode('');
        }
      }
    }
  };

  useEffect(() => {
    if (isSettingInitial && passcode.length === 4 && confirmPasscode) {
      handleSetPasscode();
    } else if (isSettingInitial && passcode.length === 4 && !confirmPasscode) {
      const timer = setTimeout(() => {
        setConfirmPasscode(passcode);
        setPasscode('');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [passcode, isSettingInitial, confirmPasscode]);

  const handleDelete = () => {
    setPasscode(prev => prev.slice(0, -1));
    setError(false);
  };

  return (
    <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-3xl flex flex-col items-center justify-center animate-in fade-in duration-700 overflow-hidden">
      {/* High Quality Background Design */}
      <div className="absolute inset-0 pointer-events-none select-none z-0">
        <BackgroundSplitLogo />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60" />
        {/* Grain/Noise Texture for Consistency */}
        <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center">
        <div className="flex flex-col items-center mb-12">
          <div className="w-28 h-28 relative group">
            <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-500" />
            <img src={logo} alt="Logo" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_25px_rgba(255,215,0,0.15)]" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-4xl font-black tracking-tighter text-white/90 drop-shadow-sm">FOX TRADE</h1>
            <div className="flex items-center justify-center gap-3 px-5 py-2 bg-white/[0.03] rounded-full border border-white/[0.05] shadow-xl">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Secure Protocol</span>
            </div>
          </div>
        </div>

        {/* Status Message */}
        <div className="text-center space-y-6 mb-12">
          <h2 className="text-sm font-black text-white/40 uppercase tracking-[0.2em]">
            {isSettingInitial 
              ? (confirmPasscode ? 'Confirm Code' : 'Set New Code')
              : 'Enter Code'}
          </h2>
          <div className="flex gap-6 justify-center">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-3.5 h-3.5 rounded-full border-2 transition-all duration-300",
                  passcode.length >= i 
                    ? "bg-white border-white scale-110" 
                    : "border-white/10 bg-white/5",
                  error && "border-red-500 bg-red-500 animate-shake"
                )}
              />
            ))}
          </div>
          {error && (
            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest animate-in slide-in-from-top-2">
              {isSettingInitial ? 'Codes do not match' : 'Incorrect code'}
            </p>
          )}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-x-6 gap-y-6 w-full max-w-sm px-8">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => { handleNumberClick(num.toString()); haptic('light'); }}
              className="w-full aspect-square rounded-[1.8rem] bg-white/[0.02] border border-white/[0.05] flex items-center justify-center text-3xl font-black text-white hover:bg-white/[0.05] hover:border-white/[0.1] active:scale-90 transition-all duration-200 shadow-2xl group"
            >
              <span className="group-hover:scale-110 transition-transform">{num}</span>
            </button>
          ))}
          <div className="w-full aspect-square" /> {/* Spacer */}
          <button
            onClick={() => { handleNumberClick('0'); haptic('light'); }}
            className="w-full aspect-square rounded-[1.8rem] bg-white/[0.02] border border-white/[0.05] flex items-center justify-center text-3xl font-black text-white hover:bg-white/[0.05] hover:border-white/[0.1] active:scale-90 transition-all duration-200 shadow-2xl group"
          >
            <span className="group-hover:scale-110 transition-transform">0</span>
          </button>
          <button
            onClick={() => { handleDelete(); haptic('medium'); }}
            className="w-full aspect-square rounded-[1.8rem] flex items-center justify-center text-white/20 hover:text-white/40 active:scale-90 transition-all duration-200"
          >
            <Delete className="w-8 h-8" />
          </button>
        </div>

        {isSettingInitial && !confirmPasscode && passcode.length === 0 && (
          <div className="flex items-center gap-2 text-[10px] text-white/20 font-black uppercase tracking-[0.2em] mt-8">
            <ShieldCheck className="w-3 h-3" />
            First Time Setup
          </div>
        )}
      </div>
    </div>
  );
}
