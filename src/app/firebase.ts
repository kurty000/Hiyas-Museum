import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyDGC5Iph7deKLGjlHfjckUYGkEQ8MpfJSw",
  authDomain: "hiyas-museum.firebaseapp.com",
  databaseURL: "https://hiyas-museum-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hiyas-museum",
  storageBucket: "hiyas-museum.firebasestorage.app",
  messagingSenderId: "406908963098",
  appId: "1:406908963098:web:3b7da2e7a1cddc825a44a3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);
