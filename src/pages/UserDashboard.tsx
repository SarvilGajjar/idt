import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Search, AlertCircle } from 'lucide-react';
import { booksService } from '../services/books';
import { DEFAULT_LOAN_DAYS, HOLD_AMOUNT, MAX_LOAN_DAYS } from '../services/books';
import type { Book, BorrowedBook } from '../services/books';
import { usersService } from '../services/users';
import type { UserProfile } from '../services/users';
import { formatDate } from '../utils/formatting';

const formatCurrency = (value: number | undefined | null) =>
  `₹${(typeof value === 'number' ? value : 0).toFixed(2)}`;

export const UserDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [accountProfile, setAccountProfile] = useState<UserProfile | null>(userProfile);
  const [books, setBooks] = useState<Book[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [borrowedBooks, setBorrowedBooks] = useState<BorrowedBook[]>([]);
  const [activeTab, setActiveTab] = useState<'browse' | 'borrowed'>('browse');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadBooks();
  }, [searchTerm, category, filterType]);

  useEffect(() => {
    if (userProfile?.id) {
      setAccountProfile(userProfile);
      loadBorrowedBooks(userProfile.id);
    } else {
      setAccountProfile(null);
      setBorrowedBooks([]);
    }
  }, [userProfile?.id]);

  const loadInitialData = async () => {
    try {
      setErrorMessage('');
      await usersService.syncOverdueStatuses();
      const cats = await booksService.getCategories();
      setCategories(cats);
      await Promise.all([
        loadBooks(),
        userProfile?.id ? loadBorrowedBooks(userProfile.id) : Promise.resolve(),
        userProfile?.id ? refreshAccountProfile(userProfile.id) : Promise.resolve(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setErrorMessage('Unable to load books right now.');
    } finally {
      setLoading(false);
    }
  };

  const loadBooks = async () => {
    try {
      const result = await booksService.getBooks(searchTerm, category, filterType);
      setBooks(result);
    } catch (error) {
      console.error('Error loading books:', error);
      setErrorMessage('Unable to load books right now.');
    }
  };

  const loadBorrowedBooks = async (userId: string) => {
    try {
      const result = await booksService.getBorrowedBooks(userId);
      setBorrowedBooks(result);
    } catch (error) {
      console.error('Error loading borrowed books:', error);
      setErrorMessage('Unable to load your borrowed books right now.');
    }
  };

  const refreshAccountProfile = async (userId: string) => {
    const allUsers = await usersService.getAllUsers();
    const currentProfile = allUsers.find((user) => user.id === userId) || null;
    setAccountProfile(currentProfile);
  };

  const handleBorrowBook = async (bookId: string) => {
    if (!userProfile?.id) return;

    try {
      setErrorMessage('');
      const input = window.prompt(
        `Enter return period in days (1-${MAX_LOAN_DAYS})`,
        String(DEFAULT_LOAN_DAYS)
      );
      if (input === null) return;

      const loanDays = Number.parseInt(input, 10);
      await booksService.borrowBook(bookId, userProfile.id, loanDays);
      const selectedBook = books.find((book) => book.id === bookId);
      const totalCharge = (selectedBook?.price || 0) + HOLD_AMOUNT;
      setSuccessMessage(
        `Book borrowed successfully for ${loanDays} days. ₹${totalCharge.toFixed(2)} charged from wallet (including ₹${HOLD_AMOUNT} hold).`
      );
      setTimeout(() => setSuccessMessage(''), 3000);
      await Promise.all([
        loadBooks(),
        loadBorrowedBooks(userProfile.id),
        refreshAccountProfile(userProfile.id),
      ]);
    } catch (error) {
      console.error('Error borrowing book:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to borrow this book.');
    }
  };

  const handleReturnBook = async (bookId: string) => {
    if (!userProfile?.id) return;

    try {
      setErrorMessage('');
      const result = await booksService.returnBook(bookId, userProfile.id);
      setSuccessMessage(
        result.penaltyAmount > 0
          ? `Book returned. Penalty ₹${result.penaltyAmount} for ${result.overdueDays} overdue day${result.overdueDays === 1 ? '' : 's'}. ₹${result.holdAppliedToPenalty} used from hold, ₹${result.refundedAmount} refunded.${result.remainingPenaltyDue > 0 ? ` ₹${result.remainingPenaltyDue} is still due.` : ''}`
          : `Book returned successfully on time. ₹${result.refundedAmount} hold refunded to your wallet!`
      );
      setTimeout(() => setSuccessMessage(''), 3000);
      await Promise.all([
        loadBooks(),
        loadBorrowedBooks(userProfile.id),
        refreshAccountProfile(userProfile.id),
      ]);
    } catch (error) {
      console.error('Error returning book:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to return this book.');
    }
  };

  const handleTopUpWallet = async () => {
    if (!userProfile?.id) return;

    const input = window.prompt('Enter wallet top-up amount');
    if (input === null) return;

    try {
      setErrorMessage('');
      const amount = Number.parseFloat(input);
      const updatedProfile = await usersService.topUpWallet(userProfile.id, amount);
      setAccountProfile(updatedProfile);
      setSuccessMessage(`Wallet topped up by ₹${amount.toFixed(2)}.`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error topping up wallet:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to top up wallet.');
    }
  };

  const handlePayPenalty = async () => {
    if (!userProfile?.id) return;

    try {
      setErrorMessage('');
      const updatedProfile = await usersService.payOutstandingPenalty(userProfile.id);
      setAccountProfile(updatedProfile);
      setSuccessMessage('Outstanding penalty paid from wallet.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error paying penalty:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to pay penalty.');
    }
  };

  const borrowedBookIds = new Set(borrowedBooks.map((book) => book.id));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-8 text-white shadow-xl">
          <h1 className="text-4xl font-bold mb-2">📚 Welcome, {userProfile?.name}!</h1>
          <p className="text-blue-100 text-lg">Discover and borrow amazing books from our collection</p>
        </div>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 text-sm">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{errorMessage}</p>
          </div>
        )}

        {borrowedBooks.some((book) => book.reminder) && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-amber-900 mb-2">Loan Reminders</h2>
            <div className="space-y-2">
              {borrowedBooks
                .filter((book) => book.reminder)
                .map((book) => (
                  <div key={book.id} className="text-sm text-amber-800">
                    {book.title}: {book.reminder}
                    {book.penaltyAmount > 0 ? `, current penalty ₹${book.penaltyAmount}` : ''}
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="mb-6 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 rounded-xl shadow-lg p-6 border-l-4 border-green-600">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-green-900 mb-1">💰 Wallet & Balance</h2>
              <p className="text-sm text-green-700">
                Borrowing charges are paid using wallet balance, including a fixed ₹{HOLD_AMOUNT} hold.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="bg-white rounded-lg p-3 shadow">
                <span className="text-gray-600 text-xs font-semibold uppercase tracking-wider">Balance</span>
                <p className="font-bold text-green-700 text-xl">₹{(accountProfile?.wallet_balance || 0).toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-lg p-3 shadow">
                <span className="text-gray-600 text-xs font-semibold uppercase tracking-wider">Due Penalty</span>
                <p className={`font-bold text-xl ${(accountProfile?.outstanding_penalty_balance || 0) > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  ₹{(accountProfile?.outstanding_penalty_balance || 0).toFixed(2)}
                </p>
              </div>
              <button
                onClick={handleTopUpWallet}
                className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold py-2 px-5 rounded-lg transition-all hover:shadow-lg hover:scale-105"
              >
                💵 Add Money
              </button>
              <button
                onClick={handlePayPenalty}
                disabled={(accountProfile?.outstanding_penalty_balance || 0) <= 0}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-2 px-5 rounded-lg transition-all hover:shadow-lg hover:scale-105"
              >
                ⚠️ Pay Due
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              activeTab === 'browse'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                : 'bg-white text-blue-700 border-2 border-blue-200 hover:border-blue-400'
            }`}
          >
            📚 Browse Books
          </button>
          <button
            onClick={() => setActiveTab('borrowed')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              activeTab === 'borrowed'
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
                : 'bg-white text-purple-700 border-2 border-purple-200 hover:border-purple-400'
            }`}
          >
            🎯 My Borrowed ({borrowedBooks.length})
          </button>
        </div>

        {activeTab === 'browse' && (
          <>
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl shadow-md p-6 mb-6 border border-blue-200">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <label className="block text-sm font-bold text-blue-900 mb-2 uppercase tracking-wider">
                🔍 Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 w-5 h-5 text-blue-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by title or author..."
                  className="w-full pl-10 pr-4 py-3 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white transition"
                />
              </div>
            </div>

            <div className="min-w-40">
              <label className="block text-sm font-bold text-blue-900 mb-2 uppercase tracking-wider">
                📚 Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white transition"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-40">
              <label className="block text-sm font-bold text-blue-900 mb-2 uppercase tracking-wider">
                🔎 Filter
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white transition"
              >
                <option value="all">All Books</option>
                <option value="available">Available Only</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map((book) => (
            <div
              key={book.id}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-gray-100"
            >
              {book.image_url ? (
                <img
                  src={book.image_url}
                  alt={book.title}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-blue-100 via-blue-50 to-cyan-100 flex items-center justify-center">
                  <BookOpen className="w-16 h-16 text-blue-300" />
                </div>
              )}
              <div className="p-5">
                <h3 className="font-bold text-lg text-gray-900 mb-1 line-clamp-2 hover:text-blue-600 transition">
                  {book.title}
                </h3>
                <p className="text-sm text-gray-600 mb-1">{book.author}</p>
                <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wider">{book.category}</p>
                <p className="text-sm text-gray-700 mb-4 line-clamp-2 leading-relaxed">
                  {book.description}
                </p>

                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full ${
                      book.available_copies > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {book.available_copies > 0
                      ? `${book.available_copies} Available`
                      : 'Not Available'}
                  </span>
                  <span className="text-lg font-bold text-green-700">
                    {formatCurrency(book.price)}
                  </span>
                </div>

                <div className="bg-blue-50 rounded-lg p-3 mb-3 border border-blue-200">
                  <p className="text-xs text-blue-900">
                    <span className="font-semibold">Total Charge:</span> {formatCurrency((book.price || 0) + HOLD_AMOUNT)}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    ({formatCurrency(book.price)} price + ₹{HOLD_AMOUNT} hold)
                  </p>
                </div>

                {borrowedBookIds.has(book.id) && (
                  <p className="text-xs text-blue-700 bg-blue-100 border border-blue-300 rounded-lg px-3 py-2 mb-3 font-semibold">
                    ✓ Already borrowed by you
                  </p>
                )}

                {borrowedBookIds.has(book.id) ? (
                  <button
                    onClick={() => handleReturnBook(book.id)}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95"
                  >
                    ↩️ Return Book
                  </button>
                ) : (
                  <button
                    onClick={() => handleBorrowBook(book.id)}
                    disabled={book.available_copies === 0}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed"
                  >
                    {book.available_copies > 0 ? '📚 Borrow Now' : 'Not Available'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {books.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No books found</p>
          </div>
        )}
          </>
        )}

        {activeTab === 'borrowed' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {borrowedBooks.map((book) => (
              <div
                key={book.id}
                className="bg-gradient-to-br from-white to-blue-50 rounded-xl shadow-lg overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-2 border-blue-200"
              >
                {book.image_url ? (
                  <img
                    src={book.image_url}
                    alt={book.title}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-purple-100 via-blue-50 to-cyan-100 flex items-center justify-center">
                    <BookOpen className="w-16 h-16 text-purple-300" />
                  </div>
                )}
                <div className="p-5">
                  <h3 className="font-bold text-lg text-gray-900 mb-1 line-clamp-2">
                    {book.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-1">{book.author}</p>
                  <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wider">{book.category}</p>
                  <p className="text-sm text-gray-700 mb-4 line-clamp-2 leading-relaxed">
                    {book.description}
                  </p>

                  <div className="bg-white rounded-lg p-3 space-y-2 mb-4 border border-blue-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">Price Paid:</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(book.price)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">Hold Paid:</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(book.holdAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-blue-100">
                      <span className="text-gray-700">Total Charged:</span>
                      <span className="font-bold text-green-700">{formatCurrency(book.totalPaidAtBorrow)}</span>
                    </div>
                    {book.holdAppliedToPenalty > 0 && (
                      <div className="flex justify-between text-sm pt-2 border-t border-blue-100">
                        <span className="text-red-700">Hold Used For Penalty:</span>
                        <span className="font-semibold text-red-700">{formatCurrency(book.holdAppliedToPenalty)}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 mb-4 text-sm">
                    <p className="text-gray-700">Borrowed: <span className="font-medium text-blue-700">{formatDate(book.borrowed_at)}</span></p>
                    <p className={`${book.overdueDays > 0 ? 'text-red-700 font-semibold' : 'text-gray-700'}`}>
                      Due: <span className="font-medium">{formatDate(book.due_date)}</span>
                    </p>
                    <p className="text-gray-700">Loan: <span className="font-medium">{book.loan_days} days</span></p>
                    {book.reminder && (
                      <p className={`text-sm font-bold ${book.overdueDays > 0 ? 'text-red-700' : 'text-amber-700'} mt-2 bg-amber-50 p-2 rounded border border-amber-200`}>
                        ⚠️ {book.reminder}
                      </p>
                    )}
                    {book.penaltyAmount > 0 && (
                      <p className="text-sm font-bold text-red-700 bg-red-50 p-2 rounded border border-red-200">
                        💰 Current Penalty: ₹{book.penaltyAmount}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleReturnBook(book.id)}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-3 rounded-lg transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95"
                  >
                    ↩️ Return Book
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
