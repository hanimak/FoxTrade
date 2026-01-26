import React, { useEffect, useRef } from 'react';

const EconomicTickerTape: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef(`tv-economic-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    currentContainer.innerHTML = '';
    
    const widgetDiv = document.createElement('div');
    widgetDiv.id = widgetId.current;
    widgetDiv.className = 'tradingview-widget-container__widget';
    currentContainer.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      "symbols": [
        { "proName": "FX_IDC:USDILS", "title": "USD/ILS" },
        { "proName": "FX_IDC:EURUSD", "title": "EUR/USD" },
        { "proName": "FX_IDC:GBPUSD", "title": "GBP/USD" },
        { "proName": "FOREXCOM:XAUUSD", "title": "GOLD" },
        { "proName": "BITSTAMP:BTCUSD", "title": "BTC" },
        { "proName": "ECONOMICS:USIR", "title": "Fed Rate" },
        { "proName": "ECONOMICS:USCPI", "title": "US CPI" },
        { "proName": "ECONOMICS:USUR", "title": "Unempl." }
      ],
      "showSymbolLogo": true,
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
    <div className="w-full px-4 mb-4 animate-fade-in">
      <div className="max-w-[1400px] mx-auto">
        <div className="relative group">
          <div className="relative bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-xl h-[40px] flex items-center shadow-lg overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1 bg-red-500/40 z-[30]" />
            <div className="absolute inset-y-0 right-0 w-1 bg-red-500/40 z-[30]" />
            <div className="w-full h-full flex items-center justify-center">
              <div 
                ref={containerRef} 
                className="tradingview-widget-container w-full h-[72px] -mt-[1px]" 
              />
            </div>
            <div className="absolute bottom-0 left-0 w-full h-[12px] bg-[#050505] z-[25]" />
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .tradingview-widget-container { overflow: hidden !important; }
        .tradingview-widget-container__widget { height: 72px !important; }
        .tradingview-widget-copyright, a[href*="tradingview"], .tv-embed-widget-wrapper__footer {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
        }
        iframe {
          height: 72px !important;
          margin: 0 !important;
          padding: 0 !important;
          filter: contrast(1.1) brightness(1.2) hue-rotate(180deg); /* Color shift to distinguish from prices */
          pointer-events: none !important;
          transform: translateY(1px) !important;
        }
      `}} />
    </div>
  );
};

export default EconomicTickerTape;
