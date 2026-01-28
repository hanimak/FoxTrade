import { cn } from '../lib/utils';
import logo from '../assets/app-logo-new.png';

export function BackgroundSplitLogo() {
  const theme = 'dark';
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
      {/* Left Half Logo */}
      <div 
        className={cn(
          "absolute top-1/2 -left-[500px] -translate-y-1/2 w-[1000px] h-[1000px] blur-[1px] transform-gpu transition-opacity duration-700",
          "opacity-[0.05]"
        )}
        style={{ filter: 'drop-shadow(0 0 50px rgba(255, 184, 0, 0.2))' }}
      >
        <img 
          src={logo} 
          alt="" 
          className="w-full h-full object-contain"
        />
      </div>

      {/* Right Half Logo */}
      <div 
        className={cn(
          "absolute top-1/2 -right-[500px] -translate-y-1/2 w-[1000px] h-[1000px] blur-[1px] transform-gpu transition-opacity duration-700",
          "opacity-[0.05]"
        )}
        style={{ filter: 'drop-shadow(0 0 50px rgba(255, 184, 0, 0.2))' }}
      >
        <img 
          src={logo} 
          alt="" 
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}
