export interface Trade {
  id: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: number;
}

export interface WalletState {
  balance: number;
  trades: Trade[];
}

export interface User {
  name: string;
  username: string;
  password: string;
  panCard: string;
  annualIncome: number;
  phoneNumber: string;
  lastTradeTime?: number;
  tradeCount: number;
}

export interface AuthState {
  currentUser: User | null;
  users: User[];
}