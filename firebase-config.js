// firebase-config.js

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// TODO: Add your web app's Firebase configuration
// Your web app's Firebase configuration
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

// Export the instances you'll need
export { auth, db };