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
  grossProfit: number;
  grossLoss: number;
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

export interface SessionStats {
  label: string;
  profit: number;
  count: number;
  winRate: number;
}

export const calculateSessionStats = (trades: MT5Trade[]): SessionStats[] => {
  const sessionStats: Record<string, { profit: number, count: number, wins: number }> = {
    'Asian': { profit: 0, count: 0, wins: 0 },
    'London': { profit: 0, count: 0, wins: 0 },
    'New York': { profit: 0, count: 0, wins: 0 },
    'Night': { profit: 0, count: 0, wins: 0 }
  };

  trades.forEach(t => {
    // Expected format: "2024.01.26 14:30:00"
    const hour = parseInt(t.closeTime.split(' ')[1]?.split(':')[0] || '0');
    let session = '';
    
    // Standard session hours (UTC approximate)
    if (hour >= 0 && hour < 8) session = 'Asian';
    else if (hour >= 8 && hour < 13) session = 'London';
    else if (hour >= 13 && hour < 21) session = 'New York';
    else session = 'Night';

    const netProfit = t.profit + (t.commission || 0) + (t.swap || 0);
    sessionStats[session].profit += netProfit;
    sessionStats[session].count += 1;
    if (netProfit > 0) sessionStats[session].wins += 1;
  });

  return Object.entries(sessionStats).map(([label, stats]) => ({
    label,
    profit: parseFloat(stats.profit.toFixed(2)),
    count: stats.count,
    winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0
  }));
};

