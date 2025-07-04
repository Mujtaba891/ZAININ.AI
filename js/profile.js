// js/profile.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const userEmailElement = document.getElementById('user-email-profile');
    const userNameElement = document.getElementById('user-name');
    const userUidElement = document.getElementById('user-uid');
    const userAvatarElement = document.getElementById('profile-avatar');
    const logoutBtn = document.getElementById('logout-btn');
    // Assume themeToggleBtn exists and theme.js handles it

    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            userEmailElement.textContent = user.email || 'N/A';
            userNameElement.textContent = user.displayName || 'User'; // Use display name if available
            userUidElement.textContent = `UID: ${user.uid}`; // Display UID
            if (user.photoURL) {
                userAvatarElement.innerHTML = `<img src="${user.photoURL}" alt="User Avatar">`;
            } else {
                 userAvatarElement.innerHTML = `<i class="fas fa-user"></i>`; // Default icon
            }

        } else {
            // User is signed out, redirect to login
            window.location.href = '/auth.html';
        }
    });

    // Handle Logout
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            // onAuthStateChanged handles redirect
        } catch (error) {
            console.error("Logout error:", error);
            alert("Error logging out. Please try again."); // Simple alert for error
        }
    });

    // Note: Theme toggle logic is assumed to be in theme.js
});