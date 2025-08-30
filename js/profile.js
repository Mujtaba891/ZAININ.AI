// js/profile.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const userEmailElement = document.getElementById('user-email-profile');
    const userNameElement = document.getElementById('user-name');
    const userUidElement = document.getElementById('user-uid');
    const userAvatarElement = document.getElementById('profile-avatar');
    const membershipStatusSpan = document.getElementById('membership-status');
    const upgradeLinkContainer = document.getElementById('upgrade-to-premium-link-container');
    const manageSubscriptionLinkContainer = document.getElementById('manage-subscription-link-container');
    const logoutBtn = document.getElementById('logout-btn');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in
            userEmailElement.textContent = user.email || 'N/A';
            userNameElement.textContent = user.displayName || 'User';
            userUidElement.textContent = `UID: ${user.uid}`;

            if (user.photoURL) {
                userAvatarElement.innerHTML = `<img src="${user.photoURL}" alt="User Avatar">`;
            } else {
                 userAvatarElement.innerHTML = `<i class="fas fa-user"></i>`;
            }

            // Load user profile for planType and premium status
            try {
                const profileDocRef = doc(db, 'users', user.uid, 'profile', 'data');
                const profileSnap = await getDoc(profileDocRef);

                let userPlanType = 'free'; // Default
                let isPremium = false;

                if (profileSnap.exists()) {
                    const data = profileSnap.data();
                    userPlanType = data.planType || 'free';
                    isPremium = data.isPremium || false;
                }

                if (isPremium) { // Check isPremium first for styling
                    membershipStatusSpan.textContent = `${userPlanType.charAt(0).toUpperCase() + userPlanType.slice(1)} User`;
                    membershipStatusSpan.classList.add('success-message');
                    upgradeLinkContainer.classList.add('hidden');
                    manageSubscriptionLinkContainer.classList.remove('hidden');
                } else {
                    membershipStatusSpan.textContent = 'Free User';
                    membershipStatusSpan.classList.remove('success-message');
                    upgradeLinkContainer.classList.remove('hidden');
                    manageSubscriptionLinkContainer.classList.add('hidden');
                }
            } catch (error) {
                console.error("Error loading user membership status:", error);
                membershipStatusSpan.textContent = 'Error loading status';
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
            alert("Error logging out. Please try again.");
        }
    });
});