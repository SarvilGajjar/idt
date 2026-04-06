import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { booksService } from '../services/books';
import type { Book } from '../services/books';
import { usersService } from '../services/users';
import type { UserProfile } from '../services/users';
import { BookOpen, Users, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { formatDate } from '../utils/formatting';
import { useAuth } from '../context/AuthContext';

type BorrowLedgerRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  borrowedAt: string;
  dueDate: string;
  returnedAt: string | null;
  loanDays: number;
  bookPrice: number;
  holdAmount: number;
  holdAppliedToPenalty: number;
  refundedHoldAmount: number;
  penaltyAmount: number;
  status: 'borrowed' | 'overdue' | 'returned' | 'penalty_due';
  currentOverdueDays: number;
  currentPenaltyExposure: number;
};

export const AdminDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'books' | 'users' | 'borrowings'>('overview');
  const [books, setBooks] = useState<Book[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [showBookForm, setShowBookForm] = useState(false);
  const [newBook, setNewBook] = useState({
    title: '',
    author: '',
    category: '',
    description: '',
    total_copies: 1,
    price: 0,
  });
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await usersService.syncOverdueStatuses();
      const [booksData, usersData] = await Promise.all([
        booksService.getBooks(),
        usersService.getAllUsers(),
      ]);
      setBooks(booksData);
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await booksService.addBook({
        ...newBook,
        available_copies: newBook.total_copies,
        image_url: null,
      });
      setNewBook({
        title: '',
        author: '',
        category: '',
        description: '',
        total_copies: 1,
        price: 0,
      });
      setShowBookForm(false);
      setSuccessMessage('Book added successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      loadAllData();
    } catch (error) {
      console.error('Error adding book:', error);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!confirm('Are you sure you want to delete this book?')) return;

    try {
      await booksService.deleteBook(bookId);
      setSuccessMessage('Book deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      loadAllData();
    } catch (error) {
      console.error('Error deleting book:', error);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook) return;

    try {
      await booksService.updateBook(editingBook.id, {
        title: editingBook.title,
        author: editingBook.author,
        category: editingBook.category,
        description: editingBook.description,
        total_copies: editingBook.total_copies,
      });
      setEditingBook(null);
      setSuccessMessage('Book updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      loadAllData();
    } catch (error) {
      console.error('Error updating book:', error);
    }
  };

  const handleChangeUserRole = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      await usersService.updateUserRole(userId, newRole);
      setSuccessMessage('User role updated!');
      setTimeout(() => setSuccessMessage(''), 3000);
      loadAllData();
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const totalCopies = books.reduce((sum, book) => sum + book.total_copies, 0);
  const availableCopies = books.reduce((sum, book) => sum + book.available_copies, 0);
  const borrowLedger: BorrowLedgerRow[] = users
    .flatMap((user) =>
      (user.borrow_history || []).map((entry, index) => {
        const book = books.find((item) => item.id === entry.book_id);
        const currentOverdueDays =
          entry.returned_at === null
            ? Math.max(
                0,
                Math.ceil((Date.now() - new Date(entry.due_date).getTime()) / (1000 * 60 * 60 * 24))
              )
            : 0;
        return {
          id: `${user.id}-${entry.book_id}-${entry.borrowed_at}-${index}`,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          bookId: entry.book_id,
          bookTitle: book?.title || 'Unknown Book',
          bookAuthor: book?.author || 'Unknown Author',
          borrowedAt: entry.borrowed_at,
          dueDate: entry.due_date,
          returnedAt: entry.returned_at,
          loanDays: entry.loan_days,
          bookPrice: entry.book_price,
          holdAmount: entry.hold_amount,
          holdAppliedToPenalty: entry.hold_applied_to_penalty || 0,
          refundedHoldAmount: entry.refunded_hold_amount || 0,
          penaltyAmount: entry.penalty_amount,
          status: entry.status,
          currentOverdueDays,
          currentPenaltyExposure: currentOverdueDays * 10,
        };
      })
    )
    .sort((a, b) => new Date(b.borrowedAt).getTime() - new Date(a.borrowedAt).getTime());
  const activeBorrowings = borrowLedger.filter(
    (entry) => entry.status === 'borrowed' || entry.status === 'overdue'
  );
  const overdueBorrowings = borrowLedger.filter(
    (entry) => entry.status === 'overdue' || entry.currentOverdueDays > 0
  );
  const totalWalletBalance = users.reduce((sum, user) => sum + (user.wallet_balance || 0), 0);
  const totalOutstandingPenalties = users.reduce(
    (sum, user) => sum + (user.outstanding_penalty_balance || 0),
    0
  );
  const totalBorrowRevenue = borrowLedger.reduce((sum, entry) => sum + entry.bookPrice, 0);
  const totalHoldsCollected = borrowLedger.reduce((sum, entry) => sum + entry.holdAmount, 0);
  const totalHoldRefunded = borrowLedger.reduce((sum, entry) => sum + entry.refundedHoldAmount, 0);
  const totalHoldUsedForPenalties = borrowLedger.reduce(
    (sum, entry) => sum + entry.holdAppliedToPenalty,
    0
  );
  const totalPenaltyRecovered = borrowLedger.reduce((sum, entry) => sum + entry.penaltyAmount, 0);
  const totalLivePenaltyExposure = overdueBorrowings.reduce(
    (sum, entry) => sum + entry.currentPenaltyExposure,
    0
  );
  const topBooks = Object.values(
    borrowLedger.reduce<Record<string, { title: string; author: string; count: number }>>(
      (acc, entry) => {
        if (!acc[entry.bookId]) {
          acc[entry.bookId] = {
            title: entry.bookTitle,
            author: entry.bookAuthor,
            count: 0,
          };
        }
        acc[entry.bookId].count += 1;
        return acc;
      },
      {}
    )
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const topBorrowers = users
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      count: (user.borrow_history || []).length,
      active: (user.borrowed_books || []).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

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
        <div className="mb-8 bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 rounded-2xl p-8 text-white shadow-xl">
          <h1 className="text-4xl font-bold mb-2">⚙️ Admin Dashboard</h1>
          <p className="text-orange-100 text-lg">Manage books, users, and system analytics</p>
        </div>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 text-sm">{successMessage}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg p-6 border-l-4 border-blue-600 hover:shadow-xl transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-semibold uppercase tracking-wider">Total Books</p>
                <p className="text-4xl font-bold text-blue-900 mt-1">{books.length}</p>
              </div>
              <BookOpen className="w-12 h-12 text-blue-600 bg-blue-200 rounded-full p-2" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-lg p-6 border-l-4 border-orange-600 hover:shadow-xl transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 text-sm font-semibold uppercase tracking-wider">Total Copies</p>
                <p className="text-4xl font-bold text-orange-900 mt-1">{totalCopies}</p>
              </div>
              <BookOpen className="w-12 h-12 text-orange-600 bg-orange-200 rounded-full p-2" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl shadow-lg p-6 border-l-4 border-emerald-600 hover:shadow-xl transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-600 text-sm font-semibold uppercase tracking-wider">Available</p>
                <p className="text-4xl font-bold text-emerald-900 mt-1">{availableCopies}</p>
              </div>
              <BookOpen className="w-12 h-12 text-emerald-600 bg-emerald-200 rounded-full p-2" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6 border-l-4 border-green-600 hover:shadow-xl transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-semibold uppercase tracking-wider">Total Users</p>
                <p className="text-4xl font-bold text-green-900 mt-1">{users.length}</p>
              </div>
              <Users className="w-12 h-12 text-green-600 bg-green-200 rounded-full p-2" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                : 'bg-white text-blue-700 border-2 border-blue-200 hover:border-blue-400'
            }`}
          >
            📊 Overview
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
                : 'bg-white text-purple-700 border-2 border-purple-200 hover:border-purple-400'
            }`}
          >
            📈 Analytics
          </button>
          <button
            onClick={() => setActiveTab('books')}
            className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
              activeTab === 'books'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg'
                : 'bg-white text-amber-700 border-2 border-amber-200 hover:border-amber-400'
            }`}
          >
            📚 Books
          </button>
          <button
            onClick={() => setActiveTab('borrowings')}
            className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
              activeTab === 'borrowings'
                ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white shadow-lg'
                : 'bg-white text-cyan-700 border-2 border-cyan-200 hover:border-cyan-400'
            }`}
          >
            🔄 Borrowings
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg'
                : 'bg-white text-green-700 border-2 border-green-200 hover:border-green-400'
            }`}
          >
            👥 Users
          </button>
          <button
            onClick={() => navigate('/admin/create')}
            className="px-6 py-2 rounded-lg font-medium transition whitespace-nowrap bg-white text-gray-700 border border-gray-200"
          >
            Create Admin
          </button>
          <button
            onClick={() => navigate('/admin/create-temp')}
            className="px-6 py-2 rounded-lg font-medium transition whitespace-nowrap bg-white text-gray-700 border border-gray-200"
          >
            Create Temp Admin
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Library Summary</h2>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Books in Catalog</span>
                  <span className="font-bold text-gray-900">{books.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Copies</span>
                  <span className="font-bold text-gray-900">{totalCopies}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Available Copies</span>
                  <span className="font-bold text-gray-900">{availableCopies}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Categories</span>
                  <span className="font-bold text-gray-900">
                    {new Set(books.map((book) => book.category)).size}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Borrowings</span>
                  <span className="font-bold text-gray-900">{activeBorrowings.length}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Member Finance</h2>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Wallet Balance</span>
                  <span className="font-bold text-gray-900">₹{totalWalletBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Outstanding Penalties</span>
                  <span className="font-bold text-red-700">₹{totalOutstandingPenalties.toFixed(2)}</span>
                </div>
                <div className="pt-4 border-t">
                  <h3 className="font-semibold text-gray-900 mb-3">Recent Members</h3>
                  <div className="space-y-3">
                    {users.slice(0, 5).map((user) => (
                      <div key={user.id} className="pb-3 border-b last:border-0">
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                        <p className="text-sm text-gray-500">Joined: {formatDate(user.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'borrowings' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600 mb-2">Active Borrowings</p>
                <p className="text-3xl font-bold text-gray-900">{activeBorrowings.length}</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600 mb-2">Returned Loans</p>
                <p className="text-3xl font-bold text-gray-900">
                  {borrowLedger.filter((entry) => entry.status === 'returned').length}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600 mb-2">Penalty Due Cases</p>
                <p className="text-3xl font-bold text-red-700">
                  {borrowLedger.filter((entry) => entry.status === 'penalty_due').length}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600 mb-2">Currently Overdue</p>
                <p className="text-3xl font-bold text-amber-700">{overdueBorrowings.length}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Borrowing Ledger</h2>
              <div className="space-y-4">
                {borrowLedger.length === 0 && (
                  <p className="text-gray-500">No borrowing activity yet.</p>
                )}
                {borrowLedger.map((entry) => (
                  <div key={entry.id} className="border rounded-xl p-4">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900">
                          {entry.bookTitle}
                        </h3>
                        <p className="text-sm text-gray-600">{entry.bookAuthor}</p>
                        <p className="text-sm text-gray-700 mt-1">
                          Borrowed by {entry.userName} ({entry.userEmail})
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium px-3 py-1 rounded-full ${
                          entry.status === 'borrowed'
                            ? 'bg-blue-100 text-blue-800'
                            : entry.status === 'overdue'
                            ? 'bg-amber-100 text-amber-800'
                            : entry.status === 'penalty_due'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Borrowed On</p>
                        <p className="font-medium text-gray-900">{formatDate(entry.borrowedAt)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Due Date</p>
                        <p className="font-medium text-gray-900">{formatDate(entry.dueDate)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Returned On</p>
                        <p className="font-medium text-gray-900">
                          {entry.returnedAt ? formatDate(entry.returnedAt) : 'Not returned yet'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Loan Period</p>
                        <p className="font-medium text-gray-900">{entry.loanDays} days</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Book Price</p>
                        <p className="font-medium text-gray-900">₹{entry.bookPrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Hold Amount</p>
                        <p className="font-medium text-gray-900">₹{entry.holdAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Hold Used</p>
                        <p className="font-medium text-amber-700">₹{entry.holdAppliedToPenalty.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Hold Refunded</p>
                        <p className="font-medium text-emerald-700">₹{entry.refundedHoldAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Penalty</p>
                        <p className={`font-medium ${entry.penaltyAmount > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                          ₹{entry.penaltyAmount.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Live Overdue Days</p>
                        <p className={`font-medium ${entry.currentOverdueDays > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                          {entry.currentOverdueDays}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Borrow Charge</p>
                        <p className="font-medium text-gray-900">
                          ₹{(entry.bookPrice + entry.holdAmount).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Live Penalty Exposure</p>
                        <p className={`font-medium ${entry.currentPenaltyExposure > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                          ₹{entry.currentPenaltyExposure.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Borrower Wallet</p>
                        <p className="font-medium text-gray-900">
                          ₹{(users.find((user) => user.id === entry.userId)?.wallet_balance || 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Outstanding Due</p>
                        <p className="font-medium text-red-700">
                          ₹{(users.find((user) => user.id === entry.userId)?.outstanding_penalty_balance || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600 mb-2">Borrow Revenue</p>
                <p className="text-3xl font-bold text-gray-900">₹{totalBorrowRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600 mb-2">Penalty Recovered</p>
                <p className="text-3xl font-bold text-gray-900">₹{totalPenaltyRecovered.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600 mb-2">Holds Collected</p>
                <p className="text-3xl font-bold text-gray-900">₹{totalHoldsCollected.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600 mb-2">Hold Refunded</p>
                <p className="text-3xl font-bold text-emerald-700">₹{totalHoldRefunded.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600 mb-2">Hold Used For Penalties</p>
                <p className="text-3xl font-bold text-amber-700">₹{totalHoldUsedForPenalties.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600 mb-2">Live Penalty Exposure</p>
                <p className="text-3xl font-bold text-red-700">₹{totalLivePenaltyExposure.toFixed(2)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Top Borrowed Books</h2>
                <div className="space-y-3">
                  {topBooks.length === 0 && <p className="text-gray-500">No borrowing activity yet.</p>}
                  {topBooks.map((book) => (
                    <div key={`${book.title}-${book.author}`} className="flex justify-between items-center border-b pb-3 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{book.title}</p>
                        <p className="text-sm text-gray-600">{book.author}</p>
                      </div>
                      <span className="font-bold text-gray-900">{book.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Top Borrowers</h2>
                <div className="space-y-3">
                  {topBorrowers.length === 0 && <p className="text-gray-500">No borrowing activity yet.</p>}
                  {topBorrowers.map((borrower) => (
                    <div key={borrower.id} className="flex justify-between items-center border-b pb-3 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{borrower.name}</p>
                        <p className="text-sm text-gray-600">{borrower.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{borrower.count} total</p>
                        <p className="text-sm text-gray-600">{borrower.active} active</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Overdue Actions</h2>
              {overdueBorrowings.length === 0 ? (
                <p className="text-gray-500">No overdue loans right now.</p>
              ) : (
                <div className="space-y-4">
                  {overdueBorrowings.map((entry) => (
                    <div key={entry.id} className="border rounded-xl p-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{entry.bookTitle}</p>
                          <p className="text-sm text-gray-600">
                            {entry.userName} ({entry.userEmail})
                          </p>
                        </div>
                        <div className="text-sm text-right">
                          <p className="text-amber-700 font-medium">
                            Overdue by {entry.currentOverdueDays} day{entry.currentOverdueDays === 1 ? '' : 's'}
                          </p>
                          <p className="text-red-700 font-medium">
                            Live penalty exposure: ₹{entry.currentPenaltyExposure.toFixed(2)}
                          </p>
                          <p className="text-gray-600">
                            Borrowing restricted until overdue item is returned
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'books' && (
          <div>
            <button
              onClick={() => setShowBookForm(!showBookForm)}
              className="mb-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add New Book
            </button>

            {showBookForm && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Book</h3>
                <form onSubmit={handleAddBook} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                      <input
                        type="text"
                        value={newBook.title}
                        onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Author</label>
                      <input
                        type="text"
                        value={newBook.author}
                        onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <input
                        type="text"
                        value={newBook.category}
                        onChange={(e) => setNewBook({ ...newBook, category: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Copies</label>
                      <input
                        type="number"
                        value={newBook.total_copies}
                        onChange={(e) =>
                          setNewBook({ ...newBook, total_copies: parseInt(e.target.value, 10) || 1 })
                        }
                        min="1"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Price</label>
                      <input
                        type="number"
                        value={newBook.price}
                        onChange={(e) => setNewBook({ ...newBook, price: parseFloat(e.target.value) || 0 })}
                        min="0"
                        step="0.01"
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={newBook.description}
                      onChange={(e) => setNewBook({ ...newBook, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    ></textarea>
                  </div>
                  <div className="flex gap-4">
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg"
                    >
                      Add Book
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBookForm(false)}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-6 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {editingBook && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Book</h3>
                <form onSubmit={handleSaveEdit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                      <input
                        type="text"
                        value={editingBook.title}
                        onChange={(e) => setEditingBook({ ...editingBook, title: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Author</label>
                      <input
                        type="text"
                        value={editingBook.author}
                        onChange={(e) => setEditingBook({ ...editingBook, author: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <input
                        type="text"
                        value={editingBook.category}
                        onChange={(e) => setEditingBook({ ...editingBook, category: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Copies</label>
                      <input
                        type="number"
                        value={editingBook.total_copies}
                        onChange={(e) =>
                          setEditingBook({
                            ...editingBook,
                            total_copies: parseInt(e.target.value, 10) || 1,
                          })
                        }
                        min={1}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={editingBook.description}
                      onChange={(e) => setEditingBook({ ...editingBook, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    ></textarea>
                  </div>
                  <div className="flex gap-4">
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg">
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingBook(null)}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-6 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {books.map((book) => (
                <div key={book.id} className="bg-white rounded-xl shadow-lg p-4">
                  <h3 className="font-bold text-gray-900 mb-1 line-clamp-2">{book.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">{book.author}</p>
                  <p className="text-xs text-gray-500 mb-3">{book.category}</p>
                  <p className="text-sm text-gray-700 font-semibold mb-2">Price: ₹{book.price}</p>
                  <div className="mb-4 pb-4 border-b">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-bold">{book.total_copies}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Available:</span>
                      <span className="font-bold text-green-600">{book.available_copies}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={async () => {
                        try {
                          await booksService.updateBook(book.id, {
                            total_copies: Math.max(1, book.total_copies - 1),
                          });
                          loadAllData();
                        } catch (error) {
                          console.error(error);
                        }
                      }}
                      className="flex-1 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-medium py-2 rounded-lg"
                    >
                      -
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await booksService.updateBook(book.id, {
                            total_copies: book.total_copies + 1,
                          });
                          loadAllData();
                        } catch (error) {
                          console.error(error);
                        }
                      }}
                      className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 font-medium py-2 rounded-lg"
                    >
                      +
                    </button>
                    <button
                      onClick={() => setEditingBook(book)}
                      className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium py-2 rounded-lg"
                    >
                      Edit
                    </button>
                  </div>

                  <button
                    onClick={() => handleDeleteBook(book.id)}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-medium py-2 rounded-lg flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {users.map((user) => (
              <div key={user.id} className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{user.name}</h3>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </div>
                  <span
                    className={`text-xs font-medium px-3 py-1 rounded-full ${
                      user.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {user.role}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  Joined: {formatDate(user.created_at)}
                </p>

                <div className="space-y-1 text-sm mb-4">
                  <p className="text-gray-700">
                    Wallet: <span className="font-medium">₹{(user.wallet_balance || 0).toFixed(2)}</span>
                  </p>
                  <p className={`${(user.outstanding_penalty_balance || 0) > 0 ? 'text-red-700' : 'text-gray-700'}`}>
                    Outstanding Penalty:{' '}
                    <span className="font-medium">₹{(user.outstanding_penalty_balance || 0).toFixed(2)}</span>
                  </p>
                  <p className="text-gray-700">
                    Active Borrows:{' '}
                    <span className="font-medium">{user.borrowed_books?.length || 0}</span>
                  </p>
                </div>

                {user.role === 'user' ? (
                  <button
                    onClick={() => handleChangeUserRole(user.id, 'admin')}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 rounded-lg"
                  >
                    Make Admin
                  </button>
                ) : (
                  user.id !== userProfile?.id && (
                    <button
                      onClick={() => handleChangeUserRole(user.id, 'user')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg"
                    >
                      Make User
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
