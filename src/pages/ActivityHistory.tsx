import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { booksService } from '../services/books';
import type { Book } from '../services/books';
import { usersService } from '../services/users';
import type { UserProfile } from '../services/users';
import { formatDate } from '../utils/formatting';
import { History, Filter, Download, Calendar } from 'lucide-react';

type ActivityRecord = {
  type: 'borrow' | 'return' | 'topup' | 'penalty_charge' | 'penalty_payment' | 'hold_refund';
  timestamp: string;
  title: string;
  description: string;
  amount?: number;
  bookTitle?: string;
  status?: string;
  icon: string;
};

const formatCurrency = (value: number | undefined | null) =>
  `₹${(typeof value === 'number' ? value : 0).toFixed(2)}`;

export const ActivityHistory: React.FC = () => {
  const { userProfile } = useAuth();
  const [accountProfile, setAccountProfile] = useState<UserProfile | null>(userProfile);
  const [books, setBooks] = useState<Map<string, Book>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'borrow' | 'wallet'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    loadData();
  }, [userProfile?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (userProfile?.id) {
        const allUsers = await usersService.getAllUsers();
        const profile = allUsers.find((u) => u.id === userProfile.id) || null;
        setAccountProfile(profile);

        const allBooks = await booksService.getBooks();
        const bookMap = new Map(allBooks.map((b) => [b.id, b]));
        setBooks(bookMap);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const activities = useMemo(() => {
    const records: ActivityRecord[] = [];

    // Borrow history
    (accountProfile?.borrow_history || []).forEach((entry) => {
      const book = books.get(entry.book_id);
      records.push({
        type: 'borrow',
        timestamp: entry.borrowed_at,
        title: `Borrowed "${book?.title || 'Unknown Book'}"`,
        description: `${entry.loan_days}-day loan • ₹${entry.book_price} + ₹${entry.hold_amount} hold`,
        amount: entry.book_price + entry.hold_amount,
        bookTitle: book?.title,
        status: entry.status,
        icon: '📚',
      });

      if (entry.returned_at) {
        const statusIcon = entry.penalty_amount > 0 ? '⚠️' : '✅';
        records.push({
          type: 'return',
          timestamp: entry.returned_at,
          title: `Returned "${book?.title || 'Unknown Book'}"`,
          description: entry.penalty_amount > 0
            ? `${statusIcon} Overdue by ${Math.ceil(entry.penalty_amount / 10)} days • Penalty: ₹${entry.penalty_amount}`
            : `${statusIcon} On time • Hold refunded: ₹${entry.refunded_hold_amount || entry.hold_amount}`,
          amount: entry.refunded_hold_amount || entry.hold_amount,
          bookTitle: book?.title,
          status: entry.status,
          icon: '↩️',
        });
      }
    });

    // Wallet history
    (accountProfile?.wallet_history || []).forEach((entry) => {
      let icon = '💰';
      let typeKey: 'topup' | 'penalty_charge' | 'penalty_payment' | 'hold_refund' = 'topup';

      if (entry.transaction_type === 'topup') {
        typeKey = 'topup';
        icon = '➕';
      } else if (entry.transaction_type === 'penalty_payment') {
        typeKey = 'penalty_payment';
        icon = '💳';
      } else if (entry.transaction_type === 'penalty_charge') {
        typeKey = 'penalty_charge';
        icon = '⚠️';
      } else if (entry.transaction_type === 'hold_refund') {
        typeKey = 'hold_refund';
        icon = '🔄';
      }

      records.push({
        type: typeKey,
        timestamp: entry.timestamp,
        title: entry.description,
        description: `Balance: ${formatCurrency(entry.previous_balance)} → ${formatCurrency(entry.new_balance)}`,
        amount: entry.amount,
        icon,
      });
    });

    // Sort
    const sorted = records.sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
    });

    // Filter
    if (filterType === 'borrow') {
      return sorted.filter((r) => r.type === 'borrow' || r.type === 'return');
    }
    if (filterType === 'wallet') {
      return sorted.filter((r) => r.type !== 'borrow' && r.type !== 'return');
    }

    return sorted;
  }, [accountProfile, books, filterType, sortOrder]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading activity history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-8 text-white shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <History className="w-8 h-8" />
            <h1 className="text-4xl font-bold">📋 Activity History</h1>
          </div>
          <p className="text-blue-100 text-lg">Track all your borrowing, returns, and wallet activities</p>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
              <Filter className="inline w-4 h-4 mr-1" /> Filter
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition bg-white"
            >
              <option value="all">All Activities</option>
              <option value="borrow">Book Borrowing & Returns</option>
              <option value="wallet">Wallet Transactions</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
              <Calendar className="inline w-4 h-4 mr-1" /> Sort
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition bg-white"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
              <Download className="inline w-4 h-4 mr-1" /> Summary
            </label>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-sm">
              <p className="font-semibold text-blue-900">{activities.length} Activities</p>
            </div>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-200">
              <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No activities yet</p>
              <p className="text-gray-500 text-sm mt-1">Your library activities will appear here</p>
            </div>
          ) : (
            <>
              {activities.map((activity, index) => {
                const isPositive = activity.type === 'topup' || activity.type === 'hold_refund';
                const isNegative = activity.type === 'penalty_charge' || activity.type === 'borrow';

                let bgColor = 'bg-white border-l-4 border-blue-400';
                let amountColor = 'text-gray-700';

                if (activity.type === 'borrow') {
                  bgColor = 'bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-blue-600';
                  amountColor = 'text-blue-700 font-bold';
                } else if (activity.type === 'return') {
                  bgColor = 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-600';
                  amountColor = 'text-green-700 font-bold';
                } else if (activity.type === 'topup') {
                  bgColor = 'bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-emerald-600';
                  amountColor = 'text-emerald-700 font-bold';
                } else if (activity.type === 'penalty_charge') {
                  bgColor = 'bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-600';
                  amountColor = 'text-red-700 font-bold';
                } else if (activity.type === 'penalty_payment') {
                  bgColor = 'bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-600';
                  amountColor = 'text-amber-700 font-bold';
                } else if (activity.type === 'hold_refund') {
                  bgColor = 'bg-gradient-to-r from-cyan-50 to-blue-50 border-l-4 border-cyan-600';
                  amountColor = 'text-cyan-700 font-bold';
                }

                return (
                  <div
                    key={`${activity.timestamp}-${index}`}
                    className={`${bgColor} rounded-xl shadow-md p-6 hover:shadow-lg transition-all`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="text-3xl">{activity.icon}</div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-lg">{activity.title}</h3>
                          <p className="text-sm text-gray-700 mt-1">{activity.description}</p>
                          <p className="text-xs text-gray-500 mt-2 uppercase tracking-wider">
                            {formatDate(activity.timestamp)}
                          </p>
                        </div>
                      </div>

                      {activity.amount !== undefined && (
                        <div className={`text-right whitespace-nowrap ${amountColor}`}>
                          <div className="text-lg font-bold">
                            {isPositive ? '+' : isNegative ? '−' : ''}
                            {formatCurrency(activity.amount)}
                          </div>
                          {activity.status && (
                            <div className="text-xs text-gray-600 mt-1 uppercase tracking-wider">
                              {activity.status}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Statistics */}
        {activities.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg p-6 border border-blue-300">
              <p className="text-sm text-blue-700 font-bold uppercase tracking-wider mb-1">Books Borrowed</p>
              <p className="text-4xl font-bold text-blue-900">
                {(accountProfile?.borrow_history || []).length}
              </p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl shadow-lg p-6 border border-emerald-300">
              <p className="text-sm text-emerald-700 font-bold uppercase tracking-wider mb-1">Books Returned</p>
              <p className="text-4xl font-bold text-emerald-900">
                {(accountProfile?.borrow_history || []).filter((b) => b.returned_at).length}
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl shadow-lg p-6 border border-amber-300">
              <p className="text-sm text-amber-700 font-bold uppercase tracking-wider mb-1">Total Spent</p>
              <p className="text-3xl font-bold text-amber-900">
                {formatCurrency(
                  (accountProfile?.borrow_history || []).reduce(
                    (sum, b) => sum + b.book_price + b.hold_amount,
                    0
                  )
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityHistory;
