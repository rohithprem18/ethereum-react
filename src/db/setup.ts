import Dexie, { Table } from 'dexie';
import type { User, Trade } from '../types';

export class TradingDB extends Dexie {
  users!: Table<User>;
  trades!: Table<Trade>;

  constructor() {
    super('TradingDB');
    this.version(1).stores({
      users: '++id, username, panCard, phoneNumber',
      trades: '++id, userId, type, amount, ethAmount, price, timestamp'
    });
  }
}

export const db = new TradingDB();

// Initialize the database
db.on('ready', () => {
  console.log('Database is ready');
});

// Helper functions
export async function findUserByCredentials(username: string, password: string): Promise<User | undefined> {
  return await db.users.where({ username, password }).first();
}

export async function createUser(userData: Omit<User, 'id'>): Promise<number> {
  return await db.users.add({
    ...userData,
    tradeCount: 0,
    walletBalance: 0,
    lastTradeTime: new Date().toISOString()
  });
}

export async function updateUserBalance(id: number, balance: number): Promise<void> {
  await db.users.update(id, { walletBalance: balance });
}

export async function updateUserTrade(
  id: number, 
  balance: number, 
  tradeCount: number, 
  lastTradeTime: string
): Promise<void> {
  await db.users.update(id, {
    walletBalance: balance,
    tradeCount,
    lastTradeTime
  });
}

export async function getUserTradeInfo(id: number): Promise<{
  tradeCount: number;
  lastTradeTime: string;
  walletBalance: number;
} | undefined> {
  const user = await db.users.get(id);
  if (!user) return undefined;
  return {
    tradeCount: user.tradeCount,
    lastTradeTime: user.lastTradeTime,
    walletBalance: user.walletBalance
  };
}

export async function resetTradeCount(id: number): Promise<void> {
  await db.users.update(id, { tradeCount: 0 });
}

export async function getUserTradeHistory(userId: string): Promise<Trade[]> {
  const trades = await db.trades.where('userId').equals(userId).toArray();
  return trades.map(trade => ({
    ...trade,
    timestamp: new Date(trade.timestamp)
  }));
}

export async function saveTrade(trade: Trade): Promise<void> {
  await db.trades.add(trade);
}