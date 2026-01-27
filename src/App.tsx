import { useState, useEffect, useMemo, useRef } from 'react';
// Force Update v36.0
import { Wallet, RotateCcw, Download, Upload, Lock, LayoutGrid, BarChart3, Settings, X, Clock, FileSpreadsheet, TrendingUp, TrendingDown, LogOut, AlertTriangle, Target, Trophy, Info, Trash2, Cloud, RefreshCcw, Share2, Sparkles, Bell, BellOff, Sun, Moon, FileText, Calendar, UserCircle } from 'lucide-react';
import { cn, haptic } from './lib/utils';
import { type DailyRecord, type MT5Trade } from './types';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import { calculateStatistics, getPeriodStats, getSmartInsights, calculateSessionStats } from './lib/statistics';
import { StatsOverview } from './components/StatsOverview';
import logo from './assets/app-logo-new.png';
import background from './assets/background.png';
import { LockScreen } from './components/LockScreen';
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
import { doc, setDoc, getDoc } from 'firebase/firestore';

type Tab = 'home' | 'analytics' | 'reports' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [isLocked, setIsLocked] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [theme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    document.documentElement.classList.remove('light');
    localStorage.setItem('app_theme', 'dark');
  }, []);

  useEffect(() => {
    let ticking = false;
    const handleScroll = (e: Event) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const target = e.target as HTMLElement;
          const currentScroll = target === document as any ? document.documentElement.scrollTop : (target.scrollTop || 0);
          
          if (currentScroll > 2) {
            setIsScrolled(true);
          } else {
            setIsScrolled(false);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, []);

  useEffect(() => {
    setIsScrolled(false);
    window.scrollTo(0, 0);
    // Also scroll the main element if it's the scrollable one
    const main = document.querySelector('main');
    if (main) main.scrollTo(0, 0);
  }, [activeTab]);

  const [, setPassword] = useState(() => localStorage.getItem('app_passcode') || '2525');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ type: 'reload' | 'reset' | 'reset_reports' | 'reset_reports_date', title: string, message: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [profileImgError, setProfileImgError] = useState(false);
  const isSyncingFromCloudRef = useRef(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const getFormattedDate = (dateStr: string) => {
    if (!dateStr) return '';
    // Handle ISO format (2024-01-27T...) or MT5 format (2024.01.27 12:00:00)
    if (dateStr.includes('T')) {
      return dateStr.split('T')[0];
    }
    // MT5 format usually uses dots or spaces
    return dateStr.split(' ')[0].replace(/\./g, '-');
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const sessions = useMemo(() => {
    const getSessionStatus = (start: number, end: number, current: number) => {
      if (start < end) return current >= start && current < end;
      return current >= start || current < end; // For sessions crossing midnight
    };

    const currentHour = currentTime.getHours(); // Use local computer time
    
    const formatTime = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;

    // Local times based on user request (Sydney 01:00 - 10:00, London 11:00 - 19:00, etc.)
    return [
      { 
        name: 'London', 
        start: 11, 
        end: 19, 
        active: getSessionStatus(11, 19, currentHour),
        timeDisplay: `${formatTime(11)} - ${formatTime(19)}`
      },
      { 
        name: 'New York', 
        start: 16, 
        end: 0, 
        active: getSessionStatus(16, 0, currentHour),
        timeDisplay: `${formatTime(16)} - 00:00`
      },
      { 
        name: 'Tokyo', 
        start: 3, 
        end: 12, 
        active: getSessionStatus(3, 12, currentHour),
        timeDisplay: `${formatTime(3)} - ${formatTime(12)}`
      },
      { 
        name: 'Sydney', 
        start: 1, 
        end: 10, 
        active: getSessionStatus(1, 10, currentHour),
        timeDisplay: `${formatTime(1)} - ${formatTime(10)}`
      }
    ];
  }, [currentTime]);

  const [records, setRecords] = useState<DailyRecord[]>(() => {
    const saved = localStorage.getItem('trade_records');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as DailyRecord[];
      return parsed.map(r => ({
        ...r,
        id: r.id || crypto.randomUUID(),
        updatedAt: r.updatedAt || Date.now()
      }));
    } catch (e) {
      return [];
    }
  });

  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number>(() => {
    const saved = localStorage.getItem('last_sync_timestamp');
    return saved ? parseInt(saved) : 0;
  });

  const recordsRef = useRef<DailyRecord[]>(records);
  const lastLocalUpdateTimeRef = useRef<number>(0); // Initialize to 0, only update on local changes
  
  useEffect(() => {
      recordsRef.current = records;
      if (!isSyncingFromCloudRef.current) {
        lastLocalUpdateTimeRef.current = Date.now();
      }
    }, [records]);

  useEffect(() => {
    if (lastSyncTimestamp) {
      localStorage.setItem('last_sync_timestamp', lastSyncTimestamp.toString());
    }
  }, [lastSyncTimestamp]);

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return 'Notification' in window && Notification.permission === 'granted';
  });

  // Function to send local notifications
  const sendNotification = (title: string, body: string) => {
    console.log(`Attempting to send notification: "${title}" - "${body}"`);
    
    if (!('Notification' in window)) {
      console.warn('Notifications not supported in this browser');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.warn(`Notification permission not granted (current: ${Notification.permission})`);
      return;
    }

    if (!notificationsEnabled) {
      console.warn('Notifications are disabled in app settings');
      return;
    }

    try {
      new Notification(title, {
        body,
        icon: logo
      });
      haptic('medium');
      console.log('Notification sent successfully');
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support notifications.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      console.log(`Notification permission requested: ${permission}`);
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        sendNotification('Notifications Enabled', 'You will now receive alerts regarding trading sessions and synchronization.');
      } else {
        setNotificationsEnabled(false);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const prevMinute = currentTime.getMinutes();
      setCurrentTime(now);

      // Check for market session starts only if minute changed
      if (now.getMinutes() !== prevMinute && notificationsEnabled) {
        const hour = now.getHours();
        const minute = now.getMinutes();

        // Market session starts (Beirut Time)
        if (hour === 11 && minute === 0) sendNotification('London Session', 'London session has started! Time for liquidity.');
        if (hour === 16 && minute === 0) sendNotification('New York Session', 'New York session has started! Get ready for high volatility.');
        if (hour === 3 && minute === 0) sendNotification('Tokyo Session', 'Tokyo session has started.');
        if (hour === 1 && minute === 0) sendNotification('Sydney Session', 'Sydney session has started.');
      }
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, [currentTime, notificationsEnabled]);

  const [initialCapital, setInitialCapital] = useState<number>(() => {
    const saved = localStorage.getItem('initial_capital');
    return saved ? parseFloat(saved) : 1000;
  });

  const [currentCapital, setCurrentCapital] = useState<number>(initialCapital);
  const [isAddingWithdrawal, setIsAddingWithdrawal] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalNote, setWithdrawalNote] = useState('');
  const [isEditingInitial, setIsEditingInitial] = useState(false);
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

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
      return Array.from(uniqueMap.values()).map(t => ({
        ...t,
        updatedAt: t.updatedAt || Date.now()
      }));
    } catch (e) {
      return [];
    }
  });

  const reportTradesRef = useRef<MT5Trade[]>(reportTrades);
  useEffect(() => {
    reportTradesRef.current = reportTrades;
  }, [reportTrades]);
  const [reportSortOrder, setReportSortOrder] = useState<'desc' | 'asc'>('desc');
  const [reportDateFilter, setReportDateFilter] = useState<string>('');
  const [reportDeleteDate, setReportDeleteDate] = useState<string>('');
  const reportFilterInputRef = useRef<HTMLInputElement>(null);
  const reportDeleteInputRef = useRef<HTMLInputElement>(null);
  const [reportSearchQuery] = useState<string>('');
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
      let errorMessage = 'Google sign-in failed.';
      
      if (error.code === 'auth/unauthorized-domain') {
        errorMessage += '\n\nThis domain is not authorized in Firebase. Please make sure "localhost" is added to Authorized Domains.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage += '\n\nPopup blocked. Please allow popups for this application.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage += '\n\nGoogle sign-in is not enabled in your Firebase project.';
      } else {
        errorMessage += `\n\nError details: ${error.message || 'Unknown error'}`;
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

  // Sync logic: Manual Cloud Fetch
  const handleManualSync = async () => {
    if (!user) {
      alert('Please sign in to sync with cloud.');
      return;
    }

    try {
      haptic('medium');
      setIsSyncing(true);
      const docRef = doc(db, 'users', user.uid);
      const snapshot = await getDoc(docRef);
      
      if (snapshot.exists()) {
        const cloudData = snapshot.data();
        console.log("Manual sync: Data received from cloud");
        
        // Set flag to prevent push back to cloud
        isSyncingFromCloudRef.current = true;

        if (cloudData.records) {
          const cloudRecords = cloudData.records as DailyRecord[];
          const merged = new Map<string, DailyRecord>();
          
          // Add local records
          records.forEach(r => merged.set(r.id, r));
          
          // Merge cloud records
          cloudRecords.forEach(r => {
            const existing = merged.get(r.id);
            if (!existing || (r.updatedAt || 0) > (existing.updatedAt || 0)) {
              merged.set(r.id, r);
            }
          });
          
          const finalRecords = Array.from(merged.values()).sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );

          const oldLength = records.length;
          const newLength = finalRecords.length;
          if (newLength > oldLength) {
            sendNotification('Sync Complete', `${newLength - oldLength} new records imported from cloud.`);
          }
          setRecords(finalRecords);
          localStorage.setItem('trade_records', JSON.stringify(finalRecords));
        }
        if (cloudData.initialCapital) {
          setInitialCapital(cloudData.initialCapital);
          localStorage.setItem('initial_capital', cloudData.initialCapital.toString());
        }
        if (cloudData.reportTrades) {
          const cloudTrades = cloudData.reportTrades as MT5Trade[];
          const merged = new Map<string, MT5Trade>();
          
          // Add local trades
          reportTrades.forEach(t => merged.set(t.positionId, t));
          
          // Merge cloud trades
          cloudTrades.forEach(t => {
            const existing = merged.get(t.positionId);
            if (!existing || (t.updatedAt || 0) > (existing.updatedAt || 0)) {
              merged.set(t.positionId, t);
            }
          });
          
          const finalTrades = Array.from(merged.values()).sort((a, b) => 
            new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime()
          );

          setReportTrades(finalTrades);
          localStorage.setItem('report_trades', JSON.stringify(finalTrades));
        }
        if (cloudData.weeklyTarget) {
          setWeeklyTarget(cloudData.weeklyTarget);
          localStorage.setItem('weekly_target', cloudData.weeklyTarget.toString());
        }
        if (cloudData.monthlyTarget) {
          setMonthlyTarget(cloudData.monthlyTarget);
          localStorage.setItem('monthly_target', cloudData.monthlyTarget.toString());
        }
        if (cloudData.showTargetsOnHome !== undefined) {
          setShowTargetsOnHome(cloudData.showTargetsOnHome);
          localStorage.setItem('show_targets_on_home', cloudData.showTargetsOnHome.toString());
        }
        
        const cloudLastSynced = cloudData.lastSynced ? new Date(cloudData.lastSynced).getTime() : Date.now();
        setLastSyncTimestamp(cloudLastSynced);
        
        setTimeout(() => {
          isSyncingFromCloudRef.current = false;
        }, 5000);
        
        sendNotification('Sync Successful', 'Your data is now up to date with the cloud.');
      } else {
        // If doc doesn't exist, push current local data to create it
        const now = new Date().toISOString();
        await setDoc(docRef, {
          records,
          initialCapital,
          reportTrades,
          weeklyTarget,
          monthlyTarget,
          showTargetsOnHome,
          lastSynced: now
        });
        setLastSyncTimestamp(new Date(now).getTime());
        sendNotification('Cloud Initialized', 'Your local data has been backed up to the cloud.');
      }
    } catch (error) {
      console.error('Manual sync error:', error);
      alert('Failed to sync with cloud. Please check your connection.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Auth & Notifications Initialization
  useEffect(() => {
    // Check permission on mount and sync state
    if ('Notification' in window) {
      if (Notification.permission === 'granted' && !notificationsEnabled) {
        setNotificationsEnabled(true);
      } else if (Notification.permission !== 'granted' && notificationsEnabled) {
        setNotificationsEnabled(false);
      }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setProfileImgError(false);
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // Sync logic: Push to Firestore on local changes
  useEffect(() => {
    // Only push if there's a user and we're NOT currently syncing FROM cloud
    if (user && !isSyncing && !isSyncingFromCloudRef.current) {
      const syncData = async () => {
        try {
          setIsPushing(true);
          const docRef = doc(db, 'users', user.uid);
          const now = new Date().toISOString();
          await setDoc(docRef, {
            records,
            initialCapital,
            reportTrades,
            weeklyTarget,
            monthlyTarget,
            showTargetsOnHome,
            lastSynced: now
          }, { merge: true });
          setLastSyncTimestamp(new Date(now).getTime());
        } catch (error) {
          console.error('Sync to cloud error:', error);
        } finally {
          setIsPushing(false);
        }
      };
      
      const timeoutId = setTimeout(syncData, 2000); // Debounce sync
      return () => clearTimeout(timeoutId);
    }
  }, [records, initialCapital, reportTrades, weeklyTarget, monthlyTarget, showTargetsOnHome, user, isSyncing]);

  // Automatic Cloud Fetch every 30 seconds
  useEffect(() => {
    if (!user) return;

    let isFirstRun = true;

    const autoFetch = async () => {
      if (isSyncing || isPushing) return;
      
      // Skip auto-fetch if we recently updated locally (within last 15s) 
      // to avoid race conditions with deletions and local state updates
      // UNLESS it's the first run, then we always want to fetch
      if (!isFirstRun && Date.now() - lastLocalUpdateTimeRef.current < 15000) return;
      
      try {
        const docRef = doc(db, 'users', user.uid);
        const snapshot = await getDoc(docRef);
        
        if (snapshot.exists()) {
          const cloudData = snapshot.data();
          const cloudLastSynced = cloudData.lastSynced ? new Date(cloudData.lastSynced).getTime() : 0;

          // Sync if:
          // 1. It's the first run
          // 2. Cloud has newer data than our last successful sync
          const isCloudNewer = cloudLastSynced > lastSyncTimestamp;

          if (isFirstRun || isCloudNewer) { 
            // Deep check if data is actually different before notifying
            const hasRecordChanges = JSON.stringify(cloudData.records || []) !== JSON.stringify(records);
            const hasTradeChanges = JSON.stringify(cloudData.reportTrades || []) !== JSON.stringify(reportTrades);
            const hasSettingsChanges = 
              cloudData.initialCapital !== initialCapital ||
              cloudData.weeklyTarget !== weeklyTarget ||
              cloudData.monthlyTarget !== monthlyTarget ||
              cloudData.showTargetsOnHome !== showTargetsOnHome;

            const isDataDifferent = hasRecordChanges || hasTradeChanges || hasSettingsChanges;

            if (isDataDifferent) {
              console.log(isFirstRun ? 'Initial sync from cloud...' : 'Cloud has newer/different data, performing merge sync...');
              
              // Set flag to prevent push back to cloud
              isSyncingFromCloudRef.current = true;
              
              // 1. Sync Records with Merging
              if (cloudData.records) {
                const cloudRecords = cloudData.records as DailyRecord[];
                const merged = new Map<string, DailyRecord>();
                
                // Add local records
                records.forEach(r => merged.set(r.id, r));
                
                // Merge cloud records
                cloudRecords.forEach(r => {
                  const existing = merged.get(r.id);
                  if (!existing || (r.updatedAt || 0) > (existing.updatedAt || 0)) {
                    merged.set(r.id, r);
                  }
                });
                
                const finalRecords = Array.from(merged.values()).sort((a, b) => 
                  new Date(b.date).getTime() - new Date(a.date).getTime()
                );

                setRecords(finalRecords);
                localStorage.setItem('trade_records', JSON.stringify(finalRecords));
              }

              // 2. Sync Report Trades with Merging
              if (cloudData.reportTrades) {
                const cloudTrades = cloudData.reportTrades as MT5Trade[];
                const merged = new Map<string, MT5Trade>();
                
                // Add local trades
                reportTrades.forEach(t => merged.set(t.positionId, t));
                
                // Merge cloud trades
                cloudTrades.forEach(t => {
                  const existing = merged.get(t.positionId);
                  if (!existing || (t.updatedAt || 0) > (existing.updatedAt || 0)) {
                    merged.set(t.positionId, t);
                  }
                });
                
                const finalTrades = Array.from(merged.values()).sort((a, b) => 
                  new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime()
                );

                setReportTrades(finalTrades);
                localStorage.setItem('report_trades', JSON.stringify(finalTrades));
              }

              // 3. Sync Settings
              if (cloudData.initialCapital !== undefined) {
                setInitialCapital(cloudData.initialCapital);
                localStorage.setItem('initial_capital', cloudData.initialCapital.toString());
              }
              if (cloudData.weeklyTarget !== undefined) {
                setWeeklyTarget(cloudData.weeklyTarget);
                localStorage.setItem('weekly_target', cloudData.weeklyTarget.toString());
              }
              if (cloudData.monthlyTarget !== undefined) {
                setMonthlyTarget(cloudData.monthlyTarget);
                localStorage.setItem('monthly_target', cloudData.monthlyTarget.toString());
              }
              if (cloudData.showTargetsOnHome !== undefined) {
                setShowTargetsOnHome(cloudData.showTargetsOnHome);
                localStorage.setItem('show_targets_on_home', cloudData.showTargetsOnHome.toString());
              }

              if (!isFirstRun) {
                sendNotification('Cloud Sync', 'Data updated from other device.');
              }
              
              setLastSyncTimestamp(cloudLastSynced);
              
              // Reset flag after states are updated
              setTimeout(() => {
                isSyncingFromCloudRef.current = false;
              }, 5000);
            } else {
              // If data is identical, just update our local sync timestamp to match cloud
              setLastSyncTimestamp(cloudLastSynced);
            }
          }
        }
        isFirstRun = false;
      } catch (error) {
        console.error('Auto-fetch error:', error);
      }
    };

    autoFetch(); // Run immediately on mount
    const intervalId = setInterval(autoFetch, 30000); // 30 seconds
    return () => clearInterval(intervalId);
  }, [user]);

  useEffect(() => {
    localStorage.setItem('report_trades', JSON.stringify(reportTrades));
    lastLocalUpdateTimeRef.current = Date.now();
  }, [reportTrades]);

  useEffect(() => {
    // Force cache refresh by checking version
    // Fresh Start Version v36.0
    const CURRENT_VERSION = 'v36.0';
    const savedVersion = localStorage.getItem('app_version');
    
    if (savedVersion !== CURRENT_VERSION) {
      // DISABLED AUTO-RELOAD TO STOP LOOP
      localStorage.setItem('app_version', CURRENT_VERSION);
      console.log('Version updated to:', CURRENT_VERSION);
    }
  }, []);

  useEffect(() => {
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

  const stats = useMemo(() => calculateStatistics(records, initialCapital, reportTrades), [records, initialCapital, reportTrades]);
  const periodStats = useMemo(() => getPeriodStats(records), [records]);
  const sessionStats = useMemo(() => calculateSessionStats(reportTrades), [reportTrades]);
  const insights = useMemo(() => getSmartInsights(records, reportTrades), [records, reportTrades]);

  const targetProgress = useMemo(() => {
    // Helper to get profit for current week (UTC)
    const getWeeklyProfit = () => {
      const now = new Date();
      const startOfWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay()); // Sunday
      startOfWeek.setUTCHours(0, 0, 0, 0);
      
      return records.reduce((sum, record) => {
        if (record.type === 'withdrawal') return sum;
        const recordDate = new Date(record.date);
        if (recordDate.getTime() >= startOfWeek.getTime()) {
          return sum + record.profitLoss;
        }
        return sum;
      }, 0);
    };

    // Helper to get profit for current month (UTC)
    const getMonthlyProfit = () => {
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      
      return records.reduce((sum, record) => {
        if (record.type === 'withdrawal') return sum;
        const recordDate = new Date(record.date);
        if (recordDate.getTime() >= startOfMonth.getTime()) {
          return sum + record.profitLoss;
        }
        return sum;
      }, 0);
    };

    const weeklyProfit = getWeeklyProfit();
    const monthlyProfit = getMonthlyProfit();
    
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
  }, [records, weeklyTarget, monthlyTarget]);

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
    const recentRecords = records.filter(r => r.type !== 'withdrawal' && new Date(r.date) >= thirtyDaysAgo);
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

  const addWithdrawal = () => {
    const amount = parseFloat(withdrawalAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const newRecord: DailyRecord = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      profitLoss: -amount, // Withdrawal is a deduction
      capitalBefore: currentCapital,
      capitalAfter: currentCapital - amount,
      notes: withdrawalNote || 'Profit Withdrawal',
      type: 'withdrawal',
      updatedAt: Date.now()
    };

    setRecords(prev => [newRecord, ...prev]);
    setIsAddingWithdrawal(false);
    setWithdrawalAmount('');
    setWithdrawalNote('');
    haptic('heavy');
  };

  const deleteRecord = (id: string) => {
    setRecordToDelete(id);
    haptic('medium');
  };

  const confirmDelete = () => {
    if (recordToDelete) {
      setRecords(prev => prev.filter(r => r.id !== recordToDelete));
      setRecordToDelete(null);
      haptic('heavy');
    }
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
            const processedData = data.map((r: any) => ({
              ...r,
              id: r.id || crypto.randomUUID(),
              updatedAt: r.updatedAt || Date.now()
            }));
            setRecords(prev => [...processedData, ...prev]);
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
    setRecords([]);
    setInitialCapital(1000);
    localStorage.clear();
    window.location.reload();
  };

  const handleDeleteMT5Reports = () => {
    // Delete all report trades
    setReportTrades([]);
    
    // Also delete all corresponding DailyRecords (we'll keep manual ones if you prefer, 
    // but the user said "everything", so let's clear all MT5 related stuff)
    const updatedRecords = records.filter(record => !record.isMT5Import);
    setRecords(updatedRecords);

    localStorage.setItem('report_trades', JSON.stringify([]));
    localStorage.setItem('trade_records', JSON.stringify(updatedRecords));
    
    // Force immediate sync
    if (user) {
      const syncImmediately = async () => {
        try {
          setIsPushing(true);
          const docRef = doc(db, 'users', user.uid);
          await setDoc(docRef, {
            records: updatedRecords,
            reportTrades: [],
            lastSynced: new Date().toISOString()
          }, { merge: true });
        } catch (error) {
          console.error('Immediate sync error:', error);
        } finally {
          setIsPushing(false);
        }
      };
      syncImmediately();
    }
    
    haptic('heavy');
    sendNotification('Reports Cleared', 'All MT5 trade reports and corresponding history cards have been deleted.');
  };

  const handleDeleteMT5ReportsByDate = () => {
    if (!reportDeleteDate) return;
    
    // 1. Delete from reportTrades
    const updatedTrades = reportTrades.filter(trade => {
      return getFormattedDate(trade.closeTime) !== reportDeleteDate;
    });
    
    const deletedTradesCount = reportTrades.length - updatedTrades.length;
    
    // 2. Delete corresponding DailyRecords for this date
    // We remove the isMT5Import check to ensure everything for that date is cleared as requested
    const updatedRecords = records.filter(record => {
      const recordDate = getFormattedDate(record.date);
      return recordDate !== reportDeleteDate;
    });
    
    const deletedRecordsCount = records.length - updatedRecords.length;

    if (deletedTradesCount === 0 && deletedRecordsCount === 0) {
      sendNotification('No Reports Found', `No reports found for the date ${reportDeleteDate}.`);
      return;
    }
    
    // Update state and localStorage
    setReportTrades(updatedTrades);
    setRecords(updatedRecords);
    
    localStorage.setItem('report_trades', JSON.stringify(updatedTrades));
    localStorage.setItem('trade_records', JSON.stringify(updatedRecords));
    
    // Force immediate sync to cloud to prevent auto-fetch race condition
    if (user) {
      const syncImmediately = async () => {
        try {
          setIsPushing(true);
          const docRef = doc(db, 'users', user.uid);
          await setDoc(docRef, {
            records: updatedRecords,
            reportTrades: updatedTrades,
            lastSynced: new Date().toISOString()
          }, { merge: true });
        } catch (error) {
          console.error('Immediate sync error:', error);
        } finally {
          setIsPushing(false);
        }
      };
      syncImmediately();
    }
    
    haptic('heavy');
    sendNotification('Reports Cleared', `Deleted ${deletedTradesCount} trades and ${deletedRecordsCount} records for ${reportDeleteDate}.`);
    setReportDeleteDate('');
  };

  const handleImportMT5 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
          alert('Positions table not found. Please ensure you select a file containing the positions table.');
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
                status: (profit + commission + swap) > 0 ? 'Win' : 'Loss',
                updatedAt: Date.now()
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
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Import error:', error);
      alert('Error reading the Excel file. Please make sure it is a valid MT5 report.');
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
      const dateStr = getFormattedDate(trade.closeTime) || new Date().toISOString().split('T')[0];
      
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

    const newRecords: DailyRecord[] = Object.entries(groupedByDate).map(([date, data]) => {
      // Create a local date string to avoid UTC shifts
      const recordDate = `${date}T12:00:00.000Z`; // Set to noon to avoid day shifts in most timezones
      return {
        id: crypto.randomUUID(),
        date: recordDate,
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
        notes: `MT5 Import: ${data.count} trades (${data.winCount}W/${data.lossCount}L) - ${Array.from(data.symbols).join(', ')}`,
        updatedAt: Date.now()
      };
    });

    // Check for duplicates (existing records with same date)
    const existingDates = new Set(records.map(r => getFormattedDate(r.date)));
    const uniqueNewRecords = newRecords.filter(nr => {
      const d = getFormattedDate(nr.date);
      if (existingDates.has(d)) {
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
            {/* Gradient Blur Effect - Positioned behind sticky header */}
            <div className={cn("gradient-blur-header", isScrolled && "is-scrolled")} style={{ zIndex: 90 }} />

            {/* Live Prices Ticker */}
            <div className={cn(
              "transition-all duration-500",
              isScrolled ? "opacity-0 -translate-y-4 pointer-events-none h-0 mb-0 overflow-hidden" : "opacity-100 translate-y-0 h-auto mb-6"
            )}>
              <LivePriceTicker theme={theme} />
            </div>

            {/* Sticky Header Section - Dynamic Portfolio Card */}
            <div className={cn(
                "sticky top-0 z-[100] transition-all duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
                isScrolled ? "pt-2 pb-0" : "pt-0 pb-2"
              )}>
              {/* Transparent Mask - Provides smooth blur transition behind sticky elements */}
              <div className={cn(
                  "fixed inset-x-0 top-0 h-[120px] -z-10 transition-opacity duration-150 gpu-accelerated will-change-[opacity,backdrop-filter] pointer-events-none",
                  isScrolled ? "backdrop-blur-md opacity-100" : "backdrop-blur-0 opacity-0"
                )} style={{ 
                  WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)',
                  maskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)'
                }} />

              <div className={cn(
                "relative group px-2 sm:px-0 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]",
                isScrolled ? "scale-[0.92] sm:scale-[0.95]" : "scale-100"
              )}>
                <div className={cn(
                  "ios-card transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden border-none outline-none ring-0 relative",
                  theme === 'light' 
                    ? "bg-primary/5 shadow-none" 
                    : "bg-primary/[0.03] shadow-none",
                  isScrolled ? "pt-1.5 pb-1.5 h-[75px] sm:h-[110px]" : "pt-6 pb-10 h-auto shadow-2xl"
                )}>
                  {/* Theme-based Edge Border Overlay */}
                  <div className={cn(
                    "absolute inset-0 pointer-events-none rounded-[inherit] z-30 transition-all duration-700",
                    theme === 'light' ? "border-[0.2px] border-black/5" : "border-[0.2px] border-white/10",
                    "shadow-[0_0_1px_rgba(255,255,255,0.05)]"
                  )} />

                  {/* Bottom Blur Effect for Card on scroll - Hidden to avoid double blur */}
                  <div className={cn(
                    "absolute inset-x-0 bottom-0 h-1/2 pointer-events-none transition-opacity duration-700 hidden",
                    isScrolled ? "opacity-100" : "opacity-0"
                  )} style={{
                    background: theme === 'dark' 
                      ? 'linear-gradient(to bottom, transparent, rgba(5, 5, 7, 0.4))'
                      : 'linear-gradient(to bottom, transparent, rgba(248, 249, 250, 0.4))',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                  }} />

                  {/* Share Button */}
                  <div className={cn(
                    "absolute top-3 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:top-4 sm:right-4 z-50 transition-all duration-500",
                    isScrolled ? "opacity-0 scale-50 pointer-events-none" : "opacity-100 scale-100"
                  )}>
                    <button 
                      onClick={handleShare}
                      disabled={isSharing}
                      className={cn(
                        "flex items-center justify-center gap-2 px-6 py-1.5 sm:p-3 rounded-full sm:rounded-2xl bg-white/[0.02] border border-white/[0.05] transition-all duration-300 active:scale-95",
                        theme === 'light' && "bg-black/[0.02] border-black/[0.05]",
                        isSharing && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isSharing ? (
                        <RefreshCcw className="w-3.5 h-3.5 text-primary animate-spin" />
                      ) : (
                        <Share2 className={cn("w-3.5 h-3.5 transition-colors", theme === 'light' ? "text-slate-900/20" : "text-white/20")} />
                      )}
                      <span className={cn("text-[10px] font-black uppercase tracking-[0.2em] sm:hidden", theme === 'light' ? "text-slate-900/20" : "text-white/20")}>Share</span>
                    </button>
                  </div>

                  <div className={cn(
                    "relative z-10 flex flex-col items-center text-center space-y-2 sm:space-y-4 transition-all duration-700",
                    isScrolled ? "pt-1 sm:pt-0" : "pt-12 sm:pt-0"
                  )}>
                    {/* Vertical Side Label */}
                    <div className={cn(
                      "absolute left-0 top-0 bottom-0 w-8 sm:w-12 hidden xs:flex items-center justify-center border-r backdrop-blur-md rounded-l-[2.5rem] overflow-hidden z-20 transition-all duration-700",
                      theme === 'light' ? "bg-black/[0.02] border-black/[0.05]" : "bg-white/[0.02] border-white/[0.05]",
                      isScrolled ? "opacity-0 -translate-x-full" : "opacity-100 translate-x-0"
                    )}>
                      <div className="-rotate-90 whitespace-nowrap">
                        <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.4em] sm:tracking-[0.6em] text-primary/80 select-none">
                          Dynamic Portfolio
                        </p>
                      </div>
                    </div>

                    <div className={cn(
                      "relative flex flex-col items-center w-full transition-all duration-700",
                      isScrolled ? "xs:pl-0 px-2 sm:px-6" : "xs:pl-8 sm:pl-0"
                    )}>
                      <div className={cn(
                        "relative w-full transition-all duration-700",
                        isScrolled ? "flex items-center justify-between px-2" : "flex flex-col items-center justify-center gap-2 sm:gap-4"
                      )}>
                        
                      {/* Market Sessions - Left Column on scroll */}
                      <div className={cn(
                        "transition-all duration-700",
                        isScrolled ? "flex-none order-first opacity-100" : "w-full mb-2 opacity-100 h-auto"
                      )}>
                        {/* Mobile: Grid Layout */}
                        <div className={cn(
                          "flex sm:hidden px-1 transition-all duration-500",
                          isScrolled ? "flex-col items-start gap-0" : "grid grid-cols-2 gap-1.5 w-full"
                        )}>
                          {sessions.map((session) => (
                            <div key={session.name} className={cn(
                              "transition-all duration-300 flex items-center gap-1",
                              !session.active && "opacity-20",
                              isScrolled ? "p-0 h-3" : "p-1.5 rounded-lg border bg-white/[0.01] border-white/[0.05]"
                            )}>
                              <div className={cn(
                                "rounded-full",
                                session.active ? "bg-primary animate-pulse" : "bg-white/20",
                                isScrolled ? "w-0.5 h-0.5" : "w-1 h-1"
                              )} />
                              <span className={cn(
                                "font-black uppercase tracking-tight",
                                session.active ? "text-primary" : theme === 'light' ? "text-slate-900/30" : "text-white/30",
                                isScrolled ? "text-[6px]" : "text-[8px]"
                              )}>
                                {session.name}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Desktop: Horizontal Layout */}
                        <div className={cn(
                          "hidden sm:flex items-center transition-all duration-500",
                          isScrolled ? "gap-4" : "justify-center gap-8 lg:gap-12 w-full"
                        )}>
                          {sessions.map((session) => (
                            <div key={session.name} className="flex items-center gap-2 group/session">
                              <div className={cn(
                                "rounded-full transition-all duration-500",
                                session.active 
                                  ? "bg-primary animate-pulse" 
                                  : theme === 'light' ? "bg-black/10" : "bg-white/10",
                                isScrolled ? "w-1 h-1" : "w-1.5 h-1.5"
                              )} />
                              <span className={cn(
                                "font-black uppercase tracking-[0.2em] transition-colors duration-300",
                                session.active ? "text-primary" : theme === 'light' ? "text-slate-900/40" : "text-white/40",
                                isScrolled ? "text-[8px]" : "text-[11px]"
                              )}>
                                {session.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Balance - Center Column on scroll */}
                      <div className={cn(
                        "flex flex-col items-center relative py-1 transition-all duration-700",
                        isScrolled ? "flex-1 flex justify-center scale-90" : "gap-1 sm:gap-2"
                      )}>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <div className={cn(
                            "relative group/dollar transition-all duration-700",
                            isScrolled ? "scale-75 opacity-40" : "scale-100"
                          )}>
                            <span className="text-xl xs:text-2xl sm:text-4xl font-extralight bg-gradient-to-b from-primary via-primary/80 to-primary/40 bg-clip-text text-transparent select-none">
                              $
                            </span>
                          </div>
                          <h2 className={cn(
                            "font-black tracking-tighter flex items-baseline transition-all duration-700", 
                            theme === 'light' ? "text-slate-900" : "text-white",
                            isScrolled ? "text-3xl xs:text-4xl sm:text-6xl" : "text-3xl xs:text-5xl sm:text-8xl"
                          )}>
                            {Math.floor(currentCapital).toLocaleString()}
                            <span className={cn(
                              "text-primary flex items-baseline relative group/balance-dec transition-all duration-700",
                              isScrolled ? "text-sm xs:text-base sm:text-xl" : "text-lg xs:text-xl sm:text-4xl"
                            )}>
                                <span className="mx-0.5">.</span>
                                <span className="ml-0.5 tracking-tight">
                                  {((currentCapital % 1) * 100).toFixed(0).padStart(2, '0')}
                                </span>
                            </span>
                            {/* Withdrawal Icon - Moved next to balance */}
                            <button 
                               onClick={(e) => { 
                                 e.stopPropagation();
                                 setIsAddingWithdrawal(true); 
                                 haptic('medium'); 
                               }}
                               className={cn(
                                 "ml-3 sm:ml-6 flex items-center self-center active:scale-90 transition-all duration-700",
                                 isScrolled ? "opacity-0 scale-0 pointer-events-none" : "opacity-100 scale-100"
                               )}
                             >
                              <div className="relative flex items-center justify-center p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl bg-red-500/10 border border-red-500/20 shadow-lg hover:bg-red-500/20 transition-colors">
                                <LogOut className="w-3.5 sm:w-5 h-3.5 sm:h-5 text-red-500 rotate-90" />
                              </div>
                            </button>
                          </h2>
                        </div>
                      </div>

                      {/* Genius Stats - Right Column on scroll */}
                      <div className={cn(
                        "transition-all duration-700",
                        isScrolled ? "flex-none flex items-center gap-2 sm:gap-6" : "grid grid-cols-3 gap-2 sm:gap-8 w-full max-w-xl px-2 sm:px-4 mt-4 sm:mt-10"
                      )}>
                        {/* Health Score */}
                        <div className={cn(
                          "flex flex-col items-center justify-start transition-all duration-700",
                          isScrolled ? "space-y-0" : "space-y-1.5 sm:space-y-3"
                        )}>
                          <div className={cn("flex items-center justify-center", isScrolled ? "h-3" : "h-5")}>
                            <p className={cn(
                              "font-black uppercase tracking-[0.2em] leading-none transition-all duration-500", 
                              theme === 'light' ? "text-slate-900/20" : "text-white/20",
                              isScrolled ? "text-[6px] sm:text-[8px]" : "text-[8px] sm:text-[10px]"
                            )}>Health Score</p>
                          </div>
                          <div className={cn(
                            "flex items-center gap-1 font-black tracking-tight transition-all duration-500",
                            geniusMetrics.healthScore > 60 ? "text-emerald-500" : "text-rose-500",
                            isScrolled ? "text-[7px] sm:text-[10px]" : "px-1.5 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl bg-primary/10 text-[9px] sm:text-xs"
                          )}>
                            <Sparkles className={cn("transition-all duration-500", isScrolled ? "w-1 h-1 sm:w-2 sm:h-2" : "w-2 sm:w-3 h-2 sm:h-3")} />
                            {geniusMetrics.healthScore}%
                          </div>
                        </div>
                        
                        {/* 30D Projection */}
                        <div className={cn(
                          "flex flex-col items-center justify-start transition-all duration-700",
                          isScrolled ? "space-y-0" : "space-y-1.5 sm:space-y-3"
                        )}>
                          <div className={cn("flex items-center justify-center", isScrolled ? "h-3" : "h-5")}>
                            <p className={cn(
                              "font-black uppercase tracking-[0.2em] leading-none transition-all duration-500 pt-[2px]", 
                              theme === 'light' ? "text-slate-900/20" : "text-white/20",
                              isScrolled ? "text-[6px] sm:text-[8px]" : "text-[8px] sm:text-[10px]"
                            )}>Projected 30D</p>
                          </div>
                          <div className={cn("flex flex-col items-center justify-center", isScrolled ? "" : "h-8 sm:h-10")}>
                            <p className={cn(
                              "font-black tracking-tighter transition-all duration-500", 
                              theme === 'light' ? "text-slate-900/90" : "text-white/90",
                              isScrolled ? "text-[8px] sm:text-[12px]" : "text-xs sm:text-xl"
                            )}>
                              <span className={cn(
                                "font-light mr-0.5 transition-all duration-500", 
                                theme === 'light' ? "text-slate-900/30" : "text-white/30",
                                isScrolled ? "text-[5px] sm:text-[7px]" : "text-[9px] sm:text-xs"
                              )}>$</span>
                              {Math.round(geniusMetrics.projected30D).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        
                        {/* Performance */}
                        <div className={cn(
                          "flex flex-col items-center justify-start transition-all duration-700",
                          isScrolled ? "space-y-0" : "space-y-1.5 sm:space-y-3"
                        )}>
                          <div className={cn("flex items-center justify-center", isScrolled ? "h-3" : "h-5")}>
                            <p className={cn(
                              "font-black uppercase tracking-[0.2em] leading-none transition-all duration-500", 
                              theme === 'light' ? "text-slate-900/20" : "text-white/20",
                              isScrolled ? "text-[6px] sm:text-[8px]" : "text-[8px] sm:text-[10px]"
                            )}>Performance</p>
                          </div>
                          <div className={cn(
                            "flex items-center gap-1 font-black tracking-tight transition-all duration-500",
                            stats.totalProfit >= 0 ? "text-emerald-500" : "text-rose-500",
                            isScrolled ? "text-[7px] sm:text-[10px]" : "px-1.5 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl bg-primary/10 text-[9px] sm:text-xs"
                          )}>
                            {stats.totalProfit >= 0 ? (
                              <TrendingUp className={cn("transition-all duration-500", isScrolled ? "w-1 h-1 sm:w-2 sm:h-2" : "w-2 sm:w-3 h-2 sm:h-3")} />
                            ) : (
                              <TrendingDown className={cn("transition-all duration-500", isScrolled ? "w-1 h-1 sm:w-2 sm:h-2" : "w-2 sm:w-3 h-2 sm:h-3")} />
                            )}
                            {Math.abs((stats.totalProfit / initialCapital) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

            {/* Scrollable Content Section */}
            <div className={cn(
              "space-y-6 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
            )}>
              {/* Smart Insights Section */}
              {insights.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-4 sm:px-0">
                {insights.map((insight, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "ios-card group relative transition-all duration-500 hover:scale-[1.02]",
                      insight.type === 'success' ? (theme === 'light' ? "bg-green-500/15 border-green-500/30" : "bg-green-500/[0.03] border-green-500/10 hover:bg-green-500/[0.05]") :
                      insight.type === 'warning' ? (theme === 'light' ? "bg-red-500/15 border-red-500/30" : "bg-red-500/[0.03] border-red-500/10 hover:bg-red-500/[0.05]") :
                      (theme === 'light' ? "bg-blue-500/15 border-blue-500/30" : "bg-blue-500/[0.03] border-blue-500/10 hover:bg-blue-500/[0.05]")
                    )}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn(
                        "p-3 rounded-2xl",
                        insight.type === 'success' ? (theme === 'light' ? "bg-green-500/20 text-green-600" : "bg-green-500/10 text-green-500") :
                        insight.type === 'warning' ? (theme === 'light' ? "bg-red-500/20 text-red-600" : "bg-red-500/10 text-red-500") :
                        (theme === 'light' ? "bg-blue-500/20 text-blue-600" : "bg-blue-500/10 text-blue-500")
                      )}>
                        {insight.icon === 'TrendingUp' && <TrendingUp className="w-5 h-5" />}
                        {insight.icon === 'AlertTriangle' && <AlertTriangle className="w-5 h-5" />}
                        {insight.icon === 'Clock' && <Clock className="w-5 h-5" />}
                        {insight.icon === 'Target' && <Target className="w-5 h-5" />}
                      </div>
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-full border",
                        theme === 'light' ? "bg-white/40 border-black/10 shadow-sm" : "bg-white/[0.03] border-white/[0.05]"
                      )}>
                        <Sparkles className={cn("w-2.5 h-2.5", theme === 'light' ? "text-slate-900/60" : "text-white/40")} />
                        <span className={cn("text-[9px] font-black uppercase tracking-widest", theme === 'light' ? "text-slate-900/40" : "text-white/20")}>Insight</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h4 className={cn("text-[11px] font-black uppercase tracking-widest", theme === 'light' ? "text-slate-900/90" : "text-white/80")}>{insight.title}</h4>
                      <p className={cn("text-[13px] font-semibold leading-relaxed transition-colors", theme === 'light' ? "text-slate-900/70 group-hover:text-slate-900/90" : "text-white/40 group-hover:text-white/60")}>
                        {insight.message}
                      </p>
                    </div>

                    <div className={cn("absolute -bottom-4 -right-4 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity", theme === 'light' ? "text-slate-900" : "text-white")}>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 sm:px-0">
                {/* Weekly Target */}
                <div className="ios-card p-6 space-y-4 relative overflow-hidden">
                  {/* Theme-based Edge Border Overlay */}
                  <div className={cn(
                    "absolute inset-0 pointer-events-none rounded-[inherit] z-30 transition-all duration-700",
                    theme === 'light' ? "border-[0.2px] border-black/5" : "border-[0.2px] border-white/10",
                    "shadow-[0_0_1px_rgba(255,255,255,0.05)]"
                  )} />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-3 h-3 text-amber-500/60" />
                      <h3 className={cn("text-[10px] font-black uppercase tracking-[0.3em]", theme === 'light' ? "text-slate-900/40" : "text-white/40")}>Weekly Target</h3>
                    </div>
                    <span className={cn("text-[10px] font-black tracking-widest", theme === 'light' ? "text-slate-900/20" : "text-white/20")}>
                      ${Math.round(targetProgress.weekly.profit)} / ${targetProgress.weekly.target}
                    </span>
                  </div>
                  
                  <div className={cn("relative h-2 w-full rounded-full overflow-hidden", theme === 'light' ? "bg-black/[0.05]" : "bg-white/[0.02]")}>
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500/40 to-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all duration-1000 ease-out"
                      style={{ width: `${targetProgress.weekly.percentage}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className={cn("text-[9px] font-black uppercase tracking-widest", theme === 'light' ? "text-slate-900/10" : "text-white/10")}>Progress</span>
                    <span className="text-[11px] font-black text-amber-500/80 tracking-tighter">{Math.round(targetProgress.weekly.percentage)}%</span>
                  </div>
                </div>

                {/* Monthly Target */}
                <div className="ios-card p-6 space-y-4 relative overflow-hidden">
                  {/* Theme-based Edge Border Overlay */}
                  <div className={cn(
                    "absolute inset-0 pointer-events-none rounded-[inherit] z-30 transition-all duration-700",
                    theme === 'light' ? "border-[0.2px] border-black/5" : "border-[0.2px] border-white/10",
                    "shadow-[0_0_1px_rgba(255,255,255,0.05)]"
                  )} />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-3 h-3 text-primary/60" />
                      <h3 className={cn("text-[10px] font-black uppercase tracking-[0.3em]", theme === 'light' ? "text-slate-900/40" : "text-white/40")}>Monthly Target</h3>
                    </div>
                    <span className={cn("text-[10px] font-black tracking-widest", theme === 'light' ? "text-slate-900/20" : "text-white/20")}>
                      ${Math.round(targetProgress.monthly.profit)} / ${targetProgress.monthly.target}
                    </span>
                  </div>
                  
                  <div className={cn("relative h-2 w-full rounded-full overflow-hidden", theme === 'light' ? "bg-black/[0.05]" : "bg-white/[0.02]")}>
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/40 to-primary shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all duration-1000 ease-out"
                      style={{ width: `${targetProgress.monthly.percentage}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className={cn("text-[9px] font-black uppercase tracking-widest", theme === 'light' ? "text-slate-900/10" : "text-white/10")}>Progress</span>
                    <span className="text-[11px] font-black text-primary/80 tracking-tighter">{Math.round(targetProgress.monthly.percentage)}%</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 px-2 sm:px-0">
              <div className="flex flex-col items-center justify-center mb-4">
                <div className={cn(
                  "inline-flex items-center gap-2.5 px-6 py-2 border rounded-full shadow-2xl",
                  theme === 'light' ? "bg-black/[0.02] border-black/[0.05]" : "bg-white/[0.02] backdrop-blur-md border border-white/[0.05]"
                )}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", theme === 'light' ? "bg-black/20" : "bg-white/20 shadow-[0_0_12px_rgba(255,255,255,0.1)]")} />
                  <p className={cn("text-[11px] font-black uppercase tracking-[0.5em]", theme === 'light' ? "text-slate-900/20" : "text-white/20")}>Operation Stream</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {recordsWithBalance.slice(0, 5).map((record) => (
                  <div 
                    key={record.id} 
                    className={cn(
                      "ios-card flex items-center gap-5 p-5 transition-all group shadow-xl !rounded-[2rem]",
                      theme === 'light' ? "bg-white/40 hover:bg-white/60" : "bg-white/[0.02] hover:bg-white/[0.04]"
                    )}
                  >
                    <div className={cn(
                      "w-1.5 h-10 rounded-full",
                      record.type === 'withdrawal' ? "bg-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]" :
                      record.profitLoss >= 0 ? "bg-green-500/40 shadow-[0_0_15px_rgba(34,197,94,0.2)]" : "bg-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                    )} />
                    <div className="flex-1 flex items-center justify-between">
                      <div className="text-left">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className={cn("text-[11px] font-black uppercase tracking-tight", theme === 'light' ? "text-slate-900/80" : "text-white/80")}>
                            {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                          {record.type === 'withdrawal' && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[7px] font-black uppercase tracking-widest border border-amber-500/20">
                              Withdrawal
                            </span>
                          )}
                        </div>
                        <p className={cn("text-[9px] font-bold uppercase tracking-[0.1em] truncate max-w-[150px]", theme === 'light' ? "text-slate-900/20" : "text-white/20")}>
                          {record.notes || (record.type === 'withdrawal' ? 'Profit Withdrawal' : 'No meta data')}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <div className={cn(
                            "text-xl font-black tracking-tighter", 
                            record.type === 'withdrawal' ? "text-amber-500/60" :
                            record.profitLoss >= 0 ? "text-green-500/60" : "text-red-500/60"
                          )}>
                            {record.type === 'withdrawal' ? '-' : (record.profitLoss >= 0 ? '+' : '')}{Math.abs(record.profitLoss).toLocaleString()}
                          </div>
                          <p className={cn("text-[10px] font-black uppercase tracking-tighter", theme === 'light' ? "text-slate-900/10" : "text-white/10")}>
                            BAL // {record.capitalAfter.toLocaleString()}
                          </p>
                        </div>
                        {record.type === 'withdrawal' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteRecord(record.id);
                            }}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500/40 hover:text-red-500 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {records.length === 0 && (
                  <div className={cn(
                    "py-20 flex flex-col items-center justify-center border rounded-[2rem] shadow-2xl",
                    theme === 'light' ? "bg-white/40 border-white/50" : "bg-white/[0.02] backdrop-blur-md border border-white/[0.05]"
                  )}>
                    <div className={cn(
                      "w-16 h-16 rounded-full flex items-center justify-center mb-6 border",
                      theme === 'light' ? "bg-black/[0.02] border-black/[0.05]" : "bg-white/[0.02] border-white/[0.05]"
                    )}>
                      <div className={cn("w-6 h-6 flex items-center justify-center", theme === 'light' ? "text-slate-900/10" : "text-white/10")}>
                        <div className={cn("w-4 h-4 border-2 rounded-full", theme === 'light' ? "border-black/20" : "border-white/20")} />
                      </div>
                    </div>
                    <p className={cn("text-[10px] font-black uppercase tracking-[0.5em]", theme === 'light' ? "text-slate-900/20" : "text-white/20")}>No active stream</p>
                  </div>
                )}
              </div>
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
              sessionStats={sessionStats}
              theme={theme}
            />
          </div>
        );
      case 'reports': {
        // Group trades and withdrawals by date
        const filteredTrades = reportTrades.filter(trade => {
          const date = getFormattedDate(trade.closeTime);
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

        const filteredWithdrawals = records.filter(r => {
          if (r.type !== 'withdrawal') return false;
          const date = r.date.split('T')[0];
          const matchesDate = !reportDateFilter || date === reportDateFilter;
          const matchesSearch = !reportSearchQuery || (r.notes || '').toLowerCase().includes(reportSearchQuery.toLowerCase());
          // Withdrawals are always "loss" in terms of balance reduction, but let's show them in 'all' and maybe 'loss' if filtered
          const matchesStatus = reportStatusFilter === 'all' || reportStatusFilter === 'loss';
          return matchesDate && matchesSearch && matchesStatus;
        });

        // Calculate counts
        const filteredForCounts = reportTrades.filter(trade => {
          const date = getFormattedDate(trade.closeTime);
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

        // Create combined items list
        type CombinedItem = { type: 'trade', data: MT5Trade } | { type: 'withdrawal', data: DailyRecord };
        const combinedItems: CombinedItem[] = [
          ...filteredTrades.map(t => ({ type: 'trade' as const, data: t })),
          ...filteredWithdrawals.map(w => ({ type: 'withdrawal' as const, data: w }))
        ];

        // Sort combined items
        combinedItems.sort((a, b) => {
          const timeA = a.type === 'trade' ? new Date(a.data.closeTime.replace(/\./g, '-')).getTime() : new Date(a.data.date).getTime();
          const timeB = b.type === 'trade' ? new Date(b.data.closeTime.replace(/\./g, '-')).getTime() : new Date(b.data.date).getTime();
          return reportSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });

        const itemsByDate = combinedItems.reduce((acc: Record<string, { items: CombinedItem[], dailyPL: number }>, item) => {
          const date = item.type === 'trade' 
            ? getFormattedDate(item.data.closeTime)
            : item.data.date.split('T')[0];
          if (!acc[date]) acc[date] = { items: [], dailyPL: 0 };
          acc[date].items.push(item);
          if (item.type === 'trade') {
            acc[date].dailyPL += (item.data.profit + item.data.commission + item.data.swap);
          }
          return acc;
        }, {});

        // Sort dates
        const sortedDates = Object.keys(itemsByDate).sort((a, b) => {
          const timeA = new Date(a).getTime();
          const timeB = new Date(b).getTime();
          return reportSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });

        return (
          <div className="space-y-10 animate-fade-in pb-32">
            {/* Gradient Blur Effect - Unified implementation for all pages */}
            <div className={cn("gradient-blur-header", isScrolled && "is-scrolled")} style={{ zIndex: 90 }} />

            {/* Sticky Header Section - Trade Report Header and Filters */}
            <div className={cn(
                "sticky top-0 z-[100] transition-all duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
                isScrolled ? "pt-2 pb-0" : "pt-0 pb-2"
              )}>
              {/* Transparent Mask - Provides smooth blur transition behind sticky elements */}
              <div className={cn(
                  "fixed inset-x-0 top-0 h-[120px] -z-10 transition-opacity duration-150 gpu-accelerated will-change-[opacity,backdrop-filter] pointer-events-none",
                  isScrolled ? "backdrop-blur-md opacity-100" : "backdrop-blur-0 opacity-0"
                )} style={{ 
                  WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)',
                  maskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)'
                }} />

              <div className={cn(
                "flex flex-col items-center justify-center transition-all duration-700",
                isScrolled ? "opacity-0 h-0 overflow-hidden mb-0" : "opacity-100 h-auto mb-6"
              )}>
                <div className={cn(
                  "inline-flex items-center gap-2.5 px-6 py-2 border rounded-full shadow-2xl",
                  theme === 'light' ? "bg-black/[0.02] border-black/[0.05]" : "bg-white/[0.02] backdrop-blur-md border border-white/[0.05]"
                )}>
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_12px_rgba(59,130,245,0.6)] animate-pulse" />
                  <p className={cn("text-[11px] font-black uppercase tracking-[0.5em]", theme === 'light' ? "text-slate-900/30" : "text-white/30")}>Trade Report</p>
                </div>
              </div>

              {(reportTrades.length > 0 || records.some(r => r.type === 'withdrawal')) && (
                <div className={cn(
                  "px-2 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]",
                  isScrolled ? "scale-[0.92] sm:scale-[0.95]" : "scale-100"
                )}>
                  <div className={cn(
                    "ios-card !rounded-[2rem] p-2 sm:p-3 shadow-2xl transition-all duration-700",
                    theme === 'light' ? "bg-white/40" : "bg-white/[0.02]",
                    isScrolled ? "h-auto" : "h-auto"
                  )}>
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                      {/* Status Filters - Segmented Style */}
                      <div className={cn(
                        "flex-1 flex rounded-2xl p-1 gap-1",
                        theme === 'light' ? "bg-black/5" : "bg-black/20"
                      )}>
                        <button 
                          onClick={() => { setReportStatusFilter('all'); haptic('light'); }}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-500",
                            reportStatusFilter === 'all' 
                              ? "bg-primary text-black shadow-lg shadow-primary/20 font-black" 
                              : (theme === 'light' ? "text-slate-900/30 hover:text-slate-900/50" : "text-white/30 hover:text-white/50") + " font-bold"
                          )}
                        >
                          <span className="text-[10px] uppercase tracking-widest">All</span>
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded-md",
                            reportStatusFilter === 'all' ? "bg-black/10" : (theme === 'light' ? "bg-black/5" : "bg-white/5")
                          )}>{counts.total}</span>
                        </button>
                        
                        <button 
                          onClick={() => { setReportStatusFilter('win'); haptic('light'); }}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-500",
                            reportStatusFilter === 'win' 
                              ? "bg-green-500 text-white shadow-lg shadow-green-500/20 font-black" 
                              : (theme === 'light' ? "text-slate-900/30 hover:text-slate-900/50" : "text-white/30 hover:text-white/50") + " font-bold"
                          )}
                        >
                          <span className="text-[10px] uppercase tracking-widest">Wins</span>
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded-md",
                            reportStatusFilter === 'win' ? "bg-black/10" : (theme === 'light' ? "bg-black/5" : "bg-white/5")
                          )}>{counts.wins}</span>
                        </button>

                        <button 
                          onClick={() => { setReportStatusFilter('loss'); haptic('light'); }}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-500",
                            reportStatusFilter === 'loss' 
                              ? "bg-red-500 text-white shadow-lg shadow-red-500/20 font-black" 
                              : (theme === 'light' ? "text-slate-900/30 hover:text-slate-900/50" : "text-white/30 hover:text-white/50") + " font-bold"
                          )}
                        >
                          <span className="text-[10px] uppercase tracking-widest">Losses</span>
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded-md",
                            reportStatusFilter === 'loss' ? "bg-black/10" : (theme === 'light' ? "bg-black/5" : "bg-white/5")
                          )}>{counts.losses}</span>
                        </button>
                      </div>

                      <div className={cn(
                        "hidden lg:block w-px h-8 transition-all duration-700", 
                        theme === 'light' ? "bg-black/[0.05]" : "bg-white/[0.05]",
                        isScrolled ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                      )} />

                      {/* Secondary Controls */}
                      <div className={cn(
                        "flex items-center gap-2 transition-all duration-700",
                        isScrolled ? "opacity-0 h-0 overflow-hidden" : "opacity-100 h-auto"
                      )}>
                        {/* Sort Toggle */}
                        <button 
                          onClick={() => {
                            setReportSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                            haptic('light');
                          }}
                          className={cn(
                            "flex-1 lg:flex-none flex items-center gap-3 px-5 py-3 border rounded-2xl transition-all group",
                            theme === 'light' ? "bg-black/[0.02] border-black/[0.05] hover:bg-black/[0.05]" : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05]"
                          )}
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
                        <div 
                          onClick={() => {
                            haptic('light');
                            try {
                              // @ts-ignore
                              reportFilterInputRef.current?.showPicker();
                            } catch (e) {
                              reportFilterInputRef.current?.click();
                            }
                          }}
                          className={cn(
                            "flex-1 lg:flex-none relative group flex items-center gap-3 px-5 py-3 rounded-2xl transition-all cursor-pointer",
                            theme === 'light' ? "bg-white/40 border border-white/50 hover:bg-white/60" : "bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05]"
                          )}
                        >
                          <div className="w-5 h-5 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
                            <Calendar className="w-3 h-3 text-amber-500" />
                          </div>
                          <input 
                            ref={reportFilterInputRef}
                            type="date" 
                            value={reportDateFilter}
                            onChange={(e) => {
                              setReportDateFilter(e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "bg-transparent text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer w-full lg:w-auto",
                              theme === 'light' ? "text-slate-600 [color-scheme:light]" : "text-white/60 [color-scheme:dark]"
                            )}
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
            </div>

            <div className={cn(
              "space-y-10 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
            )}>

            {combinedItems.length === 0 ? (
              <div className={cn(
                "ios-card flex flex-col items-center justify-center py-20 border-dashed",
                theme === 'light' ? "bg-white/30" : "bg-white/[0.01]"
              )}>
                <FileSpreadsheet className={cn("w-16 h-16 mb-4", theme === 'light' ? "text-slate-300" : "text-white/5")} />
                <p className={cn("font-black uppercase tracking-widest text-[10px]", theme === 'light' ? "text-slate-400" : "text-white/20")}>No activity found</p>
                <p className={cn("text-xs mt-2", theme === 'light' ? "text-slate-400" : "text-white/10")}>Trades and withdrawals will appear here</p>
              </div>
            ) : (
              <div className="space-y-12">
                {sortedDates.map(date => (
                  <div key={date} className="space-y-6">
                    <div className="flex items-center gap-4 px-2">
                      <div className={cn("h-px flex-1", theme === 'light' ? "bg-slate-200" : "bg-white/[0.05]")} />
                      <div className="flex flex-col items-center gap-1">
                        <h3 className={cn("text-[10px] font-black uppercase tracking-[0.3em] whitespace-nowrap", theme === 'light' ? "text-slate-400" : "text-white/30")}>
                          {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </h3>
                        {itemsByDate[date].dailyPL !== 0 && (
                          <div className={cn(
                            "px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase",
                            itemsByDate[date].dailyPL >= 0 ? "bg-green-500/10 text-green-500/60" : "bg-red-500/10 text-red-500/60"
                          )}>
                            {itemsByDate[date].dailyPL >= 0 ? '+' : ''}${itemsByDate[date].dailyPL.toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className={cn("h-px flex-1", theme === 'light' ? "bg-slate-200" : "bg-white/[0.05]")} />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {itemsByDate[date].items.map((item, i) => (
                        item.type === 'trade' ? (
                          <div key={i} className={cn(
                            "ios-card-mini group relative transition-all duration-300",
                            theme === 'light' ? "bg-white/60 hover:bg-white/80" : "bg-white/[0.02] hover:bg-white/[0.04]"
                          )}>
                            <div className="flex justify-between items-start mb-2 sm:mb-3">
                              <div className={cn(
                                "w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-[10px] sm:text-xs font-black",
                                item.data.profit >= 0 ? "bg-green-500/10 text-green-500/60" : "bg-red-500/10 text-red-500/60"
                              )}>
                                {item.data.symbol.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="text-right">
                                <p className={cn("text-base sm:text-xl font-black tracking-tighter leading-none", item.data.profit >= 0 ? "text-green-500/80" : "text-red-500/80")}>
                                  {item.data.profit >= 0 ? '+' : ''}{item.data.profit.toLocaleString()}
                                </p>
                                <p className={cn("text-[7px] sm:text-[8px] font-black uppercase tracking-widest mt-1", theme === 'light' ? "text-slate-400" : "text-white/10")}>Profit</p>
                              </div>
                            </div>

                            <div className="space-y-1 sm:space-y-1.5 text-left">
                              <h4 className={cn("text-[11px] sm:text-[13px] font-black truncate", theme === 'light' ? "text-slate-700" : "text-white/90")}>{item.data.symbol}</h4>
                              <div className="flex items-center justify-between">
                                <span className={cn(
                                  "text-[7px] sm:text-[8px] font-black uppercase tracking-widest px-1.5 sm:px-2 py-0.5 rounded-md",
                                  item.data.type === 'Buy' ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400"
                                )}>
                                  {item.data.type}
                                </span>
                                <span className={cn("text-[9px] sm:text-[11px] font-black tracking-tighter", theme === 'light' ? "text-slate-400" : "text-white/40")}>{item.data.volume}L</span>
                              </div>
                            </div>

                            <div className={cn("mt-3 sm:mt-4 pt-2 sm:pt-3 border-t flex items-center justify-between", theme === 'light' ? "border-slate-100" : "border-white/[0.03]")}>
                              <span className={cn("text-[8px] sm:text-[9px] font-bold tracking-tighter", theme === 'light' ? "text-slate-300" : "text-white/20")}>#{item.data.positionId.slice(-6)}</span>
                              <div className={cn("flex items-center gap-1 sm:gap-1.5", theme === 'light' ? "text-slate-400" : "text-white/30")}>
                                <Clock className="w-2 sm:w-2.5 h-2 sm:h-2.5" />
                                <span className="text-[9px] sm:text-[10px] font-bold tracking-tighter">{item.data.closeTime.split(' ')[1].substring(0, 5)}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div key={i} className={cn(
                            "ios-card-mini group relative transition-all duration-300",
                            theme === 'light' ? "bg-amber-500/15 hover:bg-amber-500/20" : "bg-white/[0.02] hover:bg-white/[0.04]"
                          )}>
                            <div className="flex justify-between items-start mb-2 sm:mb-3">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-500/10 flex items-center justify-center relative">
                                <LogOut className="w-4 h-4 text-amber-500 rotate-90" />
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteRecord(item.data.id);
                                  }}
                                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <div className="text-right">
                                <p className="text-base sm:text-xl font-black tracking-tighter leading-none text-amber-500/80">
                                  -{Math.abs(item.data.profitLoss).toLocaleString()}
                                </p>
                                <p className={cn("text-[7px] sm:text-[8px] font-black uppercase tracking-widest mt-1", theme === 'light' ? "text-slate-400" : "text-white/10")}>Withdrawal</p>
                              </div>
                            </div>

                            <div className="space-y-1 sm:space-y-1.5 text-left">
                              <h4 className={cn("text-[11px] sm:text-[13px] font-black truncate", theme === 'light' ? "text-slate-700" : "text-white/90")}>Profit Withdrawal</h4>
                              <div className="flex items-center justify-between">
                                <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-500">
                                  Cash Out
                                </span>
                              </div>
                            </div>

                            <div className={cn("mt-3 sm:mt-4 pt-2 sm:pt-3 border-t flex items-center justify-between", theme === 'light' ? "border-amber-500/10" : "border-white/[0.03]")}>
                              <span className={cn("text-[8px] sm:text-[9px] font-bold tracking-tighter truncate max-w-[60%]", theme === 'light' ? "text-slate-300" : "text-white/20")}>{item.data.notes || 'No notes'}</span>
                              <div className={cn("flex items-center gap-1 sm:gap-1.5", theme === 'light' ? "text-slate-400" : "text-white/30")}>
                                <Clock className="w-2 sm:w-2.5 h-2 sm:h-2.5" />
                                <span className="text-[9px] sm:text-[10px] font-bold tracking-tighter">{new Date(item.data.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                              </div>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        );
      }
      case 'settings':
        return (
          <div className="space-y-8 animate-fade-in pb-40 px-4">
            {/* Gradient Blur Effect - Unified implementation for all pages */}
            <div className={cn("gradient-blur-header", isScrolled && "is-scrolled")} style={{ zIndex: 90 }} />

            {/* Header Section */}
            <div className={cn(
                "sticky top-0 z-[100] transition-all duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
                isScrolled ? "pt-2 pb-0" : "pt-0 pb-2"
              )}>
              {/* Transparent Mask - Provides smooth blur transition behind sticky elements */}
              <div className={cn(
                  "fixed inset-x-0 top-0 h-[120px] -z-10 transition-opacity duration-150 gpu-accelerated will-change-[opacity,backdrop-filter] pointer-events-none",
                  isScrolled ? "backdrop-blur-md opacity-100" : "backdrop-blur-0 opacity-0"
                )} style={{ 
                  WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)',
                  maskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)'
                }} />

              <div className={cn(
                "flex flex-col items-center transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]",
                isScrolled ? "opacity-0 h-0 overflow-hidden mb-0 scale-90" : "opacity-100 h-auto mb-8 scale-100"
              )}>
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-xl shadow-2xl relative group transition-all duration-700",
                  theme === 'light' ? "bg-white/60 border border-white/50 shadow-lg" : "bg-white/[0.03] border border-white/10",
                  isScrolled ? "w-12 h-12 mb-2" : "w-16 h-16 mb-4"
                )}>
                  <div className="absolute inset-0 bg-primary/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Settings className={cn("text-primary animate-spin-slow relative z-10 transition-all duration-700", isScrolled ? "w-6 h-6" : "w-8 h-8")} />
                </div>
                
                <div className="flex flex-col items-center space-y-0.5">
                  <div className={cn(
                    "flex items-center gap-1.5 mb-0.5 transition-all duration-500",
                    isScrolled ? "opacity-0 h-0 overflow-hidden" : "opacity-100 h-auto"
                  )}>
                    <div className="w-1 h-1 rounded-full bg-primary shadow-[0_0_8px_rgba(212,175,55,0.4)] animate-pulse" />
                    <p className={cn("text-[8px] font-black uppercase tracking-[0.3em]", theme === 'light' ? "text-slate-400" : "text-white/20")}>Control Center</p>
                  </div>
                  <h2 className={cn(
                    "font-black tracking-tighter uppercase leading-none transition-all duration-700", 
                    theme === 'light' ? "text-slate-800" : "text-white",
                    isScrolled ? "text-xl" : "text-2xl"
                  )}>
                    App <span className="text-primary/70">Settings</span>
                  </h2>
                </div>
              </div>
            </div>

            <div className={cn(
              "space-y-8 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
            )}>
              {/* Profile & Cloud Section */}
              <div className={cn(
                "ios-card transition-all duration-300",
                theme === 'light' ? "bg-white/60" : "bg-white/[0.02]"
              )}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center border overflow-hidden shrink-0",
                    theme === 'light' ? "bg-white/40 border-white/60" : "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-white/10"
                  )}>
                    {user ? (
                      (() => {
                        const photoURL = user.photoURL || user.providerData?.[0]?.photoURL;
                        if (photoURL && !profileImgError) {
                          return (
                            <img 
                              src={photoURL} 
                              alt={user.displayName || ''} 
                              className="w-full h-full object-cover" 
                              onError={(e) => {
                                console.error("Profile image failed to load:", photoURL);
                                setProfileImgError(true);
                              }}
                            />
                          );
                        }
                        return (
                          <div className="w-full h-full flex items-center justify-center bg-indigo-500/10">
                            <UserCircle className="w-8 h-8 text-indigo-400" />
                          </div>
                        );
                      })()
                    ) : (
                      <Cloud className="w-7 h-7 text-indigo-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-1 h-1 rounded-full bg-indigo-500/40 shadow-[0_0_5px_rgba(99,102,241,0.3)]" />
                      <p className={cn("text-[8px] font-black uppercase tracking-[0.2em]", theme === 'light' ? "text-slate-400" : "text-white/10")}>Identity</p>
                    </div>
                    <h3 className={cn("text-sm font-black uppercase tracking-wider truncate", theme === 'light' ? "text-slate-800" : "text-white")}>
                      {user ? (
                        <>
                          {user.displayName?.split(' ')[0]} <span className="text-indigo-500/50">{user.displayName?.split(' ').slice(1).join(' ') || 'Profile'}</span>
                        </>
                      ) : (
                        <>Cloud <span className="text-indigo-500/50">Identity</span></>
                      )}
                    </h3>
                    <p className={cn("text-[10px] font-bold uppercase tracking-widest truncate", theme === 'light' ? "text-slate-400" : "text-white/30")}>{user ? user.email : 'Not Synchronized'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => { user ? handleSignOut() : handleGoogleSignIn(); haptic('medium'); }}
                  className={cn(
                    "w-full sm:w-auto px-6 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                    user ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-primary text-black"
                  )}
                >
                  {user ? 'Sign Out' : 'Connect Account'}
                </button>
              </div>

              {user && (
                <button 
                  onClick={() => { handleManualSync(); haptic('medium'); }}
                  className={cn(
                  "w-full py-4 rounded-2xl flex items-center justify-center gap-3 group active:scale-[0.98] transition-all backdrop-blur-xl",
                  theme === 'light' ? "bg-white/40 border border-white/60 shadow-sm" : "bg-white/[0.03] border border-white/[0.05]"
                )}
                >
                  <RefreshCcw className={cn("w-4 h-4 text-emerald-400", isSyncing && "animate-spin")} />
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest group-hover:text-emerald-400 transition-colors",
                    theme === 'light' ? "text-slate-500" : "text-white/60"
                  )}>
                    {isSyncing ? 'Synchronizing Data...' : 'Manual Cloud Sync'}
                  </span>
                </button>
              )}
            </div>

            {/* Main Settings Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Capital Card */}
              <button 
                onClick={() => { setIsEditingInitial(true); haptic('medium'); }}
                className={cn(
                  "ios-card group flex flex-col items-start gap-4 transition-all active:scale-95 text-left",
                  theme === 'light' ? "bg-white/60 hover:bg-white/80" : "bg-white/[0.02] hover:bg-white/[0.05]"
                )}
              >
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
                  <Wallet className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-1 h-1 rounded-full bg-emerald-500/40 shadow-[0_0_5px_rgba(16,185,129,0.3)]" />
                    <p className={cn("text-[8px] font-black uppercase tracking-[0.2em]", theme === 'light' ? "text-slate-400" : "text-white/10")}>Ledger</p>
                  </div>
                  <h4 className={cn("text-xs font-black uppercase tracking-widest", theme === 'light' ? "text-slate-800" : "text-white")}>Capital <span className="text-emerald-500/50">Base</span></h4>
                </div>
              </button>

              {/* Security Card */}
              <button 
                onClick={() => { setIsChangingPass(true); haptic('medium'); }}
                className={cn(
                  "ios-card group flex flex-col items-start gap-4 transition-all active:scale-95 text-left",
                  theme === 'light' ? "bg-white/60 hover:bg-white/80" : "bg-white/[0.02] hover:bg-white/[0.05]"
                )}
              >
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
                  <Lock className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-1 h-1 rounded-full bg-amber-500/40 shadow-[0_0_5px_rgba(245,158,11,0.3)]" />
                    <p className={cn("text-[8px] font-black uppercase tracking-[0.2em]", theme === 'light' ? "text-slate-400" : "text-white/10")}>Access</p>
                  </div>
                  <h4 className={cn("text-xs font-black uppercase tracking-widest", theme === 'light' ? "text-slate-800" : "text-white")}>Security <span className="text-amber-500/50">Hub</span></h4>
                </div>
              </button>

              {/* Targets Card */}
              <button 
                onClick={() => { setIsEditingTargets(true); haptic('medium'); }}
                className={cn(
                  "ios-card group flex flex-col items-start gap-4 transition-all active:scale-95 text-left",
                  theme === 'light' ? "bg-white/60 hover:bg-white/80" : "bg-white/[0.02] hover:bg-white/[0.05]"
                )}
              >
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                  <Trophy className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-1 h-1 rounded-full bg-blue-500/40 shadow-[0_0_5px_rgba(59,130,246,0.3)]" />
                    <p className={cn("text-[8px] font-black uppercase tracking-[0.2em]", theme === 'light' ? "text-slate-400" : "text-white/10")}>Ambition</p>
                  </div>
                  <h4 className={cn("text-xs font-black uppercase tracking-widest", theme === 'light' ? "text-slate-800" : "text-white")}>Profit <span className="text-blue-500/50">Goals</span></h4>
                </div>
              </button>

              {/* Notifications Card */}
              <button 
                onClick={() => { requestNotificationPermission(); haptic('medium'); }}
                className={cn(
                  "ios-card group flex flex-col items-start gap-4 transition-all active:scale-95 text-left",
                  theme === 'light' ? "bg-white/60 hover:bg-white/80" : "bg-white/[0.02] hover:bg-white/[0.05]"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center border group-hover:scale-110 transition-transform",
                  notificationsEnabled ? "bg-green-500/10 border-green-500/20" : "bg-primary/10 border-primary/20"
                )}>
                  {notificationsEnabled ? (
                    <Bell className="w-6 h-6 text-green-500" />
                  ) : (
                    <BellOff className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={cn(
                      "w-1 h-1 rounded-full shadow-[0_0_5px_rgba(0,0,0,0.2)]",
                      notificationsEnabled ? "bg-green-500/40" : "bg-primary/40"
                    )} />
                    <p className={cn("text-[8px] font-black uppercase tracking-[0.2em]", theme === 'light' ? "text-slate-400" : "text-white/10")}>Alerts</p>
                  </div>
                  <h4 className={cn("text-xs font-black uppercase tracking-widest", theme === 'light' ? "text-slate-800" : "text-white")}>System <span className={cn(notificationsEnabled ? "text-green-500/50" : "text-primary/50")}>Status</span></h4>
                </div>
              </button>
            </div>

            {/* Data Management Section */}
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => { handleExportJSON(); haptic('medium'); }}
                className={cn(
                  "ios-card flex items-center gap-3 group transition-all active:scale-95",
                  theme === 'light' ? "bg-white/60 hover:bg-white/80" : "bg-white/[0.02] hover:bg-white/[0.05]"
                )}
              >
                <Download className={cn("w-4 h-4 group-hover:text-blue-400 transition-colors", theme === 'light' ? "text-slate-400" : "text-white/40")} />
                <span className={cn("text-[10px] font-black uppercase tracking-widest", theme === 'light' ? "text-slate-500" : "text-white/60")}>Backup</span>
              </button>

              <label className={cn(
                "ios-card flex items-center gap-3 group transition-all active:scale-95 cursor-pointer",
                theme === 'light' ? "bg-white/60 hover:bg-white/80" : "bg-white/[0.02] hover:bg-white/[0.05]"
              )}>
                <Upload className={cn("w-4 h-4 group-hover:text-purple-400 transition-colors", theme === 'light' ? "text-slate-400" : "text-white/40")} />
                <span className={cn("text-[10px] font-black uppercase tracking-widest", theme === 'light' ? "text-slate-500" : "text-white/60")}>Restore</span>
                <input type="file" className="hidden" accept=".json" onChange={handleImportJSON} />
              </label>
            </div>

            {/* Danger Zone Section */}
            <div className="space-y-3">
              <button 
                onClick={() => { setShowAbout(true); haptic('medium'); }}
                className={cn(
                  "ios-card w-full flex items-center justify-between group transition-all active:scale-[0.99]",
                  theme === 'light' ? "bg-white/60 hover:bg-white/80" : "bg-white/[0.02] hover:bg-white/[0.05]"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                    <Info className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-0.5">
                      <div className="w-1 h-1 rounded-full bg-primary/40 shadow-[0_0_5px_rgba(212,175,55,0.2)]" />
                      <p className={cn("text-[7px] font-black uppercase tracking-[0.2em]", theme === 'light' ? "text-slate-400" : "text-white/10")}>Information</p>
                    </div>
                    <span className={cn("text-xs font-black uppercase tracking-widest", theme === 'light' ? "text-slate-800" : "text-white/70")}>About <span className="text-primary/50">Fox Trade</span></span>
                  </div>
                </div>
                <Sparkles className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors" />
              </button>

              <div className={cn(
                "ios-card w-full flex flex-col gap-4",
                theme === 'light' ? "bg-amber-500/10 hover:bg-amber-500/15" : "bg-amber-500/[0.03] hover:bg-amber-500/[0.05]"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
                      <FileText className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <div className="w-1 h-1 rounded-full bg-amber-500/40 shadow-[0_0_5px_rgba(245,158,11,0.2)]" />
                        <p className={cn("text-[7px] font-black uppercase tracking-[0.2em]", theme === 'light' ? "text-amber-600" : "text-white/10")}>Selective Wipe</p>
                      </div>
                      <span className={cn("text-xs font-black uppercase tracking-widest", theme === 'light' ? "text-amber-700" : "text-amber-500/70")}>Delete <span className="text-amber-500/50">By Date</span></span>
                    </div>
                  </div>
                  
                  <div 
                    onClick={() => {
                      haptic('light');
                      try {
                        // @ts-ignore
                        reportDeleteInputRef.current?.showPicker();
                      } catch (e) {
                        reportDeleteInputRef.current?.click();
                      }
                    }}
                    className={cn(
                      "relative group flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer",
                      theme === 'light' ? "bg-white/40 border-black/5 hover:bg-white/60" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"
                    )}
                  >
                    <Calendar className="w-3 h-3 text-amber-500/60" />
                    <input 
                      ref={reportDeleteInputRef}
                      type="date" 
                      value={reportDeleteDate}
                      onChange={(e) => {
                        setReportDeleteDate(e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "bg-transparent text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer w-24",
                        theme === 'light' ? "text-slate-600 [color-scheme:light]" : "text-white/60 [color-scheme:dark]"
                      )}
                    />
                  </div>
                </div>

                <button 
                  disabled={!reportDeleteDate}
                  onClick={() => { 
                    haptic('heavy'); 
                    setConfirmAction({
                      type: 'reset_reports_date',
                      title: 'Delete Reports',
                      message: `Are you sure you want to delete MT5 reports for ${reportDeleteDate}?`
                    });
                  }}
                  className={cn(
                    "w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg",
                    reportDeleteDate 
                      ? (theme === 'light' ? "bg-amber-500 text-white shadow-amber-500/20" : "bg-amber-500/20 text-amber-500 border border-amber-500/30 hover:bg-amber-500/30 shadow-amber-500/10")
                      : (theme === 'light' ? "bg-slate-100 text-slate-300 cursor-not-allowed" : "bg-white/[0.02] text-white/10 cursor-not-allowed border border-white/[0.02]")
                  )}
                >
                  <Trash2 className="w-3 h-3" />
                  Clear Selected Date
                </button>
              </div>

              <button 
                onClick={() => { 
                  haptic('heavy'); 
                  setConfirmAction({
                    type: 'reset_reports',
                    title: 'Clear Reports',
                    message: 'Are you sure you want to delete ALL MT5 trade reports? This will not affect your daily records.'
                  });
                }}
                className={cn(
                  "ios-card w-full flex items-center justify-between group transition-all active:scale-[0.99]",
                  theme === 'light' ? "bg-amber-500/15 hover:bg-amber-500/20" : "bg-amber-500/[0.05] hover:bg-amber-500/10"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
                    <FileText className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-0.5">
                      <div className="w-1 h-1 rounded-full bg-amber-500/40 shadow-[0_0_5px_rgba(245,158,11,0.2)]" />
                      <p className={cn("text-[7px] font-black uppercase tracking-[0.2em]", theme === 'light' ? "text-amber-600" : "text-white/10")}>Report Management</p>
                    </div>
                    <span className={cn("text-xs font-black uppercase tracking-widest", theme === 'light' ? "text-amber-700" : "text-amber-500/70")}>Clear <span className="text-amber-500/50">All Reports</span></span>
                  </div>
                </div>
                <Trash2 className="w-4 h-4 text-amber-500/20 group-hover:text-amber-500 transition-colors" />
              </button>

              <button 
                onClick={() => { 
                  haptic('heavy'); 
                  setConfirmAction({
                    type: 'reset',
                    title: 'Danger Zone',
                    message: 'Are you absolutely sure? This will permanently delete ALL trade records and reset capital settings.'
                  });
                }}
                className={cn(
                  "ios-card w-full flex items-center justify-between group transition-all active:scale-[0.99]",
                  theme === 'light' ? "bg-red-500/15 hover:bg-red-500/20" : "bg-red-500/[0.05] hover:bg-red-500/10"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-0.5">
                      <div className="w-1 h-1 rounded-full bg-red-500/40 shadow-[0_0_5px_rgba(239,68,68,0.2)]" />
                      <p className={cn("text-[7px] font-black uppercase tracking-[0.2em]", theme === 'light' ? "text-red-400" : "text-white/10")}>Maintenance</p>
                    </div>
                    <span className={cn("text-xs font-black uppercase tracking-widest", theme === 'light' ? "text-red-600" : "text-red-500/70")}>Wipe <span className="text-red-500/50">All Data</span></span>
                  </div>
                </div>
                <AlertTriangle className="w-5 h-5 text-red-500/20 group-hover:animate-pulse" />
              </button>

              <button 
                onClick={() => { 
                  haptic('heavy'); 
                  setConfirmAction({
                    type: 'reload',
                    title: 'System Reload',
                    message: 'Force refreshing the application will clear all temporary cache. Proceed?'
                  });
                }}
                className={cn(
                  "ios-card w-full flex items-center justify-between group transition-all active:scale-[0.99]",
                  theme === 'light' ? "bg-sky-500/15 hover:bg-sky-500/20" : "bg-sky-500/[0.05] hover:bg-sky-500/10"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center border border-sky-500/20">
                    <RotateCcw className="w-5 h-5 text-sky-500" />
                  </div>
                  <span className={cn("text-xs font-black uppercase tracking-widest", theme === 'light' ? "text-sky-600" : "text-sky-500/70")}>Force Update</span>
                </div>
                <RefreshCcw className="w-5 h-5 text-sky-500/20 group-hover:rotate-180 transition-transform duration-700" />
              </button>
            </div>

            {/* Footer Credits */}
            <div className="pt-12 flex flex-col items-center opacity-20">
              <p className={cn("text-[8px] font-black uppercase tracking-[0.6em]", theme === 'light' ? "text-slate-900" : "text-white")}>MAK GROUP SYSTEMS</p>
              <p className={cn("text-[6px] font-bold uppercase tracking-[0.4em] mt-2", theme === 'light' ? "text-slate-600" : "text-white/50")}>Precision Trading Intelligence © 2026</p>
            </div>

            {/* Modals follow below as they are state-driven */}
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
              <div className={cn(
                "fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in duration-300",
                theme === 'light' ? "bg-white/40" : "bg-black/95"
              )}>
                <div className={cn(
                  "w-full max-w-xs border rounded-[2.5rem] p-8 shadow-2xl scale-in-center",
                  theme === 'light' ? "bg-white border-slate-200" : "bg-[#0A0A0C] border-white/[0.05]"
                )}>
                  <div className={cn(
                    "w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 border animate-pulse",
                    confirmAction.type === 'reset' ? "bg-rose-500/10 border-rose-500/20" : 
                    confirmAction.type === 'reset_reports' ? "bg-amber-500/10 border-amber-500/20" :
                    "bg-sky-500/10 border-sky-500/20"
                  )}>
                    <RotateCcw className={cn("w-8 h-8", 
                      confirmAction.type === 'reset' ? "text-rose-500" : 
                      confirmAction.type === 'reset_reports' ? "text-amber-500" :
                      "text-sky-500"
                    )} />
                  </div>
                  <h3 className={cn("text-xl font-black mb-2 tracking-tighter text-center", theme === 'light' ? "text-slate-800" : "text-white")}>{confirmAction.title}</h3>
                  <p className={cn("text-[10px] font-black uppercase tracking-[0.2em] mb-8 text-center leading-relaxed px-4", theme === 'light' ? "text-slate-400" : "text-white/50")}>
                    {confirmAction.message}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => { setConfirmAction(null); haptic('light'); }}
                      className={cn(
                        "p-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-colors active:scale-95",
                        theme === 'light' ? "bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-200" : "bg-white/[0.03] border border-white/[0.05] text-white/60 hover:bg-white/10"
                      )}
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
                        } else if (confirmAction.type === 'reset_reports') {
                          handleDeleteMT5Reports();
                        } else if (confirmAction.type === 'reset_reports_date') {
                          handleDeleteMT5ReportsByDate();
                        } else {
                          handleResetAllData();
                        }
                        setConfirmAction(null);
                      }}
                      className={cn(
                            "p-4 rounded-2xl text-black text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg",
                            confirmAction.type === 'reset' ? "bg-rose-500 shadow-rose-500/20" : 
                            (confirmAction.type === 'reset_reports' || confirmAction.type === 'reset_reports_date') ? "bg-amber-500 shadow-amber-500/20" :
                            "bg-sky-500 shadow-sky-500/20"
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
              <div className={cn(
                "fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-300",
                theme === 'light' ? "bg-white/40" : "bg-black/90"
              )}>
                <div className={cn(
                  "w-full max-w-sm border rounded-[2rem] p-10 shadow-2xl scale-in-center",
                  theme === 'light' ? "bg-white border-slate-200" : "bg-[#0A0A0C] border-white/[0.05]"
                )}>
                  <div className={cn(
                    "w-16 h-16 border rounded-3xl flex items-center justify-center mx-auto mb-8",
                    theme === 'light' ? "bg-slate-50 border-slate-100" : "bg-white/[0.02] border border-white/[0.05]"
                  )}>
                    <Lock className="w-8 h-8 text-primary/60" />
                  </div>
                  <h3 className={cn("text-2xl font-black mb-2 tracking-tighter text-center", theme === 'light' ? "text-slate-800" : "text-white")}>Security Hub</h3>
                  <p className={cn("text-[10px] font-black uppercase tracking-[0.3em] mb-10 text-center", theme === 'light' ? "text-slate-400" : "text-white/50")}>Set 4-digit master code</p>
                  
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="••••"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value.replace(/\D/g, ''))}
                    className={cn(
                      "w-full border rounded-[1.8rem] p-6 text-center text-4xl tracking-[0.5em] font-black focus:outline-none transition-all mb-10",
                      theme === 'light' ? "bg-slate-50 border-slate-200 text-slate-800 focus:border-primary/40" : "bg-white/[0.01] border border-white/[0.05] text-white focus:border-primary/20"
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => { setIsChangingPass(false); setNewPass(''); haptic('light'); }}
                      className={cn(
                        "p-5 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-colors active:scale-95",
                        theme === 'light' ? "bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-200" : "bg-white/[0.03] border border-white/[0.05] text-white/60 hover:bg-white/10"
                      )}
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
        </div>
      );
    }
  };

  return (
    <div className={cn(
      "h-screen font-sans selection:bg-primary/30 antialiased relative flex flex-col overflow-hidden transition-colors duration-500",
      theme === 'dark' ? "bg-[#050507]" : "bg-[#f8f9fa]"
    )}>
      {/* iOS Glass Header - Fixed at top with safe area padding */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-[env(safe-area-inset-top)] pointer-events-none" />
      
      {/* Premium Background Design - Dynamic Theme */}
      {/* High Quality Image Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none bg-black">
        <img 
          src={background} 
          alt="" 
          className="absolute inset-0 w-full h-full object-cover opacity-100 border-none outline-none ring-0"
        />
        
        {/* Theme Overlay for Readability */}
        <div className={cn(
          "absolute inset-0 transition-all duration-500",
          theme === 'light' ? "bg-white/10" : "bg-black/30"
        )} />
        
        {/* Grain/Noise Texture for Premium Feel */}
        <div className={cn(
          "absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]",
          theme === 'light' && "invert"
        )} />
      </div>

      {isLocked && <LockScreen onUnlock={() => setIsLocked(false)} theme={theme} />}
      
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
        theme={theme}
      />

      {/* Main Content Area */}
       <main className="flex-1 overflow-y-auto relative z-10 pt-[calc(env(safe-area-inset-top)+2rem)] px-3 sm:px-6 custom-scroll pb-32">
        <div className="relative z-10 max-w-[1400px] mx-auto">
          {renderTabContent()}
        </div>
      </main>

      {/* iOS 26 Tab Bar */}
      <nav className={cn(
        "fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-4 right-4 z-50 backdrop-blur-[40px] border px-2 py-2 flex items-center justify-between shadow-2xl rounded-[2.5rem]",
        theme === 'light' ? "bg-white/60 border-white/60" : "bg-white/[0.01] border-white/5"
      )}>
        <button onClick={() => { setActiveTab('home'); haptic('light'); }} className="flex-1 flex justify-center group py-1">
          <div className={cn(
            "p-2.5 sm:p-3.5 transition-all duration-300 rounded-[1.2rem] sm:rounded-[1.5rem] flex items-center justify-center min-w-[50px] sm:min-w-[70px]",
            activeTab === 'home' 
              ? (theme === 'light' ? "bg-black/[0.05] text-slate-900 shadow-xl scale-110 border border-black/5" : "bg-white/[0.05] text-white shadow-xl scale-110 border border-white/10")
              : (theme === 'light' ? "text-slate-900/20 group-hover:text-slate-900/40" : "text-white/20 group-hover:text-white/40")
          )}>
            <LayoutGrid className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
        </button>
        <button onClick={() => { setActiveTab('analytics'); haptic('light'); }} className="flex-1 flex justify-center group py-1">
          <div className={cn(
            "p-2.5 sm:p-3.5 transition-all duration-300 rounded-[1.2rem] sm:rounded-[1.5rem] flex items-center justify-center min-w-[50px] sm:min-w-[70px]",
            activeTab === 'analytics' 
              ? (theme === 'light' ? "bg-black/[0.05] text-slate-900 shadow-xl scale-110 border border-black/5" : "bg-white/[0.05] text-white shadow-xl scale-110 border border-white/10")
              : (theme === 'light' ? "text-slate-900/20 group-hover:text-slate-900/40" : "text-white/20 group-hover:text-white/40")
          )}>
            <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
        </button>

        {/* Central Add Button (Now MT5 Import) */}
        <div className="flex-1 flex items-center justify-center -mt-10 sm:-mt-14">
          <button 
            onClick={() => { fileInputRef.current?.click(); haptic('medium'); }}
            className={cn(
              "w-16 h-16 sm:w-20 sm:h-20 backdrop-blur-[50px] rounded-[2rem] sm:rounded-[2.5rem] p-3 sm:p-4 border shadow-[0_15px_35px_rgba(0,0,0,0.4)] active:scale-90 transition-all duration-300 flex items-center justify-center group relative overflow-hidden",
              theme === 'light' ? "bg-white/80 border-white/60" : "bg-white/[0.02] border-white/5"
            )}
          >
            <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity", theme === 'light' ? "bg-black/5" : "bg-white/5")} />
            <img 
               src={logo} 
               alt="Logo" 
               className="w-full h-full object-contain relative z-10 group-hover:scale-110 transition-transform duration-500" 
             />
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
              ? (theme === 'light' ? "bg-black/[0.05] text-slate-900 shadow-xl scale-110 border border-black/5" : "bg-white/[0.05] text-white shadow-xl scale-110 border border-white/10")
              : (theme === 'light' ? "text-slate-900/20 group-hover:text-slate-900/40" : "text-white/20 group-hover:text-white/40")
          )}>
            <FileSpreadsheet className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
        </button>

        <button onClick={() => { setActiveTab('settings'); haptic('light'); }} className="flex-1 flex justify-center group py-1">
          <div className={cn(
            "p-2.5 sm:p-3.5 transition-all duration-300 rounded-[1.2rem] sm:rounded-[1.5rem] flex items-center justify-center min-w-[50px] sm:min-w-[70px]",
            activeTab === 'settings' 
              ? (theme === 'light' ? "bg-black/[0.05] text-slate-900 shadow-xl scale-110 border border-black/5" : "bg-white/[0.05] text-white shadow-xl scale-110 border border-white/10")
              : (theme === 'light' ? "text-slate-900/20 group-hover:text-slate-900/40" : "text-white/20 group-hover:text-white/40")
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

      {/* Withdrawal Modal */}
      {isAddingWithdrawal && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[110] animate-fade-in" onClick={() => setIsAddingWithdrawal(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[120] w-[90%] max-w-sm bg-white/[0.01] backdrop-blur-[30px] border border-white/5 rounded-[2.5rem] p-10 animate-in zoom-in duration-300 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent rounded-[2.5rem] pointer-events-none" />
            <div className="relative z-10">
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <LogOut className="w-8 h-8 text-red-500 rotate-90" />
              </div>
              <h3 className="text-xl font-black text-center mb-2 text-white tracking-tighter">Withdraw Profit</h3>
              <p className="text-[10px] font-black text-center mb-8 text-white/20 uppercase tracking-widest">Specify the amount to withdraw</p>
              
              <div className="space-y-4">
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-white/10">$</span>
                  <input 
                    type="number" 
                    value={withdrawalAmount} 
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white/[0.01] border border-white/[0.05] rounded-[1.8rem] p-8 text-center text-4xl font-black text-white outline-none focus:border-red-500/20 transition-all"
                    autoFocus
                  />
                </div>
                
                <input 
                  type="text" 
                  value={withdrawalNote} 
                  onChange={(e) => setWithdrawalNote(e.target.value)}
                  placeholder="Notes (Optional)"
                  className="w-full bg-white/[0.01] border border-white/[0.05] rounded-[1.2rem] p-4 text-center text-sm font-medium text-white/60 outline-none focus:border-white/10 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-8">
                <button 
                  onClick={() => setIsAddingWithdrawal(false)}
                  className="py-5 bg-white/[0.02] text-white/40 border border-white/[0.05] rounded-[1.2rem] font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={addWithdrawal}
                  className="py-5 bg-red-500 text-white rounded-[1.2rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-[0_10px_30px_rgba(239,68,68,0.2)] active:scale-95 transition-all"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {/* Glassmorphism Delete Confirmation Modal */}
      {recordToDelete && (
        <>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[200] animate-fade-in" onClick={() => setRecordToDelete(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[210] w-[85%] max-w-xs bg-white/[0.03] backdrop-blur-[50px] border border-white/10 rounded-[2.5rem] p-8 animate-in zoom-in duration-300 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent rounded-[2.5rem] pointer-events-none" />
            
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 relative overflow-hidden group">
              <div className="absolute inset-0 bg-red-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <Trash2 className="w-8 h-8 text-red-500 relative z-10" />
            </div>

            <h3 className="text-xl font-black text-center mb-2 text-white tracking-tighter">Confirm Deletion</h3>
            <p className="text-[10px] font-black text-center mb-8 text-white/30 uppercase tracking-[0.2em] leading-relaxed">
              Are you sure you want to revert this withdrawal? This action cannot be undone.
            </p>

            <div className="space-y-3">
              <button 
                onClick={confirmDelete}
                className="w-full py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-[0_10px_30px_rgba(239,68,68,0.2)] active:scale-95 transition-all"
              >
                Delete Permanently
              </button>
              <button 
                onClick={() => setRecordToDelete(null)}
                className="w-full py-4 bg-white/[0.05] text-white/60 border border-white/10 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-white/10 transition-all active:scale-95"
              >
                Keep Record
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
