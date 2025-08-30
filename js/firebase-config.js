// js/firebase-config.js
// Initialize Firebase app, auth, and firestore.
// Use import.meta.env for environment variables if using a build tool like Vite/Webpack,
// otherwise replace with your actual config.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js"; // Import GoogleAuthProvider

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyARVt5zXpIgtlmLfM92lP7ILLL8zkPs_ek",
  authDomain: "zainin-ai.firebaseapp.com",
  projectId: "zainin-ai",
  storageBucket: "zainin-ai.firebasestorage.app",
  messagingSenderId: "560455432570",
  appId: "1:560455432570:web:754688f0da627a02a4fec3",
  measurementId: "G-JB30JZNCBT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider(); // Export provider

export { auth, db, googleProvider }; // Export initialized services and provider