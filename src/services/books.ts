import { db, storage, storageHelpers, Book, BorrowedBookRecord, BorrowHistoryRecord, WalletTransactionRecord } from './firebase';
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';

const DEFAULT_LOAN_DAYS = 14;
const MAX_LOAN_DAYS = 30;
const REMINDER_DAYS = 3;
const PENALTY_PER_DAY = 10;
const HOLD_AMOUNT = 100;

export type BorrowedBook = Book & {
  borrowed_at: string;
  due_date: string;
  loan_days: number;
  daysUntilDue: number;
  overdueDays: number;
  penaltyAmount: number;
  holdAmount: number;
  holdAppliedToPenalty: number;
  refundableHoldAmount: number;
  totalPaidAtBorrow: number;
  status: 'borrowed' | 'overdue';
  reminder: string | null;
};

const getDaysUntilDate = (dateString: string) => {
  const target = new Date(dateString);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const normalizeBook = (id: string, data: any): Book => ({
  id,
  title: data.title || 'Untitled Book',
  author: data.author || 'Unknown Author',
  category: data.category || 'General',
  description: data.description || '',
  total_copies: typeof data.total_copies === 'number' ? data.total_copies : 1,
  available_copies:
    typeof data.available_copies === 'number'
      ? data.available_copies
      : typeof data.total_copies === 'number'
      ? data.total_copies
      : 1,
  price: typeof data.price === 'number' ? data.price : 0,
  image_url: data.image_url ?? null,
  created_at: data.created_at || new Date().toISOString(),
  updated_at: data.updated_at || new Date().toISOString(),
});

const normalizeBorrowedBooks = (
  borrowedBookIds: string[] = [],
  borrowedBooks: BorrowedBookRecord[] = []
) => {
  if (borrowedBooks.length > 0) return borrowedBooks;

  return borrowedBookIds.map((bookId) => {
    const borrowedAt = new Date().toISOString();
    const dueDate = new Date(
      Date.now() + DEFAULT_LOAN_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    return {
      book_id: bookId,
      borrowed_at: borrowedAt,
      due_date: dueDate,
      loan_days: DEFAULT_LOAN_DAYS,
    };
  });
};

export const booksService = {
  async getBooks(searchTerm = '', category = '', filter = 'all'): Promise<Book[]> {
    const col = collection(db, 'books');
    // Always query by created_at desc and apply category filtering client-side
    // to avoid issues with case-sensitivity or missing indexes.
    const q = query(col, orderBy('created_at', 'desc'));

    const snap = await getDocs(q);
    let books = snap.docs.map((d) => normalizeBook(d.id, d.data()));

    if (category) {
      const cat = category.toLowerCase();
      books = books.filter((b) => (b.category || '').toLowerCase() === cat);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      books = books.filter(
        (b) => b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term)
      );
    }

    if (filter === 'available') books = books.filter((b) => b.available_copies > 0);

    return books;
  },

  async getBookById(bookId: string): Promise<Book | null> {
    const snap = await getDoc(doc(db, 'books', bookId));
    return snap.exists() ? normalizeBook(snap.id, snap.data()) : null;
  },

  async getBorrowedBookRecords(userId: string): Promise<BorrowedBookRecord[]> {
    const userSnap = await getDoc(doc(db, 'user_profiles', userId));
    if (!userSnap.exists()) return [];

    const userData = userSnap.data() as {
      borrowed_book_ids?: string[];
      borrowed_books?: BorrowedBookRecord[];
    };

    return normalizeBorrowedBooks(
      userData.borrowed_book_ids || [],
      userData.borrowed_books || []
    );
  },

  async getBorrowedBooks(userId: string): Promise<BorrowedBook[]> {
    const borrowedRecords = await booksService.getBorrowedBookRecords(userId);
    if (borrowedRecords.length === 0) return [];

    const borrowedBooks = await Promise.all(
      borrowedRecords.map(async (record) => {
        const book = await booksService.getBookById(record.book_id);
        if (!book) return null;

        const daysUntilDue = getDaysUntilDate(record.due_date);
        const overdueDays = Math.max(0, -daysUntilDue);
        const penaltyAmount = overdueDays * PENALTY_PER_DAY;

        let reminder: string | null = null;
        if (overdueDays > 0) {
          reminder = `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`;
        } else if (daysUntilDue <= REMINDER_DAYS) {
          reminder = `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`;
        }

        return {
          ...book,
          borrowed_at: record.borrowed_at,
          due_date: record.due_date,
          loan_days: record.loan_days,
          daysUntilDue,
          overdueDays,
          penaltyAmount,
          holdAmount: HOLD_AMOUNT,
          holdAppliedToPenalty: Math.min(HOLD_AMOUNT, penaltyAmount),
          refundableHoldAmount: Math.max(0, HOLD_AMOUNT - penaltyAmount),
          totalPaidAtBorrow: book.price + HOLD_AMOUNT,
          status: overdueDays > 0 ? 'overdue' : 'borrowed',
          reminder,
        };
      })
    );

    return borrowedBooks.filter((book): book is BorrowedBook => book !== null);
  },

  async borrowBook(bookId: string, userId: string, loanDays = DEFAULT_LOAN_DAYS) {
    if (!Number.isFinite(loanDays) || loanDays < 1 || loanDays > MAX_LOAN_DAYS) {
      throw new Error(`Loan period must be between 1 and ${MAX_LOAN_DAYS} days`);
    }

    await runTransaction(db, async (transaction) => {
      const bookRef = doc(db, 'books', bookId);
      const userRef = doc(db, 'user_profiles', userId);

      const [bookSnap, userSnap] = await Promise.all([
        transaction.get(bookRef),
        transaction.get(userRef),
      ]);

      if (!bookSnap.exists()) throw new Error('Book not found');
      if (!userSnap.exists()) throw new Error('User profile not found');

      const book = normalizeBook(bookSnap.id, bookSnap.data());
      const user = userSnap.data() as {
        wallet_balance?: number;
        outstanding_penalty_balance?: number;
        borrowing_restricted?: boolean;
        borrowed_book_ids?: string[];
        borrowed_books?: BorrowedBookRecord[];
        borrow_history?: BorrowHistoryRecord[];
        wallet_history?: WalletTransactionRecord[];
      };
      const borrowedBookIds = user.borrowed_book_ids || [];
      const borrowedBooks = normalizeBorrowedBooks(
        borrowedBookIds,
        user.borrowed_books || []
      );
      const borrowHistory = user.borrow_history || [];
      const walletBalance = user.wallet_balance || 0;
      const hasOverdueBook = borrowedBooks.some(
        (entry) => getDaysUntilDate(entry.due_date) < 0
      );

      if (borrowedBooks.some((entry) => entry.book_id === bookId)) {
        throw new Error('You have already borrowed this book');
      }

      if (hasOverdueBook || (user.outstanding_penalty_balance || 0) > 0 || user.borrowing_restricted) {
        throw new Error('Borrowing is blocked until overdue books and pending dues are cleared');
      }

      if ((book.available_copies || 0) <= 0) {
        throw new Error('This book is not available right now');
      }

      const totalBorrowCharge = book.price + HOLD_AMOUNT;

      if (walletBalance < totalBorrowCharge) {
        throw new Error(
          `Insufficient wallet balance. Add at least ₹${totalBorrowCharge - walletBalance} more.`
        );
      }

      const now = new Date();
      const borrowedAt = now.toISOString();
      const dueDate = new Date(
        now.getTime() + loanDays * 24 * 60 * 60 * 1000
      ).toISOString();

      // Create wallet transaction record for book charge
      const walletTransaction: WalletTransactionRecord = {
        transaction_type: 'book_charge',
        amount: totalBorrowCharge,
        description: `Book borrow: ${book.title} by ${book.author}`,
        book_id: bookId,
        book_title: book.title,
        previous_balance: walletBalance,
        new_balance: walletBalance - totalBorrowCharge,
        timestamp: borrowedAt,
      };

      const walletHistory = user.wallet_history || [];

      transaction.update(bookRef, {
        available_copies: book.available_copies - 1,
        updated_at: borrowedAt,
      });

      transaction.update(userRef, {
        wallet_balance: walletBalance - totalBorrowCharge,
        wallet_history: [...walletHistory, walletTransaction],
        borrowed_book_ids: [...borrowedBookIds, bookId],
        borrowed_books: [
          ...borrowedBooks,
          {
            book_id: bookId,
            borrowed_at: borrowedAt,
            due_date: dueDate,
            loan_days: loanDays,
          },
        ],
        borrow_history: [
          ...borrowHistory,
          {
            book_id: bookId,
            borrowed_at: borrowedAt,
            due_date: dueDate,
            loan_days: loanDays,
            returned_at: null,
            book_price: book.price,
            hold_amount: HOLD_AMOUNT,
            penalty_amount: 0,
            payment_method: 'wallet',
            status: 'borrowed',
          },
        ],
        borrowing_restricted: false,
        updated_at: borrowedAt,
      });
    });
  },

  async returnBook(bookId: string, userId: string) {
    let returnSummary = {
      overdueDays: 0,
      penaltyAmount: 0,
      holdAppliedToPenalty: 0,
      refundedAmount: 0,
      remainingPenaltyDue: 0,
    };

    await runTransaction(db, async (transaction) => {
      const bookRef = doc(db, 'books', bookId);
      const userRef = doc(db, 'user_profiles', userId);

      const [bookSnap, userSnap] = await Promise.all([
        transaction.get(bookRef),
        transaction.get(userRef),
      ]);

      if (!bookSnap.exists()) throw new Error('Book not found');
      if (!userSnap.exists()) throw new Error('User profile not found');

      const book = normalizeBook(bookSnap.id, bookSnap.data());
      const user = userSnap.data() as {
        wallet_balance?: number;
        outstanding_penalty_balance?: number;
        borrowed_book_ids?: string[];
        borrowed_books?: BorrowedBookRecord[];
        borrow_history?: BorrowHistoryRecord[];
        wallet_history?: WalletTransactionRecord[];
      };
      const borrowedBookIds = user.borrowed_book_ids || [];
      const borrowedBooks = normalizeBorrowedBooks(
        borrowedBookIds,
        user.borrowed_books || []
      );
      const borrowHistory = user.borrow_history || [];
      const borrowedBook = borrowedBooks.find((entry) => entry.book_id === bookId);

      if (!borrowedBook) {
        throw new Error('This book is not borrowed by your account');
      }

      const overdueDays = Math.max(0, -getDaysUntilDate(borrowedBook.due_date));
      const holdAppliedToPenalty = Math.min(HOLD_AMOUNT, overdueDays * PENALTY_PER_DAY);
      const refundedAmount = Math.max(0, HOLD_AMOUNT - holdAppliedToPenalty);
      const remainingPenaltyDue = Math.max(
        0,
        overdueDays * PENALTY_PER_DAY - holdAppliedToPenalty
      );
      returnSummary = {
        overdueDays,
        penaltyAmount: overdueDays * PENALTY_PER_DAY,
        holdAppliedToPenalty,
        refundedAmount,
        remainingPenaltyDue,
      };

      const returnedAt = new Date().toISOString();
      const walletBalance = user.wallet_balance || 0;
      const remainingBorrowedBooks = borrowedBooks.filter((entry) => entry.book_id !== bookId);
      const hasRemainingOverdueBooks = remainingBorrowedBooks.some(
        (entry) => getDaysUntilDate(entry.due_date) < 0
      );

      // Create wallet transactions for return
      const walletHistory = user.wallet_history || [];
      const returnTransactions: WalletTransactionRecord[] = [];

      // Record hold refund transaction
      if (returnSummary.refundedAmount > 0) {
        returnTransactions.push({
          transaction_type: 'hold_refund',
          amount: returnSummary.refundedAmount,
          description: `Hold refunded for book return: ${book.title}`,
          book_id: bookId,
          book_title: book.title,
          previous_balance: walletBalance,
          new_balance: walletBalance + returnSummary.refundedAmount,
          timestamp: returnedAt,
        });
      }

      // Record penalty charge transaction (if any)
      if (returnSummary.remainingPenaltyDue > 0) {
        const newBalance = walletBalance + returnSummary.refundedAmount;
        returnTransactions.push({
          transaction_type: 'penalty_charge',
          amount: returnSummary.remainingPenaltyDue,
          description: `Penalty charged for ${returnSummary.overdueDays} overdue day${returnSummary.overdueDays === 1 ? '' : 's'}: ${book.title}`,
          book_id: bookId,
          book_title: book.title,
          previous_balance: newBalance,
          new_balance: newBalance - returnSummary.remainingPenaltyDue,
          timestamp: returnedAt,
        });
      }

      transaction.update(bookRef, {
        available_copies: Math.min(book.total_copies, (book.available_copies || 0) + 1),
        updated_at: returnedAt,
      });

      transaction.update(userRef, {
        wallet_balance: walletBalance + returnSummary.refundedAmount,
        wallet_history: [...walletHistory, ...returnTransactions],
        outstanding_penalty_balance:
          (user.outstanding_penalty_balance || 0) + returnSummary.remainingPenaltyDue,
        borrowed_book_ids: borrowedBookIds.filter((id) => id !== bookId),
        borrowed_books: remainingBorrowedBooks,
        borrow_history: borrowHistory.map((entry) => {
          if (
            entry.book_id === bookId &&
            entry.borrowed_at === borrowedBook.borrowed_at &&
            entry.returned_at === null
          ) {
            return {
              ...entry,
              returned_at: returnedAt,
              penalty_amount: returnSummary.penaltyAmount,
              hold_applied_to_penalty: returnSummary.holdAppliedToPenalty,
              refunded_hold_amount: returnSummary.refundedAmount,
              status: returnSummary.remainingPenaltyDue > 0 ? 'penalty_due' : 'returned',
            };
          }
          return entry;
        }),
        borrowing_restricted:
          hasRemainingOverdueBooks ||
          (user.outstanding_penalty_balance || 0) + returnSummary.remainingPenaltyDue > 0,
        updated_at: returnedAt,
      });
    });

    return returnSummary;
  },

  async addBook(book: Omit<Book, 'id' | 'created_at' | 'updated_at'>) {
    // Validate price and copies
    if (typeof (book as any).price !== 'number' || (book as any).price <= 0) {
      throw new Error('Book must have a valid positive price');
    }
    const now = new Date().toISOString();
    const total = (book as any).total_copies || 1;
    const toWrite = {
      ...book,
      total_copies: total,
      available_copies: (book as any).available_copies ?? total,
      created_at: now,
      updated_at: now,
    } as any;
    const docRef = await addDoc(collection(db, 'books'), toWrite);
    const snap = await getDoc(doc(db, 'books', docRef.id));
    return normalizeBook(docRef.id, snap.data());
  },

  async updateBook(bookId: string, updates: Partial<Book>) {
    const snap = await getDoc(doc(db, 'books', bookId));
    if (!snap.exists()) throw new Error('Book not found');
    const existing = snap.data() as any;

    // Prevent changing price after creation
    if (updates.price !== undefined && updates.price !== existing.price) {
      throw new Error('Book price is fixed and cannot be changed');
    }

    const updated: any = { ...updates };

    // Handle total_copies change and adjust available_copies accordingly
    if (updates.total_copies !== undefined && updates.total_copies !== existing.total_copies) {
      const delta = (updates.total_copies as number) - (existing.total_copies || 0);
      const newAvailable = Math.max(0, (existing.available_copies || 0) + delta);
      updated.available_copies = newAvailable;
    }

    updated.updated_at = new Date().toISOString();

    await updateDoc(doc(db, 'books', bookId), updated as any);
    const fresh = await getDoc(doc(db, 'books', bookId));
    return fresh.exists() ? normalizeBook(fresh.id, fresh.data()) : null;
  },

  async deleteBook(bookId: string) {
    await deleteDoc(doc(db, 'books', bookId));
  },

  async getCategories(): Promise<string[]> {
    const snap = await getDocs(query(collection(db, 'books')));
    const set = new Set<string>();
    snap.docs.forEach((d) => {
      const data = d.data() as any;
      if (data.category) set.add(data.category);
    });
    return Array.from(set);
  },

  async uploadBookImage(file: File): Promise<string> {
    const timestamp = Date.now();
    const filename = `books/${timestamp}-${file.name}`;
    const storageRef = storageHelpers.ref(storage, filename);
    await storageHelpers.uploadBytes(storageRef, file as any);
    const url = await storageHelpers.getDownloadURL(storageRef);
    return url;
  },

  subscribeToBooks(
    callback: (books: Book[]) => void,
    filter?: { searchTerm?: string; category?: string; filterType?: string }
  ) {
    // Always subscribe to the full books collection ordered by creation time,
    // then apply filtering in `getBooks` for consistency with client-side behavior.
    const q = query(collection(db, 'books'), orderBy('created_at', 'desc'));

    return onSnapshot(q, async () => {
      const books = await booksService.getBooks(
        filter?.searchTerm || '',
        filter?.category || '',
        filter?.filterType || 'all'
      );
      callback(books);
    });
  },
};
export { DEFAULT_LOAN_DAYS, MAX_LOAN_DAYS, REMINDER_DAYS, PENALTY_PER_DAY };
export { HOLD_AMOUNT };
export type { Book };
