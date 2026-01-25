import { useState, useEffect, useMemo, useRef } from 'react';
// Force Update v20.0
import { Wallet, RotateCcw, Download, Upload, Lock, LayoutGrid, BarChart3, Settings, X, Clock, FileSpreadsheet, TrendingUp, TrendingDown, LogOut, AlertTriangle, Target, Trophy, Info, Trash2, Cloud, RefreshCcw, Share2, Sparkles } from 'lucide-react';
import { cn, haptic } from './lib/utils';
import { type DailyRecord, type MT5Trade } from './types';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import { calculateStatistics, getPeriodStats, getSmartInsights } from './lib/statistics';
import { StatsOverview } from './components/StatsOverview';
import logo from './assets/app-logo-new.png';
import { LockScreen } from './components/LockScreen';
import { BackgroundSplitLogo } from './components/BackgroundSplitLogo';
import { ShareCard } from './components/ShareCard';
import LivePriceTicker from './components/LivePriceTicker';
import { 
  auth, 
  db, 
  googleProvider,
  type User 
} from './lib/firebase';
import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

type Tab = 'home' | 'analytics' | 'reports' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [isLocked, setIsLocked] = useState(true);
  const [, setPassword] = useState(() => localStorage.getItem('app_passcode') || '2525');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ type: 'reload' | 'reset', title: string, message: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);

  const [records, setRecords] = useState<DailyRecord[]>(() => {
    const saved = localStorage.getItem('trade_records');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [initialCapital, setInitialCapital] = useState<number>(() => {
    const saved = localStorage.getItem('initial_capital');
    return saved ? parseFloat(saved) : 1000;
  });

  const [currentCapital, setCurrentCapital] = useState<number>(initialCapital);
  const [isEditingInitial, setIsEditingInitial] = useState(false);
  const [isEditingTargets, setIsEditingTargets] = useState(false);

  const [showTargetsOnHome, setShowTargetsOnHome] = useState(() => {
    const saved = localStorage.getItem('show_targets_on_home');
    return saved ? saved === 'true' : true;
  });
  const [weeklyTarget, setWeeklyTarget] = useState<number>(() => {
    const saved = localStorage.getItem('weekly_target');
    return saved ? parseFloat(saved) : 500;
  });
  const [monthlyTarget, setMonthlyTarget] = useState<number>(() => {
    const saved = localStorage.getItem('monthly_target');
    return saved ? parseFloat(saved) : 2000;
  });
  
  // MT5 Import States
  const [mt5Preview, setMt5Preview] = useState<{
    trades: MT5Trade[];
    totalProfit: number;
    totalCommission: number;
    totalSwap: number;
    tradeCount: number;
    winCount: number;
    lossCount: number;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reportTrades, setReportTrades] = useState<MT5Trade[]>(() => {
    const saved = localStorage.getItem('report_trades');
    if (!saved) return [];
    try {
      const trades = JSON.parse(saved) as MT5Trade[];
      // Deduplicate by positionId to fix existing duplicate issues
      const uniqueMap = new Map<string, MT5Trade>();
      trades.forEach(t => {
        if (t && t.positionId && !uniqueMap.has(t.positionId)) {
          uniqueMap.set(t.positionId, t);
        }
      });
      return Array.from(uniqueMap.values());
    } catch (e) {
      return [];
    }
  });
  const [reportSortOrder, setReportSortOrder] = useState<'desc' | 'asc'>('desc');
  const [reportDateFilter, setReportDateFilter] = useState<string>('');
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'win' | 'loss'>('all');

  // Authentication Handlers
  const handleGoogleSignIn = async () => {
    try {
      haptic('medium');
      setIsSyncing(true);
      
      // On Electron or mobile, popup might fail. We'll try popup first.
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (popupError: any) {
        if (popupError.code === 'auth/popup-blocked') {
          await signInWithRedirect(auth, googleProvider);
        } else {
          throw popupError;
        }
      }
    } catch (error: any) {
      console.error('Sign in error details:', error);
      console.log('Current window origin:', window.location.origin);
      let errorMessage = 'فشل تسجيل الدخول عبر جوجل.';
      
      if (error.code === 'auth/unauthorized-domain') {
        errorMessage += '\n\nهذا النطاق غير مصرح به في Firebase. يرجى التأكد من إضافة "localhost" في Authorized Domains.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage += '\n\nتم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة للتطبيق.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage += '\n\nتسجيل الدخول عبر جوجل غير مفعل في مشروع Firebase الخاص بك.';
      } else {
        errorMessage += `\n\nتفاصيل الخطأ: ${error.message || 'خطأ غير معروف'}`;
      }
      
      alert(errorMessage);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle redirect result if needed
  useEffect(() => {
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect auth error:", error);
    });
  }, []);

  const handleSignOut = async () => {
    try {
      haptic('medium');
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Sync logic: Real-time Listener from Firestore
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Clean up previous listener if user changes
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = undefined;
      }

      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        
        // 1. Initial Get (to handle first-time user data push)
        try {
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
            await setDoc(docRef, {
              records,
              initialCapital,
              reportTrades,
              weeklyTarget,
              monthlyTarget,
              lastSynced: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Initial check error:', error);
        }

        // 2. Setup Real-time Listener
        unsubscribeSnapshot = onSnapshot(docRef, (snapshot) => {
          if (snapshot.exists() && snapshot.metadata.hasPendingWrites === false) {
            const cloudData = snapshot.data();
            console.log("Real-time update received from cloud");
            
            setIsSyncing(true); // Temporarily block outgoing sync to prevent loops
            
            if (cloudData.records) {
              setRecords(cloudData.records);
              localStorage.setItem('trade_records', JSON.stringify(cloudData.records));
            }
            if (cloudData.initialCapital) {
              setInitialCapital(cloudData.initialCapital);
              localStorage.setItem('initial_capital', cloudData.initialCapital.toString());
            }
            if (cloudData.reportTrades) {
              setReportTrades(cloudData.reportTrades);
              localStorage.setItem('report_trades', JSON.stringify(cloudData.reportTrades));
            }
            if (cloudData.weeklyTarget) {
              setWeeklyTarget(cloudData.weeklyTarget);
              localStorage.setItem('weekly_target', cloudData.weeklyTarget.toString());
            }
            if (cloudData.monthlyTarget) {
              setMonthlyTarget(cloudData.monthlyTarget);
              localStorage.setItem('monthly_target', cloudData.monthlyTarget.toString());
            }
            
            setTimeout(() => setIsSyncing(false), 500);
          }
        }, (error) => {
          console.error('Real-time listener error:', error);
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  // Sync logic: Push to Firestore on local changes
  useEffect(() => {
    if (user && !isSyncing) {
      const syncData = async () => {
        try {
          const docRef = doc(db, 'users', user.uid);
          await setDoc(docRef, {
            records,
            initialCapital,
            reportTrades,
            weeklyTarget,
            monthlyTarget,
            lastSynced: new Date().toISOString()
          }, { merge: true });
        } catch (error) {
          console.error('Sync to cloud error:', error);
        }
      };
      
      const timeoutId = setTimeout(syncData, 2000); // Debounce sync
      return () => clearTimeout(timeoutId);
    }
  }, [records, initialCapital, reportTrades, weeklyTarget, monthlyTarget, user]);

  useEffect(() => {
    localStorage.setItem('report_trades', JSON.stringify(reportTrades));
  }, [reportTrades]);

  useEffect(() => {
    // Force cache refresh by checking version
    // Fresh Start Version v26.1
    const CURRENT_VERSION = 'v26.1';
    const savedVersion = localStorage.getItem('app_version');
    if (savedVersion !== CURRENT_VERSION) {
      localStorage.setItem('app_version', CURRENT_VERSION);
      // Clear any service workers if possible
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (let registration of registrations) {
            registration.unregister();
          }
        });
      }
      // Clear session storage but keep local storage for data
      sessionStorage.clear();
      window.location.reload();
    }

    const totalPL = records.reduce((acc, curr) => acc + curr.profitLoss, 0);
    const newCapital = parseFloat((initialCapital + totalPL).toFixed(2));
    setCurrentCapital(newCapital);
    
    localStorage.setItem('trade_records', JSON.stringify(records));
    localStorage.setItem('initial_capital', initialCapital.toString());
    localStorage.setItem('current_capital', newCapital.toString());
    localStorage.setItem('weekly_target', weeklyTarget.toString());
    localStorage.setItem('monthly_target', monthlyTarget.toString());
    localStorage.setItem('show_targets_on_home', showTargetsOnHome.toString());
  }, [records, initialCapital, weeklyTarget, monthlyTarget, showTargetsOnHome]);

  const marketSessions = useMemo(() => {
    // Lebanon is UTC+2 or UTC+3 (DST)
    // We'll calculate the sessions based on the user's local time (computer time)
    const now = new Date();
    const localHour = now.getHours();

    // Helper to check if current local hour is within a session
    // This correctly handles sessions that cross midnight
    const isActive = (start: number, end: number) => {
      if (start < end) return localHour >= start && localHour < end;
      return localHour >= start || localHour < end;
    };

    // Market hours in Beirut Time (UTC+3 DST / UTC+2 Standard)
    // Shifted forward by 1 hour based on user request (Market Open 1:00)
    // London: 11:00 - 19:00
    // NY: 16:00 - 00:00
    // Tokyo: 03:00 - 12:00
    // Sydney: 01:00 - 10:00

    return [
      { name: 'London', hours: '11:00 - 19:00', active: isActive(11, 19) },
      { name: 'New York', hours: '16:00 - 00:00', active: isActive(16, 0) },
      { name: 'Tokyo', hours: '03:00 - 12:00', active: isActive(3, 12) },
      { name: 'Sydney', hours: '01:00 - 10:00', active: isActive(1, 10) }
    ];
  }, []);

  const stats = useMemo(() => calculateStatistics(records), [records]);
  const periodStats = useMemo(() => getPeriodStats(records), [records]);
  const insights = useMemo(() => getSmartInsights(records, reportTrades), [records, reportTrades]);

  const targetProgress = useMemo(() => {
    const weeklyProfit = periodStats.weekly[periodStats.weekly.length - 1]?.profit || 0;
    const monthlyProfit = periodStats.monthly[periodStats.monthly.length - 1]?.profit || 0;
    
    return {
      weekly: {
        profit: weeklyProfit,
        target: weeklyTarget,
        percentage: Math.min(Math.max((weeklyProfit / weeklyTarget) * 100, 0), 100)
      },
      monthly: {
        profit: monthlyProfit,
        target: monthlyTarget,
        percentage: Math.min(Math.max((monthlyProfit / monthlyTarget) * 100, 0), 100)
      }
    };
  }, [periodStats, weeklyTarget, monthlyTarget]);

  const geniusMetrics = useMemo(() => {
    // 1. Portfolio Health Score (0-100)
    // Based on Win Rate (40%), Profit Factor (40%), and Risk/Reward (20%)
    const winRateScore = (stats.winRate / 100) * 40;
    const pfScore = Math.min((stats.profitFactor / 3) * 40, 40); // Max PF 3.0 gives full 40 points
    const healthScore = Math.round(winRateScore + pfScore + 20); // Base 20 for participating

    // 2. 30-Day Projection
    // Average daily profit over the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRecords = records.filter(r => new Date(r.date) >= thirtyDaysAgo);
    const avgDailyProfit = recentRecords.length > 0 
      ? recentRecords.reduce((acc, curr) => acc + curr.profitLoss, 0) / 30 
      : 0;
    const projected30D = currentCapital + (avgDailyProfit * 30);

    return { healthScore, projected30D };
  }, [stats, records, currentCapital]);

  const recordsWithBalance = useMemo(() => {
    const sorted = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let running = initialCapital;
    const withBalance = sorted.map(r => {
      running += r.profitLoss;
      return { ...r, capitalAfter: parseFloat(running.toFixed(2)) };
    });
    return withBalance.reverse();
  }, [records, initialCapital]);

  const handleExportJSON = () => {
    if (records.length === 0) return;
    const dataStr = JSON.stringify(records, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fox-trade-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          if (confirm(`Do you want to import ${data.length} records? They will be added to your current data.`)) {
            setRecords(prev => [...data, ...prev]);
          }
        }
      } catch (err) {
        alert('Invalid file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetAllData = () => {
    if (confirm('⚠️ Warning: All records will be deleted and capital reset. This cannot be undone! Are you sure?')) {
      setRecords([]);
      setInitialCapital(1000);
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleImportMT5 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    haptic('medium');

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // MT5 can have different sheet names depending on export/language
        // Common names: 'Deals', 'Positions', 'Orders', or sometimes the first sheet
        const sheetNames = workbook.SheetNames;
        // Strict Sheet Selection: Priority to 'Positions' to avoid duplicates from 'Orders' or 'Deals'
        let targetSheetName = sheetNames.find(name => 
          ['positions', 'المراكز'].some(p => name.toLowerCase().includes(p))
        );

        // Fallback ONLY if 'Positions' is not found
        if (!targetSheetName) {
          targetSheetName = sheetNames.find(name => 
            ['deals', 'صفقات', 'العمليات', 'trades', 'history', 'تاريخ'].some(p => name.toLowerCase().includes(p))
          );
        }

        // Final fallback to first sheet
        if (!targetSheetName) targetSheetName = sheetNames[0];

        const dealsSheet = workbook.Sheets[targetSheetName];
        
        const rawData = XLSX.utils.sheet_to_json(dealsSheet, { header: 1, defval: "" }) as any[][];
        
        let headerRowIndex = -1;
        // Search for the header row that starts the 'Positions' table
        for (let i = 0; i < Math.min(rawData.length, 100); i++) {
          const row = rawData[i];
          if (row && row.some(cell => String(cell).toLowerCase().includes('symbol')) && 
              row.some(cell => String(cell).toLowerCase().includes('profit'))) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          alert('لم يتم العثور على جدول الصفقات (Positions). يرجى التأكد من اختيار ملف يحتوي على جدول المراكز.');
          setIsImporting(false);
          return;
        }

        const headers = rawData[headerRowIndex].map(h => String(h).trim());
        const rowsData = rawData.slice(headerRowIndex + 1);

        console.log('Detected Headers:', headers);

        // Find exact column indices to avoid any ambiguity
        // MT5 Reports have specific patterns. Profit is usually one of the last columns.
        const profitIndex = headers.findIndex(h => {
          const lower = h.toLowerCase();
          return lower === 'profit' || lower === 'الربح' || lower === 'الربح/الخسارة';
        });
        
        const symbolIndex = headers.findIndex(h => {
          const lower = h.toLowerCase();
          return lower === 'symbol' || lower === 'الرمز' || lower === 'الأصل';
        });

        // For Time, we want the CLOSE time. In MT5 Positions, it's often the second 'Time' column.
        const timeIndices = headers.reduce((acc: number[], h, i) => {
          if (h.toLowerCase().includes('time') || h.includes('الوقت')) acc.push(i);
          return acc;
        }, []);
        const timeIndex = timeIndices.length > 1 ? timeIndices[1] : (timeIndices[0] || -1);

        const ticketIndex = headers.findIndex(h => {
          const lower = h.toLowerCase();
          return lower === 'position' || lower === 'ticket' || lower === 'order' || lower === 'رقم' || lower === 'التذكرة' || lower === '#';
        });

        const commissionIndex = headers.findIndex(h => {
          const lower = h.toLowerCase();
          return lower === 'commission' || lower === 'العمولة' || lower === 'العمولات';
        });

        const swapIndex = headers.findIndex(h => {
          const lower = h.toLowerCase();
          return lower === 'swap' || lower === 'السواب' || lower === 'تبييت' || lower === 'الفوائد';
        });

        const typeIndex = headers.findIndex(h => h.toLowerCase() === 'type' || h === 'النوع');
        const volumeIndex = headers.findIndex(h => h.toLowerCase() === 'volume' || h === 'الحجم');

        console.log('Column Indices Found:', { profitIndex, commissionIndex, swapIndex, symbolIndex, ticketIndex, timeIndex });

        const tradesMap = new Map<string, MT5Trade>();

        rowsData.forEach((row) => {
          if (!row || row.length < Math.max(profitIndex, symbolIndex)) return;

          const symbol = String(row[symbolIndex] || '').trim();
          const profitRaw = row[profitIndex];
          const commissionRaw = commissionIndex !== -1 ? row[commissionIndex] : 0;
          const swapRaw = swapIndex !== -1 ? row[swapIndex] : 0;
          const ticket = String(row[ticketIndex] || '').trim();
          const type = String(row[typeIndex] || '').toLowerCase().trim();
          
          // Helper to parse numbers properly
          const parseNum = (val: any) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            let s = String(val).trim();
            // Handle negative numbers in brackets or with special dashes
            s = s.replace(/[()]/g, '-').replace(/[−–—]/g, '-');
            const cleaned = s.replace(/[^-0-9.]/g, '');
            const parts = cleaned.split('.');
            let finalStr = parts[0];
            if (parts.length > 1) finalStr += '.' + parts.slice(1).join('');
            return parseFloat(finalStr) || 0;
          };

          const profit = parseNum(profitRaw);
          const commission = parseNum(commissionRaw);
          const swap = parseNum(swapRaw);

          // ULTRA-STRICT FILTERING - ONLY REAL TRADES
          // 1. Must have a valid symbol (not empty, not numeric, not a reserved word, no spaces)
          const isReservedWord = /total|net|gross|summary|balance|equity|credit|deposit|withdrawal|initial|المجموع|الصافي|رصيد|إيداع|سحب|الرصيد|حقوق|ملخص/i.test(symbol);
          // Stronger symbol check: MT5 symbols are usually 6+ chars (EURUSD) or known pairs (XAUUSD). 
          // Balance rows often use the account number as a symbol or a generic "Balance".
          const isValidSymbol = symbol && 
                               symbol.length >= 2 && 
                               symbol.length <= 15 && // Symbols are never huge
                               !symbol.includes(' ') && 
                               !/^\d+$/.test(symbol) && 
                               !isReservedWord;
          
          // 2. Type must be EXACTLY Buy or Sell (or Arabic equivalents)
          const isRealTradeType = ['buy', 'sell', 'شراء', 'بيع'].some(t => type === t || type.startsWith(t));
          
          // 3. Ticket must be numeric and represent a real position ID
          const isNumericTicket = /^\d+$/.test(ticket) && ticket.length >= 5; // Tickets are usually long
          
          // 4. Double check the whole row for ANY balance-related keywords
          const rowString = row.map(cell => String(cell).toLowerCase()).join(' ');
          const isBalanceRow = /balance|deposit|withdrawal|credit|initial|summary|رصيد|إيداع|سحب|أولي|ملخص/i.test(rowString) && 
                              !/commission|swap/i.test(rowString);

          // 5. CUSTOM THRESHOLD: Real trades in your report are small (1-10$). 
          // We will cap it at 100$ to be safe, as 487+ is definitely balance.
          const isAboveBalanceThreshold = Math.abs(profit) >= 100;
          
          // 6. Summary row check
          const isSummaryRow = rowString.includes('total') || rowString.includes('gross') || rowString.includes('net profit');
          
          if (isValidSymbol && isRealTradeType && isNumericTicket && !isBalanceRow && !isAboveBalanceThreshold && !isSummaryRow && profit !== 0) {
            const volume = parseNum(row[volumeIndex]);
            const time = String(row[timeIndex] || '');

            // Use ticket as key to avoid duplicates from partial closes
            const existing = tradesMap.get(ticket);
            if (existing) {
              existing.profit = parseFloat((existing.profit + profit).toFixed(2));
              existing.commission = parseFloat((existing.commission + commission).toFixed(2));
              existing.swap = parseFloat((existing.swap + swap).toFixed(2));
            } else {
              tradesMap.set(ticket, {
                positionId: ticket,
                symbol,
                type: (type.includes('buy') || type.includes('شراء')) ? 'Buy' : 'Sell',
                volume,
                profit: parseFloat(profit.toFixed(2)),
                commission: parseFloat(commission.toFixed(2)),
                swap: parseFloat(swap.toFixed(2)),
                closeTime: time || new Date().toISOString(),
                status: (profit + commission + swap) > 0 ? 'Win' : 'Loss'
              });
            }
          }
        });

        const trades = Array.from(tradesMap.values());
        console.log('Final Filtered Trades:', trades);
        
        // CALCULATE NET RESULT: Only sum of filtered trade profits, commissions, and swaps
        const netTradeProfit = trades.reduce((acc, t) => acc + (t.profit + t.commission + t.swap), 0);
        const totalCommission = trades.reduce((acc, t) => acc + t.commission, 0);
        const totalSwap = trades.reduce((acc, t) => acc + t.swap, 0);
        
        console.log('Calculated Net Result (Trades Only):', netTradeProfit);
        
        const winCount = trades.filter(t => (t.profit + t.commission + t.swap) > 0).length;
        const lossCount = trades.length - winCount;

        setMt5Preview({
          trades,
          totalProfit: parseFloat(netTradeProfit.toFixed(2)), // This is the NET RESULT for import
          totalCommission: parseFloat(totalCommission.toFixed(2)),
          totalSwap: parseFloat(totalSwap.toFixed(2)),
          tradeCount: trades.length,
          winCount,
          lossCount
        });
        setIsImporting(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Import error:', error);
      alert('Error reading the Excel file. Please make sure it is a valid MT5 report.');
      setIsImporting(false);
    }
    e.target.value = '';
  };

  const confirmMT5Import = () => {
    if (!mt5Preview) return;

    haptic('heavy');
    
    // Store all individual trades for the reports page, avoiding duplicates
    setReportTrades(prev => {
      const existingIds = new Set(prev.map(t => t.positionId));
      const newUniqueTrades = mt5Preview.trades.filter(t => !existingIds.has(t.positionId));
      return [...newUniqueTrades, ...prev];
    });
    
    // Group trades by date to create DailyRecords
    const groupedByDate = mt5Preview.trades.reduce((acc: Record<string, { profit: number, symbols: Set<string>, count: number, winCount: number, lossCount: number, commission: number, swap: number }>, trade) => {
      // Parse MT5 time (format is usually YYYY.MM.DD HH:MM:SS)
      let dateStr = '';
      try {
        const parts = trade.closeTime.split(' ');
        const datePart = parts[0].replace(/\./g, '-'); // YYYY.MM.DD -> YYYY-MM-DD
        dateStr = new Date(datePart).toISOString().split('T')[0];
      } catch (e) {
        // Fallback for other formats
        dateStr = new Date().toISOString().split('T')[0];
      }
      
      if (!acc[dateStr]) {
        acc[dateStr] = { profit: 0, symbols: new Set(), count: 0, winCount: 0, lossCount: 0, commission: 0, swap: 0 };
      }
      
      const netProfit = trade.profit + trade.commission + trade.swap;
      acc[dateStr].profit += netProfit;
      acc[dateStr].commission += trade.commission;
      acc[dateStr].swap += trade.swap;
      acc[dateStr].symbols.add(trade.symbol);
      acc[dateStr].count += 1;
      if (netProfit > 0) acc[dateStr].winCount += 1;
      else acc[dateStr].lossCount += 1;
      
      return acc;
    }, {});

    const newRecords: DailyRecord[] = Object.entries(groupedByDate).map(([date, data]) => ({
      id: crypto.randomUUID(),
      date: new Date(date).toISOString(),
      profitLoss: parseFloat(data.profit.toFixed(2)),
      capitalBefore: 0,
      capitalAfter: 0,
      isMT5Import: true,
      mt5Details: {
        tradeCount: data.count,
        winCount: data.winCount,
        lossCount: data.lossCount,
        totalCommission: parseFloat(data.commission.toFixed(2)),
        totalSwap: parseFloat(data.swap.toFixed(2)),
        symbols: Array.from(data.symbols)
      },
      notes: `MT5 Import: ${data.count} trades (${data.winCount}W/${data.lossCount}L) - ${Array.from(data.symbols).join(', ')}`
    }));

    // Check for duplicates (existing records with same date)
    const existingDates = new Set(records.map(r => new Date(r.date).toISOString().split('T')[0]));
    const uniqueNewRecords = newRecords.filter(nr => {
      const d = new Date(nr.date).toISOString().split('T')[0];
      if (existingDates.has(d)) {
        // Optional: Merge or skip? Let's skip and alert for now, or merge?
        // User said "check for duplicates". Let's skip if exact date exists to avoid double entry.
        return false;
      }
      return true;
    });

    if (uniqueNewRecords.length === 0) {
      alert('All imported dates already exist in your records. No new data added.');
    } else {
      setRecords(prev => [...uniqueNewRecords, ...prev]);
      alert(`Successfully imported ${uniqueNewRecords.length} daily records from MT5!`);
    }

    setMt5Preview(null);
  };

  const handleShare = async () => {
    if (!shareCardRef.current) return;
    
    try {
      haptic('heavy');
      setIsSharing(true);
      
      // Give a small delay for any layout updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await toPng(shareCardRef.current, {
        quality: 1.0,
        pixelRatio: 2, // Higher resolution for sharing
      });
      
      const link = document.createElement('a');
      link.download = `fox-trade-performance-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
      
      setIsSharing(false);
    } catch (err) {
      console.error('Error sharing performance:', err);
      setIsSharing(false);
      alert('Failed to generate share image. Please try again.');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="space-y-6 animate-fade-in pb-32">
            {/* Live Prices Ticker */}
            <LivePriceTicker />

            {/* Unique Genius Net Worth Card */}
            <div className="relative group px-4 sm:px-0">
              <div className="relative overflow-hidden bg-white/[0.01] border border-white/[0.05] rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl backdrop-blur-sm">
                <div className="relative z-10 flex flex-col items-center text-center space-y-6 sm:space-y-10">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-3 px-5 py-2 bg-primary/10 border border-primary/20 rounded-full backdrop-blur-xl">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/80">Dynamic Portfolio</p>
                    </div>
                  </div>

                  <div className="absolute top-0 right-0 p-4 sm:p-6">
                    <button 
                      onClick={handleShare}
                      disabled={isSharing}
                      className={cn(
                        "group relative p-3 sm:p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] transition-all duration-500 hover:bg-primary/10 hover:border-primary/20 active:scale-90",
                        isSharing && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isSharing ? (
                        <RefreshCcw className="w-5 h-5 text-primary animate-spin" />
                      ) : (
                        <Share2 className="w-5 h-5 text-white/20 group-hover:text-primary transition-colors" />
                      )}
                    </button>
                  </div>

                  <div className="relative flex flex-col items-center w-full">
                    <div className="flex items-baseline gap-2 sm:gap-4 relative">
                      <div className="relative group/dollar">
                        <span className="text-3xl sm:text-5xl font-extralight bg-gradient-to-b from-primary via-primary/80 to-primary/40 bg-clip-text text-transparent select-none">
                          $
                        </span>
                      </div>
                      <h2 className="text-5xl sm:text-8xl font-black tracking-tighter text-white">
                        {currentCapital.toLocaleString()}
                      </h2>
                    </div>
                    
                    {/* Genius Stats Row */}
                    <div className="mt-8 sm:mt-12 grid grid-cols-3 gap-2 sm:gap-8 w-full max-w-xl px-2 sm:px-4">
                      {/* Health Score */}
                      <div className="flex flex-col items-center space-y-2 sm:space-y-3 group/stat transition-all duration-300 hover:scale-105 sm:hover:scale-110">
                        <p className="text-[7px] sm:text-[9px] font-black text-white/20 uppercase tracking-[0.2em] sm:tracking-[0.3em]">Health Score</p>
                        <div className={cn(
                          "flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black tracking-tight transition-all",
                          geniusMetrics.healthScore > 60 
                            ? "bg-green-500/10 text-green-500" 
                            : "bg-red-500/10 text-red-500"
                        )}>
                          <Sparkles className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                          {geniusMetrics.healthScore}%
                        </div>
                      </div>
                      
                      {/* 30D Projection */}
                      <div className="flex flex-col items-center space-y-2 sm:space-y-3 group/stat transition-all duration-300 hover:scale-105 sm:hover:scale-110">
                        <p className="text-[7px] sm:text-[9px] font-black text-white/20 uppercase tracking-[0.2em] sm:tracking-[0.3em]">Projected 30D</p>
                        <div className="flex flex-col items-center">
                          <p className="text-sm sm:text-xl font-black tracking-tighter text-white/90">
                            <span className="text-[10px] sm:text-xs font-light text-white/30 mr-0.5">$</span>
                            {Math.round(geniusMetrics.projected30D).toLocaleString()}
                          </p>
                          <div className="flex items-center gap-1 text-[7px] sm:text-[8px] font-black text-primary uppercase tracking-widest opacity-60">
                            <TrendingUp className="w-2 h-2" />
                            Forecast
                          </div>
                        </div>
                      </div>
                      
                      {/* Growth */}
                      <div className="flex flex-col items-center space-y-2 sm:space-y-3 group/stat transition-all duration-300 hover:scale-105 sm:hover:scale-110">
                        <p className="text-[7px] sm:text-[9px] font-black text-white/20 uppercase tracking-[0.2em] sm:tracking-[0.3em]">Performance</p>
                        <div className={cn(
                          "flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black tracking-tight transition-all",
                          stats.totalProfit >= 0 
                            ? "bg-green-500/10 text-green-500" 
                            : "bg-red-500/10 text-red-500"
                        )}>
                          {stats.totalProfit >= 0 ? (
                            <TrendingUp className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                          ) : (
                            <TrendingDown className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                          )}
                          {Math.abs((stats.totalProfit / initialCapital) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Smart Insights Section */}
            {insights.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {insights.map((insight, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "group relative p-5 rounded-[2rem] border overflow-hidden transition-all duration-500 hover:scale-[1.02]",
                      insight.type === 'success' ? "bg-green-500/[0.03] border-green-500/10 hover:bg-green-500/[0.05]" :
                      insight.type === 'warning' ? "bg-red-500/[0.03] border-red-500/10 hover:bg-red-500/[0.05]" :
                      "bg-blue-500/[0.03] border-blue-500/10 hover:bg-blue-500/[0.05]"
                    )}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn(
                        "p-3 rounded-2xl",
                        insight.type === 'success' ? "bg-green-500/10 text-green-500" :
                        insight.type === 'warning' ? "bg-red-500/10 text-red-500" :
                        "bg-blue-500/10 text-blue-500"
                      )}>
                        {insight.icon === 'TrendingUp' && <TrendingUp className="w-5 h-5" />}
                        {insight.icon === 'AlertTriangle' && <AlertTriangle className="w-5 h-5" />}
                        {insight.icon === 'Clock' && <Clock className="w-5 h-5" />}
                        {insight.icon === 'Target' && <Target className="w-5 h-5" />}
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-white/[0.03] border border-white/[0.05] rounded-full">
                        <Sparkles className="w-2.5 h-2.5 text-white/40" />
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Insight</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-[11px] font-black text-white/80 uppercase tracking-widest">{insight.title}</h4>
                      <p className="text-[13px] font-medium text-white/40 leading-relaxed group-hover:text-white/60 transition-colors">
                        {insight.message}
                      </p>
                    </div>

                    <div className="absolute -bottom-4 -right-4 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                      {insight.icon === 'TrendingUp' && <TrendingUp className="w-24 h-24" />}
                      {insight.icon === 'AlertTriangle' && <AlertTriangle className="w-24 h-24" />}
                      {insight.icon === 'Clock' && <Clock className="w-24 h-24" />}
                      {insight.icon === 'Target' && <Target className="w-24 h-24" />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Profit Targets Progress */}
            {showTargetsOnHome && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Weekly Target */}
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-[2rem] p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-3 h-3 text-amber-500/60" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Weekly Target</h3>
                    </div>
                    <span className="text-[10px] font-black text-white/20 tracking-widest">
                      ${Math.round(targetProgress.weekly.profit)} / ${targetProgress.weekly.target}
                    </span>
                  </div>
                  
                  <div className="relative h-2 w-full bg-white/[0.02] rounded-full overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500/40 to-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all duration-1000 ease-out"
                      style={{ width: `${targetProgress.weekly.percentage}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-white/10 uppercase tracking-widest">Progress</span>
                    <span className="text-[11px] font-black text-amber-500/80 tracking-tighter">{Math.round(targetProgress.weekly.percentage)}%</span>
                  </div>
                </div>

                {/* Monthly Target */}
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-[2rem] p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-3 h-3 text-primary/60" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Monthly Target</h3>
                    </div>
                    <span className="text-[10px] font-black text-white/20 tracking-widest">
                      ${Math.round(targetProgress.monthly.profit)} / ${targetProgress.monthly.target}
                    </span>
                  </div>
                  
                  <div className="relative h-2 w-full bg-white/[0.02] rounded-full overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/40 to-primary shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all duration-1000 ease-out"
                      style={{ width: `${targetProgress.monthly.percentage}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-white/10 uppercase tracking-widest">Progress</span>
                    <span className="text-[11px] font-black text-primary/80 tracking-tighter">{Math.round(targetProgress.monthly.percentage)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Market Sessions */}
            <div className="grid grid-cols-1 gap-4">
              {/* Live Market Sessions */}
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-[2rem] p-6 space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Clock className="w-3 h-3 text-primary/60" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Market Sessions</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {marketSessions.map(session => (
                    <div key={session.name} className={cn(
                      "p-3 rounded-2xl border transition-all duration-500",
                      session.active 
                        ? "bg-primary/10 border-primary/20 shadow-[0_0_15px_rgba(59,130,246,0.05)]" 
                        : "bg-white/[0.01] border-white/[0.05] opacity-40"
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <p className={cn("text-[10px] font-black uppercase tracking-tight", session.active ? "text-primary" : "text-white/40")}>
                          {session.name}
                        </p>
                        {session.active && <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />}
                      </div>
                      <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{session.hours}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center mb-4">
                <div className="inline-flex items-center gap-2.5 px-6 py-2 bg-white/[0.02] backdrop-blur-md border border-white/[0.05] rounded-full shadow-2xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20 shadow-[0_0_12px_rgba(255,255,255,0.1)]" />
                  <p className="text-[11px] font-black uppercase tracking-[0.5em] text-white/20">Operation Stream</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {recordsWithBalance.slice(0, 5).map((record) => (
                  <div 
                    key={record.id} 
                    className="flex items-center gap-5 bg-white/[0.02] backdrop-blur-md hover:bg-white/[0.04] border border-white/[0.05] rounded-[1.8rem] p-5 transition-all group shadow-xl"
                  >
                    <div className={cn(
                      "w-1.5 h-10 rounded-full",
                      record.profitLoss >= 0 ? "bg-green-500/40 shadow-[0_0_15px_rgba(34,197,94,0.2)]" : "bg-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                    )} />
                    <div className="flex-1 flex items-center justify-between">
                      <div className="text-left">
                        <p className="text-[11px] font-black text-white/80 uppercase tracking-tight mb-0.5">
                          {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.1em] truncate max-w-[150px]">
                          {record.notes || 'No meta data'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={cn("text-xl font-black tracking-tighter", record.profitLoss >= 0 ? "text-green-500/60" : "text-red-500/60")}>
                          {record.profitLoss >= 0 ? '+' : ''}{record.profitLoss.toLocaleString()}
                        </div>
                        <p className="text-[10px] font-black text-white/10 uppercase tracking-tighter">
                          BAL // {record.capitalAfter.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {records.length === 0 && (
                  <div className="py-20 flex flex-col items-center justify-center bg-white/[0.02] backdrop-blur-md border border-white/[0.05] rounded-[2rem] shadow-2xl">
                    <div className="w-16 h-16 bg-white/[0.02] rounded-full flex items-center justify-center mb-6 border border-white/[0.05]">
                      <div className="w-6 h-6 text-white/10 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white/20 rounded-full" />
                      </div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">No active stream</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case 'analytics':
        return (
          <div className="space-y-6 animate-fade-in pb-32">
            <StatsOverview 
              stats={stats} 
              periodStats={periodStats} 
              records={records} 
              initialCapital={initialCapital} 
            />
          </div>
        );
      case 'reports': {
        // Group trades by date
        const filteredTrades = reportTrades.filter(trade => {
          const date = trade.closeTime.split(' ')[0].replace(/\./g, '-');
          const matchesDate = !reportDateFilter || date === reportDateFilter;
          const matchesSearch = !reportSearchQuery || 
            trade.symbol.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
            trade.positionId.includes(reportSearchQuery);
          
          const netProfit = trade.profit + trade.commission + trade.swap;
          const matchesStatus = reportStatusFilter === 'all' || 
            (reportStatusFilter === 'win' && netProfit > 0) ||
            (reportStatusFilter === 'loss' && netProfit <= 0);

          return matchesDate && matchesSearch && matchesStatus;
        });

        // Calculate counts based on current date and search filters
        const filteredForCounts = reportTrades.filter(trade => {
          const date = trade.closeTime.split(' ')[0].replace(/\./g, '-');
          const matchesDate = !reportDateFilter || date === reportDateFilter;
          const matchesSearch = !reportSearchQuery || 
            trade.symbol.toLowerCase().includes(reportSearchQuery.toLowerCase()) ||
            trade.positionId.includes(reportSearchQuery);
          return matchesDate && matchesSearch;
        });

        const counts = {
          total: filteredForCounts.length,
          wins: filteredForCounts.filter(t => (t.profit + t.commission + t.swap) > 0).length,
          losses: filteredForCounts.filter(t => (t.profit + t.commission + t.swap) <= 0).length
        };

        // Sort trades by closeTime before grouping
        const sortedTrades = [...filteredTrades].sort((a, b) => {
          const timeA = new Date(a.closeTime.replace(/\./g, '-')).getTime();
          const timeB = new Date(b.closeTime.replace(/\./g, '-')).getTime();
          return reportSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });

        const tradesByDate = sortedTrades.reduce((acc: Record<string, { trades: MT5Trade[], dailyPL: number }>, trade) => {
          const date = trade.closeTime.split(' ')[0].replace(/\./g, '-');
          if (!acc[date]) acc[date] = { trades: [], dailyPL: 0 };
          acc[date].trades.push(trade);
          acc[date].dailyPL += (trade.profit + trade.commission + trade.swap);
          return acc;
        }, {});

        // Sort dates
        const sortedDates = Object.keys(tradesByDate).sort((a, b) => {
          const timeA = new Date(a).getTime();
          const timeB = new Date(b).getTime();
          return reportSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });

        return (
          <div className="space-y-10 animate-fade-in pb-32">
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="inline-flex items-center gap-2.5 px-6 py-2 bg-white/[0.02] backdrop-blur-md border border-white/[0.05] rounded-full shadow-2xl">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_12px_rgba(59,130,245,0.6)] animate-pulse" />
                <p className="text-[11px] font-black uppercase tracking-[0.5em] text-white/30">Trade Report</p>
              </div>
            </div>

            {reportTrades.length > 0 && (
              <div className="px-4">
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-[2rem] p-2 sm:p-3 backdrop-blur-md">
                  <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                    {/* Status Filters - Segmented Style */}
                    <div className="flex-1 flex bg-black/20 rounded-2xl p-1 gap-1">
                      <button 
                        onClick={() => { setReportStatusFilter('all'); haptic('light'); }}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-500",
                          reportStatusFilter === 'all' 
                            ? "bg-primary text-black shadow-lg shadow-primary/20 font-black" 
                            : "text-white/30 hover:text-white/50 font-bold"
                        )}
                      >
                        <span className="text-[10px] uppercase tracking-widest">All</span>
                        <span className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded-md",
                          reportStatusFilter === 'all' ? "bg-black/10" : "bg-white/5"
                        )}>{counts.total}</span>
                      </button>
                      
                      <button 
                        onClick={() => { setReportStatusFilter('win'); haptic('light'); }}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-500",
                          reportStatusFilter === 'win' 
                            ? "bg-green-500 text-white shadow-lg shadow-green-500/20 font-black" 
                            : "text-white/30 hover:text-white/50 font-bold"
                        )}
                      >
                        <span className="text-[10px] uppercase tracking-widest">Wins</span>
                        <span className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded-md",
                          reportStatusFilter === 'win' ? "bg-black/10" : "bg-white/5"
                        )}>{counts.wins}</span>
                      </button>

                      <button 
                        onClick={() => { setReportStatusFilter('loss'); haptic('light'); }}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-500",
                          reportStatusFilter === 'loss' 
                            ? "bg-red-500 text-white shadow-lg shadow-red-500/20 font-black" 
                            : "text-white/30 hover:text-white/50 font-bold"
                        )}
                      >
                        <span className="text-[10px] uppercase tracking-widest">Losses</span>
                        <span className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded-md",
                          reportStatusFilter === 'loss' ? "bg-black/10" : "bg-white/5"
                        )}>{counts.losses}</span>
                      </button>
                    </div>

                    <div className="hidden lg:block w-px h-8 bg-white/[0.05]" />

                    {/* Secondary Controls */}
                    <div className="flex items-center gap-2">
                      {/* Sort Toggle */}
                      <button 
                        onClick={() => {
                          setReportSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                          haptic('light');
                        }}
                        className="flex-1 lg:flex-none flex items-center gap-3 px-5 py-3 bg-white/[0.02] border border-white/[0.05] rounded-2xl hover:bg-white/[0.05] transition-all group"
                      >
                        <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:scale-110 transition-transform">
                          {reportSortOrder === 'desc' ? (
                            <TrendingDown className="w-3 h-3 text-primary" />
                          ) : (
                            <TrendingUp className="w-3 h-3 text-primary" />
                          )}
                        </div>
                        <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                          {reportSortOrder === 'desc' ? 'Newest' : 'Oldest'}
                        </span>
                      </button>

                      {/* Date Filter */}
                      <div className="flex-1 lg:flex-none relative group flex items-center gap-3 px-5 py-3 bg-white/[0.02] border border-white/[0.05] rounded-2xl hover:bg-white/[0.05] transition-all">
                        <div className="w-5 h-5 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
                          <Clock className="w-3 h-3 text-amber-500" />
                        </div>
                        <input 
                          type="date" 
                          value={reportDateFilter}
                          onChange={(e) => {
                            setReportDateFilter(e.target.value);
                            haptic('light');
                          }}
                          className="bg-transparent text-[10px] font-black text-white/60 uppercase tracking-widest outline-none cursor-pointer [color-scheme:dark] w-full lg:w-auto"
                        />
                        {reportDateFilter && (
                          <button 
                            onClick={() => {
                              setReportDateFilter('');
                              haptic('medium');
                            }}
                            className="ml-1 p-0.5 hover:bg-white/10 rounded-full transition-colors"
                          >
                            <X className="w-3 h-3 text-white/40" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {reportTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white/[0.01] border border-white/[0.03] rounded-[2.5rem] border-dashed">
                <FileSpreadsheet className="w-16 h-16 text-white/5 mb-4" />
                <p className="text-white/20 font-black uppercase tracking-widest text-[10px]">No trades imported yet</p>
                <p className="text-white/10 text-xs mt-2">Tap the central logo to import an MT5 report</p>
              </div>
            ) : filteredTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white/[0.01] border border-white/[0.03] rounded-[2.5rem]">
                <AlertTriangle className="w-12 h-12 text-white/5 mb-4" />
                <p className="text-white/20 font-black uppercase tracking-widest text-[10px]">No matching trades found</p>
                <button 
                  onClick={() => { setReportDateFilter(''); setReportSearchQuery(''); haptic('medium'); }}
                  className="mt-4 text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="space-y-12">
                {sortedDates.map(date => (
                  <div key={date} className="space-y-6">
                    <div className="flex items-center gap-4 px-2">
                      <div className="h-px flex-1 bg-white/[0.05]" />
                      <div className="flex flex-col items-center gap-1">
                        <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] whitespace-nowrap">
                          {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </h3>
                        <div className={cn(
                          "px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase",
                          tradesByDate[date].dailyPL >= 0 ? "bg-green-500/10 text-green-500/60" : "bg-red-500/10 text-red-500/60"
                        )}>
                          {tradesByDate[date].dailyPL >= 0 ? '+' : ''}${tradesByDate[date].dailyPL.toLocaleString()}
                        </div>
                      </div>
                      <div className="h-px flex-1 bg-white/[0.05]" />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {tradesByDate[date].trades.map((trade, i) => (
                        <div key={i} className="group relative bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 hover:bg-white/[0.04] transition-all duration-300">
                          <div className="flex justify-between items-start mb-2 sm:mb-3">
                            <div className={cn(
                              "w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-[10px] sm:text-xs font-black",
                              trade.profit >= 0 ? "bg-green-500/10 text-green-500/60" : "bg-red-500/10 text-red-500/60"
                            )}>
                              {trade.symbol.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="text-right">
                              <p className={cn("text-base sm:text-xl font-black tracking-tighter leading-none", trade.profit >= 0 ? "text-green-500/80" : "text-red-500/80")}>
                                {trade.profit >= 0 ? '+' : ''}{trade.profit.toLocaleString()}
                              </p>
                              <p className="text-[7px] sm:text-[8px] font-black text-white/10 uppercase tracking-widest mt-1">Profit</p>
                            </div>
                          </div>

                          <div className="space-y-1 sm:space-y-1.5 text-left">
                            <h4 className="text-[11px] sm:text-[13px] font-black text-white/90 truncate">{trade.symbol}</h4>
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-[7px] sm:text-[8px] font-black uppercase tracking-widest px-1.5 sm:px-2 py-0.5 rounded-md",
                                trade.type === 'Buy' ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400"
                              )}>
                                {trade.type}
                              </span>
                              <span className="text-[9px] sm:text-[11px] font-black text-white/40 tracking-tighter">{trade.volume}L</span>
                            </div>
                          </div>

                          <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-white/[0.03] flex items-center justify-between">
                            <span className="text-[8px] sm:text-[9px] font-bold text-white/20 tracking-tighter">#{trade.positionId.slice(-6)}</span>
                            <div className="flex items-center gap-1 sm:gap-1.5 text-white/30">
                              <Clock className="w-2 sm:w-2.5 h-2 sm:h-2.5" />
                              <span className="text-[9px] sm:text-[10px] font-bold tracking-tighter">{trade.closeTime.split(' ')[1].substring(0, 5)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
      case 'settings':
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in px-4">
            <div className="grid grid-cols-5 items-center justify-center gap-x-4 gap-y-12 sm:gap-x-12 sm:gap-y-16 max-w-4xl">
              {/* Capital */}
              <button 
                onClick={() => { setIsEditingInitial(true); haptic('light'); }}
                className="group relative flex flex-col items-center gap-3 sm:gap-4 transition-all duration-500 active:scale-90"
              >
                <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center">
                  <div className="absolute inset-0 bg-emerald-500/10 rounded-2xl sm:rounded-3xl blur-lg sm:blur-xl group-hover:bg-emerald-500/30 transition-all duration-700 opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-white/[0.02] border border-white/[0.05] rounded-2xl sm:rounded-3xl backdrop-blur-md group-hover:border-emerald-500/40 transition-all duration-500 group-hover:bg-emerald-500/10" />
                  <Wallet className="w-7 h-7 sm:w-9 sm:h-9 text-emerald-500/40 group-hover:text-emerald-400 group-hover:scale-110 transition-all duration-500 relative z-10" />
                </div>
                <span className="text-[8px] sm:text-[11px] font-black uppercase tracking-widest text-white/40 group-hover:text-emerald-400/80 transition-colors duration-500">Capital</span>
              </button>

              {/* Pass */}
              <button 
                onClick={() => { setIsChangingPass(true); haptic('light'); }}
                className="group relative flex flex-col items-center gap-3 sm:gap-4 transition-all duration-500 active:scale-90"
              >
                <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center">
                  <div className="absolute inset-0 bg-amber-500/10 rounded-2xl sm:rounded-3xl blur-lg sm:blur-xl group-hover:bg-amber-500/30 transition-all duration-700 opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-white/[0.02] border border-white/[0.05] rounded-2xl sm:rounded-3xl backdrop-blur-md group-hover:border-amber-500/40 transition-all duration-500 group-hover:bg-amber-500/10" />
                  <Lock className="w-7 h-7 sm:w-9 sm:h-9 text-amber-500/40 group-hover:text-amber-400 group-hover:scale-110 transition-all duration-500 relative z-10" />
                </div>
                <span className="text-[8px] sm:text-[11px] font-black uppercase tracking-widest text-white/40 group-hover:text-amber-400/80 transition-colors duration-500">Security</span>
              </button>

              {/* Targets */}
              <button 
                onClick={() => { setIsEditingTargets(true); haptic('light'); }}
                className="group relative flex flex-col items-center gap-3 sm:gap-4 transition-all duration-500 active:scale-90"
              >
                <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center">
                  <div className="absolute inset-0 bg-amber-500/10 rounded-2xl sm:rounded-3xl blur-lg sm:blur-xl group-hover:bg-amber-500/30 transition-all duration-700 opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-white/[0.02] border border-white/[0.05] rounded-2xl sm:rounded-3xl backdrop-blur-md group-hover:border-amber-500/40 transition-all duration-500 group-hover:bg-amber-500/10" />
                  <Trophy className="w-7 h-7 sm:w-9 sm:h-9 text-amber-500/40 group-hover:text-amber-400 group-hover:scale-110 transition-all duration-500 relative z-10" />
                </div>
                <span className="text-[8px] sm:text-[11px] font-black uppercase tracking-widest text-white/40 group-hover:text-amber-400/80 transition-colors duration-500">Targets</span>
              </button>

              {/* Ingest */}
              <button 
                onClick={() => { fileInputRef.current?.click(); haptic('medium'); }}
                className="group relative flex flex-col items-center gap-3 sm:gap-4 transition-all duration-500 active:scale-90"
              >
                <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center">
                  <div className="absolute inset-0 bg-blue-500/10 rounded-2xl sm:rounded-3xl blur-lg sm:blur-xl group-hover:bg-blue-500/30 transition-all duration-700 opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-white/[0.02] border border-white/[0.05] rounded-2xl sm:rounded-3xl backdrop-blur-md group-hover:border-blue-500/40 transition-all duration-500 group-hover:bg-blue-500/10" />
                  {isImporting ? (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin relative z-10" />
                  ) : (
                    <FileSpreadsheet className="w-7 h-7 sm:w-9 sm:h-9 text-blue-500/40 group-hover:text-blue-400 group-hover:scale-110 transition-all duration-500 relative z-10" />
                  )}
                </div>
                <span className="text-[8px] sm:text-[11px] font-black uppercase tracking-widest text-white/40 group-hover:text-blue-400/80 transition-colors duration-500">Ingest</span>
              </button>

              {/* Backup */}
              <button 
                onClick={() => { handleExportJSON(); haptic('medium'); }} 
                className="group relative flex flex-col items-center gap-3 sm:gap-4 transition-all duration-500 active:scale-90"
              >
                <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center">
                  <div className="absolute inset-0 bg-amber-500/10 rounded-2xl sm:rounded-3xl blur-lg sm:blur-xl group-hover:bg-amber-500/30 transition-all duration-700 opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-white/[0.02] border border-white/[0.05] rounded-2xl sm:rounded-3xl backdrop-blur-md group-hover:border-amber-500/40 transition-all duration-500 group-hover:bg-amber-500/10" />
                  <Download className="w-7 h-7 sm:w-9 sm:h-9 text-amber-500/40 group-hover:text-amber-400 group-hover:scale-110 transition-all duration-500 relative z-10" />
                </div>
                <span className="text-[8px] sm:text-[11px] font-black uppercase tracking-widest text-white/40 group-hover:text-amber-400/80 transition-colors duration-500">Backup</span>
              </button>

              {/* Restore */}
              <label 
                className="group relative flex flex-col items-center gap-3 sm:gap-4 transition-all duration-500 active:scale-90 cursor-pointer"
                onClick={() => haptic('light')}
              >
                <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center">
                  <div className="absolute inset-0 bg-amber-500/10 rounded-2xl sm:rounded-3xl blur-lg sm:blur-xl group-hover:bg-amber-500/30 transition-all duration-700 opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-white/[0.02] border border-white/[0.05] rounded-2xl sm:rounded-3xl backdrop-blur-md group-hover:border-amber-500/40 transition-all duration-500 group-hover:bg-amber-500/10" />
                  <Upload className="w-7 h-7 sm:w-9 sm:h-9 text-amber-500/40 group-hover:text-amber-400 group-hover:scale-110 transition-all duration-500 relative z-10" />
                </div>
                <span className="text-[8px] sm:text-[11px] font-black uppercase tracking-widest text-white/40 group-hover:text-amber-400/80 transition-colors duration-500">Restore</span>
                <input type="file" className="hidden" accept=".json" onChange={handleImportJSON} />
              </label>

              {/* About */}
              <button 
                onClick={() => { setShowAbout(true); haptic('medium'); }} 
                className="group relative flex flex-col items-center gap-3 sm:gap-4 transition-all duration-500 active:scale-90"
              >
                <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center">
                  <div className="absolute inset-0 bg-primary/10 rounded-2xl sm:rounded-3xl blur-lg sm:blur-xl group-hover:bg-primary/30 transition-all duration-700 opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-white/[0.02] border border-white/[0.05] rounded-2xl sm:rounded-3xl backdrop-blur-md group-hover:border-primary/40 transition-all duration-500 group-hover:bg-primary/10" />
                  <Info className="w-7 h-7 sm:w-9 sm:h-9 text-primary/40 group-hover:text-primary group-hover:scale-110 transition-all duration-500 relative z-10" />
                </div>
                <span className="text-[8px] sm:text-[11px] font-black uppercase tracking-widest text-white/40 group-hover:text-primary transition-colors duration-500">About</span>
              </button>

              {/* Cloud Sync (Gmail) */}
              <button 
                onClick={() => {
                  if (user) {
                    // Option to sign out or just show status
                    if (window.confirm(`Logged in as ${user.email}. Do you want to sign out?`)) {
                      handleSignOut();
                    }
                  } else {
                    handleGoogleSignIn();
                  }
                }}
                className="group relative flex flex-col items-center gap-3 sm:gap-4 transition-all duration-500 active:scale-90"
              >
                <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center">
                  <div className={cn(
                    "absolute inset-0 rounded-2xl sm:rounded-3xl blur-lg sm:blur-xl transition-all duration-700 opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-110",
                    user ? "bg-emerald-500/10 group-hover:bg-emerald-500/30" : "bg-indigo-500/10 group-hover:bg-indigo-500/30"
                  )} />
                  <div className={cn(
                    "absolute inset-0 bg-white/[0.02] border border-white/[0.05] rounded-2xl sm:rounded-3xl backdrop-blur-md transition-all duration-500",
                    user ? "group-hover:border-emerald-500/40 group-hover:bg-emerald-500/10" : "group-hover:border-indigo-500/40 group-hover:bg-indigo-500/10"
                  )} />
                  {isSyncing ? (
                    <RefreshCcw className="w-7 h-7 sm:w-9 sm:h-9 text-indigo-400 animate-spin relative z-10" />
                  ) : (
                    <Cloud className={cn(
                      "w-7 h-7 sm:w-9 sm:h-9 transition-all duration-500 relative z-10",
                      user ? "text-emerald-500/40 group-hover:text-emerald-400 group-hover:scale-110" : "text-indigo-500/40 group-hover:text-indigo-400 group-hover:scale-110"
                    )} />
                  )}
                </div>
                <span className={cn(
                  "text-[8px] sm:text-[11px] font-black uppercase tracking-widest transition-colors duration-500",
                  user ? "text-emerald-400/80" : "text-white/40 group-hover:text-indigo-400/80"
                )}>
                  {user ? 'Synced' : 'Cloud Sync'}
                </span>
                {user && (
                  <span className="absolute -bottom-4 text-[7px] text-white/40 font-medium truncate max-w-[60px]">
                    {user.email?.split('@')[0]}
                  </span>
                )}
              </button>

              {/* Refresh System */}
              <button 
                onClick={() => {
                  haptic('medium');
                  setConfirmAction({
                    type: 'reload',
                    title: 'System Reload',
                    message: 'This will refresh the application state. Current session data may be reset.'
                  });
                }}
                className="group relative flex flex-col items-center gap-3 sm:gap-4 transition-all duration-500 active:scale-90"
              >
                <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center">
                  <div className="absolute inset-0 bg-sky-500/10 rounded-2xl sm:rounded-3xl blur-lg sm:blur-xl group-hover:bg-sky-500/30 transition-all duration-700 opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-white/[0.02] border border-white/[0.05] rounded-2xl sm:rounded-3xl backdrop-blur-md group-hover:border-sky-500/40 transition-all duration-500 group-hover:bg-sky-500/10" />
                  <RotateCcw className="w-7 h-7 sm:w-9 sm:h-9 text-sky-500/40 group-hover:text-sky-400 group-hover:scale-110 transition-all duration-500 relative z-10" />
                </div>
                <span className="text-[8px] sm:text-[11px] font-black uppercase tracking-widest text-white/40 group-hover:text-sky-400/80 transition-colors duration-500">Refresh</span>
              </button>

              {/* Wipe All Data */}
              <button 
                onClick={() => { 
                  haptic('heavy'); 
                  setConfirmAction({
                    type: 'reset',
                    title: 'Danger Zone',
                    message: 'Are you absolutely sure? This will permanently delete ALL trade records and reset capital settings.'
                  });
                }}
                className="group relative flex flex-col items-center gap-3 sm:gap-4 transition-all duration-500 active:scale-90"
              >
                <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center">
                  <div className="absolute inset-0 bg-rose-500/10 rounded-2xl sm:rounded-3xl blur-lg sm:blur-xl group-hover:bg-rose-500/30 transition-all duration-700 opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-white/[0.02] border border-white/[0.05] rounded-2xl sm:rounded-3xl backdrop-blur-md group-hover:border-rose-500/40 transition-all duration-500 group-hover:bg-rose-500/10" />
                  <Trash2 className="w-7 h-7 sm:w-9 sm:h-9 text-rose-500/40 group-hover:text-rose-400 group-hover:scale-110 transition-all duration-500 relative z-10" />
                </div>
                <span className="text-[8px] sm:text-[11px] font-black uppercase tracking-widest text-white/40 group-hover:text-rose-400/80 transition-colors duration-500">Wipe All</span>
              </button>
            </div>

            {/* Logout - Prominent at bottom */}
            <div className="mt-24 sm:mt-32 pb-8 flex flex-col items-center">
              <div className="w-full max-w-[200px] h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent mb-12" />
              <button 
                onClick={() => { setIsLocked(true); haptic('heavy'); }}
                className="group relative flex flex-col items-center gap-4 transition-all duration-500 active:scale-95"
              >
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
                  <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl group-hover:bg-red-500/40 transition-all duration-700 opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-125" />
                  <div className="absolute inset-0 bg-white/[0.02] border border-white/[0.05] rounded-full backdrop-blur-xl group-hover:border-red-500/40 transition-all duration-500 group-hover:bg-red-500/10 shadow-2xl" />
                  <LogOut className="w-9 h-9 sm:w-11 sm:h-11 text-red-500/40 group-hover:text-red-500 group-hover:scale-110 transition-all duration-500 relative z-10 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] sm:text-[13px] font-black uppercase tracking-[0.4em] text-white/40 group-hover:text-red-500 transition-colors duration-500">Sign Out</span>
                  <div className="w-0 group-hover:w-full h-[1px] bg-red-500/50 transition-all duration-500 rounded-full" />
                </div>
              </button>
            </div>

            {/* About Modal */}
            {showAbout && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-500">
                <div className="relative w-full max-w-sm bg-[#0A0A0C] border border-white/[0.05] rounded-[2.5rem] p-10 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                  {/* Background Logo */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                    <img src={logo} alt="MAK GROUP" className="w-[120%] h-[120%] object-contain rotate-[-15deg]" />
                  </div>

                  <button 
                    onClick={() => { setShowAbout(false); haptic('light'); }}
                    className="absolute top-6 right-6 w-10 h-10 bg-white/[0.02] border border-white/[0.05] rounded-full flex items-center justify-center text-white/20 hover:text-white/40 transition-all z-20 active:scale-90"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-24 h-24 mb-8 flex items-center justify-center">
                      <img src={logo} alt="MAK GROUP" className="w-20 h-20 object-contain" />
                    </div>

                    <h3 className="text-2xl font-black text-white mb-2 tracking-tighter text-center uppercase">FOX TRADE</h3>
                    <div className="h-1 w-12 bg-primary rounded-full mb-8 shadow-[0_0_15px_rgba(255,184,0,0.4)]" />

                    <div className="space-y-6 text-center px-4">
                      <p className="text-[11px] font-medium text-white/60 lowercase tracking-widest leading-relaxed">
                        all intellectual property rights for this software<br />
                        are exclusively reserved for <span className="text-primary uppercase font-black tracking-normal text-[9px]">MAK GROUP</span>
                      </p>

                      <div className="pt-6 border-t border-white/[0.05]">
                        <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.5em]">© 2026 Exclusive Rights</p>
                      </div>
                    </div>

                    <button 
                      onClick={() => { setShowAbout(false); haptic('medium'); }}
                      className="w-full mt-10 py-5 bg-primary text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-[0_10px_30px_rgba(255,184,0,0.2)] active:scale-95 transition-all"
                    >
                      Close Portal
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Confirmation Modal */}
            {confirmAction && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
                <div className="w-full max-w-xs bg-[#0A0A0C] border border-white/[0.05] rounded-[2.5rem] p-8 shadow-2xl scale-in-center">
                  <div className={cn(
                    "w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 border animate-pulse",
                    confirmAction.type === 'reset' ? "bg-rose-500/10 border-rose-500/20" : "bg-sky-500/10 border-sky-500/20"
                  )}>
                    <RotateCcw className={cn("w-8 h-8", confirmAction.type === 'reset' ? "text-rose-500" : "text-sky-500")} />
                  </div>
                  <h3 className="text-xl font-black text-white mb-2 tracking-tighter text-center">{confirmAction.title}</h3>
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-8 text-center leading-relaxed px-4">
                    {confirmAction.message}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => { setConfirmAction(null); haptic('light'); }}
                      className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] text-white/60 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors active:scale-95"
                    >
                      Abort
                    </button>
                    <button 
                      onClick={() => {
                        haptic('heavy');
                        if (confirmAction.type === 'reload') {
                          localStorage.clear();
                          sessionStorage.clear();
                          window.location.href = window.location.origin + window.location.pathname + '?force=' + Date.now();
                        } else {
                          handleResetAllData();
                        }
                        setConfirmAction(null);
                      }}
                      className={cn(
                        "p-4 rounded-2xl text-black text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg",
                        confirmAction.type === 'reset' ? "bg-rose-500 shadow-rose-500/20" : "bg-sky-500 shadow-sky-500/20"
                      )}
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Password Change Modal */}
            {isChangingPass && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                <div className="w-full max-w-sm bg-[#0A0A0C] border border-white/[0.05] rounded-[2rem] p-10 shadow-2xl scale-in-center">
                  <div className="w-16 h-16 bg-white/[0.02] border border-white/[0.05] rounded-3xl flex items-center justify-center mx-auto mb-8">
                    <Lock className="w-8 h-8 text-primary/60" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2 tracking-tighter text-center">Security Hub</h3>
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] mb-10 text-center">Set 4-digit master code</p>
                  
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="••••"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-white/[0.01] border border-white/[0.05] rounded-[1.8rem] p-6 text-center text-4xl tracking-[0.5em] font-black text-white focus:outline-none focus:border-primary/20 transition-all mb-10"
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => { setIsChangingPass(false); setNewPass(''); haptic('light'); }}
                      className="p-5 rounded-[1.2rem] bg-white/[0.03] border border-white/[0.05] text-white/60 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors active:scale-95"
                    >
                      Abort
                    </button>
                    <button 
                      onClick={() => {
                        if (newPass.length === 4) {
                          localStorage.setItem('app_passcode', newPass);
                          setPassword(newPass);
                          setIsChangingPass(false);
                          setNewPass('');
                          haptic('medium');
                        }
                      }}
                      className="p-5 rounded-[1.2rem] bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity active:scale-95 shadow-[0_10px_30px_rgba(255,184,0,0.15)]"
                    >
                      Execute
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Targets Editing Modal */}
            {isEditingTargets && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                <div className="w-full max-w-sm bg-[#0A0A0C] border border-white/[0.05] rounded-[2rem] p-10 shadow-2xl scale-in-center">
                  <div className="w-16 h-16 bg-white/[0.02] border border-white/[0.05] rounded-3xl flex items-center justify-center mx-auto mb-8">
                    <Trophy className="w-8 h-8 text-amber-500/60" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2 tracking-tighter text-center">Profit Targets</h3>
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-10 text-center leading-relaxed">Set Your Ambitions</p>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl mb-4">
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Show on Home</span>
                      <button 
                        onClick={() => { setShowTargetsOnHome(!showTargetsOnHome); haptic('light'); }}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all duration-300 relative",
                          showTargetsOnHome ? "bg-amber-500" : "bg-white/10"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300",
                          showTargetsOnHome ? "left-7" : "left-1"
                        )} />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-2">Weekly Target ($)</label>
                      <input 
                        type="number" 
                        defaultValue={weeklyTarget}
                        className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 text-center text-3xl font-black text-white tracking-tight focus:outline-none focus:border-amber-500/50 transition-all"
                        onChange={(e) => setWeeklyTarget(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-2">Monthly Target ($)</label>
                      <input 
                        type="number" 
                        defaultValue={monthlyTarget}
                        className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 text-center text-3xl font-black text-white tracking-tight focus:outline-none focus:border-amber-500/50 transition-all"
                        onChange={(e) => setMonthlyTarget(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    
                    <button 
                      onClick={() => { setIsEditingTargets(false); haptic('heavy'); }}
                      className="w-full p-5 rounded-2xl bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition-all mt-4"
                    >
                      Save Targets
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="h-screen bg-[#050507] font-sans selection:bg-primary/30 antialiased relative flex flex-col overflow-hidden">
      {/* iOS Glass Header - Fixed at top with safe area padding */}
      <div className="fixed top-0 left-0 right-0 z-[60] backdrop-blur-3xl bg-black/60 border-b border-white/5">
        <div className="h-[env(safe-area-inset-top)] w-full" /> {/* Safe Area Spacer */}
        <div className="h-4 w-full" /> {/* Additional spacing requested by user */}
      </div>
      
      {/* Premium Background Design - Pure Minimalist Dark */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#050507]">
        <BackgroundSplitLogo />
        {/* Grain/Noise Texture for Premium Feel */}
        <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      {isLocked && <LockScreen onUnlock={() => setIsLocked(false)} />}
      
      {/* Hidden Share Card for Capture */}
      <ShareCard 
        cardRef={shareCardRef}
        data={{
          totalProfit: stats.totalProfit,
          growthPercentage: parseFloat(((stats.totalProfit / initialCapital) * 100).toFixed(1)),
          winRate: stats.winRate,
          currentCapital: currentCapital,
          period: 'Overall',
          healthScore: geniusMetrics.healthScore
        }}
      />

      {/* Main Content Area */}
       <main className="flex-1 overflow-y-auto relative z-10 pt-[calc(env(safe-area-inset-top)+2rem)] px-4 sm:px-6 custom-scroll pb-44">
        <div className="relative z-10 max-w-[1400px] mx-auto">
          {renderTabContent()}
        </div>
      </main>

      {/* iOS 26 Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/[0.01] backdrop-blur-[50px] border-t border-white/[0.08] px-2 sm:px-8 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 flex items-center justify-between shadow-[0_-20px_50px_rgba(0,0,0,0.4)]">
        <button onClick={() => { setActiveTab('home'); haptic('light'); }} className="flex-1 flex justify-center group py-1">
          <div className={cn(
            "p-2.5 sm:p-3.5 transition-all duration-300 rounded-[1.2rem] sm:rounded-[1.5rem] flex items-center justify-center min-w-[50px] sm:min-w-[70px]",
            activeTab === 'home' 
              ? "bg-white/[0.08] text-white shadow-xl scale-110 border border-white/10" 
              : "text-white/20 group-hover:text-white/40"
          )}>
            <LayoutGrid className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
        </button>
        <button onClick={() => { setActiveTab('analytics'); haptic('light'); }} className="flex-1 flex justify-center group py-1">
          <div className={cn(
            "p-2.5 sm:p-3.5 transition-all duration-300 rounded-[1.2rem] sm:rounded-[1.5rem] flex items-center justify-center min-w-[50px] sm:min-w-[70px]",
            activeTab === 'analytics' 
              ? "bg-white/[0.08] text-white shadow-xl scale-110 border border-white/10" 
              : "text-white/20 group-hover:text-white/40"
          )}>
            <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
        </button>

        {/* Central Add Button (Now MT5 Import) */}
        <div className="flex-1 flex items-center justify-center -mt-8 sm:-mt-12">
          <button 
            onClick={() => { fileInputRef.current?.click(); haptic('medium'); }}
            className="w-16 h-16 sm:w-20 sm:h-20 bg-white/[0.03] backdrop-blur-[40px] rounded-[1.8rem] sm:rounded-[2.2rem] p-3 sm:p-4 border border-white/[0.12] shadow-[0_20px_40px_rgba(0,0,0,0.6)] active:scale-90 transition-all duration-300 flex items-center justify-center group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <img src={logo} alt="Logo" className="w-full h-full object-contain relative z-10 group-hover:scale-110 transition-transform duration-500" />
            <input 
              type="file" 
              ref={fileInputRef}
              className="hidden" 
              accept=".xlsx,.xls" 
              onChange={handleImportMT5} 
            />
          </button>
        </div>

        <button onClick={() => { setActiveTab('reports'); haptic('light'); }} className="flex-1 flex justify-center group py-1">
          <div className={cn(
            "p-2.5 sm:p-3.5 transition-all duration-300 rounded-[1.2rem] sm:rounded-[1.5rem] flex items-center justify-center min-w-[50px] sm:min-w-[70px]",
            activeTab === 'reports' 
              ? "bg-white/[0.08] text-white shadow-xl scale-110 border border-white/10" 
              : "text-white/20 group-hover:text-white/40"
          )}>
            <FileSpreadsheet className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
        </button>

        <button onClick={() => { setActiveTab('settings'); haptic('light'); }} className="flex-1 flex justify-center group py-1">
          <div className={cn(
            "p-2.5 sm:p-3.5 transition-all duration-300 rounded-[1.2rem] sm:rounded-[1.5rem] flex items-center justify-center min-w-[50px] sm:min-w-[70px]",
            activeTab === 'settings' 
              ? "bg-white/[0.05] text-white shadow-xl scale-110 border border-white/10" 
              : "text-white/20 group-hover:text-white/40"
          )}>
            <Settings className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
        </button>
      </nav>

      {/* MT5 Import Preview Modal */}
      {mt5Preview && (
        <>
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[130] animate-fade-in" onClick={() => setMt5Preview(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[140] w-[95%] max-w-lg bg-[#0A0A0C] border border-white/10 rounded-[2.5rem] p-8 animate-in zoom-in duration-300 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            
            <div className="flex flex-col items-center mb-10 pt-4 relative">
              <button 
                onClick={() => { setMt5Preview(null); haptic('light'); }} 
                className="absolute -top-2 -right-2 w-8 h-8 bg-white/[0.03] border border-white/[0.05] rounded-full flex items-center justify-center text-white/20 hover:text-white/40 transition-all z-20"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-24 h-24 mb-4 relative flex items-center justify-center">
                  <img src={logo} alt="Logo" className="w-full h-full object-contain relative z-10 opacity-100" />
                </div>
              
              <div className="flex flex-col items-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/[0.02] border border-white/[0.05] rounded-full backdrop-blur-md mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse" />
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30">Data Ingestion</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 text-left relative overflow-hidden">
                <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1 text-left">Trade Performance</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-black text-white">{mt5Preview.tradeCount}</p>
                  <p className="text-[10px] font-bold text-white/20 uppercase">Total</p>
                </div>
                <div className="flex gap-3 mt-2">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                    <span className="text-[10px] font-black text-green-500/50">{mt5Preview.winCount}W</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                    <span className="text-[10px] font-black text-red-500/50">{mt5Preview.lossCount}L</span>
                  </div>
                </div>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 text-left relative overflow-hidden">
                <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1 text-left">Net Result</p>
                <p className={cn("text-2xl font-black", mt5Preview.totalProfit >= 0 ? "text-green-500/70" : "text-red-500/70")}>
                  ${mt5Preview.totalProfit.toLocaleString()}
                </p>
                <div className="mt-2 flex items-center gap-1">
                  <div className={cn("w-1 h-1 rounded-full", mt5Preview.totalProfit >= 0 ? "bg-green-500" : "bg-red-500")} />
                  <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Calculated P/L</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mb-8">
              <div className="flex-1 px-4 py-2 bg-white/[0.01] border border-white/[0.03] rounded-xl flex items-center justify-between">
                <span className="text-[8px] font-black text-white/10 uppercase tracking-widest">Commission</span>
                <span className="text-[10px] font-black text-red-500/40">${mt5Preview.totalCommission.toLocaleString()}</span>
              </div>
              <div className="flex-1 px-4 py-2 bg-white/[0.01] border border-white/[0.03] rounded-xl flex items-center justify-between">
                <span className="text-[8px] font-black text-white/10 uppercase tracking-widest">Swap</span>
                <span className="text-[10px] font-black text-white/40">${mt5Preview.totalSwap.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-3 mb-10">
              <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] text-left ml-1">Trade Sample (First 3)</p>
              {mt5Preview.trades.slice(0, 3).map((trade, i) => {
                const netTradeProfit = trade.profit;
                return (
                  <div key={i} className="flex items-center justify-between p-4 bg-white/[0.01] border border-white/[0.03] rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-1 h-8 rounded-full", netTradeProfit >= 0 ? "bg-green-500/30" : "bg-red-500/30")} />
                      <div className="text-left">
                        <p className="text-[11px] font-black text-white/80 uppercase">{trade.symbol}</p>
                        <p className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">{trade.type} // {trade.volume} Lot</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-black", netTradeProfit >= 0 ? "text-green-500/60" : "text-red-500/60")}>
                        {netTradeProfit >= 0 ? '+' : ''}{netTradeProfit.toFixed(2)}
                      </p>
                      <p className="text-[8px] font-bold text-white/10 uppercase">
                        Profit Only
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => { setMt5Preview(null); haptic('light'); }}
                className="py-5 rounded-2xl bg-white/[0.03] border border-white/[0.05] text-white/40 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button 
                onClick={confirmMT5Import}
                className="py-5 rounded-2xl bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 shadow-[0_10px_30px_rgba(255,184,0,0.15)]"
              >
                Import All
              </button>
            </div>
          </div>
        </>
      )}

      {/* Geometric Initial Capital Modal */}
      {isEditingInitial && (
        <>
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[110] animate-fade-in" onClick={() => setIsEditingInitial(false)} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[120] w-[90%] max-w-sm bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-10 animate-in zoom-in duration-300 shadow-2xl">
            <div className="w-16 h-16 bg-white/[0.02] border border-white/[0.05] rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Wallet className="w-8 h-8 text-white/20" />
            </div>
            <h3 className="text-xl font-black text-center mb-2 text-white tracking-tighter">Portfolio Base</h3>
            <p className="text-[10px] font-black text-center mb-8 text-white/20 uppercase tracking-widest">Set starting balance</p>
            
            <div className="relative mb-8">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-white/10">$</span>
              <input 
                type="number" 
                value={initialCapital} 
                onChange={(e) => setInitialCapital(parseFloat(e.target.value) || 0)}
                className="w-full bg-white/[0.01] border border-white/[0.05] rounded-[1.8rem] p-8 text-center text-4xl font-black text-white outline-none focus:border-primary/20 transition-all"
                autoFocus
              />
            </div>

            <button 
              onClick={() => { setIsEditingInitial(false); haptic('medium'); }}
              className="w-full py-5 bg-primary text-black rounded-[1.2rem] font-black uppercase tracking-[0.2em] text-xs shadow-[0_10px_30px_rgba(255,184,0,0.2)] active:scale-95 transition-all"
            >
              Update Ledger
            </button>
          </div>
        </>
      )}

      {/* System Stats Footer */}
      <div className="mt-12 mb-24 flex flex-col items-center gap-4">
        <div className="px-4 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.05] backdrop-blur-md">
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">
            System Engine <span className="text-primary/40 ml-2">v26.1</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
