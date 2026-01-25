import React, { useEffect, useRef } from 'react';

const LivePriceTicker: React.FC = () => {
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
      "colorTheme": "dark",
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
  }, []);

  return (
    <div className="w-full px-4 mb-8 animate-fade-in">
      <div className="max-w-[1400px] mx-auto">
        <div className="relative group">
          {/* Glass Card Container - Fixed Height and Overflow */}
          <div className="relative bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-xl h-[40px] flex items-center shadow-lg overflow-hidden">
            
            {/* Cyberpunk Accents */}
            <div className="absolute inset-y-0 left-0 w-1 bg-primary/40 z-[30]" />
            <div className="absolute inset-y-0 right-0 w-1 bg-primary/40 z-[30]" />
            
            {/* Ticker Content Container - Simplified for containment */}
            <div className="w-full h-full flex items-center justify-center">
              <div 
                ref={containerRef} 
                className="tradingview-widget-container w-full h-[72px] -mt-[1px]" 
              />
            </div>

            {/* Logo Mask Layer - Absolute bottom protection */}
            <div className="absolute bottom-0 left-0 w-full h-[12px] bg-[#050505] z-[25]" />
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
          filter: contrast(1.1) brightness(1.2);
          pointer-events: none !important;
          transform: translateY(1px) !important;
        }
      `}} />
    </div>
  );
};

export default LivePriceTicker;
