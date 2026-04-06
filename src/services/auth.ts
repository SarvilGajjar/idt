import {
  firebaseAuthHelpers,
  db,
  UserProfile,
} from './firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

export const authService = {
  async signup(email: string, password: string, name: string) {
    const user = await firebaseAuthHelpers.signup(email, password);
    // create profile in Firestore
    const now = new Date().toISOString();
    await setDoc(doc(db, 'user_profiles', user.uid), {
      id: user.uid,
      email,
      name,
      role: 'user',
      wallet_balance: 1000,
      outstanding_penalty_balance: 0,
      borrowed_book_ids: [],
      borrowed_books: [],
      borrow_history: [],
      created_at: now,
      updated_at: now,
    });
    return user;
  },

  // Create an admin user (caller must be admin in the app)
  async createAdmin(email: string, password: string, name: string) {
    const user = await firebaseAuthHelpers.signup(email, password);
    const now = new Date().toISOString();
    await setDoc(doc(db, 'user_profiles', user.uid), {
      id: user.uid,
      email,
      name,
      role: 'admin',
      wallet_balance: 0,
      outstanding_penalty_balance: 0,
      borrowed_book_ids: [],
      borrowed_books: [],
      borrow_history: [],
      created_at: now,
      updated_at: now,
    });
    return user;
  },

  // Create a temporary admin account with expiry (days)
  async createTempAdmin(email: string, password: string, name: string, expiresInDays = 7) {
    const user = await firebaseAuthHelpers.signup(email, password);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
    await setDoc(doc(db, 'user_profiles', user.uid), {
      id: user.uid,
      email,
      name,
      role: 'admin',
      temporary: true,
      expires_at: expiresAt,
      wallet_balance: 0,
      outstanding_penalty_balance: 0,
      borrowed_book_ids: [],
      borrowed_books: [],
      borrow_history: [],
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
    return user;
  },

  async login(email: string, password: string) {
    const user = await firebaseAuthHelpers.login(email, password);
    return user;
  },

  async logout() {
    await firebaseAuthHelpers.logout();
  },

  async getCurrentUser() {
    return firebaseAuthHelpers.getCurrentUser();
  },

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(db, 'user_profiles', userId));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  },

  async updateUserProfile(userId: string, updates: Partial<UserProfile>) {
    updates.updated_at = new Date().toISOString();
    await updateDoc(doc(db, 'user_profiles', userId), updates as any);
    const snap = await getDoc(doc(db, 'user_profiles', userId));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  },

  onAuthStateChange(callback: (user: any) => void) {
    return firebaseAuthHelpers.onAuthStateChange(callback);
  },
};
