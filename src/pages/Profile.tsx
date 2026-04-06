import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Wallet, Shield, Clock3 } from 'lucide-react';
import { booksService } from '../services/books';
import type { Book } from '../services/books';
import { formatDate } from '../utils/formatting';

const formatCurrency = (value: number | undefined | null) =>
  `₹${(typeof value === 'number' ? value : 0).toFixed(2)}`;

const getStatusClasses = (status: string) => {
  if (status === 'returned') return 'bg-green-100 text-green-800';
  if (status === 'overdue') return 'bg-amber-100 text-amber-800';
  if (status === 'penalty_due') return 'bg-red-100 text-red-800';
  return 'bg-blue-100 text-blue-800';
};

const Profile: React.FC = () => {
  const { userProfile } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    const loadBooks = async () => {
      try {
        const result = await booksService.getBooks();
        setBooks(result);
      } catch (error) {
        console.error('Error loading books for profile:', error);
      }
    };

    loadBooks();
  }, []);

  const bookMap = useMemo(
    () => new Map(books.map((book) => [book.id, book])),
    [books]
  );

  if (!userProfile) return <div className="p-8">No profile</div>;

  const activeBorrowCount = userProfile.borrowed_books?.length || 0;
  const borrowHistory = userProfile.borrow_history || [];
  const completedBorrowCount = borrowHistory.filter(
    (entry) => entry.status === 'returned' || entry.status === 'penalty_due'
  ).length;
  const overdueCount = borrowHistory.filter((entry) => entry.status === 'overdue').length;
  const totalBookSpend = borrowHistory.reduce((sum, entry) => sum + (entry.book_price || 0), 0);
  const totalHoldRefund = borrowHistory.reduce(
    (sum, entry) => sum + (entry.refunded_hold_amount || 0),
    0
  );
  const totalPenalty = borrowHistory.reduce((sum, entry) => sum + (entry.penalty_amount || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">👤 My Profile</h1>
          <p className="text-gray-600 text-lg">View your account details and borrowing history</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl shadow-lg p-6 sticky top-6 border border-blue-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{userProfile.name}</h2>
                  <p className="text-sm text-gray-600">{userProfile.email}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border-2 border-blue-300 p-4 bg-white">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-gray-900 uppercase tracking-wider text-sm">Account Role</h3>
                  </div>
                  <p className="text-gray-700 font-semibold capitalize text-lg">
                    {userProfile.role === 'admin' ? '⚙️ Admin' : '👤 User'}
                    {' '}
                    {(userProfile as any).temporary ? '(⏰ Temporary)' : ''}
                  </p>
                  {(userProfile as any).expires_at && (
                    <p className="text-sm text-red-700 font-semibold mt-1">
                      ⏳ Expires: {formatDate((userProfile as any).expires_at)}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border-2 border-green-300 p-4 bg-white">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-5 h-5 text-green-600" />
                    <h3 className="font-bold text-gray-900 uppercase tracking-wider text-sm">💰 Wallet & Dues</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Wallet Balance</span>
                      <span className="font-bold text-green-700 text-lg">
                        {formatCurrency(userProfile.wallet_balance)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Outstanding Penalty</span>
                      <span
                        className={`font-bold text-lg ${
                          (userProfile.outstanding_penalty_balance || 0) > 0
                            ? 'text-red-700'
                            : 'text-green-700'
                        }`}
                      >
                        {formatCurrency(userProfile.outstanding_penalty_balance)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Borrowing Access</span>
                      <span
                        className={`font-bold text-lg ${
                          userProfile.borrowing_restricted
                            ? 'text-red-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {userProfile.borrowing_restricted ? '🔒 Restricted' : '✅ Active'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border-2 border-purple-300 p-4 bg-white">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock3 className="w-5 h-5 text-purple-600" />
                    <h3 className="font-bold text-gray-900 uppercase tracking-wider text-sm">📊 Quick Stats</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Active Borrowings</span>
                      <span className="font-bold text-blue-700 text-lg">{activeBorrowCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Completed Returns</span>
                      <span className="font-bold text-green-700 text-lg">{completedBorrowCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Overdue Loans</span>
                      <span className="font-bold text-amber-700 text-lg">{overdueCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-lg p-6 border-2 border-blue-300 hover:shadow-xl transition">
                <p className="text-sm text-blue-700 font-bold uppercase tracking-wider mb-2">📚 Book Spend</p>
                <p className="text-4xl font-bold text-blue-900">
                  {formatCurrency(totalBookSpend)}
                </p>
                <p className="text-xs text-blue-700 mt-2">Total paid for book charges</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl shadow-lg p-6 border-2 border-emerald-300 hover:shadow-xl transition">
                <p className="text-sm text-emerald-700 font-bold uppercase tracking-wider mb-2">💚 Hold Refunded</p>
                <p className="text-4xl font-bold text-emerald-900">
                  {formatCurrency(totalHoldRefund)}
                </p>
                <p className="text-xs text-emerald-700 mt-2">Deposit returned after returns</p>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl shadow-lg p-6 border-2 border-red-300 hover:shadow-xl transition">
                <p className="text-sm text-red-700 font-bold uppercase tracking-wider mb-2">⚠️ Penalty Total</p>
                <p className="text-4xl font-bold text-red-900">
                  {formatCurrency(totalPenalty)}
                </p>
                <p className="text-xs text-red-700 mt-2">All late penalties recorded</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg p-6 border border-blue-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">📖 Current Borrowed Books</h3>
              {activeBorrowCount === 0 ? (
                <p className="text-gray-600 text-center py-8">✨ No active borrowed books right now.</p>
              ) : (
                <div className="space-y-4">
                  {(userProfile.borrowed_books || []).map((entry) => {
                    const book = bookMap.get(entry.book_id);
                    const daysUntilDue = Math.ceil(
                      (new Date(entry.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );

                    return (
                      <div key={`${entry.book_id}-${entry.borrowed_at}`} className="border-2 border-blue-200 rounded-xl p-5 bg-gradient-to-r from-blue-50 to-cyan-50 hover:shadow-lg transition">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div>
                            <h4 className="font-bold text-gray-900 text-lg">
                              {book?.title || 'Unknown Book'}
                            </h4>
                            <p className="text-sm text-gray-700">
                              {book?.author || 'Unknown Author'}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-medium px-3 py-1 rounded-full ${
                              daysUntilDue < 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {daysUntilDue < 0
                              ? `Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? '' : 's'}`
                              : `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
                          <div>
                            <p className="text-gray-500">Borrowed On</p>
                            <p className="font-medium text-gray-900">{formatDate(entry.borrowed_at)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Due Date</p>
                            <p className="font-medium text-gray-900">{formatDate(entry.due_date)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Loan Period</p>
                            <p className="font-medium text-gray-900">{entry.loan_days} days</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl shadow-lg p-6 border border-purple-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">📜 Borrow History</h3>
                <span className="text-sm font-semibold bg-purple-200 text-purple-900 px-4 py-2 rounded-full">{borrowHistory.length} records</span>
              </div>

              {borrowHistory.length === 0 ? (
                <p className="text-gray-600 text-center py-8">✨ No borrow history yet.</p>
              ) : (
                <div className="space-y-4">
                  {borrowHistory
                    .slice()
                    .sort((a, b) => new Date(b.borrowed_at).getTime() - new Date(a.borrowed_at).getTime())
                    .map((entry, index) => {
                      const book = bookMap.get(entry.book_id);

                      return (
                        <div key={`${entry.book_id}-${entry.borrowed_at}-${index}`} className="border-2 border-purple-200 rounded-xl p-5 bg-white hover:shadow-lg transition">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                            <div>
                              <h4 className="font-bold text-gray-900 text-lg">
                                {book?.title || 'Unknown Book'}
                              </h4>
                              <p className="text-sm text-gray-700">
                                {book?.author || 'Unknown Author'}
                              </p>
                            </div>
                            <span className={`text-xs font-bold px-4 py-2 rounded-full ${getStatusClasses(entry.status)}`}>
                              {entry.status === 'returned' && '✅'} {entry.status === 'overdue' && '⚠️'} {entry.status === 'penalty_due' && '💰'} {entry.status === 'borrowed' && '📖'}
                              {' '}
                              {entry.status.toUpperCase()}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500">Borrowed On</p>
                              <p className="font-medium text-gray-900">{formatDate(entry.borrowed_at)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Returned On</p>
                              <p className="font-medium text-gray-900">
                                {entry.returned_at ? formatDate(entry.returned_at) : 'Not returned yet'}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Book Price</p>
                              <p className="font-medium text-gray-900">{formatCurrency(entry.book_price)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Hold Amount</p>
                              <p className="font-medium text-gray-900">{formatCurrency(entry.hold_amount)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Hold Used</p>
                              <p className="font-medium text-amber-700">
                                {formatCurrency(entry.hold_applied_to_penalty)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Hold Refunded</p>
                              <p className="font-medium text-emerald-700">
                                {formatCurrency(entry.refunded_hold_amount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Penalty</p>
                              <p className={`font-medium ${(entry.penalty_amount || 0) > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                                {formatCurrency(entry.penalty_amount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Payment Method</p>
                              <p className="font-medium text-gray-900 capitalize">{entry.payment_method}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
