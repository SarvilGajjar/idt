import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query as fsQuery,
  where,
  orderBy,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  limit as fsLimit,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  wallet_balance?: number;
  outstanding_penalty_balance?: number;
  borrowing_restricted?: boolean;
  borrowed_book_ids?: string[];
  borrowed_books?: BorrowedBookRecord[];
  borrow_history?: BorrowHistoryRecord[];
  wallet_history?: WalletTransactionRecord[];
  created_at: string;
  updated_at: string;
};

export type BorrowedBookRecord = {
  book_id: string;
  borrowed_at: string;
  due_date: string;
  loan_days: number;
};

export type BorrowHistoryRecord = BorrowedBookRecord & {
  returned_at: string | null;
  book_price: number;
  hold_amount: number;
  hold_applied_to_penalty?: number;
  refunded_hold_amount?: number;
  penalty_amount: number;
  payment_method: 'wallet';
  status: 'borrowed' | 'overdue' | 'returned' | 'penalty_due';
};

export type WalletTransactionRecord = {
  id?: string;
  transaction_type: 'topup' | 'penalty_payment' | 'book_charge' | 'hold_refund' | 'penalty_charge';
  amount: number;
  description: string;
  book_id?: string;
  book_title?: string;
  reference_id?: string; // borrow history record id or transaction id
  previous_balance: number;
  new_balance: number;
  timestamp: string;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  total_copies: number;
  available_copies: number;
  price: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  book_id: string;
  status: 'issued' | 'returned' | 'pending' | 'rejected';
  issue_date?: string;
  due_date?: string;
  returned_date?: string;
  requested_days?: number;
  deposit_amount?: number;
  hold_amount?: number;
  payment_amount?: number;
  payment_status?: 'paid' | 'unpaid' | 'refunded';
  fine_amount?: number;
  refund_amount?: number;
  created_at: string;
  updated_at: string;
};

export const firebaseAuthHelpers = {
  async signup(email: string, password: string) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  },

  async login(email: string, password: string) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  },

  async logout() {
    await signOut(auth);
  },

  getCurrentUser() {
    return auth.currentUser;
  },

  onAuthStateChange(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  },
};

export const firestoreHelpers = {
  collection,
  doc,
  getDoc,
  getDocs,
  query: fsQuery,
  where,
  orderBy,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  limit: fsLimit,
};

export const storageHelpers = {
  ref,
  uploadBytes,
  getDownloadURL,
};
