import { useState } from 'react';
import { ref, set, get } from 'firebase/database';
import { db } from '../firebase';

interface FraudMetrics {
  riskScore: number;
  flags: string[];
  lastLoginIP: string;
  deviceFingerprint: string;
  loginAttempts: number;
  tradingPattern: {
    rapidTrades: number;
    volumeSpikes: number;
    unusualHours: number;
  };
}

interface TradePattern {
  timestamp: string;
  volume: number;
  price: number;
  type: 'buy' | 'sell';
}

interface MarketCondition {
  volatility: number;
  volume: number;
  trend: 'up' | 'down' | 'sideways';
  timeOfDay: number;
}

interface UserBehavior {
  typingSpeed: number;
  mouseMovements: number;
  tabSwitches: number;
  lastLocations: string[];
  deviceChanges: string[];
  tradingTimePatterns: number[];
}

export function useFraudDetection() {
  const [fraudMetrics, _setFraudMetrics] = useState<FraudMetrics | null>(null);

  const analyzeDeposits = (deposits: any[], annualIncome: number) => {
    const flags: string[] = [];
    
    // Calculate 10% of annual income
    const tenPercentIncome = annualIncome * 0.1;
    
    // Get recent deposits (last 3)
    const recentDeposits = deposits.slice(-3);
    
    // Track the progression of deposits
    if (recentDeposits.length > 0) {
      const totalAmount = recentDeposits.reduce((sum, d) => sum + d.amount, 0);
      
      if (recentDeposits.length === 1) {
        // First deposit - just monitor
        if (totalAmount > tenPercentIncome) {
          flags.push('First deposit exceeds 10% of annual income');
        }
      } else if (recentDeposits.length === 2) {
        // Second deposit - warning if total exceeds threshold
        if (totalAmount > tenPercentIncome * 2) {
          flags.push('Warning: Multiple large deposits detected');
        }
      } else if (recentDeposits.length === 3) {
        // Third deposit - suspicious activity if pattern continues
        if (totalAmount > tenPercentIncome * 3) {
          flags.push('Suspicious activity: Deposits exceed expected income pattern');
        }
      }
    }

    // Keep the rapid deposits check
    const rapidDeposits = deposits.filter(d => 
      new Date().getTime() - new Date(d.timestamp).getTime() < 5000
    );
    
    if (rapidDeposits.length >= 2) {
      flags.push('Suspicious rapid deposits detected');
    }

    return flags;
  };

  const analyzeTradingPattern = (trades: TradePattern[], marketCondition: MarketCondition, userBehavior: UserBehavior) => {
    const flags: string[] = [];
    
    // Enhanced wash trading detection
    const potentialWashTrades = trades.reduce((count, trade, index) => {
      if (index === trades.length - 1) return count;
      
      const nextTrade = trades[index + 1];
      const timeDiff = new Date(trade.timestamp).getTime() - 
                       new Date(nextTrade.timestamp).getTime();
      
      // Check for wash trading patterns
      if (
        trade.type !== nextTrade.type && // Opposite trade types
        Math.abs(trade.volume - nextTrade.volume) < 0.0001 && // Same volume (with small tolerance)
        Math.abs(timeDiff) < 60000 && // Within 1 minute
        Math.abs(trade.price - nextTrade.price) / trade.price < 0.01 // Price difference < 1%
      ) {
        return count + 1;
      }
      return count;
    }, 0);

    if (potentialWashTrades >= 2) {
      flags.push('Potential wash trading detected');
    }

    // Check for rapid trading pattern
    const rapidTradeCount = trades.reduce((count, trade, index) => {
      if (index === 0) return count;
      const prevTrade = trades[index - 1];
      const timeDiff = new Date(trade.timestamp).getTime() - 
                       new Date(prevTrade.timestamp).getTime();
      return timeDiff < 2000 ? count + 1 : count; // 2 seconds between trades
    }, 0);

    if (rapidTradeCount >= 3) {
      flags.push('Suspicious rapid trading activity');
    }

    // 1. Counter-trend Trading Pattern
    const isCounterTrend = trades.some((trade, index) => {
      if (index === 0) return false;
      return (marketCondition.trend === 'up' && trade.type === 'sell') ||
             (marketCondition.trend === 'down' && trade.type === 'buy');
    });

    // 2. AI-Bot Detection
    const isPotentialBot = 
      userBehavior.typingSpeed > 200 || // Typing too fast
      userBehavior.mouseMovements < 10 || // Too few mouse movements
      userBehavior.tabSwitches === 0; // No tab switches

    // 3. Multi-Account Correlation
    const hasLocationAnomaly = userBehavior.lastLocations.length > 1 &&
      new Set(userBehavior.lastLocations).size > 3;

    // 4. Time-Based Manipulation
    const hasAbnormalTiming = trades.some(trade => {
      const tradeHour = new Date(trade.timestamp).getHours();
      return Math.abs(tradeHour - marketCondition.timeOfDay) < 0.1;
    });

    // 5. Volume-Price Manipulation
    const hasVolumeAnomaly = trades.some((trade, index) => {
      if (index === 0) return false;
      const prevTrade = trades[index - 1];
      return (trade.volume > marketCondition.volume * 0.1) && 
             (Math.abs(trade.price - prevTrade.price) < 0.01);
    });

    // 6. Device Fingerprint Analysis
    const hasDeviceAnomaly = userBehavior.deviceChanges.length > 2 &&
      new Set(userBehavior.deviceChanges).size > 1;

    // 7. Trading Rhythm Analysis
    const tradingIntervals = trades.reduce((intervals: number[], trade, index) => {
      if (index === 0) return intervals;
      const prevTrade = trades[index - 1];
      const interval = new Date(trade.timestamp).getTime() - 
                      new Date(prevTrade.timestamp).getTime();
      return [...intervals, interval];
    }, []);

    const hasRhythmicPattern = tradingIntervals.every((interval, index) => 
      index === 0 || Math.abs(interval - tradingIntervals[0]) < 100
    );

    // Add flags based on new criteria
    if (isCounterTrend && trades.length > 5) {
      flags.push('Suspicious counter-trend trading pattern');
    }

    if (isPotentialBot) {
      flags.push('Potential automated trading bot detected');
    }

    if (hasLocationAnomaly) {
      flags.push('Multiple location access detected');
    }

    if (hasAbnormalTiming && trades.length > 3) {
      flags.push('Suspicious trade timing pattern');
    }

    if (hasVolumeAnomaly) {
      flags.push('Abnormal volume-price relationship detected');
    }

    if (hasDeviceAnomaly) {
      flags.push('Multiple device switching detected');
    }

    if (hasRhythmicPattern && trades.length > 4) {
      flags.push('Algorithmic trading pattern detected');
    }

    return flags;
  };

  const detectDeviceFingerprint = () => {
    // Basic device fingerprinting
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    return btoa(JSON.stringify(fingerprint));
  };

  const monitorLoginAttempts = async (userId: string) => {
    const loginRef = ref(db, `loginAttempts/${userId}`);
    const snapshot = await get(loginRef);
    const attempts = snapshot.val() || { count: 0, timestamp: Date.now() };
    
    // Reset if last attempt was more than 24 hours ago
    if (Date.now() - attempts.timestamp > 24 * 60 * 60 * 1000) {
      attempts.count = 0;
    }

    attempts.count++;
    attempts.timestamp = Date.now();

    await set(loginRef, attempts);
    return attempts.count;
  };

  const calculateRiskScore = (flags: string[]) => {
    let score = 0;
    flags.forEach(flag => {
      switch (flag) {
        case 'Suspicious counter-trend trading pattern':
          score += 35;
          break;
        case 'Potential automated trading bot detected':
          score += 45;
          break;
        case 'Multiple location access detected':
          score += 50;
          break;
        case 'Suspicious trade timing pattern':
          score += 30;
          break;
        case 'Abnormal volume-price relationship detected':
          score += 40;
          break;
        case 'Multiple device switching detected':
          score += 35;
          break;
        case 'Algorithmic trading pattern detected':
          score += 45;
          break;
        case 'Suspicious rapid deposits detected':
          score += 30;
          break;
        case 'Warning: Recent deposits exceed 10% of annual income':
          score += 40;
          break;
        case 'Potential wash trading detected':
          score += 60;
          break;
        case 'Suspicious rapid trading activity':
          score += 40;
          break;
        default:
          score += 10;
      }
    });
    return Math.min(score, 100);
  };

  return {
    analyzeDeposits,
    analyzeTradingPattern,
    detectDeviceFingerprint,
    monitorLoginAttempts,
    calculateRiskScore,
    fraudMetrics
  };
} 