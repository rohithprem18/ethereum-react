import { useState, useEffect } from 'react';
import { ref, onValue, set, get } from 'firebase/database';
import { db } from '../firebase';

interface Trade {
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: string;
  userId: string;
}

interface User {
  username: string;
  annualIncome: number;
  // ... other user properties
}

interface Transaction {
  type: 'deposit' | 'trade' | 'withdraw';
  amount: number;
  timestamp: string;
}

interface WalletState {
  [userId: string]: {
    balance: number;
    trades: Trade[];
    transactions: Transaction[];
  };
}

export function useWallet() {
  const [walletState, setWalletState] = useState<WalletState>({});

  // Get balance for specific user
  const getBalance = (userId: string) => {
    return walletState[userId]?.balance || 0;
  };

  // Get trades for specific user
  const getTrades = (userId: string) => {
    return walletState[userId]?.trades || [];
  };

  // Load data from Firebase on mount
  useEffect(() => {
    const loadWalletData = async () => {
      try {
        // First try to load from localStorage
        const localData = localStorage.getItem('wallets');
        if (localData) {
          setWalletState(JSON.parse(localData));
        }

        // Then load from Firebase and update if newer
        const walletRef = ref(db, 'wallets');
        const snapshot = await get(walletRef);
        if (snapshot.exists()) {
          const firebaseData = snapshot.val();
          // Merge with local data, preferring Firebase data
          const mergedData = { ...JSON.parse(localData || '{}'), ...firebaseData };
          setWalletState(mergedData);
          // Update localStorage
          localStorage.setItem('wallets', JSON.stringify(mergedData));
        }

        // Set up real-time listener
        const unsubscribe = onValue(walletRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            setWalletState(prevState => {
              const newState = { ...prevState, ...data };
              localStorage.setItem('wallets', JSON.stringify(newState));
              return newState;
            });
          }
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading wallet data:', error);
        // Fallback to localStorage if Firebase fails
        const localData = localStorage.getItem('wallets');
        if (localData) {
          setWalletState(JSON.parse(localData));
        }
      }
    };

    loadWalletData();
  }, []);

  // Update Firebase whenever state changes
  useEffect(() => {
    if (Object.keys(walletState).length > 0) {
      // Save to localStorage
      localStorage.setItem('wallets', JSON.stringify(walletState));
      // Save to Firebase
      set(ref(db, 'wallets'), walletState).catch(error => {
        console.error('Error saving to Firebase:', error);
      });
    }
  }, [walletState]);

  const addFunds = (amount: number, user: User) => {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    // Check if single deposit exceeds annual income
    if (amount > user.annualIncome) {
      throw new Error('🚨 SUSPICIOUS: Single deposit exceeds annual income - Potential money laundering detected');
    }

    const userWallet = walletState[user.username] || {
      balance: 0,
      trades: [],
      transactions: []
    };

    setWalletState(prev => ({
      ...prev,
      [user.username]: {
        ...userWallet,
        balance: (userWallet.balance || 0) + amount,
        trades: userWallet.trades,
        transactions: [
          {
            type: 'deposit' as const,
            amount,
            timestamp: new Date().toISOString()
          },
          ...(userWallet.transactions || [])
        ]
      }
    }));
  };

  const withdraw = (amount: number, user: User) => {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const userWallet = walletState[user.username] || {
      balance: 0,
      trades: [],
      transactions: []
    };

    const currentBalance = getBalance(user.username);

    // Check if trying to withdraw more than available
    if (amount > currentBalance) {
      throw new Error('Insufficient balance');
    }

    setWalletState(prev => {
      const newState = {
        ...prev,
        [user.username]: {
          ...userWallet,
          trades: userWallet.trades,
          // Set balance to 0 if withdrawing full amount, otherwise subtract
          balance: amount === currentBalance ? 0 : currentBalance - amount,
          transactions: [
            {
              type: 'withdraw',
              amount: -amount,
              timestamp: new Date().toISOString()
            },
            ...(userWallet.transactions || [])
          ]
        }
      };
      
      // Save to both localStorage and Firebase
      localStorage.setItem('wallets', JSON.stringify(newState));
      set(ref(db, 'wallets'), newState).catch(error => {
        console.error('Error saving withdrawal to Firebase:', error);
      });

      return newState;
    });
  };

  const executeTrade = (type: 'buy' | 'sell', amount: number, price: number, user: User, timestamp: string) => {
    const currentBalance = getBalance(user.username);
    const cost = amount * price;

    if (type === 'buy') {
      if (cost > currentBalance) {
        throw new Error('Insufficient funds');
      }

      setWalletState(prev => {
        const newState = {
          ...prev,
          [user.username]: {
            balance: currentBalance - cost,
            trades: [
              {
                type,
                amount,
                price,
                timestamp,
                userId: user.username
              },
              ...(prev[user.username]?.trades || [])
            ],
            transactions: [
              {
                type: 'trade',
                amount: -cost,
                timestamp: new Date().toISOString()
              },
              ...(prev[user.username]?.transactions || [])
            ]
          }
        };

        // Save immediately to localStorage
        localStorage.setItem('wallets', JSON.stringify(newState));
        return newState;
      });
    } else {
      // Check if user has enough ETH to sell
      const userTrades = getTrades(user.username);
      const ethBalance = userTrades.reduce((total, trade) => {
        return total + (trade.type === 'buy' ? trade.amount : -trade.amount);
      }, 0);

      if (amount > ethBalance) {
        throw new Error('Insufficient ETH balance');
      }

      setWalletState(prev => {
        const newState = {
          ...prev,
          [user.username]: {
            balance: currentBalance + cost,
            trades: [
              {
                type,
                amount,
                price,
                timestamp,
                userId: user.username
              },
              ...(prev[user.username]?.trades || [])
            ],
            transactions: [
              {
                type: 'trade',
                amount: cost,
                timestamp: new Date().toISOString()
              },
              ...(prev[user.username]?.transactions || [])
            ]
          }
        };

        // Save immediately to localStorage
        localStorage.setItem('wallets', JSON.stringify(newState));
        return newState;
      });
    }
  };

  const getWalletState = () => walletState;

  return {
    balance: (user: User) => getBalance(user.username),
    trades: (user: User) => getTrades(user.username),
    addFunds,
    withdraw,
    executeTrade,
    getWalletState
  };
}