export const getSmartInsights = (records: DailyRecord[], reportTrades: MT5Trade[] = []): SmartInsight[] => {
  const insights: SmartInsight[] = [];
  const tradeRecords = records.filter(r => r.type !== 'withdrawal');
  if (tradeRecords.length < 3) return insights;

  // 1. Best Trading Day Analysis
  const dayStats: Record<string, { profit: number, count: number }> = {};
  tradeRecords.forEach(r => {
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
    const sessionData = calculateSessionStats(reportTrades);
    const bestSession = sessionData.reduce((a, b) => b.profit > a.profit ? b : a);
    const worstSession = sessionData.reduce((a, b) => b.profit < a.profit ? b : a);

    if (bestSession.profit > 0) {
      insights.push({
        type: 'info',
        title: 'Session Mastery',
        message: `Your edge is strongest during the ${bestSession.label} session.`,
        value: bestSession.label,
        icon: 'Clock'
      });
    }

    if (worstSession.profit < 0) {
      insights.push({
        type: 'warning',
        title: 'Session Warning',
        message: `Performance drops during the ${worstSession.label} session. Stay vigilant.`,
        value: worstSession.label,
        icon: 'AlertTriangle'
      });
    }
  }

  // 4. Consistency Insight
  const winRate = (tradeRecords.filter(r => r.profitLoss > 0).length / tradeRecords.length) * 100;
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

export const calculateStatistics = (records: DailyRecord[], initialCapital: number = 1000, reportTrades: MT5Trade[] = []): Statistics => {
  if (records.length === 0 && reportTrades.length === 0) {
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
      grossProfit: 0,
      grossLoss: 0,
    };
  }

  // If we have individual trades, use them for Gross Profit/Loss calculation
  // otherwise fallback to daily records.
  let grossProfit = 0;
  let grossLoss = 0;
  let totalTradesCount = 0;
  let winningTradesCount = 0;
  let losingTradesCount = 0;

  if (reportTrades.length > 0) {
    reportTrades.forEach(t => {
      const netProfit = t.profit + (t.commission || 0) + (t.swap || 0);
      if (netProfit > 0) {
        grossProfit += netProfit;
        winningTradesCount++;
      } else if (netProfit < 0) {
        grossLoss += Math.abs(netProfit);
        losingTradesCount++;
      }
      totalTradesCount++;
    });
  } else {
    // Fallback to daily records if no individual trades
    // Only include trade records for performance statistics
    const tradeRecords = records.filter(r => r.type !== 'withdrawal');
    const wins = tradeRecords.filter(r => r.profitLoss > 0);
    const losses = tradeRecords.filter(r => r.profitLoss < 0);
    grossProfit = wins.reduce((acc, r) => acc + r.profitLoss, 0);
    grossLoss = Math.abs(losses.reduce((acc, r) => acc + r.profitLoss, 0));
    totalTradesCount = tradeRecords.length;
    winningTradesCount = wins.length;
    losingTradesCount = tradeRecords.length - winningTradesCount;
  }

  // Sort by date ascending for drawdown calculation
  const sortedRecords = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Drawdown Calculation - Account for withdrawals
  let peakCapital = initialCapital;
  let maxDrawdown = 0;
  let maxDrawdownValue = 0;
  let currentCapital = initialCapital;

  sortedRecords.forEach(r => {
    if (r.type === 'withdrawal') {
      // For withdrawals, we subtract from current capital AND peak capital
      // so it doesn't appear as a "trading loss" drawdown
      const withdrawalAmount = Math.abs(r.profitLoss);
      currentCapital -= withdrawalAmount;
      peakCapital -= withdrawalAmount;
      // Ensure peak capital doesn't go below current capital
      if (peakCapital < currentCapital) peakCapital = currentCapital;
    } else {
      currentCapital += r.profitLoss;
      
      if (currentCapital > peakCapital) {
        peakCapital = currentCapital;
      }
      
      const drawdown = peakCapital - currentCapital;
      const drawdownPercent = peakCapital > 0 ? (drawdown / peakCapital) * 100 : 0;
      
      if (drawdown > maxDrawdownValue) maxDrawdownValue = drawdown;
      if (drawdownPercent > maxDrawdown) maxDrawdown = drawdownPercent;
    }
  });

  const winRate = totalTradesCount > 0 ? (winningTradesCount / totalTradesCount) * 100 : 0;
  const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;

  const averageWin = winningTradesCount > 0 ? grossProfit / winningTradesCount : 0;
  const averageLoss = losingTradesCount > 0 ? grossLoss / losingTradesCount : 0;

  const tradeRecordsOnly = records.filter(r => r.type !== 'withdrawal');
  const bestDay = tradeRecordsOnly.length > 0 ? Math.max(...tradeRecordsOnly.map(r => r.profitLoss)) : 0;
  const worstDay = tradeRecordsOnly.length > 0 ? Math.min(...tradeRecordsOnly.map(r => r.profitLoss)) : 0;

  // Total profit should be from trades only
  const totalProfit = tradeRecordsOnly.reduce((acc, r) => acc + r.profitLoss, 0);
  const expectedValue = totalTradesCount > 0 ? totalProfit / totalTradesCount : 0;
  const winLossRatio = averageLoss === 0 ? averageWin : averageWin / averageLoss;

  return {
    winRate,
    maxDrawdown,
    maxDrawdownValue,
    profitFactor,
    totalTrades: totalTradesCount,
    winningTrades: winningTradesCount,
    losingTrades: losingTradesCount,
    averageWin,
    averageLoss,
    bestDay,
    worstDay,
    expectedValue,
    totalProfit,
    winLossRatio,
    grossProfit,
    grossLoss,
  };
};

export const getPeriodStats = (records: DailyRecord[]) => {
  const weeklyStats: Record<string, number> = {};
  const monthlyStats: Record<string, number> = {};
  const dailyByDateStats: Record<string, number> = {};

  // Filter out withdrawals for period profit statistics
  const tradeRecords = records.filter(r => r.type !== 'withdrawal');
  
  // Sort records by date to ensure the daily distribution follows chronological order
  const sortedRecords = [...tradeRecords].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedRecords.forEach(record => {
    const date = new Date(record.date);
    
    // Use UTC methods to avoid timezone shifts
    // Weekly (Mon-Sun)
    const day = date.getUTCDay();
    const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setUTCDate(diff);
    monday.setUTCHours(0, 0, 0, 0);
    const weekKey = `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
    
    weeklyStats[weekKey] = (weeklyStats[weekKey] || 0) + record.profitLoss;

    // Monthly
    const monthKey = date.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    monthlyStats[monthKey] = (monthlyStats[monthKey] || 0) + record.profitLoss;

    // Daily (By Date)
    const dailyKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    dailyByDateStats[dailyKey] = (dailyByDateStats[dailyKey] || 0) + record.profitLoss;
  });

  return {
    weekly: Object.entries(weeklyStats).map(([label, profit]) => ({ label, profit, count: 0 })),
    monthly: Object.entries(monthlyStats).map(([label, profit]) => ({ label, profit, count: 0 })),
    daily: Object.entries(dailyByDateStats).map(([label, profit]) => ({
      label,
      profit: parseFloat(profit.toFixed(2)),
      count: 0
    })),
  };
};
