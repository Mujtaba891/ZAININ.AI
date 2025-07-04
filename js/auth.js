// js/auth.js
import { auth, googleProvider } from "./firebase-config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const emailSigninBtn = document.getElementById('email-signin-btn');
    const emailSignupBtn = document.getElementById('email-signup-btn');
    const googleSigninBtn = document.getElementById('google-signin-btn');
    const authError = document.getElementById('auth-error');
    const authFormsDiv = document.getElementById('auth-forms');

    // Check auth state on load
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in, redirect to chat
            window.location.href = '/index.html';
        } else {
            // User is signed out, show auth form
            document.getElementById('auth-container').classList.add('visible');
        }
    });

    // Handle Email Sign In
    emailSigninBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        authError.textContent = ''; // Clear previous errors

        if (!email || !password) {
            authError.textContent = 'Please enter email and password.';
            return;
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged handles redirect
        } catch (error) {
            authError.textContent = error.message;
            console.error("Email Sign In Error:", error);
        }
    });

    // Handle Email Sign Up
    emailSignupBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        authError.textContent = ''; // Clear previous errors

        if (!email || !password) {
            authError.textContent = 'Please enter email and password.';
            return;
        }
        if (password.length < 6) {
            authError.textContent = 'Password must be at least 6 characters.';
            return;
        }

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged handles redirect
        } catch (error) {
            authError.textContent = error.message;
             console.error("Email Sign Up Error:", error);
        }
    });

    // Handle Google Sign In
    googleSigninBtn.addEventListener('click', async () => {
        authError.textContent = ''; // Clear previous errors
        try {
            await signInWithPopup(auth, googleProvider);
            // onAuthStateChanged handles redirect
        } catch (error) {
             // Handle specific errors like popup closed
             if (error.code !== 'auth/popup-closed-by-user') {
                authError.textContent = error.message;
                console.error("Google Sign In Error:", error);
             }
        }
    });
});