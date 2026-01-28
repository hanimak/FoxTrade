import React, { useEffect, useRef } from 'react';
import { cn } from '../lib/utils';

interface LivePriceTickerProps {
  theme?: 'light' | 'dark';
}

const LivePriceTicker: React.FC<LivePriceTickerProps> = ({ theme = 'dark' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef(`tv-widget-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    // Clear container
    currentContainer.innerHTML = '';
    
    // Create widget container
    const widgetDiv = document.createElement('div');
    widgetDiv.id = widgetId.current;
    widgetDiv.className = 'tradingview-widget-container__widget';
    currentContainer.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      "symbols": [
        { "proName": "FOREXCOM:XAUUSD", "title": "GOLD" },
        { "proName": "FOREXCOM:XAGUSD", "title": "SILVER" },
        { "proName": "CAPITALCOM:DXY", "title": "DXY" },
        { "proName": "OANDA:BCOUSD", "title": "OIL" }
      ],
      "showSymbolLogo": false,
      "colorTheme": theme,
      "isTransparent": true,
      "displayMode": "regular",
      "locale": "en"
    });

    currentContainer.appendChild(script);

    return () => {
      if (currentContainer) {
        currentContainer.innerHTML = '';
      }
    };
  }, [theme]);

  return (
    <div className="w-full px-4 mb-8 animate-fade-in">
      <div className="max-w-[1400px] mx-auto">
        <div className="relative group">
          {/* Glass Card Container - Fixed Height and Overflow */}
          <div className={cn(
            "relative h-[44px] flex items-center bg-white/[0.05] backdrop-blur-[2px] border border-white/10 overflow-visible transition-all duration-500 rounded-2xl shadow-[0_0_15px_rgba(255,255,255,0.03)]"
          )}>
            {/* Glass Edge Highlight */}
            <div 
              className="absolute -inset-[1px] rounded-2xl pointer-events-none opacity-50 bg-gradient-to-br from-white/40 via-transparent to-white/10 z-10"
              style={{
                maskImage: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskImage: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                maskComposite: 'exclude',
                WebkitMaskComposite: 'xor',
                padding: '1px'
              }}
            />
            
            {/* Ticker Content Container - Simplified for containment */}
            <div className="w-full h-full flex items-center justify-center">
              <div 
                ref={containerRef} 
                className="tradingview-widget-container w-full h-[72px] -mt-[1px]" 
              />
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .tradingview-widget-container {
          overflow: hidden !important;
        }
        .tradingview-widget-container__widget {
          height: 72px !important;
        }
        /* Hide TradingView elements aggressively */
        .tradingview-widget-copyright,
        a[href*="tradingview"],
        .tv-embed-widget-wrapper__footer {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
        }
        iframe {
          height: 72px !important;
          margin: 0 !important;
          padding: 0 !important;
          filter: ${theme === 'light' ? 'contrast(0.8) brightness(0.9) grayscale(0.2)' : 'contrast(1.1) brightness(1.2)'};
          pointer-events: none !important;
          transform: translateY(1px) !important;
        }
      `}} />
    </div>
  );
};

export default LivePriceTicker;
