// js/api.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const openrouterKeyInput = document.getElementById('openrouter-key');
    const serpapiKeyInput = document.getElementById('serpapi-key');
    const saveKeysBtn = document.getElementById('save-api-keys-btn');
    const messageElement = document.getElementById('api-key-message');
    const tutorialBtn = document.getElementById('tutorial-btn');
    const tutorialOverlay = document.getElementById('tutorial-overlay');
    const tutorialCloseBtn = document.getElementById('tutorial-close-btn');
    const videoContainer = document.getElementById('video-container');

    let currentUser = null; // To store the authenticated user

    // --- Authentication State & Initial Load ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            console.log("User on API page:", user.uid);
            loadApiKeys(user.uid); // Load existing keys for this user
        } else {
            // User is not signed in, redirect to login
            console.log("No user on API page, redirecting to auth.");
            window.location.href = '/auth.html';
        }
    });

    // --- Firebase Data Loading ---
    /**
     * Loads API keys for the current user from Firestore.
     * @param {string} uid - The user's UID.
     */
    async function loadApiKeys(uid) {
        try {
            const apiKeysDocRef = doc(db, 'users', uid, 'settings', 'apikeys');
            const docSnap = await getDoc(apiKeysDocRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                openrouterKeyInput.value = data.openrouter || '';
                serpapiKeyInput.value = data.serpapi || '';
                 showMessage('', 'message-text'); // Clear status message on load
                console.log("API keys loaded from Firestore.");
            } else {
                 openrouterKeyInput.value = '';
                 serpapiKeyInput.value = '';
                 showMessage('No keys found. Please enter them above.', 'warning-message');
                 console.log("No API keys document found for user.");
            }
        } catch (error) {
            console.error("Error loading API keys: ", error);
            showMessage('Error loading keys.', 'error-message');
        } finally {
             // Ensure inputs are enabled after load attempt
             openrouterKeyInput.disabled = false;
             serpapiKeyInput.disabled = false;
             saveKeysBtn.disabled = false;
        }
    }

    // --- Firebase Data Saving ---
    /**
     * Saves API keys for the current user to Firestore.
     */
    async function saveApiKeys() {
        if (!currentUser) {
            showMessage('User not logged in. Cannot save keys.', 'error-message');
            return;
        }

        const openrouterKey = openrouterKeyInput.value.trim();
        const serpapiKey = serpapiKeyInput.value.trim();

        // Basic validation
        if (!openrouterKey) {
             showMessage('OpenRouter key is required.', 'warning-message');
             return;
        }

        // Optional: Add more robust key format validation here if needed

        // Disable button during save
        saveKeysBtn.disabled = true;
        showMessage('Saving keys...', ''); // Neutral message

        try {
            const apiKeysDocRef = doc(db, 'users', currentUser.uid, 'settings', 'apikeys');
            // Use setDoc with merge:true. This creates the document if it doesn't exist.
            await setDoc(apiKeysDocRef, {
                openrouter: openrouterKey,
                serpapi: serpapiKey,
                updatedAt: new Date() // Using client timestamp. Firestore serverTimestamp is better with backend.
            }, { merge: true });

            showMessage('API Keys saved successfully!', 'success-message');
            console.log("API keys saved to Firestore.");

        } catch (error) {
            console.error("Error saving API keys: ", error);
            showMessage(`Error saving keys: ${error.message}`, 'error-message');
        } finally {
            // Re-enable button
            saveKeysBtn.disabled = false;
             // Clear status message after a delay
            setTimeout(() => {
                showMessage('', 'message-text'); // Clear message and reset class
            }, 5000);
        }
    }


    // --- Tutorial Modal Functions ---
    const tutorialVideoEmbedUrl = 'https://www.youtube.com/embed/FjcNeYiZWDk?autoplay=1'; // Added autoplay

    function openTutorial() {
        videoContainer.innerHTML = `<iframe src="${tutorialVideoEmbedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
        tutorialOverlay.classList.remove('hidden');
        console.log("Tutorial modal opened.");
    }

    function closeTutorial() {
        tutorialOverlay.classList.add('hidden');
        videoContainer.innerHTML = ''; // Stop video playback by removing iframe
        console.log("Tutorial modal closed.");
    }


    // --- Helper Functions ---
    /**
     * Displays a status message below the save button.
     * @param {string} text - The message text.
     * @param {string} className - The CSS class for styling (e.g., 'success-message', 'error-message', 'warning-message', 'message-text').
     */
    function showMessage(text, className) {
        messageElement.textContent = text;
        // Reset all message classes first, then add the desired one
        messageElement.className = 'message-text'; // Start with base class
        if (className && className !== 'message-text') {
             messageElement.classList.add(className);
        }
    }


    // --- Event Listeners ---
    saveKeysBtn.addEventListener('click', saveApiKeys);
    tutorialBtn.addEventListener('click', openTutorial);
    tutorialCloseBtn.addEventListener('click', closeTutorial);

     // Close modal if clicking outside video content but within overlay
    tutorialOverlay.addEventListener('click', (e) => {
        if (e.target === tutorialOverlay) {
            closeTutorial();
        }
    });
});