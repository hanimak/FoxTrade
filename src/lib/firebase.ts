import { initializeApp } from 'firebase/app';
import { 
  getAuth,
  GoogleAuthProvider, 
  browserLocalPersistence,
  setPersistence,
  type User 
} from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// IMPORTANT: For Desktop (Electron) builds, ensure you add "localhost" 
// to your Authorized Domains in the Firebase Console (Authentication > Settings)
const firebaseConfig = { 
  apiKey: "AIzaSyDQ3Gvx7KNs-K38Y-BB7OTipqFlooYuKzI", 
  authDomain: "fox-trade.firebaseapp.com", 
  projectId: "fox-trade", 
  storageBucket: "fox-trade.firebasestorage.app", 
  messagingSenderId: "1052422097736", 
  appId: "1:1052422097736:web:d8df074b1fd3b4b3bec17d", 
  measurementId: "G-F6ND60QHF8" 
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Set persistence to local for better experience on desktop/mobile
// This handles persistence more reliably than initializeAuth on some platforms
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.error("Firebase persistence error:", err);
});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Firestore with settings to avoid ERR_ABORTED
// Using experimentalForceLongPolling helps in environments with restrictive networks or proxies (common in Electron)
// In production, we ensure we don't use persistentMultipleTabManager if it causes issues with the app protocol
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true,
  // Ensure we use the right host for production
  host: 'firestore.googleapis.com',
  ssl: true
});

export const storage = getStorage(app);

export type { User };
