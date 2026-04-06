import { db, UserProfile, WalletTransactionRecord } from './firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

const getDaysUntilDate = (dateString: string) => {
  const target = new Date(dateString);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

export const usersService = {
  async getAllUsers(): Promise<UserProfile[]> {
    const q = query(collection(db, 'user_profiles'), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UserProfile);
  },

  async getUsersByRole(role: 'admin' | 'user'): Promise<UserProfile[]> {
    const q = query(
      collection(db, 'user_profiles'),
      where('role', '==', role),
      orderBy('created_at', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UserProfile);
  },

  async updateUserRole(userId: string, role: 'admin' | 'user') {
    const userRef = doc(db, 'user_profiles', userId);
    await updateDoc(userRef, { role, updated_at: new Date().toISOString() } as any);
    const updated = await getDocs(query(collection(db, 'user_profiles'), where('id', '==', userId)));
    return updated.docs[0]?.data() as UserProfile | null;
  },

  async topUpWallet(userId: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Top-up amount must be greater than zero');
    }

    const users = await getDocs(query(collection(db, 'user_profiles'), where('id', '==', userId)));
    const current = users.docs[0]?.data() as UserProfile | undefined;
    if (!current) throw new Error('User not found');

    const previousBalance = current.wallet_balance || 0;
    const newBalance = previousBalance + amount;

    // Create wallet transaction record
    const walletTransaction: WalletTransactionRecord = {
      transaction_type: 'topup',
      amount: amount,
      description: `Wallet top-up of ₹${amount}`,
      previous_balance: previousBalance,
      new_balance: newBalance,
      timestamp: new Date().toISOString(),
    };

    const walletHistory = current.wallet_history || [];

    const userRef = doc(db, 'user_profiles', userId);
    await updateDoc(userRef, {
      wallet_balance: newBalance,
      wallet_history: [...walletHistory, walletTransaction],
      updated_at: new Date().toISOString(),
    } as any);

    const updated = await getDocs(query(collection(db, 'user_profiles'), where('id', '==', userId)));
    return updated.docs[0]?.data() as UserProfile | null;
  },

  async payOutstandingPenalty(userId: string, amount?: number) {
    const users = await getDocs(query(collection(db, 'user_profiles'), where('id', '==', userId)));
    const current = users.docs[0]?.data() as UserProfile | undefined;
    if (!current) throw new Error('User not found');

    const walletBalance = current.wallet_balance || 0;
    const outstandingPenalty = current.outstanding_penalty_balance || 0;
    if (outstandingPenalty <= 0) return current;

    const paymentAmount = Math.min(
      amount ?? outstandingPenalty,
      outstandingPenalty,
      walletBalance
    );

    if (paymentAmount <= 0) {
      throw new Error('Insufficient wallet balance to pay the outstanding penalty');
    }

    const previousBalance = walletBalance;
    const newBalance = walletBalance - paymentAmount;

    // Create wallet transaction record
    const walletTransaction: WalletTransactionRecord = {
      transaction_type: 'penalty_payment',
      amount: paymentAmount,
      description: `Penalty payment of ₹${paymentAmount}`,
      previous_balance: previousBalance,
      new_balance: newBalance,
      timestamp: new Date().toISOString(),
    };

    const walletHistory = current.wallet_history || [];

    const userRef = doc(db, 'user_profiles', userId);
    await updateDoc(userRef, {
      wallet_balance: newBalance,
      outstanding_penalty_balance: outstandingPenalty - paymentAmount,
      wallet_history: [...walletHistory, walletTransaction],
      borrowing_restricted: outstandingPenalty - paymentAmount > 0,
      updated_at: new Date().toISOString(),
    } as any);

    const updated = await getDocs(query(collection(db, 'user_profiles'), where('id', '==', userId)));
    return updated.docs[0]?.data() as UserProfile | null;
  },

  async syncOverdueStatuses() {
    const snap = await getDocs(collection(db, 'user_profiles'));
    const batch = writeBatch(db);
    let hasUpdates = false;

    snap.docs.forEach((userDoc) => {
      const user = userDoc.data() as UserProfile;
      const borrowedBooks = user.borrowed_books || [];
      const borrowHistory = user.borrow_history || [];
      const hasOverdueBook = borrowedBooks.some((entry) => getDaysUntilDate(entry.due_date) < 0);
      const borrowingRestricted = hasOverdueBook || (user.outstanding_penalty_balance || 0) > 0;

      const nextBorrowHistory = borrowHistory.map((entry) => {
        if (entry.returned_at === null && getDaysUntilDate(entry.due_date) < 0 && entry.status === 'borrowed') {
          return { ...entry, status: 'overdue' as const };
        }
        return entry;
      });

      const historyChanged = JSON.stringify(nextBorrowHistory) !== JSON.stringify(borrowHistory);
      if (historyChanged || borrowingRestricted !== !!user.borrowing_restricted) {
        hasUpdates = true;
        batch.update(doc(db, 'user_profiles', user.id), {
          borrow_history: nextBorrowHistory,
          borrowing_restricted: borrowingRestricted,
          updated_at: new Date().toISOString(),
        } as any);
      }
    });

    if (hasUpdates) {
      await batch.commit();
    }
  },

  async deleteUser(userId: string) {
    await deleteDoc(doc(db, 'user_profiles', userId));
  },

  async getUserCount(): Promise<number> {
    const snap = await getDocs(collection(db, 'user_profiles'));
    return snap.size;
  },

  subscribeToUsers(callback: (users: UserProfile[]) => void) {
    const q = query(collection(db, 'user_profiles'), orderBy('created_at', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map((d) => d.data() as UserProfile));
    });
  },
};

export type { UserProfile };
