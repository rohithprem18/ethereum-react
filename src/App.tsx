import React, { useState } from 'react';
import { TrendingUp, DollarSign, UserCircle, LogOut, Shield, HelpCircle, Bell, LineChart } from 'lucide-react';
import { useWallet } from './hooks/useWallet';
import { useAuth } from './hooks/useAuth';
import { TradeHistory } from './components/TradeHistory';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ResponsiveContainer, 
  ComposedChart,
  ReferenceLine,
  Area
} from 'recharts';
import { Toaster, toast } from 'react-hot-toast';
import { useFraudDetection } from './hooks/useFraudDetection';
import { BrowserRouter as Router } from 'react-router-dom';

interface Trade {
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: string;
  userId: string;
}

interface PriceAlert {
  id: string;
  price: number;
  type: 'above' | 'below';
  active: boolean;
}

interface PortfolioMetrics {
  totalValue: number;
  pnl: number;
  pnlPercentage: number;
  risk: number;
  realizedPnL: number;
  unrealizedPnL: number;
}

interface PriceData {
  time: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  tradeType?: 'buy' | 'sell';
  tradeAmount?: number;
  tradePrice?: number;
}

interface StopOrder {
  id: string;
  type: 'stop-loss' | 'take-profit';
  price: number;
  amount: number;
  active: boolean;
  originalPrice: number;
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


// Add this interface for tooltips
interface TooltipProps {
  text: string;
}

function App() {
  const { 
    balance: getBalance, 
    trades: getTrades, 
    addFunds, 
    executeTrade, 
    withdraw,
    getWalletState
  } = useWallet();
  const { currentUser, register, login, logout, updateUserTradeCount } = useAuth();
  const { 
    analyzeDeposits, 
    analyzeTradingPattern, 
    calculateRiskScore 
  } = useFraudDetection();
  const [showLogin, setShowLogin] = useState(true);
  const [ethPrice, setEthPrice] = useState(3000);
  const [addAmount, setAddAmount] = useState('');
  const [tradeAmount, setTradeAmount] = useState('');
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [priceHistory, setPriceHistory] = useState<PriceData[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertPrice, setAlertPrice] = useState('');
  const [alertType, setAlertType] = useState<'above' | 'below'>('above');
  const [showRiskWarning, setShowRiskWarning] = useState(false);
  const [pendingTradeType, setPendingTradeType] = useState<'buy' | 'sell'>('buy');
  const [stopOrders, setStopOrders] = useState<StopOrder[]>([]);
  const [showStopOrderModal, setShowStopOrderModal] = useState(false);
  const [stopOrderType, setStopOrderType] = useState<'stop-loss' | 'take-profit'>('stop-loss');
  const [stopPrice, setStopPrice] = useState('');
  const [stopAmount, setStopAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [marketCondition] = useState<MarketCondition>({
    volatility: 0,
    volume: 0,
    trend: 'sideways' as const,
    timeOfDay: new Date().getHours()
  });
  const [userBehavior, setUserBehavior] = useState<UserBehavior>({
    typingSpeed: 0,
    mouseMovements: 0,
    tabSwitches: 0,
    lastLocations: [],
    deviceChanges: [],
    tradingTimePatterns: []
  });

  React.useEffect(() => {
    const interval = setInterval(() => {
      setEthPrice(prev => {
        const change = (Math.random() - 0.5) * 100;
        const newPrice = Math.max(1000, prev + change);
        
        setPriceHistory(history => {
          const now = new Date();
          const timeStr = now.toLocaleTimeString();
          
          const newCandle = {
            time: timeStr,
            open: prev,
            close: newPrice,
            high: Math.max(prev, newPrice),
            low: Math.min(prev, newPrice),
            volume: Math.random() * 100 + 50 // Simulated volume
          };

          const updatedHistory = [...history, newCandle].slice(-30); // Keep last 30 candles
          return updatedHistory;
        });

        return newPrice;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (priceAlerts.length > 0) {
      priceAlerts.forEach(alert => {
        if (alert.active) {
          if (alert.type === 'above' && ethPrice >= alert.price) {
            toast.success(`Price Alert: ETH is now above $${alert.price}`);
            // Deactivate the alert after triggering
            setPriceAlerts(alerts => 
              alerts.map(a => a.id === alert.id ? { ...a, active: false } : a)
            );
          } else if (alert.type === 'below' && ethPrice <= alert.price) {
            toast.success(`Price Alert: ETH is now below $${alert.price}`);
            setPriceAlerts(alerts => 
              alerts.map(a => a.id === alert.id ? { ...a, active: false } : a)
            );
          }
        }
      });
    }
  }, [ethPrice, priceAlerts]);

  // Add this effect to monitor stop orders
  React.useEffect(() => {
    if (stopOrders.length > 0) {
      stopOrders.forEach(order => {
        if (order.active) {
          if (order.type === 'stop-loss' && ethPrice <= order.price) {
            // Execute stop loss
            handleStopOrder(order);
          } else if (order.type === 'take-profit' && ethPrice >= order.price) {
            // Execute take profit
            handleStopOrder(order);
          }
        }
      });
    }
  }, [ethPrice, stopOrders]);

  if (!currentUser) {
    return showLogin ? (
      <Login onLogin={login} onSwitch={() => setShowLogin(false)} />
    ) : (
      <Register onRegister={register} onSwitch={() => setShowLogin(true)} />
    );
  }

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(addAmount);
    if (amount > 0) {
      try {
        const walletState = getWalletState();
        const deposits = walletState[currentUser.username]?.transactions
          .filter((t: { type: string }) => t.type === 'deposit') || [];
        
        // Analyze for fraud
        const fraudFlags = analyzeDeposits(deposits, currentUser.annualIncome);
        
        // Show warnings but allow the transaction
        if (fraudFlags.length > 0) {
          fraudFlags.forEach(flag => {
            showWarning(flag);
          });
        }

        // Execute the deposit regardless of warnings
        await addFunds(amount, currentUser);
        setAddAmount('');
        toast.success(`Successfully added $${amount.toFixed(2)} to your wallet`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to add funds');
      }
    }
  };

  const calculatePortfolioMetrics = (): PortfolioMetrics => {
    const trades = getTrades(currentUser);
    const ethBalance = getEthBalance(trades);
    const currentBalance = getBalance(currentUser);
    
    // Calculate total value (USD balance + ETH value)
    const ethValue = ethBalance * ethPrice;
    const totalValue = currentBalance + ethValue;

    // Calculate realized P&L from completed trades
    const realizedPnL = trades.reduce((total, trade) => {
      if (trade.type === 'sell') {
        // Calculate profit/loss for each sell
        const buyPrice = trades.find(t => 
          t.type === 'buy' && 
          t.amount === trade.amount && 
          new Date(t.timestamp) < new Date(trade.timestamp)
        )?.price || 0;
        
        return total + ((trade.price - buyPrice) * trade.amount);
      }
      return total;
    }, 0);

    // Calculate unrealized P&L
    const buyTrades = trades.filter(t => t.type === 'buy');
    const avgBuyPrice = buyTrades.length > 0
      ? buyTrades.reduce((sum, trade) => sum + (trade.price * trade.amount), 0) / 
        buyTrades.reduce((sum, trade) => sum + trade.amount, 0)
      : 0;
    
    const unrealizedPnL = ethBalance * (ethPrice - avgBuyPrice);

    // Calculate total P&L
    const totalPnL = realizedPnL + unrealizedPnL;

    // Calculate total invested amount
    const totalInvested = buyTrades.reduce((sum, trade) => 
      sum + (trade.amount * trade.price), 0);

    // Calculate P&L percentage
    const pnlPercentage = totalInvested > 0 
      ? (totalPnL / totalInvested) * 100 
      : 0;

    // Calculate risk level based on portfolio concentration
    const ethExposure = ethValue / (totalValue || 1);
    const risk = Math.min(100, Math.max(0, ethExposure * 100));

    return {
      totalValue: Number(totalValue.toFixed(2)),
      pnl: Number(totalPnL.toFixed(2)),
      pnlPercentage: Number(pnlPercentage.toFixed(2)),
      risk: Number(risk.toFixed(2)),
      realizedPnL: Number(realizedPnL.toFixed(2)),
      unrealizedPnL: Number(unrealizedPnL.toFixed(2))
    };
  };

  const handleAddAlert = () => {
    const price = parseFloat(alertPrice);
    if (price > 0) {
      const newAlert: PriceAlert = {
        id: Date.now().toString(),
        price,
        type: alertType,
        active: true
      };
      setPriceAlerts([...priceAlerts, newAlert]);
      setShowAlertModal(false);
      setAlertPrice('');
      toast.success(`Price alert set for $${price}`);
    }
  };

  const handleTrade = async (type: 'buy' | 'sell') => {
    const amount = parseFloat(tradeAmount);
    if (amount > 0) {
      try {
        // Get recent trading history
        const recentTrades = getTrades(currentUser)
          .slice(0, 10)
          .map(trade => ({
            timestamp: trade.timestamp,
            volume: trade.amount,
            price: trade.price,
            type: trade.type
          }));

        // Analyze trading patterns with market condition and user behavior
        const fraudFlags = analyzeTradingPattern(recentTrades, marketCondition, userBehavior);
        const riskScore = calculateRiskScore(fraudFlags);

        // Lower threshold for testing
        if (riskScore > 60) { // Changed from 80
          toast.error('Trade blocked: Suspicious wash trading pattern detected');
          return;
        }

        if (fraudFlags.length > 0) {
          showWarning('Warning: Potential wash trading pattern detected');
        }

        const metrics = calculatePortfolioMetrics();
        
        if (metrics.risk > 70) {
          setPendingTradeType(type);
          setShowRiskWarning(true);
          return;
        }

        const now = new Date();
        const timestamp = now.toLocaleTimeString();
        
        // Execute the trade
        executeTrade(type, amount, ethPrice, currentUser, timestamp);
        updateUserTradeCount(currentUser.username);
        setTradeAmount('');

        // Update the last candle with trade information
        setPriceHistory(history => {
          const lastIndex = history.length - 1;
          return history.map((candle, index) => {
            if (index === lastIndex) {
              return {
                ...candle,
                tradeType: type,
                tradeAmount: amount,
                tradePrice: ethPrice,
                timestamp // Add timestamp to match with trade
              };
            }
            return candle;
          });
        });

        toast.success(`Successfully ${type === 'buy' ? 'bought' : 'sold'} ${amount} ETH`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('wait')) {
          // Cooldown message
          toast(error.message, {
            icon: '⏳',
            style: {
              background: '#3b82f6',
              color: '#fff',
              fontWeight: '500',
            },
          });
        } else {
          // Error message
          toast.error(error instanceof Error ? error.message : 'Trade failed');
        }
      }
    }
  };

  const getEthBalance = (trades: Trade[]) => {
    return trades.reduce((total, trade) => {
      return total + (trade.type === 'buy' ? trade.amount : -trade.amount);
    }, 0);
  };

  // Update the renderPriceChart function with light theme colors
  const renderPriceChart = () => (
    <div className="bg-white p-6 rounded-lg shadow-md h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            ETH/USD
          </h3>
          <p className="text-gray-500 text-sm">Real-time price updates</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">${ethPrice.toFixed(2)}</p>
          <p className={`text-sm ${
            priceHistory.length > 1 && 
            priceHistory[priceHistory.length - 1].close > priceHistory[priceHistory.length - 2].close 
              ? 'text-green-600' 
              : 'text-red-600'
          }`}>
            {priceHistory.length > 1 
              ? `${(((priceHistory[priceHistory.length - 1].close - priceHistory[priceHistory.length - 2].close) / priceHistory[priceHistory.length - 2].close) * 100).toFixed(2)}%`
              : '0.00%'}
          </p>
        </div>
      </div>
      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={priceHistory}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>

            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#E5E7EB"
              vertical={false}
            />
            
            <XAxis 
              dataKey="time" 
              stroke="#6B7280"
              tick={{ fill: '#374151' }}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            
            <YAxis 
              yAxisId="price"
              domain={['dataMin - 100', 'dataMax + 100']}
              stroke="#6B7280"
              tick={{ fill: '#374151' }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickFormatter={(value) => `$${value}`}
            />
            
            <Tooltip
              content={({ payload, label }) => {
                if (payload && payload[0]) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                      <p className="text-gray-500 mb-2">{label}</p>
                      <div className="space-y-1">
                        <p className="font-semibold">Price: <span className="text-blue-600">${data.close.toFixed(2)}</span></p>
                        <p className="font-semibold">Change: 
                          <span className={data.close >= data.open ? 'text-green-600' : 'text-red-600'}>
                            {' '}{((data.close - data.open) / data.open * 100).toFixed(2)}%
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Price Area */}
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="close"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPrice)"
            />

            {/* Trade markers */}
            {priceHistory.map((point, index) => {
              if (point.tradeType) {
                return (
                  <ReferenceLine
                    key={`trade-${index}`}
                    yAxisId="price"
                    x={point.time}
                    stroke={point.tradeType === 'buy' ? '#22c55e' : '#ef4444'}
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    label={{
                      value: `${point.tradeType.toUpperCase()} ${point.tradeAmount} ETH\n$${point.tradePrice?.toFixed(2)}`,
                      position: 'insideTopRight',
                      fill: point.tradeType === 'buy' ? '#22c55e' : '#ef4444',
                      fontSize: 12
                    }}
                  />
                );
              }
              return null;
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const RiskWarningModal = () => (
    showRiskWarning && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-2 text-red-500 mb-4">
            <Shield className="w-6 h-6" />
            <h3 className="text-xl font-bold">High Risk Warning</h3>
          </div>
          <p className="text-gray-700 mb-4">
            This trade would put your portfolio at high risk. Consider reducing the
            trade amount or diversifying your position.
          </p>
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setShowRiskWarning(false)}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowRiskWarning(false);
                const now = new Date();
                executeTrade(
                  pendingTradeType,
                  parseFloat(tradeAmount),
                  ethPrice,
                  currentUser,
                  now.toLocaleTimeString()
                );
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Trade Anyway
            </button>
          </div>
        </div>
      </div>
    )
  );

  const handleAlertPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and one decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAlertPrice(value);
    }
  };

  const AlertModal = () => (
    showAlertModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h3 className="text-lg font-bold mb-4">Add Price Alert</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Price: ${ethPrice.toFixed(2)}
              </label>
              <input
                type="text"
                pattern="[0-9]*"
                inputMode="decimal"
                value={alertPrice}
                onChange={handleAlertPriceChange}
                placeholder="Price in USD"
                className="w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alert Type
              </label>
              <select
                value={alertType}
                onChange={(e) => setAlertType(e.target.value as 'above' | 'below')}
                className="w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="above">Price goes above</option>
                <option value="below">Price goes below</option>
              </select>
            </div>
            <div className="flex justify-end gap-4 pt-2">
              <button
                onClick={() => {
                  setShowAlertModal(false);
                  setAlertPrice('');
                }}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAlert}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Add Alert
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  );


  // Add a function to handle withdrawing all funds
  const handleWithdrawAll = (e: React.FormEvent) => {
    e.preventDefault();
    const currentBalance = getBalance(currentUser);
    
    if (currentBalance <= 0) {
      toast.error('No funds available to withdraw');
      return;
    }

    try {
      withdraw(currentBalance, currentUser);
      setWithdrawAmount('');
      toast.success(`Successfully withdrew all funds: $${currentBalance.toFixed(2)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to withdraw funds');
    }
  };

  // Move this up with other handlers, before any JSX
  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      withdraw(amount, currentUser);
      setWithdrawAmount('');
      toast.success(`Successfully withdrew $${amount.toFixed(2)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to withdraw funds');
    }
  };

  // Add handler for stop orders
  const handleStopOrder = async (order: StopOrder) => {
    try {
      const now = new Date();
      await executeTrade('sell', order.amount, ethPrice, currentUser, now.toLocaleTimeString());
      
      // Deactivate the order
      setStopOrders(orders => 
        orders.map(o => o.id === order.id ? { ...o, active: false } : o)
      );
      
      toast.success(`${order.type === 'stop-loss' ? 'Stop Loss' : 'Take Profit'} executed at $${ethPrice.toFixed(2)}`);
    } catch (error) {
      toast.error(`Failed to execute ${order.type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const StopOrderModal = () => (
    showStopOrderModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h3 className="text-lg font-bold mb-4">
            Set {stopOrderType === 'stop-loss' ? 'Stop Loss' : 'Take Profit'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Price: ${ethPrice.toFixed(2)}
              </label>
              <input
                type="text"
                value={stopPrice}
                onChange={(e) => setStopPrice(validateNumberInput(e.target.value))}
                placeholder="Price in USD"
                className="w-full rounded-md border-gray-300 shadow-sm px-4 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (ETH)
              </label>
              <input
                type="text"
                value={stopAmount}
                onChange={(e) => setStopAmount(validateNumberInput(e.target.value))}
                placeholder="Amount in ETH"
                className="w-full rounded-md border-gray-300 shadow-sm px-4 py-2"
              />
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button
                onClick={() => setShowStopOrderModal(false)}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const price = parseFloat(stopPrice);
                  const amount = parseFloat(stopAmount);
                  if (price > 0 && amount > 0) {
                    setStopOrders(orders => [...orders, {
                      id: Date.now().toString(),
                      type: stopOrderType,
                      price,
                      amount,
                      active: true,
                      originalPrice: ethPrice
                    }]);
                    setShowStopOrderModal(false);
                    setStopPrice('');
                    setStopAmount('');
                    toast.success(`${stopOrderType === 'stop-loss' ? 'Stop Loss' : 'Take Profit'} order set at $${price}`);
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Set Order
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  );

  // Add custom toast options
  const showWarning = (message: string) => {
    toast(message, {
      icon: '⚠️',
      style: {
        background: '#eab308',
        color: '#fff',
        fontWeight: '500',
      },
    });
  };

  // Add these test functions before the return statement
  const testRapidDeposits = async () => {
    try {
      const tenPercent = currentUser.annualIncome * 0.1;
      
      // First deposit - 10% of annual income
      await addFunds(tenPercent, currentUser);
      toast.success(`First deposit: $${tenPercent.toFixed(2)} (10% of annual income)`);
      
      // Wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Second deposit - another 10%
      await addFunds(tenPercent, currentUser);
      showWarning(`Second deposit: $${tenPercent.toFixed(2)} - Warning: Multiple large deposits`);
      
      // Wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Third deposit - triggers suspicious activity
      await addFunds(tenPercent, currentUser);
      showWarning("🚨 SUSPICIOUS ACTIVITY DETECTED: Deposit pattern exceeds normal income-based thresholds");
      
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Test failed');
    }
  };

  const testIncomeLimitDeposit = async () => {
    const annualIncomeLimit = currentUser.annualIncome * 0.1; // 10% of annual income
    try {
      // Make three deposits that total more than 10% of annual income
      await addFunds(annualIncomeLimit * 0.4, currentUser);
      toast.success(`First deposit: $${(annualIncomeLimit * 0.4).toFixed(2)}`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      await addFunds(annualIncomeLimit * 0.4, currentUser);
      toast.success(`Second deposit: $${(annualIncomeLimit * 0.4).toFixed(2)}`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      await addFunds(annualIncomeLimit * 0.4, currentUser);
      showWarning("Warning: Recent deposits exceed 10% of annual income");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Test failed');
    }
  };

  const testWashTrading = async () => {
    try {
      // Initial buy
      await executeTrade('buy', 0.1, ethPrice, currentUser, new Date().toISOString());
      toast.success("Bought 0.1 ETH");
      
      // Wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Quick sell
      await executeTrade('sell', 0.1, ethPrice, currentUser, new Date().toISOString());
      toast.success("Sold 0.1 ETH");
      
      // Wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Another buy
      await executeTrade('buy', 0.1, ethPrice, currentUser, new Date().toISOString());
      toast.success("Bought 0.1 ETH");
      
      // Wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Another sell
      await executeTrade('sell', 0.1, ethPrice, currentUser, new Date().toISOString());
      toast.success("Sold 0.1 ETH");

      showWarning(
        "Suspicious trading activity detected: Rapid buy/sell patterns may indicate wash trading"
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Insufficient')) {
          toast.error('Not enough funds available - Add funds to test wash trading detection');
        } else if (error.message.includes('trading pattern')) {
          toast.success('Wash trading pattern detected and blocked');
        } else {
          toast.error(`Error: ${error.message}`);
        }
      }
    }
  };

  const testBotTrading = async () => {
    try {
      // Simulate rapid trades with consistent timing
      for (let i = 0; i < 5; i++) {
        await executeTrade('buy', 0.1, ethPrice, currentUser, new Date().toISOString());
        await new Promise(resolve => setTimeout(resolve, 100)); // Very fast trades
      }
      showWarning("Bot trading pattern detected: Suspiciously consistent trade timing");
    } catch (error) {
      toast.error('Bot trading test failed - Insufficient funds');
    }
  };

  const testLocationSpoofing = () => {
    // Simulate multiple location changes
    setUserBehavior(prev => ({
      ...prev,
      lastLocations: ['New York', 'London', 'Tokyo', 'Singapore'],
      deviceChanges: ['Device1', 'Device2', 'Device3']
    }));
    showWarning("Multiple location access detected: Potential account sharing");
  };

  // Add this component near the top of the file
  const InfoTooltip: React.FC<TooltipProps> = ({ text }) => (
    <div className="group relative inline-block ml-1">
      <HelpCircle className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
      <div className="invisible group-hover:visible absolute z-10 w-64 p-2 mt-2 text-sm text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 -left-1/2">
        {text}
      </div>
    </div>
  );

  // Add these input validation functions at the top of App component
  const validateNumberInput = (value: string) => {
    // Remove any non-digit characters except decimal point
    const sanitized = value.replace(/[^\d.]/g, '');
    // Ensure only one decimal point
    const parts = sanitized.split('.');
    if (parts.length > 2) return parts[0] + '.' + parts[1];
    return sanitized;
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              fontSize: '1rem',
              fontWeight: '500',
              borderRadius: '10px',
              padding: '16px 24px',
            },
            success: {
              style: {
                background: '#22c55e',
                color: '#fff',
              },
            },
            error: {
              style: {
                background: '#ef4444',
                color: '#fff',
              },
            },
          }}
        />
        <div className="bg-white border-b shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
                <h1 className="text-xl sm:text-2xl font-bold text-blue-600">
                  ETH Trading Platform
                </h1>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="relative">
                    <button
                      onClick={() => setShowUserDetails(!showUserDetails)}
                      className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors"
                    >
                      <UserCircle className="w-6 h-6" />
                      <span className="font-medium">Welcome, {currentUser.name}</span>
                    </button>
                    {showUserDetails && (
                      <div className="absolute right-0 mt-3 w-72 bg-white rounded-lg shadow-xl p-4 border border-gray-200">
                        <h3 className="font-semibold mb-3 text-gray-800">User Details</h3>
                        <div className="space-y-2 text-sm">
                          <p className="flex justify-between">
                            <span className="text-gray-500">Username:</span>
                            <span className="text-gray-800">{currentUser.username}</span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-gray-500">PAN Card:</span>
                            <span className="text-gray-800">{currentUser.panCard}</span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-gray-500">Annual Income:</span>
                            <span className="text-gray-800">${currentUser.annualIncome.toLocaleString()}</span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-gray-500">Phone:</span>
                            <span className="text-gray-800">{currentUser.phoneNumber}</span>
                          </p>
                          <p className="flex justify-between">
                            <span className="text-gray-500">Trades Today:</span>
                            <span className="text-gray-800">{currentUser.tradeCount}</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={logout}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <div className="col-span-full">
              {renderPriceChart()}
            </div>
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Portfolio Metrics</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-gray-500">Total Value</p>
                  <p className="text-2xl font-bold">${calculatePortfolioMetrics().totalValue.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-500">P&L</p>
                  <p className={`text-xl font-semibold ${calculatePortfolioMetrics().pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${calculatePortfolioMetrics().pnl.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Risk Level</p>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ width: `${calculatePortfolioMetrics().risk}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Account Balance</h3>
              <div className="grid grid-cols-2 gap-6">
                {/* USD Balance */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500">USD Balance</span>
                    <DollarSign className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    ${getBalance(currentUser).toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Available for trading
                  </div>
                </div>

                {/* ETH Balance */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500">ETH Balance</span>
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {getEthBalance(getTrades(currentUser)).toFixed(4)} ETH
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    ≈ ${(getEthBalance(getTrades(currentUser)) * ethPrice).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Trade ETH</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(validateNumberInput(e.target.value))}
                  placeholder="Amount in ETH"
                  className="w-full rounded-md border-gray-300 shadow-sm px-4 py-2"
                  min="0"
                />
                <div className="flex gap-4">
                  <button
                    onClick={() => handleTrade('buy')}
                    className="flex-1 bg-green-500 text-white px-6 py-2 rounded-md hover:bg-green-600"
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => handleTrade('sell')}
                    className="flex-1 bg-red-500 text-white px-6 py-2 rounded-md hover:bg-red-600"
                  >
                    Sell
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Add Funds</h3>
              <form onSubmit={handleAddFunds} className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={addAmount}
                    onChange={(e) => setAddAmount(validateNumberInput(e.target.value))}
                    placeholder="Amount in USD"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
                    min="0"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Available: ${getBalance(currentUser).toFixed(2)}
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Add Funds
                  </button>
                </div>
              </form>
            </div>
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Withdraw Funds</h3>
              <form onSubmit={handleWithdraw} className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(validateNumberInput(e.target.value))}
                    placeholder="Amount in USD"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
                    min="0"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Available: ${getBalance(currentUser).toFixed(2)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleWithdrawAll}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                      Withdraw All
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              </form>
            </div>
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Price Alerts</h3>
                <button
                  onClick={() => setShowAlertModal(true)}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  Add Alert
                </button>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {priceAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <Bell className="w-16 h-16 mb-4 text-gray-300" />
                    <p className="text-center">No price alerts set</p>
                    <p className="text-sm text-center">Create alerts to get notified of price movements</p>
                  </div>
                ) : (
                  priceAlerts.map(alert => (
                    <div key={alert.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                      <span>Alert when price is {alert.type} ${alert.price}</span>
                      <span className={`px-2 py-1 rounded ${
                        alert.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {alert.active ? 'Active' : 'Triggered'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Trade History</h3>
              <div className="max-h-[300px] overflow-y-auto">
                <TradeHistory trades={getTrades(currentUser)} />
              </div>
            </div>
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Stop Orders</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setStopOrderType('stop-loss');
                      setShowStopOrderModal(true);
                    }}
                    className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
                  >
                    Stop Loss
                  </button>
                  <button
                    onClick={() => {
                      setStopOrderType('take-profit');
                      setShowStopOrderModal(true);
                    }}
                    className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm"
                  >
                    Take Profit
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {stopOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <LineChart className="w-16 h-16 mb-4 text-gray-300" />
                    <p className="text-center">No stop orders active</p>
                    <p className="text-sm text-center">Set stop-loss or take-profit orders to manage risk</p>
                  </div>
                ) : (
                  stopOrders.map(order => (
                    <div key={order.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                      <div>
                        <span className={`font-medium ${
                          order.type === 'stop-loss' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {order.type === 'stop-loss' ? 'Stop Loss' : 'Take Profit'}
                        </span>
                        <p className="text-sm text-gray-500">
                          Sell {order.amount} ETH at ${order.price}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          order.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {order.active ? 'Active' : 'Executed'}
                        </span>
                        {order.active && (
                          <button
                            onClick={() => setStopOrders(orders => 
                              orders.filter(o => o.id !== order.id)
                            )}
                            className="text-red-500 hover:text-red-600"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Fraud Detection Testing</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center mb-2">
                    <h4 className="text-sm font-medium text-gray-700">Rapid Deposits</h4>
                    <InfoTooltip text="Tests the system's ability to detect suspicious deposit patterns. Will attempt 3 deposits of 10% of annual income each to trigger fraud detection." />
                  </div>
                  <button
                    onClick={testRapidDeposits}
                    className="w-full px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                  >
                    Test Rapid Deposits
                  </button>
                </div>
                
                <div>
                  <div className="flex items-center mb-2">
                    <h4 className="text-sm font-medium text-gray-700">Income Limit</h4>
                    <InfoTooltip text="Tests deposit limits based on annual income. Attempts to deposit more than 10% of annual income in a short period." />
                  </div>
                  <button
                    onClick={testIncomeLimitDeposit}
                    className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                  >
                    Test Income Limit
                  </button>
                </div>
                
                <div>
                  <div className="flex items-center mb-2">
                    <h4 className="text-sm font-medium text-gray-700">Wash Trading</h4>
                    <InfoTooltip text="Tests detection of wash trading patterns by executing rapid buy/sell orders of the same amount." />
                  </div>
                  <button
                    onClick={testWashTrading}
                    className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    Test Wash Trading
                  </button>
                </div>

                <div>
                  <div className="flex items-center mb-2">
                    <h4 className="text-sm font-medium text-gray-700">Bot Detection</h4>
                    <InfoTooltip text="Tests the system's ability to detect automated trading patterns through consistent timing and volumes." />
                  </div>
                  <button
                    onClick={testBotTrading}
                    className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                  >
                    Test Bot Trading
                  </button>
                </div>

                <div>
                  <div className="flex items-center mb-2">
                    <h4 className="text-sm font-medium text-gray-700">Location Spoofing</h4>
                    <InfoTooltip text="Tests detection of suspicious account access from multiple locations in a short time period." />
                  </div>
                  <button
                    onClick={testLocationSpoofing}
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Test Location Spoofing
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <RiskWarningModal />
        <AlertModal />
        <StopOrderModal />
      </div>
    </Router>
  );
}

export default App;