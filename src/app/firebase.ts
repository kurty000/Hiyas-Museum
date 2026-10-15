import { initializeApp, getApps } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// Hiyas Museum — project: hiyas-museum-da909
export const firebaseConfig = {
  apiKey: "AIzaSyAIM6uI6YqHUNcZ4628ITTkTsAZBa66_OA",
  authDomain: "hiyas-museum-da909.firebaseapp.com",
  databaseURL: "https://hiyas-museum-da909-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hiyas-museum-da909",
  storageBucket: "hiyas-museum-da909.firebasestorage.app",
  messagingSenderId: "204039084611",
  appId: "1:204039084611:web:7d920f6436e03c8a6192f6",
};

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

/**
 * Persist sessions in IndexedDB (preferred) with localStorage fallback.
 * initializeAuth is synchronous so persistence is set before any auth listeners run.
 */
function createAuth() {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  } catch {
    // Hot reload / second import — Auth already initialized for this app
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = getFirestore(app);
/** Realtime Database — ESP32 writes live readings to /liveSensors/{deviceId} */
export const rtdb = getDatabase(app);
