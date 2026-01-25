import { type DailyRecord, type MT5Trade } from '../types';

export interface Statistics {
  winRate: number;
  maxDrawdown: number;
  maxDrawdownValue: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  bestDay: number;
  worstDay: number;
  expectedValue: number; // Average P/L per trade
  totalProfit: number;
  winLossRatio: number;
}

export interface SmartInsight {
  type: 'success' | 'warning' | 'info';
  title: string;
  message: string;
  value?: string;
  icon?: string;
}

export interface PeriodStats {
  label: string;
  profit: number;
  count: number;
}

export const getSmartInsights = (records: DailyRecord[], reportTrades: MT5Trade[] = []): SmartInsight[] => {
  const insights: SmartInsight[] = [];
  if (records.length < 3) return insights;

  // 1. Best Trading Day Analysis
  const dayStats: Record<string, { profit: number, count: number }> = {};
  records.forEach(r => {
    const day = new Date(r.date).toLocaleString('en-US', { weekday: 'long' });
    if (!dayStats[day]) dayStats[day] = { profit: 0, count: 0 };
    dayStats[day].profit += r.profitLoss;
    dayStats[day].count += 1;
  });

  const bestDay = Object.entries(dayStats).reduce((a, b) => b[1].profit > a[1].profit ? b : a);
  const worstDay = Object.entries(dayStats).reduce((a, b) => b[1].profit < a[1].profit ? b : a);

  if (bestDay[1].profit > 0) {
    insights.push({
      type: 'success',
      title: 'Optimal Trading Day',
      message: `Historically, your most profitable trades happen on ${bestDay[0]}.`,
      value: bestDay[0],
      icon: 'TrendingUp'
    });
  }

  // 2. Worst Trading Day Warning
  if (worstDay[1].profit < 0) {
    insights.push({
      type: 'warning',
      title: 'Risk Alert',
      message: `You tend to face more challenges on ${worstDay[0]}. Consider lowering your risk on this day.`,
      value: worstDay[0],
      icon: 'AlertTriangle'
    });
  }

  // 3. Time-based Analysis (If MT5 trades available)
  if (reportTrades.length > 0) {
    const sessionStats: Record<string, { profit: number, count: number }> = {
      'Morning (Asian)': { profit: 0, count: 0 },
      'Afternoon (London)': { profit: 0, count: 0 },
      'Evening (New York)': { profit: 0, count: 0 },
      'Night': { profit: 0, count: 0 }
    };

    reportTrades.forEach(t => {
      const hour = parseInt(t.closeTime.split(' ')[1].split(':')[0]);
      let session = '';
      if (hour >= 2 && hour < 10) session = 'Morning (Asian)';
      else if (hour >= 10 && hour < 16) session = 'Afternoon (London)';
      else if (hour >= 16 && hour < 22) session = 'Evening (New York)';
      else session = 'Night';

      sessionStats[session].profit += t.profit;
      sessionStats[session].count += 1;
    });

    const bestSession = Object.entries(sessionStats).reduce((a, b) => b[1].profit > a[1].profit ? b : a);
    if (bestSession[1].profit > 0) {
      insights.push({
        type: 'info',
        title: 'Session Mastery',
        message: `Your edge is strongest during the ${bestSession[0]} session.`,
        value: bestSession[0],
        icon: 'Clock'
      });
    }
  }

  // 4. Consistency Insight
  const winRate = (records.filter(r => r.profitLoss > 0).length / records.length) * 100;
  if (winRate > 60) {
    insights.push({
      type: 'success',
      title: 'High Consistency',
      message: `Your win rate is an impressive ${winRate.toFixed(1)}%. Keep following your execution plan.`,
      value: `${winRate.toFixed(0)}%`,
      icon: 'Target'
    });
  }

  return insights;
};

