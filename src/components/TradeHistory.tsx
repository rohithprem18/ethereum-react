import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Trade {
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: string;
  userId: string;
}

interface TradeHistoryProps {
  trades: Trade[];
}

export const TradeHistory: React.FC<TradeHistoryProps> = ({ trades }) => {
  return (
    <div className="space-y-3">
      {trades.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No trades yet</p>
      ) : (
        trades.map((trade, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              {trade.type === 'buy' ? (
                <div className="bg-green-100 p-2 rounded-full">
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                </div>
              ) : (
                <div className="bg-red-100 p-2 rounded-full">
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                </div>
              )}
              <div>
                <p className="font-medium">
                  {trade.type === 'buy' ? 'Bought' : 'Sold'} {trade.amount} ETH
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-medium">${(trade.amount * trade.price).toFixed(2)}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
};