import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
/** Realtime Database — ESP32 writes live readings to /liveSensors/{deviceId} */
export const rtdb = getDatabase(app);
