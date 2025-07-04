"use strict";

/**
 * ZAININ AI - Main Application Logic
 * @version 5.2 - Improved Streaming & Error Handling
 * @description This script manages all client-side functionality for the ZAININ AI chat application,
 * including Firebase authentication, Firestore database operations, real-time UI rendering with
 * improved response streaming, and external API communications using user-provided keys from localStorage.
 * Addresses issues with streaming performance, typing indicator, API key checks, and error display.
 */

//================================================================//
//============== 1. MODULES & CONFIGURATION ======================//
//================================================================//

import { auth, db } from './firebase-config.js'; // Ensure firebase-config.js is correctly set up
import {
    createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider,
    signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
    doc, collection, addDoc, query, orderBy, onSnapshot,
    deleteDoc, updateDoc, getDocs, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Assuming marked.js is included via a script tag in your HTML header,
// or imported if you are using a module bundler like Webpack/Vite.
// Example HTML: <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
// If using modules: import { marked } from 'marked'; (requires build process)
// For simplicity, assuming global `marked` from CDN for this update.


//================================================================//
//===================== 2. API CONSTANTS & KEYS ==================//
//================================================================//

// API keys are now loaded from localStorage
let openrouterKey = null;
let serpapiKey = null; // Optional for web search

// API Endpoints
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const SERPAPI_URL = 'https://serpapi.com/search.json';
// Use a CORS proxy for SerpApi calls to avoid CORS issues in the browser
// This proxy is hosted externally (e.g., on Vercel, Render, etc.).
// The example uses api.allorigins.win, but you might need to host your own for reliability.
const CORS_PROXY_URL = 'https://api.allorigins.win/get?url=';


//================================================================//
//=================== 3. DOM ELEMENT CACHE =======================//
//================================================================//

const ui = {
    authContainer: document.getElementById('auth-container'), emailInput: document.getElementById('email-input'), passwordInput: document.getElementById('password-input'), emailSignInBtn: document.getElementById('email-signin-btn'), emailSignUpBtn: document.getElementById('email-signup-btn'), googleSignInBtn: document.getElementById('google-signin-btn'), authError: document.getElementById('auth-error'),
    mainApp: document.getElementById('main-app'), userEmailDisplay: document.getElementById('user-email'), logoutBtn: document.getElementById('logout-btn'), newChatBtn: document.getElementById('new-chat-btn'), chatHistoryList: document.getElementById('chat-history-list'), sidebar: document.getElementById('sidebar'), sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'), sidebarCloseBtn: document.getElementById('sidebar-close-btn'), webSearchToggle: document.getElementById('web-search-toggle'),
    chatContainer: document.getElementById('chat-container'), chatTitle: document.getElementById('chat-title'), chatMessages: document.getElementById('chat-messages'), messageInput: document.getElementById('message-input'), sendBtn: document.getElementById('send-btn')
};

// Element to hold the currently streaming AI message content
let currentStreamingMessageElement = null;


//================================================================//
//=================== 4. APPLICATION STATE =======================//
//================================================================//

let state = {
    currentUser: null, currentChatId: null, unsubscribeChatHistory: null, unsubscribeMessages: null,
    messagesData: [], // Array to store message data from Firestore
    isSendingMessage: false, // Flag to prevent concurrent message sending
    aiResponseAccumulator: '', // Buffer for the streaming AI response text
    aiMessageFirestoreId: null // To store the Firestore ID of the AI message being streamed (if created early)
};


//================================================================//
//==================== 5. INITIALIZATION =========================//
//================================================================//

document.addEventListener('DOMContentLoaded', initializeApplication);

/**
 * Initializes all core components of the application.
 */
function initializeApplication() {
    console.log("Initializing ZAININ AI application.");
    loadApiKeys(); // Load keys from localStorage early
    bindStaticEventListeners();
    onAuthStateChanged(auth, handleAuthStateChange);

    // Adjust message input height on load and input
    adjustMessageInputHeight();
    ui.messageInput.addEventListener('input', adjustMessageInputHeight);

    // Add event listener for resizing (e.g., mobile keyboard appearance/disappearance)
     window.addEventListener('resize', () => {
        adjustMessageInputHeight();
        // Scroll to bottom on resize in case keyboard pushes content up
        // Only if scrolled near the bottom already
        if (ui.chatMessages.scrollHeight - ui.chatMessages.scrollTop - ui.chatMessages.clientHeight < 100) {
             scrollToBottom(true); // Instant scroll
        }
     });
}

/**
 * Binds event listeners to static DOM elements that exist on page load.
 */
function bindStaticEventListeners() {
    ui.emailSignUpBtn.addEventListener('click', () => handleAuthAction('signup'));
    ui.emailSignInBtn.addEventListener('click', () => handleAuthAction('signin'));
    ui.googleSignInBtn.addEventListener('click', () => handleAuthAction('google'));
    ui.logoutBtn.addEventListener('click', () => signOut(auth));
    ui.newChatBtn.addEventListener('click', createNewChatSession);
    ui.sendBtn.addEventListener('click', () => processUserMessage());
    ui.messageInput.addEventListener('keydown', handleInputKeyDown);
    ui.sidebarToggleBtn.addEventListener('click', () => ui.sidebar.classList.add('open'));
    ui.sidebarCloseBtn.addEventListener('click', () => ui.sidebar.classList.remove('open'));
    ui.chatMessages.addEventListener('click', handleMessageInteraction); // Event delegation for message actions (copy, rerun)
}

/**
 * Loads API keys from localStorage.
 */
function loadApiKeys() {
    openrouterKey = localStorage.getItem('openrouterKey');
    serpapiKey = localStorage.getItem('serpapiKey');
    console.log("API Keys loaded from localStorage.");
    // Note: Keys are not logged to console for security reasons in a production app.
    // This is just for debugging during development.
    console.log("OpenRouter Key:", openrouterKey ? "Present" : "Missing");
    console.log("SerpApi Key:", serpapiKey ? "Present" : "Missing");
}

/**
 * Checks if the necessary API keys are available for core functionality.
 * Displays a warning message in the chat area if the OpenRouter key is missing.
 * @returns {boolean} True if OpenRouter key is present, false otherwise.
 */
function checkApiKeys() {
    const warningId = 'api-key-warning';
    const existingWarning = document.getElementById(warningId);

    if (!openrouterKey) {
        const title = 'OpenRouter API Key Required';
        const message = 'To use ZAININ AI, you need to provide your own OpenRouter API key. Please go to <a href="/api.html">Manage API Keys</a> to add it.';
        if (!existingWarning) {
             renderPersistentWarning(title, message, warningId);
        } else {
             // Update existing warning just in case the message content changed
             existingWarning.innerHTML = `<strong>${title}</strong><p>${message}</p>`;
        }
        ui.messageInput.placeholder = "Enter your OpenRouter API key to start chatting...";
        ui.messageInput.disabled = true; // Disable input if key is missing
        ui.sendBtn.disabled = true; // Disable send button
        return false;
    } else {
        // If key is present, remove the warning if it exists
        if (existingWarning) {
            existingWarning.remove();
        }
        ui.messageInput.placeholder = "Send a message...";
        ui.messageInput.disabled = false; // Re-enable input
        ui.sendBtn.disabled = state.isSendingMessage; // Re-enable send button unless already sending
        return true;
    }
}

/**
 * Renders a persistent warning message in the chat area, styled like an AI message error.
 * Useful for displaying required setup steps like adding API keys.
 * @param {string} title - The title of the warning.
 * @param {string} message - The message content (can contain HTML).
 * @param {string} id - A unique ID for the warning element to prevent duplicates.
 */
function renderPersistentWarning(title, message, id) {
     console.log("Rendering persistent warning:", title);
     const warningDiv = document.createElement('div');
     warningDiv.id = id;
     warningDiv.className = 'message ai-message error-message-bubble'; // Use existing message/error styles
     warningDiv.innerHTML = `
        <div class="message-content-wrapper">
            <div class="message-content">
                 <strong>${title}</strong><p>${message}</p>
            </div>
        </div>`;

     // Prepend the warning so it stays at the top unless scrolled past
     ui.chatMessages.insertBefore(warningDiv, ui.chatMessages.firstChild);

     // Don't necessarily scroll to bottom, as this warning might stay at the top.
}


//================================================================//
//=================== 6. AUTHENTICATION ==========================//
//================================================================//

/**
 * Handles changes in the user's authentication state.
 * @param {object|null} user - The Firebase user object or null if logged out.
 */
function handleAuthStateChange(user) {
    if (user) {
        console.log("User signed in:", user.email);
        state.currentUser = user;
        ui.authContainer.classList.add('hidden');
        ui.mainApp.classList.remove('hidden');
        ui.userEmailDisplay.textContent = user.email;

        // Load API keys again in case they were added/changed while logged out
        loadApiKeys();

        fetchAndRenderChatHistory(); // This will load chats and potentially switch to the last one
        checkApiKeys(); // Check keys and display warning/enable input after login
    } else {
        console.log("User signed out.");
        state.currentUser = null;
        state.currentChatId = null; // Clear active chat on logout
        state.messagesData = []; // Clear message data
        state.isSendingMessage = false; // Reset sending flag
        ui.authContainer.classList.remove('hidden');
        ui.mainApp.classList.add('hidden');
        ui.chatHistoryList.innerHTML = ''; // Clear history UI
        ui.chatMessages.innerHTML = ''; // Clear chat messages UI
        ui.chatTitle.textContent = 'New Chat'; // Reset title
        ui.messageInput.value = ''; // Clear input
        adjustMessageInputHeight(); // Adjust height for empty input
        ui.sendBtn.disabled = false; // Re-enable send button
        currentStreamingMessageElement = null; // Clear streaming element reference

        // Unsubscribe from real-time updates
        if (state.unsubscribeChatHistory) {
            state.unsubscribeChatHistory();
            state.unsubscribeChatHistory = null;
        }
        if (state.unsubscribeMessages) {
             state.unsubscribeMessages();
             state.unsubscribeMessages = null;
        }
         document.getElementById('api-key-warning')?.remove(); // Remove warning on logout
         checkApiKeys(); // Update input/button state based on missing keys
    }
}

/**
 * A wrapper for handling different authentication methods.
 * @param {string} type - The type of authentication ('signin', 'signup', 'google').
 */
async function handleAuthAction(type) {
    ui.authError.textContent = ''; // Clear previous errors
    try {
        let result;
        const actions = {
            signup: () => createUserWithEmailAndPassword(auth, ui.emailInput.value, ui.passwordInput.value),
            signin: () => signInWithEmailAndPassword(auth, ui.emailInput.value, ui.passwordInput.value),
            google: () => signInWithPopup(auth, new GoogleAuthProvider())
        };
        result = await actions[type]();
        console.log(`${type} successful`, result.user);
        // handleAuthStateChange will be triggered by onAuthStateChanged listener
    } catch (error) {
        console.error(`Auth action (${type}) failed:`, error);
        // Display user-friendly error message
        let errorMessage = error.message;
        if (error.code) {
            // Attempt to make Firebase auth codes more readable
            errorMessage = error.code.replace('auth/', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            errorMessage = errorMessage.charAt(0).toUpperCase() + errorMessage.slice(1); // Capitalize first letter
        }
        ui.authError.textContent = errorMessage;
    }
}


//================================================================//
//=============== 7. FIRESTORE DATABASE OPERATIONS ===============//
//================================================================//

/**
 * Fetches and subscribes to the user's chat history from Firestore.
 * This sets up real-time listening for new chats, deleted chats, and title changes.
 */
function fetchAndRenderChatHistory() {
    if (!state.currentUser) return; // Ensure user is logged in

    // Unsubscribe from previous chat history listener if exists
    if (state.unsubscribeChatHistory) {
        state.unsubscribeChatHistory();
        state.unsubscribeChatHistory = null; // Clear the reference
    }

    const chatsCollectionRef = collection(db, 'users', state.currentUser.uid, 'chats');
    // Order by timestamp descending to show most recent chats first
    const chatsQuery = query(chatsCollectionRef, orderBy('timestamp', 'desc'));

    // Set up the real-time listener
    state.unsubscribeChatHistory = onSnapshot(chatsQuery, snapshot => {
        const chats = snapshot.docs;
        ui.chatHistoryList.innerHTML = ''; // Clear current list

        let mostRecentChatId = chats.length > 0 ? chats[0].id : null;

        // Render all chat items
        chats.forEach(doc => renderChatItem(doc));

        // Logic for switching/loading the correct chat after history update:
        // 1. If there is no active chat (`state.currentChatId` is null),
        //    load the most recent chat from history if one exists.
        // 2. If the previously active chat (`state.currentChatId`) no longer exists
        //    in the snapshot (meaning it was deleted), create a new session.
        // 3. If the active chat exists and is still in the history, do nothing here;
        //    the messages `onSnapshot` for that chat remains active and will handle UI updates.
        // 4. If there are no chats in history AND no active chat, create a new session.

        const currentChatExistsInHistory = state.currentChatId && chats.some(chat => chat.id === state.currentChatId);

        if (!state.currentChatId) {
            if (mostRecentChatId) {
                console.log("No active chat, loading most recent:", mostRecentChatId);
                switchActiveChat(mostRecentChatId);
            } else {
                 console.log("No chats in history, creating new session.");
                 createNewChatSession();
            }
        } else if (state.currentChatId && !currentChatExistsInHistory) {
            console.log("Active chat deleted, creating new session.");
            createNewChatSession();
        } else if (state.currentChatId && currentChatExistsInHistory) {
             console.log("Active chat still exists, ensuring active class is set.");
             // Ensure the active class is correctly applied
             document.querySelectorAll('.chat-history-item').forEach(el => el.classList.remove('active'));
             document.querySelector(`.chat-history-item[data-id="${state.currentChatId}"]`)?.classList.add('active');
             // The messages onSnapshot for the currentChatId is already active
             // and will handle updating the message list if messages change.
        }
         // If state.currentChatId is set and it exists in history, no action needed here.

    }, error => {
        console.error("Error fetching chat history:", error);
        // Render a persistent error message in the sidebar
        ui.chatHistoryList.innerHTML = `<li><p class="error-message" style="padding: 10px;">Failed to load history: ${error.message}</p></li>`;
    });
}

/**
 * Switches the active chat session. Unsubscribes from the old chat's messages
 * and subscribes to the new chat's messages.
 * @param {string} chatId - The ID of the chat to switch to.
 */
async function switchActiveChat(chatId) {
    // If the user is already in this chat or chatId is null/undefined, do nothing.
    if (!chatId || state.currentChatId === chatId) {
        console.log(`Attempted to switch to current or null chat: ${chatId}`);
        return;
    }

    console.log("Switching to chat:", chatId);

    // Unsubscribe from previous messages listener if exists
    if (state.unsubscribeMessages) {
        state.unsubscribeMessages();
        state.unsubscribeMessages = null;
        console.log("Unsubscribed from previous messages.");
    }

    // Reset streaming state if switching away from a chat while streaming was happening (shouldn't, but safety)
    state.isSendingMessage = false;
    state.aiResponseAccumulator = '';
    state.aiMessageFirestoreId = null;
    currentStreamingMessageElement = null;
    hideTypingIndicator(); // Hide indicator just in case

    state.currentChatId = chatId; // Set the new active chat ID
    state.messagesData = []; // Clear message data immediately
    ui.chatMessages.innerHTML = ''; // Clear UI messages immediately
    ui.chatTitle.textContent = 'Loading Chat...'; // Show loading state

    // Update UI for active chat item
    document.querySelectorAll('.chat-history-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.querySelector(`.chat-history-item[data-id="${chatId}"]`);
    if (activeItem) activeItem.classList.add('active');
    // Close sidebar on mobile
     if (ui.sidebar.classList.contains('open')) {
        ui.sidebar.classList.remove('open');
    }


    // Fetch chat title
    try {
        const chatDocSnap = await getDoc(doc(db, 'users', state.currentUser.uid, 'chats', chatId));
        if (chatDocSnap.exists()) {
             ui.chatTitle.textContent = chatDocSnap.data()?.title || 'Chat';
        } else {
            // If chat document doesn't exist (e.g., deleted right after snapshot),
            // this switch might be happening based on stale data.
            console.warn("Attempted to switch to non-existent chat ID:", chatId);
            // Fallback: Create new session if the target chat document is not found
            createNewChatSession();
            return; // Stop the switch process
        }
    } catch (error) {
         console.error("Error fetching chat title on switch:", error);
         ui.chatTitle.textContent = 'Error Loading Title';
         // Continue loading messages even if title fetch fails
    }


    // Subscribe to messages for the new chat
    const messagesCollectionRef = collection(db, 'users', state.currentUser.uid, 'chats', chatId, 'messages');
    const messagesQuery = query(messagesCollectionRef, orderBy('timestamp'));
    console.log("Subscribing to messages for chat:", chatId);
    state.unsubscribeMessages = onSnapshot(messagesQuery, snapshot => {
        console.log("Messages snapshot update for chat:", chatId);
        const newMessagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Check if the update is just the AI message completing after streaming.
        // This avoids re-rendering the *entire* message list if we just finished streaming.
        // This check is simplified: if the last message in the new snapshot
        // matches the message we just streamed (by content or implied by timing),
        // we might optimize rendering. However, relying solely on `onSnapshot`
        // for the *final* render simplifies the streaming logic significantly.
        // So, we will clear and re-render *all* messages on every snapshot update.
        // This is less efficient than incremental updates but much simpler and less error-prone.

        state.messagesData = newMessagesData; // Update state with the latest data
        renderAllMessages(state.messagesData); // Re-render all messages from the latest snapshot

    }, error => {
        console.error("Error fetching messages for chat", chatId, ":", error);
        renderErrorMessage("Failed to load messages for this chat.");
        // Keep the error message visible, don't automatically switch away.
    });

    checkApiKeys(); // Check API keys and show warning if necessary after switching chat
}

/**
 * Saves a message object to the current chat in Firestore.
 * If no chat is active (state.currentChatId is null), a new chat document is
 * created first, and then the message is added to its messages subcollection.
 * @param {object} messageData - The message object to save ({ sender, text, timestamp }).
 * @returns {Promise<string>} A promise that resolves with the ID of the chat the message was saved to.
 */
async function saveMessageToFirestore(messageData) {
    if (!state.currentUser) {
        console.error("Cannot save message: User not logged in.");
        throw new Error("User not authenticated.");
    }

    let targetChatId = state.currentChatId;
    let isNewChat = false;

    // If no current chat ID, create a new chat document first
    if (!targetChatId) {
        console.log("No active chat, creating new chat document.");
        // Use the first ~50 characters of the message as the initial title
        const initialTitle = messageData.text.substring(0, 50).trim() + (messageData.text.length > 50 ? '...' : '');
         // Sanitize title for any potential issues (e.g., remove leading/trailing spaces, newlines)
         const safeTitle = initialTitle.replace(/\n/g, ' ').trim() || 'New Chat';

        try {
            const newChatRef = await addDoc(collection(db, 'users', state.currentUser.uid, 'chats'), {
                title: safeTitle,
                timestamp: serverTimestamp() // Use server timestamp for ordering
            });
            targetChatId = newChatRef.id;
            state.currentChatId = targetChatId; // Update state immediately
            isNewChat = true;
            console.log("New chat created with ID:", targetChatId);
            ui.chatTitle.textContent = safeTitle; // Update UI title proactively

            // The chat history onSnapshot listener will detect this new chat and add it to the sidebar list.
            // We also need to ensure the messages onSnapshot listener is set up for this new chat.
            // switchActiveChat handles setting up the messages listener.
            // We *could* call switchActiveChat(targetChatId) here, but it might interfere
            // with the current message sending flow. The existing onSnapshot listener for
            // chat history *should* eventually trigger a switch or detect the new chat.
            // Let's rely on the history listener to pick up the new chat and manage the switch,
            // or if this is the very first message, switchActiveChat(targetChatId) might be needed.
             // Let's explicitly call switchActiveChat to be sure the messages listener is setup promptly.
             // Need to be careful about race conditions with history listener.
             // Alternative: Setup messages listener *after* creating the new chat and getting its ID.
             switchActiveChat(targetChatId); // This will also ensure history UI is updated correctly.

        } catch (error) {
             console.error("Error creating new chat:", error);
             throw new Error("Failed to create new chat."); // Re-throw to be caught by caller
        }
    }

    // Save the message to the specified or newly created chat ID
    try {
        const messageRef = await addDoc(collection(db, 'users', state.currentUser.uid, 'chats', targetChatId, 'messages'), messageData);
        console.log(`Message from ${messageData.sender} saved to chat ID: ${targetChatId}`, messageRef.id);

        // If this is the user message and a new chat was created, the switchActiveChat call above
        // will handle the message listener setup. If it's the AI message following a user message
        // in an existing chat, the existing message listener is already active.

        // Return the message ID for AI message, might be useful for streaming element correlation (though using message data is often enough)
        return messageRef.id;

    } catch (error) {
        console.error(`Error saving message to chat ${targetChatId}:`, error);
        // If this is the user message and it failed, should we delete the new chat? Complex.
        // For now, just log error and throw.
        throw new Error("Failed to save message."); // Re-throw to be caught by caller
    }
}

/**
 * Updates the title of a chat in Firestore.
 * @param {string} chatId - The ID of the chat to rename.
 * @param {string} currentTitle - The current title of the chat.
 */
async function renameChatInFirestore(chatId, currentTitle) {
    if (!state.currentUser) return;
    const newTitle = prompt("Enter new chat name:", currentTitle || '');
    // Check if new title is provided, trimmed, and actually different
    if (newTitle !== null && newTitle.trim() && newTitle.trim() !== currentTitle) {
        try {
            await updateDoc(doc(db, 'users', state.currentUser.uid, 'chats', chatId), { title: newTitle.trim() });
            console.log("Chat renamed:", chatId, "to", newTitle.trim());
            // UI update is handled automatically by the chat history onSnapshot listener
        } catch (error) {
            console.error("Error renaming chat:", error);
            alert("Failed to rename chat: " + error.message); // Inform user
        }
    } else {
        console.log("Rename cancelled or title unchanged/empty.");
    }
}

/**
 * Deletes a chat and all its messages from Firestore.
 * Note: Deleting a document with subcollections in Firestore client SDK requires
 * manually deleting the subcollection documents first, or using a server-side approach
 * like a Cloud Function (more reliable for large subcollections).
 * For simplicity here, we'll rely on the client SDK which might have limitations
 * on deeply nested or very large subcollections without explicit deletion.
 * A safer approach would be to use a Cloud Function triggered by the chat document deletion.
 * @param {string} chatId - The ID of the chat to delete.
 */
async function deleteChatFromFirestore(chatId) {
    if (!state.currentUser) return;
    if (confirm("Are you sure you want to permanently delete this chat? This cannot be undone.")) {
        console.log("Attempting to delete chat:", chatId);
        try {
            // Attempt to delete messages first. This is necessary for the client SDK.
            // Fetch all messages in batches if necessary (Firestore query limit is 10k, delete limit applies)
            const messagesCollectionRef = collection(db, 'users', state.currentUser.uid, 'chats', chatId, 'messages');
            let messagesSnapshot;
            let deletedCount = 0;
             // Fetch and delete in batches if needed, though for typical chats, one fetch is usually fine.
             // Using getDocs and Promise.all is simpler for moderate message counts.
            messagesSnapshot = await getDocs(messagesCollectionRef);
            const deleteMessagePromises = messagesSnapshot.docs.map(msgDoc => deleteDoc(msgDoc.ref));
            await Promise.all(deleteMessagePromises);
            deletedCount = messagesSnapshot.size;

            console.log(`Deleted ${deletedCount} messages for chat ${chatId}.`);

            // Now delete the chat document itself
            await deleteDoc(doc(db, 'users', state.currentUser.uid, 'chats', chatId));
            console.log("Chat document deleted:", chatId);

            // If the deleted chat was the active one, switch to a new session
            if (chatId === state.currentChatId) {
                console.log("Deleted active chat, creating new session.");
                // The chat history listener will detect the deletion and call createNewChatSession
                // or switch to the next chat. Explicitly calling it here ensures immediate UI change.
                createNewChatSession();
            }
            // UI update (removing item from list) is handled automatically by the chat history onSnapshot listener
        } catch (error) {
             console.error("Error deleting chat:", chatId, error);
             alert("Failed to delete chat: " + error.message); // Inform user
             // If deletion failed, the UI snapshot listener should eventually reflect the true state
        }
    } else {
        console.log("Chat deletion cancelled.");
    }
}

//================================================================//
//================== 8. UI RENDERING & EVENTS ====================//
//================================================================//

/**
 * Renders a single item in the chat history list.
 * @param {object} doc - The Firestore document snapshot for the chat.
 */
function renderChatItem(doc) {
    const chat = doc.data();
    const li = document.createElement('li');
    li.className = 'chat-history-item';
    li.dataset.id = doc.id; // Store Firestore ID in data attribute
    // Add title attribute for full name visibility on hover if truncated
    li.title = chat.title || 'Untitled Chat';
    li.innerHTML = `
        <span class="chat-title-text">${chat.title || 'Untitled Chat'}</span>
        <div class="chat-item-actions">
            <button class="rename-chat-btn" title="Rename"><i class="fas fa-pen"></i></button>
            <button class="delete-chat-btn" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
    `;

    // Set active class if this is the currently active chat
    if (doc.id === state.currentChatId) li.classList.add('active');

    // Add event listeners directly to elements
    li.querySelector('.chat-title-text').addEventListener('click', () => switchActiveChat(doc.id));
    li.querySelector('.rename-chat-btn').addEventListener('click', e => {
        e.stopPropagation(); // Prevent triggering the switchActiveChat on the li
        renameChatInFirestore(doc.id, chat.title);
    });
    li.querySelector('.delete-chat-btn').addEventListener('click', e => {
        e.stopPropagation(); // Prevent triggering the switchActiveChat on the li
        deleteChatFromFirestore(doc.id);
    });

    ui.chatHistoryList.appendChild(li);
}

/**
 * Renders all messages for the active chat.
 * This function clears the chat messages area and re-renders based on the current state.messagesData.
 * Called primarily by the messages onSnapshot listener.
 * @param {Array<object>} messages - An array of message objects to render.
 */
function renderAllMessages(messages) {
    console.log("Rendering all messages:", messages.length);
     // Save the current scroll position relative to the bottom
     const isScrolledToBottom = ui.chatMessages.scrollHeight - ui.chatMessages.scrollTop - ui.chatMessages.clientHeight <= 1; // Allow a small tolerance
     const scrollOffsetFromBottom = ui.chatMessages.scrollHeight - ui.chatMessages.scrollTop - ui.chatMessages.clientHeight;

    ui.chatMessages.innerHTML = ''; // Clear existing messages UI

    // If no messages from Firestore and no active chat ID, show the welcome message.
    // If there's an active chat ID but no messages yet, it means the chat is new or empty.
    // We only show the explicit welcome message for a brand new *client-side* session before any messages are saved.
    // Once a chat is saved, even if empty, we just show an empty chat area or a "Start the conversation..." prompt.
     if (messages.length === 0 && !state.currentChatId) {
         // This case is handled by createNewChatSession()
         const welcomeMessageDiv = document.createElement('div');
         welcomeMessageDiv.className = 'message ai-message welcome-message'; // Use a distinct class
         welcomeMessageDiv.innerHTML = `
            <div class="message-content-wrapper">
                <div class="message-content">
                    <p>Welcome to <strong>ZAININ AI</strong>. I am your advanced AI assistant, ready to help you with research, coding, and creative tasks. How may I assist you today?</p>
                     <p><small>Your conversations are saved automatically.</small></p>
                </div>
            </div>`;
         ui.chatMessages.appendChild(welcomeMessageDiv);
    } else {
        // Render messages from Firestore
        messages.forEach(msg => renderMessage(msg));
    }


    // Add the API key warning *after* rendering messages, so it appears below them
     // but remains persistent if key is missing.
     checkApiKeys(); // This function handles adding/removing the warning.

    // Restore scroll position or scroll to bottom if the user was already there
    if (isScrolledToBottom) {
         scrollToBottom(true); // Scroll instantly to the new bottom
    } else {
         // Attempt to maintain position relative to bottom (useful if new messages arrive while scrolled up)
         ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight - ui.chatMessages.clientHeight - scrollOffsetFromBottom;
    }
}

/**
 * Renders a single message in the chat window.
 * Includes Markdown parsing and sets up message actions.
 * This is called by renderAllMessages for messages loaded from Firestore.
 * Streaming messages are handled separately until finalized and saved.
 * @param {object} msg - The message object ({ id, sender, text, timestamp }).
 */
function renderMessage(msg) {
    const { sender, text, id } = msg; // Using message ID from Firestore snapshot

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.dataset.messageId = id; // Store Firestore document ID on the element

    // Render message content using marked for Markdown parsing
    // marked.parse will handle turning Markdown (like **bold**, *italic*, `code`, ```blocks```) into HTML
    // Ensure marked.js is loaded. If not, fallback to plain text.
    const renderedContent = (typeof marked !== 'undefined' && text) ? marked.parse(text) : (text || '');


    // Define action buttons HTML based on sender
    // Note: Edit action is currently just populating the input field.
    const actionsHTML = sender === 'ai'
        ? `<button class="message-action-btn copy-btn" data-action="copy" title="Copy"><i class="fas fa-copy"></i></button><button class="message-action-btn rerun-btn" data-action="rerun" title="Rerun Prompt"><i class="fas fa-redo"></i></button>`
        : `<button class="message-action-btn edit-btn" data-action="edit" title="Edit"><i class="fas fa-pen"></i></button><button class="message-action-btn copy-btn" data-action="copy" title="Copy"><i class="fas fa-copy"></i></button>`;

    messageDiv.innerHTML = `
        <div class="message-content-wrapper">
            <div class="message-content">${renderedContent}</div>
            <div class="message-actions">${actionsHTML}</div>
        </div>
    `;

    // Add copy buttons to all <pre><code>...</code></pre> blocks within this message
    // This needs to be done *after* setting innerHTML and parsing markdown.
    messageDiv.querySelectorAll('pre code').forEach(codeBlock => {
        const pre = codeBlock.parentElement; // The <pre> element
         if (pre.tagName === 'PRE' && !pre.querySelector('.copy-code-btn')) {
             const copyBtn = document.createElement('button');
             copyBtn.className = 'copy-code-btn';
             copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy'; // Icon + text
             copyBtn.title = 'Copy Code'; // Add title for accessibility
             // Add event listener directly to this button
             copyBtn.addEventListener('click', () => {
                 navigator.clipboard.writeText(codeBlock.innerText).then(() => {
                     // Provide visual feedback
                     copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                     setTimeout(() => { copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy'; }, 2000);
                 }).catch(err => {
                     console.error('Failed to copy code: ', err);
                     copyBtn.innerHTML = '<i class="fas fa-times"></i> Error'; // Show error feedback
                 });
             });
             pre.style.position = 'relative'; // Ensure positioning context for the absolute button
             pre.appendChild(copyBtn); // Append the button inside the <pre>
         }
    });

    ui.chatMessages.appendChild(messageDiv); // Add the message element to the chat area
}


/**
 * Creates a new, empty chat session in the UI.
 * This function resets the UI and state for a new chat but does NOT immediately
 * save a new chat document to Firestore. The document is created only when the
 * first user message is sent in this new session via `saveMessageToFirestore`.
 */
function createNewChatSession() {
    console.log("Creating new chat session.");

    // Unsubscribe from the messages listener of the previous chat if active
    if (state.unsubscribeMessages) {
        state.unsubscribeMessages();
        state.unsubscribeMessages = null;
    }

    state.currentChatId = null; // Indicate that there is no active Firestore chat document
    state.messagesData = []; // Clear in-memory message data
    state.aiResponseAccumulator = ''; // Clear any pending streamed response
    state.aiMessageFirestoreId = null; // Clear AI message ID state
    currentStreamingMessageElement = null; // Clear streaming element reference

    ui.chatMessages.innerHTML = ''; // Clear all messages from the UI

    // Add the initial welcome message to the UI (this message is not saved to Firestore)
    const welcomeMessageDiv = document.createElement('div');
    welcomeMessageDiv.className = 'message ai-message welcome-message'; // Use a distinct class
    welcomeMessageDiv.innerHTML = `
        <div class="message-content-wrapper">
            <div class="message-content">
                <p>Welcome to <strong>ZAININ AI</strong>. I am your advanced AI assistant, ready to help you with research, coding, and creative tasks. How may I assist you today?</p>
                 <p><small>Your conversations are saved automatically.</small></p>
            </div>
        </div>`;
    ui.chatMessages.appendChild(welcomeMessageDiv);


    ui.chatTitle.textContent = 'New Chat'; // Set the chat title
    ui.messageInput.value = ''; // Clear the input field
    adjustMessageInputHeight(); // Adjust input height
    ui.messageInput.focus(); // Set focus to the input field

    // Deselect any active chat history item in the sidebar
    document.querySelectorAll('.chat-history-item.active').forEach(el => el.classList.remove('active'));

    // Check API keys and display a warning if the OpenRouter key is missing
    checkApiKeys();

    // Close sidebar on mobile view
    if (ui.sidebar.classList.contains('open')) {
        ui.sidebar.classList.classList.remove('open');
    }

    scrollToBottom(true); // Scroll to the bottom to show the welcome message
}


/**
 * Processes the user's input message.
 * This function is triggered when the user clicks send or presses Enter.
 * It handles getting the message text, validating it, checking API keys,
 * saving the user message, showing a typing indicator, fetching/streaming
 * the AI response, and finally saving the AI response.
 * @param {string|null} rerunText - Optional text to use for rerunning a prompt. If provided, skips reading from the input field.
 */
async function processUserMessage(rerunText = null) {
    // Prevent sending if a message is already being processed
    if (state.isSendingMessage) {
        console.log("Message sending in progress, ignoring new input.");
        return;
    }

    // Get message text, prioritizing rerunText if provided, otherwise from the input field
    const userText = (rerunText || ui.messageInput.value).trim();

    // Do not proceed if the message is empty after trimming
    if (!userText) {
        console.log("Input is empty, not sending message.");
        return;
    }

    // Crucially, check if the OpenRouter API key is set BEFORE attempting to send to the AI
    if (!checkApiKeys()) {
         console.warn("OpenRouter API key is missing. Cannot send message.");
         // The checkApiKeys() function already displays a warning in the chat UI.
         // Also ensure input and send button are disabled by checkApiKeys.
         return; // Stop the process here
    }

    // Set state to indicate message sending is in progress
    state.isSendingMessage = true;
    ui.sendBtn.disabled = true; // Disable the send button to prevent double-sending
    ui.messageInput.disabled = true; // Disable input field

    // Clear and shrink the input field if this is not a rerun
    if (!rerunText) {
        ui.messageInput.value = '';
        adjustMessageInputHeight(); // Reset input height after clearing
    }

    // Save the user's message to Firestore.
    // This function will create a new chat document if state.currentChatId is null.
    // The Firestore onSnapshot listener will automatically add this message to the UI.
    try {
         await saveMessageToFirestore({ sender: 'user', text: userText, timestamp: serverTimestamp() });
         // After saving, the Firestore onSnapshot listener for messages will automatically
         // trigger renderAllMessages, which will update the UI with the user's message.
         console.log("User message saved. Awaiting onSnapshot update.");

    } catch (error) {
        console.error("Failed to save user message:", error);
        renderErrorMessage("Failed to save your message. Please try again.");
        // Clean up state before returning
        state.isSendingMessage = false;
        ui.sendBtn.disabled = false;
        ui.messageInput.disabled = false;
        ui.messageInput.focus();
        return; // Stop the process if saving fails
    }

    // Show the typing indicator while waiting for the AI response
    showTypingIndicator();

    // Fetch and stream the AI response
    try {
        // Pass the original userText (not the potentially augmented finalPrompt)
        // to fetchAndStreamAIResponse, as that function handles web search augmentation
        // and API message construction.
        await fetchAndStreamAIResponse(userText);
        // fetchAndStreamAIResponse will handle creating a streaming UI element,
        // updating it, and finally saving the complete AI message to Firestore.
        // The subsequent onSnapshot will then handle rendering the final message.

    } catch (error) {
        // Errors thrown by fetchAndStreamAIResponse (e.g., API failures)
        console.error("Error during AI response fetching/streaming:", error);
        // The streaming function handles rendering the error message in the chat itself.
    } finally {
        // Always clean up the state and UI elements related to sending
        hideTypingIndicator(); // Ensure typing indicator is removed
        state.isSendingMessage = false; // Reset sending state
        ui.sendBtn.disabled = false; // Re-enable the send button
        ui.messageInput.disabled = false; // Re-enable input field
        ui.messageInput.focus(); // Set focus back to the input field
        // Clear streaming state variables
        state.aiResponseAccumulator = '';
        state.aiMessageFirestoreId = null;
        currentStreamingMessageElement = null; // Ensure reference is cleared
    }
}


/**
 * Renders an error message directly in the chat UI, styled like an AI message.
 * This is for runtime errors encountered during API calls or processing.
 * @param {string} errorMessage - The error message text to display.
 */
function renderErrorMessage(errorMessage) {
     console.log("Rendering error message in chat:", errorMessage);
     const errorDiv = document.createElement('div');
     errorDiv.className = 'message ai-message error-message-bubble'; // Add a specific class for styling if needed
     errorDiv.innerHTML = `
        <div class="message-content-wrapper">
            <div class="message-content">
                <p><strong>Error:</strong> ${errorMessage}</p>
            </div>
             <!-- No actions for error messages -->
        </div>`;
     ui.chatMessages.appendChild(errorDiv);
     scrollToBottom(); // Scroll to show the error message
}


//================================================================//
//================= 10. API & STREAMING SERVICES =================//
//================================================================//

/**
 * Fetches and processes a streaming AI response from OpenRouter using user-provided keys.
 * Includes optional web search using SerpApi if toggled and key is available.
 * Handles UI updates during streaming and saves the final response to Firestore.
 * @param {string} userPrompt - The user's original prompt.
 */
async function fetchAndStreamAIResponse(userPrompt) {
    // Ensure OpenRouter key is available - checkApiKeys should handle this before calling
    if (!openrouterKey) {
        console.error("OpenRouter API Key is not set. Cannot fetch AI response.");
        // renderErrorMessage("OpenRouter API Key is not configured. Please go to Manage API Keys.");
        throw new Error("OpenRouter API Key is not set."); // Throw for the caller to handle finally block
    }

    let finalPrompt = userPrompt; // Start with the user's original prompt
    let searchError = null; // To store any error during search

    // Step 1: Perform web search if toggle is checked and SerpApi key is available
    if (ui.webSearchToggle.checked) {
        if (serpapiKey) {
             console.log("Web search toggle is ON and SerpApi key is available. Performing search...");
             try {
                 const searchResults = await performWebSearch(userPrompt);
                 if (searchResults && searchResults.error) {
                     searchError = searchResults.error;
                     console.error("Web search failed:", searchError);
                 } else if (searchResults) {
                     console.log("Web search successful. Augmenting prompt.");
                     // Augment the user's prompt with search results context
                     finalPrompt = `Web search results for context:\n---\n${searchResults}\n---\nUser question: ${userPrompt}`;
                 } else {
                     console.log("Web search returned no organic results.");
                      // Optionally inform the user search yielded no results
                      // searchError = "Web search found no relevant results."; // Or handle this subtly
                 }
             } catch (error) {
                  console.error("Unexpected error during web search call:", error);
                  searchError = `Unexpected search error: ${error.message}`;
             }
        } else {
            // Web search requested but SerpApi key is missing
            searchError = "SerpApi key is missing. Web search skipped.";
            console.warn(searchError);
             // Inform the user in the AI response itself
        }
    }


    // Step 2: Prepare messages array for OpenRouter API call
    // Include historical messages to provide conversation context, filtering out non-conversation messages.
    // Limit the history size to avoid hitting token limits or excessive costs.
    const historyMessages = state.messagesData.filter(msg => msg.sender === 'user' || msg.sender === 'ai');

    // Ensure the last message in history sent to the API is the user's (potentially augmented) prompt.
    // state.messagesData *already includes* the user's message from Firestore.
    // We need to find that user message and replace its text with the finalPrompt *only for the API call*.
    const messagesForApi = historyMessages.map(msg => ({ ...msg })); // Create a copy to avoid modifying state.messagesData
     if (messagesForApi.length > 0 && messagesForApi[messagesForApi.length - 1].sender === 'user') {
         messagesForApi[messagesForApi.length - 1].content = finalPrompt; // Use 'content' for API role
     } else {
         // Should not happen if user message was saved, but safeguard
         console.warn("Could not find user message in history copy, adding augmented prompt to API list.");
         messagesForApi.push({ role: 'user', content: finalPrompt });
     }

    // Limit history length (e.g., last 20 messages including the system message and current prompt)
    const maxHistoryLength = 20; // Adjust as needed based on model context window
    // Start slicing from the end: keep the last `maxHistoryLength - 1` messages from history
    // plus the system message and the current user message.
    const slicedMessagesForApi = messagesForApi.slice(Math.max(messagesForApi.length - maxHistoryLength, 0));


    // Construct the system message
    const systemMessage = "You are ZAININ AI, an eloquent and helpful AI assistant. Format your responses using Markdown.";


    // Step 3: Create the UI element for the streaming AI message BEFORE fetching
    // This element will be updated as tokens arrive.
    currentStreamingMessageElement = createStreamingAIMessageElement(); // This function appends to DOM and returns the content div


    console.log("Sending streaming request to OpenRouter...");
    state.aiResponseAccumulator = searchError ? `*(Note: Web search failed or skipped: ${searchError})*\n\n` : ''; // Initialize accumulator with search error note if any

    // Update the streaming element with the initial search note if present
    if (searchError) {
        updateStreamingMessage(state.aiResponseAccumulator + '█'); // Add cursor immediately
    } else {
         // Show initial cursor even with empty content
         updateStreamingMessage('█');
    }


    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openrouterKey}`, // Use the user's key
                'Content-Type': 'application/json',
                 // OpenRouter specific headers for tracking/moderation if needed
                 // 'HTTP-Referer': 'YOUR_APP_URL', // Optional: Replace with your app's URL
                 // 'X-Title': 'YOUR_APP_NAME', // Optional: Replace with your app's name
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-chat', // Specify the model
                messages: [
                    { role: "system", content: systemMessage },
                    ...slicedMessagesForApi // Pass the sliced history and augmented prompt
                ],
                stream: true, // Request streaming response
                // Optional OpenRouter parameters:
                // temperature: 0.7,
                // max_tokens: 1000,
            })
        });

        // Check for non-successful HTTP status codes (e.g., 401, 403, 429, 500)
        if (!response.ok) {
             // Attempt to read error body for more details
             const errorBody = await response.text();
             console.error(`OpenRouter API request failed: ${response.status} ${response.statusText}`, errorBody);

             let apiErrorMessage = `AI API failed: ${response.status} ${response.statusText}`;
             try {
                 const errorJson = JSON.parse(errorBody);
                 if (errorJson.error && errorJson.error.message) {
                     apiErrorMessage = `AI API Error: ${errorJson.error.message}`;
                 } else if (errorJson.message) { // Some APIs use 'message' instead of 'error.message'
                     apiErrorMessage = `AI API Error: ${errorJson.message}`;
                 }
                 // Check for specific API key errors
                 if (errorJson.error?.type === 'authentication_error') {
                     apiErrorMessage += " (Invalid API key)";
                 }

             } catch (e) {
                 // If JSON parsing fails, use the status text default
                 console.warn("Could not parse OpenRouter error body as JSON:", e);
             }

             // Update the streaming element with the error message
             state.aiResponseAccumulator += `\n\n**API Error:** ${apiErrorMessage}`;
             updateStreamingMessage(state.aiResponseAccumulator); // Render with error
             throw new Error(`API Error: ${apiErrorMessage}`); // Throw error for finally block cleanup

        }

        // Hide the static typing indicator now that streaming is starting
        hideTypingIndicator();

        const reader = response.body.getReader(); // Get a reader for the stream
        const decoder = new TextDecoder(); // Decoder for UTF-8

        // Process the stream chunks
        while (true) {
            const { value, done } = await reader.read(); // Read the next chunk
            if (done) break; // Exit loop when stream is finished

            const chunk = decoder.decode(value, { stream: true }); // Decode the chunk, allow streaming continuation
            // OpenRouter sends data in 'data: {...}' format, potentially multiple per chunk
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.trim().startsWith('data:')) {
                    const jsonStr = line.replace('data: ', '').trim(); // Extract JSON string
                    if (jsonStr === '[DONE]') continue; // Skip the DONE signal

                    try {
                        const parsed = JSON.parse(jsonStr);
                        // Extract the token from the parsed JSON
                        const token = parsed.choices?.[0]?.delta?.content || "";

                        if (token) {
                            state.aiResponseAccumulator += token; // Add token to accumulated response
                            // Update the content in the DOM with the accumulated text and a cursor
                            // Append the cursor character directly for simple visualization
                             updateStreamingMessage(state.aiResponseAccumulator + '█');
                        }
                    } catch (error) {
                        // Log non-JSON chunks or parsing errors but continue processing the stream
                        console.warn('Skipping non-JSON chunk or parsing error:', jsonStr, error);
                    }
                }
            }
        }

        // Step 4: Stream finished. Remove cursor, save the complete AI message text to Firestore.
        console.log("Streaming finished. Accumulated response length:", state.aiResponseAccumulator.length);

        // Remove the cursor from the final streamed text
         updateStreamingMessage(state.aiResponseAccumulator); // Update UI one last time without cursor

        // Save the complete AI message to Firestore
        await saveMessageToFirestore({ sender: 'ai', text: state.aiResponseAccumulator, timestamp: serverTimestamp() });
        console.log("Final AI message saved to Firestore.");
        // The Firestore onSnapshot listener will detect this save and trigger
        // renderAllMessages, which will render the final Markdown-parsed message with buttons.

    } catch (error) {
        // Catch errors during fetch or stream processing that were not caught inside the loop
        console.error("Fetch or streaming error caught:", error);
        // Ensure the streamed message element shows the error if possible
        if (currentStreamingMessageElement) {
             const errorText = `\n\n**Connection/Streaming Error:** ${error.message}`;
             state.aiResponseAccumulator += errorText;
             updateStreamingMessage(state.aiResponseAccumulator); // Update UI with error
        } else {
            // If no streaming element was created, render a new error message bubble
             renderErrorMessage(`AI response failed: ${error.message}`);
        }
        // Re-throw the error so the caller (processUserMessage) can handle cleanup
        throw error;
    } finally {
        // Reset streaming UI elements and state variables in processUserMessage's finally block
        // This block only handles errors thrown within fetchAndStreamAIResponse
    }
}

/**
 * Creates the initial HTML container for a streaming AI message.
 * This container will be updated as tokens arrive.
 * @returns {HTMLElement} The main .message div element.
 */
function createStreamingAIMessageElement() {
    const messageDiv = document.createElement('div');
    // Add a specific class to identify this as a temporary streaming element
    messageDiv.className = 'message ai-message streaming';
    messageDiv.innerHTML = `
        <div class="message-content-wrapper">
            <div class="message-content"></div>
            <!-- Action buttons and code copy buttons will be added after save by renderMessage -->
        </div>`;
    ui.chatMessages.appendChild(messageDiv); // Append the main message div to the chat area
    scrollToBottom(); // Scroll to the bottom immediately to show the new message container
    currentStreamingMessageElement = messageDiv.querySelector('.message-content'); // Store reference to the content div
     return messageDiv; // Return the main div for potential future use
}

/**
 * Updates the content of the currently streaming message element.
 * This function is called repeatedly as tokens arrive.
 * It updates the text content and ensures a cursor is displayed.
 * Markdown is NOT parsed here; it's just raw text updates.
 * @param {string} textWithCursor - The full accumulated text plus a cursor character.
 */
function updateStreamingMessage(textWithCursor) {
    if (!currentStreamingMessageElement) return;
     // Use textContent to avoid issues with partial HTML/Markdown during streaming
     currentStreamingMessageElement.textContent = textWithCursor;
     scrollToBottom(); // Ensure the chat view scrolls down
}


/**
 * Performs a web search using SerpApi via a CORS proxy.
 * Requires the SerpApi key to be present in localStorage.
 * @param {string} query - The search query.
 * @returns {Promise<string|object|null>} A formatted string of search results (up to 3 snippets),
 *                                       an error object ({ error: string }) if the search failed or key is missing,
 *                                       or null if the search was successful but returned no organic results.
 */
async function performWebSearch(query) {
    // Ensure SerpApi key is available
    if (!serpapiKey) {
        console.warn("SerpApi key is not set. Web search cannot be performed.");
        return { error: "SerpApi key is not set in browser storage." };
    }

    console.log("Performing web search for:", query);
    try {
        // Construct the SerpApi URL
        const searchParams = new URLSearchParams({
             q: query,
             api_key: serpapiKey,
             // Add other SerpApi parameters if needed, e.g., engine: 'google', location: 'United States'
             // engine: 'google',
             // hl: 'en', // host language
             // gl: 'us' // geographic limit
        });
        const serpApiFullUrl = `${SERPAPI_URL}?${searchParams.toString()}`;
        const proxyUrl = `${CORS_PROXY_URL}${encodeURIComponent(serpApiFullUrl)}`;

        console.log("Fetching SerpApi results via proxy URL:", proxyUrl);

        // Use the CORS proxy to fetch the SerpApi results
        const proxyResponse = await fetch(proxyUrl);

        // Check if the proxy request itself failed
        if (!proxyResponse.ok) {
            const errorBody = await proxyResponse.text();
            console.error(`CORS proxy request failed: ${proxyResponse.status} ${proxyResponse.statusText}`, errorBody);
            return { error: `Search proxy failed: ${proxyResponse.status} ${proxyResponse.statusText}` };
        }

        // Parse the proxy's response, which contains the actual API response in the 'contents' field
        const proxyData = await proxyResponse.json();

        // Parse the actual SerpApi response contained within the proxy's data
        let results;
        try {
             // The content from allorigins might be a stringified JSON
             results = JSON.parse(proxyData.contents);
        } catch (parseError) {
             console.error("Failed to parse SerpApi response from proxy contents:", parseError, proxyData.contents);
             return { error: `Failed to parse search results: ${parseError.message}` };
        }


        // Check if SerpApi itself returned an error
        if (results.error) {
             console.error("SerpApi returned an error:", results.error);
             // Sometimes the error is in organic_results if no results were found but API call succeeded
             if (typeof results.error === 'string') {
                 return { error: `SerpApi error: ${results.error}` };
             } else {
                  return { error: "SerpApi returned an error object." }; // Handle complex error objects
             }
        }

        // Check if organic results are available
        if (results.organic_results && results.organic_results.length > 0) {
            console.log("SerpApi results received:", results.organic_results.slice(0, 3));
            // Format the top 3 organic results into a string for the AI model
            const formattedResults = results.organic_results.slice(0, 3).map((r, index) =>
                `Result ${index + 1}:\nTitle: ${r.title}\nLink: ${r.link}\nSnippet: ${r.snippet}`
            ).join('\n---\n'); // Use a clear separator between results
            return formattedResults;
        } else {
            // No organic results found
            console.log("SerpApi returned no organic results.");
            return null; // Explicitly return null if no organic results
        }

    } catch (error) {
        // Catch any other errors during the fetch process
        console.error("Error performing web search:", error);
        return { error: `Web search failed: ${error.message}` };
    }
}


/**
 * Handles all keydown events on the message input field.
 * Sends the message on Enter (without Shift).
 * @param {KeyboardEvent} e - The keyboard event.
 */
function handleInputKeyDown(e) {
    // Allow Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Prevent default Enter behavior (newline)
        processUserMessage(); // Send message
    }
    // Note: adjustMessageInputHeight is already bound to 'input' event
}

/**
 * Adjusts the height of the message input textarea based on its content
 * to create an auto-resizing effect, up to a max height defined by CSS.
 */
function adjustMessageInputHeight() {
    // Temporarily set height to 'auto' to get the correct scrollHeight
    ui.messageInput.style.height = 'auto';
    // Set the height to scrollHeight, capped by CSS max-height
    ui.messageInput.style.height = ui.messageInput.scrollHeight + 'px';

    // Ensure scrollbar visibility is handled by CSS overflow property
}


/**
 * Handles clicks on message action buttons using event delegation on the chatMessages container.
 * This is more efficient than adding listeners to every button on every message.
 * @param {MouseEvent} e - The click event.
 */
async function handleMessageInteraction(e) {
    // Find the closest action button element or code copy button element
    const actionButton = e.target.closest('[data-action]');
    const copyCodeButton = e.target.closest('.copy-code-btn');

    if (copyCodeButton) {
        // Handle copy code button click
        const codeBlock = copyCodeButton.parentElement?.querySelector('code'); // Find code within the same <pre> parent
        if (codeBlock) {
            try {
                await navigator.clipboard.writeText(codeBlock.innerText);
                copyCodeButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => { copyCodeButton.innerHTML = '<i class="fas fa-copy"></i> Copy'; }, 2000);
            } catch (err) {
                 console.error('Failed to copy code: ', err);
                 copyCodeButton.innerHTML = '<i class="fas fa-times"></i> Error';
            }
        } else {
             console.warn("Could not find code block for copy button.", copyCodeButton);
        }
        return; // Stop here if a code button was clicked
    }

    if (!actionButton) return; // Not an action button or code button

    // Find the closest message element to identify the message
    const messageElement = actionButton.closest('.message');
    if (!messageElement) return; // Should not happen if target is inside .message

    const messageId = messageElement.dataset.messageId;
    // Find the message data in our state based on the stored ID
    const message = state.messagesData.find(m => m.id === messageId);

    if (!message) {
        console.error("Message data not found in state for ID:", messageId);
        // This can happen if a snapshot hasn't updated yet or message was deleted.
        // Maybe refetch the specific message if needed, or rely on the next snapshot.
        return;
    }

    const action = actionButton.dataset.action;
    console.log(`Action '${action}' triggered for message ID: ${messageId}`);

    switch (action) {
        case 'copy':
            try {
                await navigator.clipboard.writeText(message.text);
                // Optional: Provide visual feedback on the message action button itself
                 const icon = actionButton.querySelector('i');
                 const originalIconClass = icon.className;
                 icon.className = 'fas fa-check'; // Change icon to a checkmark
                 setTimeout(() => { icon.className = originalIconClass; }, 2000); // Revert icon
            } catch (err) {
                 console.error('Failed to copy message text: ', err);
                 // Optional: Provide visual feedback that copy failed
                 const icon = actionButton.querySelector('i');
                 const originalIconClass = icon.className;
                 icon.className = 'fas fa-times'; // Change icon to an X
                  setTimeout(() => { icon.className = originalIconClass; }, 2000); // Revert icon
            }
            break;
        case 'edit':
            // Populate the input field with the message text
            ui.messageInput.value = message.text;
            adjustMessageInputHeight(); // Adjust input height for the populated text
            ui.messageInput.focus(); // Focus the input field
            // Note: This implementation of "edit" just loads the text into the input.
            // A full "edit" feature would require deleting/modifying the original message.
            break;
        case 'rerun':
             // Find the text of the user message that triggered this AI response
             // This requires finding the *user* message that came *before* this AI message.
             const aiMessageIndex = state.messagesData.findIndex(m => m.id === messageId);
             if (aiMessageIndex > 0) {
                 // Iterate backwards to find the most recent user message before the AI one
                 let lastUserMessageText = null;
                 for (let i = aiMessageIndex - 1; i >= 0; i--) {
                     if (state.messagesData[i].sender === 'user') {
                         lastUserMessageText = state.messagesData[i].text;
                         break; // Found the user message, stop searching
                     }
                 }

                 if (lastUserMessageText) {
                    console.log("Rerunning prompt:", lastUserMessageText);
                    // Call processUserMessage with the text from the previous user message
                    // This bypasses reading from the input field.
                    processUserMessage(lastUserMessageText);
                 } else {
                     console.warn("Could not find a preceding user message to rerun for AI message ID:", messageId);
                     renderErrorMessage("Cannot rerun: Could not find the previous user prompt in history.");
                 }
             } else {
                 console.warn("Rerun triggered on the very first message (or message not in history index).");
                 renderErrorMessage("Cannot rerun the first message.");
             }
            break;
        default:
            console.warn("Unknown action:", action);
    }
}

/**
 * Scrolls the chat messages container to the bottom.
 * Useful after adding new messages or when loading.
 * @param {boolean} instant - If true, scrolls instantly. Otherwise, uses smooth scrolling.
 */
function scrollToBottom(instant = false) {
    const behavior = instant ? 'instant' : 'smooth';
     // Use requestAnimationFrame to ensure DOM layout is updated before scrolling
     requestAnimationFrame(() => {
         ui.chatMessages.scrollTo({
             top: ui.chatMessages.scrollHeight,
             behavior: behavior
         });
     });
}

/**
 * Shows the GIF typing indicator in the chat window.
 * Prevents adding multiple indicators.
 */
function showTypingIndicator() {
    if (document.getElementById('typing-indicator')) {
        // console.log("Typing indicator already visible.");
        return; // Prevent adding multiple indicators
    }
    console.log("Showing typing indicator.");
    const indicatorDiv = document.createElement('div');
    indicatorDiv.id = 'typing-indicator';
    indicatorDiv.className = 'message ai-message'; // Style like an AI message
    indicatorDiv.innerHTML = `
        <div class="message-content-wrapper">
            <div class="typing-indicator">
                <img src="assets/typing.gif" alt="AI is typing...">
            </div>
        </div>`;
    ui.chatMessages.appendChild(indicatorDiv); // Add indicator at the end
    scrollToBottom(); // Scroll to show the indicator
}

/**
 * Removes the GIF typing indicator.
 */
function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        console.log("Hiding typing indicator.");
        indicator.remove();
    }
}