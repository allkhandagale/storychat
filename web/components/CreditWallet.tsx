'use client';

import { useState } from 'react';
import { CreditBalance, CreditTransaction } from '@/types';
import { creditsAPI } from '@/lib/api';

interface CreditWalletProps {
  balance?: number;
  onBalanceChange?: (newBalance: number) => void;
}

export function CreditWallet({ balance: initialBalance, onBalanceChange }: CreditWalletProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [balance, setBalance] = useState(initialBalance || 0);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);

  const fetchBalance = async () => {
    try {
      setLoading(true);
      const data = await creditsAPI.getBalance();
      setBalance(data.balance);
      setTransactions(data.recentTransactions);
      onBalanceChange?.(data.balance);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDetails = async () => {
    await fetchBalance();
    setShowDetails(true);
  };

  const formatAmount = (amount: number) => {
    if (amount > 0) return `+${amount}`;
    return `${amount}`;
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'PURCHASE':
        return '💰';
      case 'CONSUMPTION':
        return '🔓';
      case 'BONUS':
        return '🎁';
      case 'ADMIN_ADD':
        return '👑';
      default:
        return '📝';
    }
  };

  return (
    <>
      {/* Wallet button */}
      <button
        onClick={openDetails}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-full hover:bg-primary/20 transition-colors"
      >
        <span className="text-lg credit-coin">🪙</span>
        <span className="font-bold text-primary">{balance}</span>
        <span className="text-xs text-muted-foreground">credits</span>
      </button>

      {/* Wallet details modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl border border-border">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary/20 to-secondary/20 p-6 text-center">
              <div className="text-5xl mb-2">🪙</div>
              <div className="text-4xl font-bold">{balance}</div>
              <div className="text-muted-foreground">credits available</div>
            </div>

            {/* Quick buy */}
            <div className="p-4 border-b border-border">
              <p className="text-sm font-medium mb-3">Quick Purchase</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { amount: 100, price: '$0.99', popular: false },
                  { amount: 500, price: '$4.49', popular: true },
                  { amount: 1000, price: '$8.99', popular: false },
                ].map((pack) => (
                  <button
                    key={pack.amount}
                    className={`relative p-3 rounded-xl border transition-all ${
                      pack.popular
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {pack.popular && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] bg-primary text-white px-2 py-0.5 rounded-full">
                        Best Value
                      </span>
                    )}
                    <div className="text-2xl mb-1">{pack.amount}</div>
                    <div className="text-lg font-bold text-primary">{pack.price}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Transaction history */}
            <div className="p-4 flex-1" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
              <p className="text-sm font-medium mb-3">Recent Transactions</p>
              {transactions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No transactions yet</p>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <span>{getTransactionIcon(tx.type)}</span>
                        <div className="text-sm">
                          <div className="text-foreground">{tx.type.replace('_', ' ')}</div>
                          <div className="text-xs text-muted-foreground">{tx.reason}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${
                          tx.amount > 0 ? 'text-green-400' : 'text-foreground'
                        }`}>
                          {formatAmount(tx.amount)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Close button */}
            <div className="p-4 border-t border-border">
              <button
                onClick={() => setShowDetails(false)}
                className="w-full py-3 bg-muted rounded-xl hover:bg-muted/80 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Chapter unlock modal
interface UnlockModalProps {
  chapterId: string;
  chapterTitle: string;
  cost: number;
  balance: number;
  onUnlock: () => void;
  onClose: () => void;
  isLoading: boolean;
}

export function UnlockModal({
  chapterId,
  chapterTitle,
  cost,
  balance,
  onUnlock,
  onClose,
  isLoading,
}: UnlockModalProps) {
  const sufficientFunds = balance >= cost;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 unlock-gate">
      <div className="bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 border-t border-border sm:border">
        {/* Locked icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-3xl">
            🔒
          </div>
        </div>

        <h3 className="text-xl font-bold text-center mb-2">Chapter Locked</h3>
        <p className="text-muted-foreground text-center mb-6">
          Unlock <span className="text-foreground font-medium">"{chapterTitle}"</span> to continue reading
        </p>

        {/* Cost + Balance */}
        <div className="bg-muted rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-muted-foreground">Cost</span>
            <span className="font-bold flex items-center gap-1">
              <span>🪙</span> {cost} credits
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Your balance</span>
            <span className={`font-bold ${sufficientFunds ? 'text-green-400' : 'text-red-