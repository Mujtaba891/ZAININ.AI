"use strict";

/**
 * ZAININ AI - Profile Page Script
 * @description Handles displaying and updating user information on the profile page
 * using Firebase Authentication.
 */

import { auth } from './firebase-config.js';
import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Cache ---
    const profileInitialSpan = document.getElementById('profile-initial');
    const displayNameInput = document.getElementById('display-name-input');
    const saveNameBtn = document.getElementById('save-name-btn');
    const nameMessageSpan = document.getElementById('name-message');
    const profileEmailSpan = document.getElementById('profile-email');
    const memberSinceSpan = document.getElementById('member-since');
    const lastLoginSpan = document.getElementById('last-login');

    console.log("Profile Page Script Loaded.");

    // --- Authentication State Listener ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Profile page: User is logged in.", user.uid);
            displayUserProfile(user); // Display user info
            bindEventListeners(user); // Bind event listeners for updating profile

        } else {
            // User is logged out. Redirect to the main login page.
            console.log("Profile page: User is logged out. Redirecting to index.");
            // Use a slight delay to allow the user to briefly see the page before redirect
            // if they navigated here while logging out in another tab.
            setTimeout(() => {
                 window.location.href = '/index.html';
            }, 100); // Redirect after 0.1 seconds
        }
    });

    // --- Functions ---

    /**
     * Displays the logged-in user's profile information on the page.
     * @param {object} user - The Firebase User object.
     */
    function displayUserProfile(user) {
        // Display email
        profileEmailSpan.textContent = user.email || 'N/A';

        // Display/populate display name input
        const displayName = user.displayName || ''; // Use empty string if null
        displayNameInput.value = displayName;

        // Display member since and last login dates
        if (user.metadata) {
            memberSinceSpan.textContent = user.metadata.creationTime ? formatDate(user.metadata.creationTime) : 'N/A';
            lastLoginSpan.textContent = user.metadata.lastSignInTime ? formatDate(user.metadata.lastSignInTime) : 'N/A';
        } else {
             memberSinceSpan.textContent = 'N/A';
             lastLoginSpan.textContent = 'N/A';
             console.warn("Firebase user metadata not available.");
        }

        // Update profile picture placeholder initial
        updateProfileInitial(displayName);
    }

    /**
     * Generates and displays the initial for the profile picture placeholder.
     * @param {string} displayName - The user's current display name.
     */
    function updateProfileInitial(displayName) {
        let initial = '?';
        if (displayName) {
            initial = displayName.trim().charAt(0).toUpperCase();
        } else if (auth.currentUser && auth.currentUser.email) {
             initial = auth.currentUser.email.trim().charAt(0).toUpperCase();
        }
        profileInitialSpan.textContent = initial;
    }

    /**
     * Formats a Firebase timestamp string into a readable date string.
     * @param {string} timestampStr - The timestamp string from Firebase metadata.
     * @returns {string} A formatted date string.
     */
    function formatDate(timestampStr) {
        try {
            const date = new Date(timestampStr);
            // Use toLocaleDateString for clarity, options can be added for more specific formats
            return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (error) {
            console.error("Error formatting date:", timestampStr, error);
            return 'Invalid Date';
        }
    }

    /**
     * Binds event listeners for profile update actions.
     * @param {object} user - The Firebase User object.
     */
    function bindEventListeners(user) {
        // Add listener to the save name button
        if (saveNameBtn) {
            saveNameBtn.addEventListener('click', () => saveDisplayName(user));
        } else {
             console.warn("Save name button #save-name-btn not found.");
        }

        // Optional: Listen for Enter key in the input field as well
        if (displayNameInput) {
            displayNameInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault(); // Prevent form submission or newline
                    saveDisplayName(user);
                }
            });
        }

    }

    /**
     * Saves the display name update to Firebase Auth.
     * @param {object} user - The current Firebase User object.
     */
    async function saveDisplayName(user) {
        const newDisplayName = displayNameInput.value.trim();
        const currentDisplayName = user.displayName || '';

        nameMessageSpan.style.opacity = 0; // Hide previous message

        if (newDisplayName === currentDisplayName) {
            nameMessageSpan.textContent = 'Name not changed.';
            nameMessageSpan.style.color = 'var(--color-text-secondary)'; // Use secondary text color for info
            nameMessageSpan.style.opacity = 1;
            console.log("Display name not changed, skipping update.");
            return; // Do nothing if name is the same
        }

        if (!newDisplayName) {
            // Allow setting name to empty, Firebase accepts this. Or require a name?
            // Let's allow empty for now, but maybe provide a warning/confirm?
            // For simplicity, we'll just update. Firebase auth allows null displayName.
             console.log("Setting display name to empty.");
        }


        // Disable button and indicate loading
        saveNameBtn.disabled = true;
        // saveNameBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; // Optional loading spinner

        try {
            console.log("Attempting to update profile display name to:", newDisplayName);
            await updateProfile(user, {
                displayName: newDisplayName || null // Set to null if empty string
            });

            console.log("Profile updated successfully.");

            // Display success message
            nameMessageSpan.textContent = 'Display name updated!';
            nameMessageSpan.style.color = 'var(--color-success)';
            nameMessageSpan.style.opacity = 1;

            // Update the profile initial immediately
            updateProfileInitial(newDisplayName);

            // Update the user object reference? onAuthStateChanged listener should
            // ideally be triggered by this update, which will call displayUserProfile again
            // with the updated user object, but explicitly calling displayUserProfile
            // can ensure immediate UI update if the listener is delayed or doesn't fire reliably for this specific change.
            // Let's rely on the listener for simplicity.

            // Optional: Fade out message after a few seconds
            setTimeout(() => {
                nameMessageSpan.style.opacity = 0;
            }, 3000);

        } catch (error) {
            console.error("Error updating profile display name:", error);

            // Display error message
            nameMessageSpan.textContent = `Failed to update name: ${error.message}`;
            nameMessageSpan.style.color = 'var(--color-error)';
            nameMessageSpan.style.opacity = 1;

        } finally {
            // Re-enable button
            saveNameBtn.disabled = false;
            // saveNameBtn.innerHTML = '<i class="fas fa-save"></i> Save Name'; // Restore button text
        }
    }

});