export const calculateStatistics = (records: DailyRecord[]): Statistics => {
  if (records.length === 0) {
    return {
      winRate: 0,
      maxDrawdown: 0,
      maxDrawdownValue: 0,
      profitFactor: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      averageWin: 0,
      averageLoss: 0,
      bestDay: 0,
      worstDay: 0,
      expectedValue: 0,
      totalProfit: 0,
      winLossRatio: 0,
    };
  }

  // Sort by date ascending for drawdown calculation
  const sortedRecords = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let peakCapital = -Infinity;
  let maxDrawdown = 0;
  let maxDrawdownValue = 0;
  let currentCapital = sortedRecords[0].capitalBefore; // Start from the very beginning

  // Drawdown Calculation
  // We need to simulate the capital curve
  const capitalCurve = [currentCapital];
  sortedRecords.forEach(r => {
    currentCapital += r.profitLoss;
    capitalCurve.push(currentCapital);
  });

  capitalCurve.forEach(cap => {
    if (cap > peakCapital) {
      peakCapital = cap;
    }
    const drawdown = peakCapital - cap;
    const drawdownPercent = peakCapital > 0 ? (drawdown / peakCapital) * 100 : 0;
    
    if (drawdown > maxDrawdownValue) maxDrawdownValue = drawdown;
    if (drawdownPercent > maxDrawdown) maxDrawdown = drawdownPercent;
  });

  // Basic Stats
  const wins = records.filter(r => r.profitLoss > 0);
  const losses = records.filter(r => r.profitLoss <= 0); // Include break-even as non-wins or handle separately? Usually 0 is neutral. Let's count > 0 as win.

  const totalTrades = records.length;
  const winningTrades = wins.length;
  const losingTrades = records.length - winningTrades;
  const winRate = (winningTrades / totalTrades) * 100;

  const grossProfit = wins.reduce((acc, r) => acc + r.profitLoss, 0);
  const grossLoss = Math.abs(losses.reduce((acc, r) => acc + r.profitLoss, 0));
  const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;

  const averageWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const averageLoss = losses.length > 0 ? grossLoss / losses.length : 0; // Absolute value

  const bestDay = Math.max(...records.map(r => r.profitLoss));
  const worstDay = Math.min(...records.map(r => r.profitLoss));

  const totalProfit = records.reduce((acc, r) => acc + r.profitLoss, 0);
  const expectedValue = totalProfit / totalTrades;
  const winLossRatio = averageLoss === 0 ? averageWin : averageWin / averageLoss;

  return {
    winRate,
    maxDrawdown,
    maxDrawdownValue,
    profitFactor,
    totalTrades,
    winningTrades,
    losingTrades,
    averageWin,
    averageLoss,
    bestDay,
    worstDay,
    expectedValue,
    totalProfit,
    winLossRatio,
  };
};

export const getPeriodStats = (records: DailyRecord[]) => {
  const weeklyStats: Record<string, number> = {};
  const monthlyStats: Record<string, number> = {};
  const dailyStats: Record<string, number> = {}; // Day of week stats

  records.forEach(record => {
    const date = new Date(record.date);
    
    // Weekly (Mon-Sun)
    // To get Monday as start: (day + 6) % 7
    // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
    // (0+6)%7 = 6 (Sun)
    // (1+6)%7 = 0 (Mon)
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const weekKey = `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    
    weeklyStats[weekKey] = (weeklyStats[weekKey] || 0) + record.profitLoss;

    // Restore date for subsequent calculations
    const originalDate = new Date(record.date);

    // Monthly
    const monthKey = originalDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    monthlyStats[monthKey] = (monthlyStats[monthKey] || 0) + record.profitLoss;

    // Daily (Day of Week)
    const dayKey = originalDate.toLocaleString('en-US', { weekday: 'short' });
    dailyStats[dayKey] = (dailyStats[dayKey] || 0) + record.profitLoss;
  });

  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return {
    weekly: Object.entries(weeklyStats).map(([label, profit]) => ({ label, profit, count: 0 })),
    monthly: Object.entries(monthlyStats).map(([label, profit]) => ({ label, profit, count: 0 })),
    daily: dayOrder.map(day => ({
      label: day,
      profit: dailyStats[day] || 0,
      count: 0
    })),
  };
};
