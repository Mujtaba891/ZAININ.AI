"use strict";

/**
 * ZAININ AI - Main Application Logic
 * @version 5.1 - Client API Keys Edition
 * @description This script manages all client-side functionality for the ZAININ AI chat application,
 * including Firebase authentication, Firestore database operations, real-time UI rendering with
 * response streaming, and external API communications using user-provided keys from localStorage.
 */

//================================================================//
//============== 1. MODULES & CONFIGURATION ======================//
//================================================================//

import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider,
    signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
    doc, collection, addDoc, query, orderBy, onSnapshot,
    deleteDoc, updateDoc, getDocs, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";


//================================================================//
//===================== 2. API CONSTANTS & KEYS ==================//
//================================================================//

// API keys are now loaded from localStorage
let openrouterKey = null;
let serpapiKey = null; // Optional for web search

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


//================================================================//
//=================== 4. APPLICATION STATE =======================//
//================================================================//

let state = {
    currentUser: null, currentChatId: null, unsubscribeChatHistory: null, unsubscribeMessages: null,
    messagesData: [], isSendingMessage: false
};


//================================================================//
//==================== 5. INITIALIZATION =========================//
//================================================================//

document.addEventListener('DOMContentLoaded', initializeApplication);

/**
 * Initializes all core components of the application.
 */
function initializeApplication() {
    loadApiKeys(); // Load keys from localStorage early
    bindStaticEventListeners();
    onAuthStateChanged(auth, handleAuthStateChange);

    // Adjust message input height on load and input
    adjustMessageInputHeight();
    ui.messageInput.addEventListener('input', adjustMessageInputHeight);
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
    ui.chatMessages.addEventListener('click', handleMessageInteraction); // Event delegation for message actions
}

/**
 * Loads API keys from localStorage.
 */
function loadApiKeys() {
    openrouterKey = localStorage.getItem('openrouterKey');
    serpapiKey = localStorage.getItem('serpapiKey');
    console.log("API Keys loaded from localStorage.");
    console.log("OpenRouter Key:", openrouterKey ? "Present" : "Missing");
    console.log("SerpApi Key:", serpapiKey ? "Present" : "Missing");
}

/**
 * Checks if the necessary API keys are available.
 * Displays a warning message in the chat area if the OpenRouter key is missing.
 * @returns {boolean} True if OpenRouter key is present, false otherwise.
 */
function checkApiKeys() {
    if (!openrouterKey) {
        renderApiKeyWarning('OpenRouter API Key Required', 'To use ZAININ AI, you need to provide your own OpenRouter API key. Please go to <a href="/api.html">Manage API Keys</a> to add it.');
        return false;
    }
    // Note: SerpApi key is optional for web search, so not checked here as a blocker.
    // A warning for SerpApi can be added when web search is attempted without the key.
    document.getElementById('api-key-warning')?.remove(); // Remove warning if key is present
    return true;
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
        fetchAndRenderChatHistory(); // This will load chats and potentially switch to the last one
        // The checkApiKeys call is now handled within createNewChatSession and processUserMessage
    } else {
        console.log("User signed out.");
        state.currentUser = null;
        state.currentChatId = null; // Clear active chat on logout
        state.messagesData = [];
        ui.authContainer.classList.remove('hidden');
        ui.mainApp.classList.add('hidden');
        ui.chatHistoryList.innerHTML = ''; // Clear history UI
        ui.chatMessages.innerHTML = ''; // Clear chat messages UI
        ui.chatTitle.textContent = 'New Chat'; // Reset title
        ui.messageInput.value = ''; // Clear input
        adjustMessageInputHeight(); // Adjust height for empty input

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
        ui.authError.textContent = error.message.replace('Firebase: Error (auth/', '').replace(').', '').replace(/-/g, ' '); // Display user-friendly error
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
    const chatsQuery = query(chatsCollectionRef, orderBy('timestamp', 'desc'));

    // Set up the real-time listener
    state.unsubscribeChatHistory = onSnapshot(chatsQuery, snapshot => {
        const chats = snapshot.docs;
        ui.chatHistoryList.innerHTML = ''; // Clear current list
        let lastChatId = null;
        if (chats.length > 0) {
            chats.forEach(doc => renderChatItem(doc));
            lastChatId = chats[0].id; // Get the ID of the most recent chat
        }

        // Logic for switching/loading the correct chat after history update:
        // 1. If there's no currentChatId (e.g., initial login or after logout/delete last chat)
        //    AND there are chats in history, switch to the most recent one.
        // 2. If there was a currentChatId, but it no longer exists in the snapshot
        //    (meaning it was deleted), switch to a new session.
        // 3. Otherwise (currentChatId exists and is in snapshot, or no chats at all),
        //    the existing messages subscription remains valid, or createNewChatSession
        //    was already called if history was empty.
        const currentChatExistsInHistory = state.currentChatId && chats.some(chat => chat.id === state.currentChatId);

        if (!state.currentChatId && lastChatId) {
            console.log("No active chat, loading most recent:", lastChatId);
            switchActiveChat(lastChatId);
        } else if (state.currentChatId && !currentChatExistsInHistory) {
            console.log("Active chat deleted, creating new session.");
            createNewChatSession();
        } else if (state.currentChatId && currentChatExistsInHistory) {
             console.log("Active chat still exists, updating UI.");
             // Ensure the active class is correctly applied
             document.querySelectorAll('.chat-history-item').forEach(el => el.classList.remove('active'));
             document.querySelector(`.chat-history-item[data-id="${state.currentChatId}"]`)?.classList.add('active');
             // The messages onSnapshot for the currentChatId is already active (or will be set up by switchActiveChat if it was null)
             // and will handle updating the message list.
        } else if (!state.currentChatId && !lastChatId) {
            // No current chat and no chats in history - already handled by createNewChatSession on initial load
            console.log("No chats in history, staying on or creating new session.");
            // Ensure a new session is shown if not already the case
            if (ui.chatTitle.textContent !== 'New Chat') {
                createNewChatSession(); // Force UI reset if needed
            }
        }


    }, error => {
        console.error("Error fetching chat history:", error);
        // Potentially render a persistent error message in the sidebar or main area
        ui.chatHistoryList.innerHTML = `<li><p class="error-message" style="padding: ${ui.chatHistoryList.style.padding};">Failed to load history: ${error.message}</p></li>`;
    });
}

/**
 * Switches the active chat session. Unsubscribes from the old chat's messages
 * and subscribes to the new chat's messages.
 * @param {string} chatId - The ID of the chat to switch to.
 */
async function switchActiveChat(chatId) {
    if (state.currentChatId === chatId) return; // Avoid unnecessary reloads

    console.log("Switching to chat:", chatId);

    // Unsubscribe from previous messages listener if exists
    if (state.unsubscribeMessages) {
        state.unsubscribeMessages();
        state.unsubscribeMessages = null; // Clear the reference
    }

    state.currentChatId = chatId; // Set the new active chat ID
    state.messagesData = []; // Clear message data immediately to show loading state quickly
    ui.chatMessages.innerHTML = ''; // Clear UI messages immediately

    // Update UI for active chat item
    document.querySelectorAll('.chat-history-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.querySelector(`.chat-history-item[data-id="${chatId}"]`);
    if (activeItem) activeItem.classList.add('active');


    // Fetch chat title
    try {
        const chatDocSnap = await getDoc(doc(db, 'users', state.currentUser.uid, 'chats', chatId));
        ui.chatTitle.textContent = chatDocSnap.data()?.title || 'Chat';
    } catch (error) {
         console.error("Error fetching chat title on switch:", error);
         ui.chatTitle.textContent = 'Error Loading Chat';
         // Continue loading messages even if title fetch fails
    }


    // Subscribe to messages for the new chat
    const messagesCollectionRef = collection(db, 'users', state.currentUser.uid, 'chats', chatId, 'messages');
    const messagesQuery = query(messagesCollectionRef, orderBy('timestamp'));
    state.unsubscribeMessages = onSnapshot(messagesQuery, snapshot => {
        console.log("Messages snapshot update for chat:", chatId);
        // Map new data and update state
        state.messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAllMessages(state.messagesData); // Re-render all messages
    }, error => {
        console.error("Error fetching messages for chat", chatId, ":", error);
        renderErrorMessage("Failed to load messages for this chat.");
        // Optionally switch back to a new chat or handle error state persistently
        // For now, just display the error message.
    });

    // Close sidebar on mobile
    if (ui.sidebar.classList.contains('open')) {
        ui.sidebar.classList.remove('open');
    }
    // Check API keys and show warning if necessary after switching chat
    checkApiKeys();
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
        // Return a rejected promise or throw an error if caller needs to handle this
        throw new Error("User not authenticated.");
    }

    let targetChatId = state.currentChatId;

    // If no current chat ID, create a new chat document first
    if (!targetChatId) {
        console.log("No active chat, creating new chat document.");
        // Use the first ~30 characters of the message as the initial title
        const initialTitle = messageData.text.substring(0, 30) + (messageData.text.length > 30 ? '...' : '');
        try {
            const newChatRef = await addDoc(collection(db, 'users', state.currentUser.uid, 'chats'), {
                title: initialTitle,
                timestamp: serverTimestamp() // Use server timestamp for ordering
            });
            targetChatId = newChatRef.id;
            state.currentChatId = targetChatId; // Update state immediately
            console.log("New chat created with ID:", targetChatId);
            ui.chatTitle.textContent = initialTitle; // Update UI title proactively
            // The chat history onSnapshot listener will detect this new chat and add it to the sidebar list.
            // The messages onSnapshot listener will also be set up by fetchAndRenderChatHistory/switchActiveChat.
        } catch (error) {
             console.error("Error creating new chat:", error);
             throw new Error("Failed to create new chat."); // Re-throw to be caught by caller
        }
    }

    // Save the message to the specified or newly created chat ID
    try {
        await addDoc(collection(db, 'users', state.currentUser.uid, 'chats', targetChatId, 'messages'), messageData);
        console.log(`Message from ${messageData.sender} saved to chat ID: ${targetChatId}`);
        // The messages onSnapshot listener will handle updating the UI.
    } catch (error) {
        console.error(`Error saving message to chat ${targetChatId}:`, error);
        throw new Error("Failed to save message."); // Re-throw to be caught by caller
    }

    return targetChatId; // Return the ID of the chat the message was saved into
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
            // If a chat has many messages, this might time out or fail.
            const messagesCollectionRef = collection(db, 'users', state.currentUser.uid, 'chats', chatId, 'messages');
            const messagesSnapshot = await getDocs(messagesCollectionRef);
            const deleteMessagePromises = messagesSnapshot.docs.map(msgDoc => deleteDoc(msgDoc.ref));
            await Promise.all(deleteMessagePromises);
            console.log(`Deleted ${messagesSnapshot.size} messages for chat ${chatId}.`);

            // Now delete the chat document itself
            await deleteDoc(doc(db, 'users', state.currentUser.uid, 'chats', chatId));
            console.log("Chat document deleted:", chatId);

            // If the deleted chat was the active one, switch to a new session
            if (chatId === state.currentChatId) {
                console.log("Deleted active chat, creating new session.");
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
    li.innerHTML = `
        <span class="chat-title-text">${chat.title || 'Untitled Chat'}</span>
        <div class="chat-item-actions">
            <button class="rename-chat-btn" title="Rename"><i class="fas fa-pen"></i></button>
            <button class="delete-chat-btn" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
    `;

    // Set active class if this is the currently active chat
    if (doc.id === state.currentChatId) li.classList.add('active');

    // Add event listeners using event delegation might be better for performance
    // if history list gets very long, but direct listeners are fine for typical use.
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
 * @param {Array<object>} messages - An array of message objects to render.
 */
function renderAllMessages(messages) {
    console.log("Rendering all messages:", messages.length);
    ui.chatMessages.innerHTML = ''; // Clear existing messages

    if (messages.length === 0 && !state.currentChatId) {
         // If there are no messages and it's a new chat session (no ID yet),
         // show the initial welcome message.
         // This case is handled by createNewChatSession, so this check might be redundant
         // but good for clarity. The welcome message isn't saved to Firestore.
         const welcomeMessageDiv = document.createElement('div');
         welcomeMessageDiv.className = 'message ai-message';
         welcomeMessageDiv.innerHTML = `
            <div class="message-content-wrapper">
                <div class="message-content">
                    <p>Welcome to <strong>ZAININ AI</strong>. I am your advanced AI assistant, ready to help you with research, coding, and creative tasks. How may I assist you today?</p>
                </div>
            </div>`;
         ui.chatMessages.appendChild(welcomeMessageDiv);

    } else {
        // Render messages from Firestore
        messages.forEach(renderMessage); // Render each message saved in state
    }


    // Ensure API key warning is shown if necessary *after* rendering messages
     checkApiKeys();

    scrollToBottom(true); // Scroll to the latest message (instant on initial load/switch)
}

/**
 * Renders a single message in the chat window.
 * Includes Markdown parsing and sets up message actions.
 * @param {object} msg - The message object ({ id, sender, text, timestamp }).
 */
function renderMessage(msg) {
    const { sender, text, id } = msg; // Using message ID from Firestore snapshot

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.dataset.messageId = id; // Store Firestore document ID on the element

    // Render message content using marked for Markdown parsing
    // marked.parse will handle turning Markdown (like **bold**, *italic*, `code`, ```blocks```) into HTML
    const renderedContent = marked.parse(text || ''); // Use empty string for null/undefined text

    // Define action buttons HTML based on sender
    const actionsHTML = sender === 'ai'
        ? `<button data-action="copy" title="Copy"><i class="fas fa-copy"></i></button><button data-action="rerun" title="Rerun Prompt"><i class="fas fa-redo"></i></button>`
        : `<button data-action="edit" title="Edit"><i class="fas fa-pen"></i></button><button data-action="copy" title="Copy"><i class="fas fa-copy"></i></button>`;

    messageDiv.innerHTML = `
        <div class="message-content-wrapper">
            <div class="message-content">${renderedContent}</div>
            <div class="message-actions">${actionsHTML}</div>
        </div>
    `;

    // Add copy button to code blocks specifically *within this message*
    // Using setTimeout allows the new message HTML to be parsed before adding buttons
    // This is less ideal than adding them directly, but sometimes necessary depending
    // on how the DOM is updated. Direct addition in finalizeStreamingMessage is better.
    // Let's move code block button logic primarily to finalizeStreamingMessage
    // and potentially add it here for non-streaming messages loaded from history.
    messageDiv.querySelectorAll('pre code').forEach(codeBlock => {
        const pre = codeBlock.parentElement;
         if (pre.tagName === 'PRE' && !pre.querySelector('.copy-code-btn')) {
             const copyBtn = document.createElement('button');
             copyBtn.className = 'copy-code-btn';
             copyBtn.innerText = 'Copy';
             copyBtn.title = 'Copy Code'; // Add title for accessibility
             // Add event listener directly to this button
             copyBtn.addEventListener('click', () => {
                 navigator.clipboard.writeText(codeBlock.innerText).then(() => {
                     copyBtn.innerText = 'Copied!';
                     setTimeout(() => { copyBtn.innerText = 'Copy'; }, 2000);
                 }).catch(err => {
                     console.error('Failed to copy code: ', err);
                     copyBtn.innerText = 'Error';
                 });
             });
             pre.style.position = 'relative'; // Ensure positioning context for the button
             pre.appendChild(copyBtn); // Append the button
         }
    });


    ui.chatMessages.appendChild(messageDiv); // Add the message element to the chat area
}

/**
 * Shows a persistent API key warning message in the chat area.
 * It is styled like an AI message error.
 * @param {string} title - The title of the warning (e.g., "API Key Required").
 * @param {string} message - The message content (can contain HTML, like links).
 */
function renderApiKeyWarning(title, message) {
    // Check if a warning message already exists with the same ID
    if (document.getElementById('api-key-warning')) {
        // Update existing warning if needed, or just leave it
        // For now, let's update it to ensure the latest message is shown
        const existingWarning = document.getElementById('api-key-warning');
        existingWarning.innerHTML = `<strong>${title}</strong><p>${message}</p>`;
        return;
    }

    // Create a new warning message element
    const warningDiv = document.createElement('div');
    warningDiv.id = 'api-key-warning'; // Assign a unique ID
    warningDiv.className = 'message ai-message api-key-warning'; // Use existing message/error styles
    warningDiv.innerHTML = `<strong>${title}</strong><p>${message}</p>`;

    // Append it to the chat messages area
    ui.chatMessages.appendChild(warningDiv);

    // Ensure it's visible by scrolling to the bottom
    scrollToBottom();
}


/**
 * Shows the GIF typing indicator in the chat window.
 * Prevents adding multiple indicators.
 */
function showTypingIndicator() {
    if (document.getElementById('typing-indicator')) return; // Prevent adding multiple indicators
    console.log("Showing typing indicator.");
    const indicatorHTML = `
        <div id="typing-indicator" class="message ai-message">
            <div class="typing-indicator">
                <img src="assets/typing.gif" alt="AI is typing...">
            </div>
        </div>`;
    ui.chatMessages.insertAdjacentHTML('beforeend', indicatorHTML); // Add indicator at the end
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
 * to create an auto-resizing effect, up to a max height.
 */
function adjustMessageInputHeight() {
    // Reset height to 'auto' to calculate the scrollHeight correctly
    ui.messageInput.style.height = 'auto';
    // Set height to the scrollHeight, effectively fitting the content
    ui.messageInput.style.height = ui.messageInput.scrollHeight + 'px';
    // The CSS max-height property will prevent it from growing indefinitely.
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
        const codeBlock = copyCodeButton.nextElementSibling; // Assuming button is right before code
        if (codeBlock && (codeBlock.tagName === 'CODE' || (codeBlock.tagName === 'PRE' && codeBlock.querySelector('code')))) {
            const textToCopy = codeBlock.tagName === 'CODE' ? codeBlock.innerText : codeBlock.querySelector('code').innerText;
            await navigator.clipboard.writeText(textToCopy);
            copyCodeButton.innerText = 'Copied!';
            setTimeout(() => { copyCodeButton.innerText = 'Copy'; }, 2000);
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
        return; // Message data not in current state (e.g., history not fully loaded or message deleted)
    }

    const action = actionButton.dataset.action;

    switch (action) {
        case 'copy':
            console.log("Copy action triggered for message ID:", messageId);
            await navigator.clipboard.writeText(message.text);
            // Optional: Provide visual feedback that text was copied
            break;
        case 'edit':
            console.log("Edit action triggered for message ID:", messageId);
            // Populate the input field with the message text
            ui.messageInput.value = message.text;
            adjustMessageInputHeight(); // Adjust input height for the populated text
            ui.messageInput.focus(); // Focus the input field
            // Note: This implementation of "edit" just loads the text into the input.
            // A full "edit" feature would also need to modify or replace the original message in Firestore.
            break;
        case 'rerun':
             console.log("Rerun action triggered for message ID:", messageId);
             // Find the text of the user message that triggered this AI response
             // This requires a bit more logic. We need to find the *user* message
             // that came *before* this AI message in the history.
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
                    // Pass the text to processUserMessage to skip reading from the input field
                    processUserMessage(lastUserMessageText);
                 } else {
                     console.warn("Could not find a preceding user message to rerun for AI message ID:", messageId);
                     // Optional: Provide user feedback like "No previous prompt found to rerun"
                     renderErrorMessage("Cannot rerun: Could not find the previous user prompt.");
                 }
             } else {
                 console.warn("Rerun triggered on the very first message (or message not in history).");
                  // Optional: Provide user feedback
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
    ui.chatMessages.scrollTo({
        top: ui.chatMessages.scrollHeight,
        behavior: instant ? 'instant' : 'smooth'
    });
}

//================================================================//
//================== 9. CORE APPLICATION LOGIC ===================//
//================================================================//

/**
 * Creates a new, empty chat session in the UI.
 * This function resets the UI and state for a new chat but does NOT immediately
 * save a new chat document to Firestore. The document is created only when the
 * first user message is sent in this new session.
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

    ui.chatMessages.innerHTML = ''; // Clear all messages from the UI

    // Add the initial welcome message to the UI (this message is not saved to Firestore)
    const welcomeMessageDiv = document.createElement('div');
    welcomeMessageDiv.className = 'message ai-message'; // Style like an AI message
    welcomeMessageDiv.innerHTML = `
        <div class="message-content-wrapper">
            <div class="message-content">
                <p>Welcome to <strong>ZAININ AI</strong>. I am your advanced AI assistant, ready to help you with research, coding, and creative tasks. How may I assist you today?</p>
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
        ui.sidebar.classList.remove('open');
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
         return; // Stop the process here
    }

    // Set state to indicate message sending is in progress
    state.isSendingMessage = true;
    ui.sendBtn.disabled = true; // Disable the send button to prevent double-sending

    // Clear and shrink the input field if this is not a rerun
    if (!rerunText) {
        ui.messageInput.value = '';
        adjustMessageInputHeight(); // Reset input height after clearing
    }

    // Save the user's message to Firestore.
    // This function will create a new chat document if state.currentChatId is null.
    let savedChatId;
    try {
         savedChatId = await saveMessageToFirestore({ sender: 'user', text: userText, timestamp: serverTimestamp() });
         // After saving, the Firestore onSnapshot listener for messages will automatically
         // trigger renderAllMessages, which will update the UI with the user's message.
    } catch (error) {
        console.error("Failed to save user message:", error);
        renderErrorMessage("Failed to save your message. Please try again.");
        // Clean up state before returning
        state.isSendingMessage = false;
        ui.sendBtn.disabled = false;
        ui.messageInput.focus();
        return; // Stop the process if saving fails
    }


    // Show the typing indicator while waiting for the AI response
    showTypingIndicator();

    // Fetch and stream the AI response
    try {
        // Pass the original userText (not the potentially augmented finalPrompt)
        // to fetchAndStreamAIResponse, as that function handles web search augmentation.
        await fetchAndStreamAIResponse(userText);
        // The streaming function handles updating the UI and saving the AI message.
    } catch (error) {
        console.error("Error during AI response fetching/streaming:", error);
        // The streaming function is designed to render errors in the chat,
        // but as a fallback or for errors before streaming starts:
        // renderErrorMessage(`Sorry, an error occurred while getting the AI response: ${error.message}`);
    } finally {
        // Always clean up the state and UI elements related to sending
        hideTypingIndicator(); // Ensure typing indicator is removed
        state.isSendingMessage = false; // Reset sending state
        ui.sendBtn.disabled = false; // Re-enable the send button
        ui.messageInput.focus(); // Set focus back to the input field
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
     errorDiv.innerHTML = `<div class="message-content-wrapper"><div class="message-content"><p><strong>Error:</strong> ${errorMessage}</p></div></div>`;
     ui.chatMessages.appendChild(errorDiv);
     scrollToBottom(); // Scroll to show the error message
}


//================================================================//
//================= 10. API & STREAMING SERVICES =================//
//================================================================//

/**
 * Fetches and processes a streaming AI response from OpenRouter using user-provided keys.
 * Includes optional web search using SerpApi if toggled and key is available.
 * Handles Markdown parsing and UI updates token by token.
 * @param {string} userPrompt - The user's original prompt.
 */
async function fetchAndStreamAIResponse(userPrompt) {
    // Ensure OpenRouter key is available - this should have been checked before calling
    if (!openrouterKey) {
        throw new Error("OpenRouter API Key is not set. Cannot fetch AI response.");
    }

    let finalPrompt = userPrompt; // Start with the user's original prompt
    let searchResults = null; // To store search results
    let searchError = null; // To store any error during search

    // Step 1: Perform web search if toggle is checked and SerpApi key is available
    if (ui.webSearchToggle.checked) {
        if (serpapiKey) {
             console.log("Web search toggle is ON and SerpApi key is available. Performing search...");
             try {
                 searchResults = await performWebSearch(userPrompt);
                 if (searchResults && searchResults.error) {
                     // If performWebSearch returns an object with an error property
                     searchError = searchResults.error;
                     console.error("Web search failed:", searchError);
                     searchResults = null; // Clear results if there was an error
                 } else if (searchResults) {
                     console.log("Web search successful. Augmenting prompt.");
                     // Augment the user's prompt with search results context
                     finalPrompt = `Web search results for context:\n---\n${searchResults}\n---\nUser question: ${userPrompt}`;
                     // Prepend a note about successful search results? Or let the AI interpret them.
                 } else {
                     console.log("Web search returned no organic results.");
                      // Optionally augment prompt slightly to indicate search was attempted but found nothing useful?
                      // Or rely on the AI to handle the context without explicit mention. Sticking to simple augmentation for now.
                 }
             } catch (error) {
                  console.error("Unexpected error during web search call:", error);
                  searchError = `Unexpected search error: ${error.message}`;
             }
        } else {
            // Web search requested but SerpApi key is missing
            searchError = "SerpApi key is missing. Web search skipped.";
            console.warn(searchError);
            // Optionally inform the user *in the chat* that search was skipped
            // We can prepend this note to the AI's response or add a separate message.
            // Prepending to the AI response seems less intrusive.
        }
    }


    // Step 2: Prepare messages array for OpenRouter API call
    // We include historical messages to provide conversation context to the AI.
    // Limit the history size to avoid hitting token limits or excessive costs.
    // Filter out any non-conversation messages like API key warnings or previous errors if they are in state.messagesData.
    const historyMessages = state.messagesData
                        .filter(msg => msg.sender === 'user' || msg.sender === 'ai');

    // The last message in history should be the user's current prompt.
    // Ensure the prompt in the history is the potentially augmented `finalPrompt`.
    // We already saved the user message to Firestore, which updates state.messagesData via onSnapshot.
    // So, the last message in `historyMessages` should be the user's original prompt.
    // We need to *replace* the content of this last message with the `finalPrompt` for the API call.
    if (historyMessages.length > 0 && historyMessages[historyMessages.length - 1].sender === 'user') {
         historyMessages[historyMessages.length - 1].text = finalPrompt; // Replace content with augmented prompt
    } else {
         // This case should ideally not happen if saveMessageToFirestore worked correctly,
         // but as a safeguard, add the user message if it's missing.
         console.warn("Last message in history is not user prompt, adding it.");
         historyMessages.push({ sender: 'user', text: finalPrompt });
    }

    // Limit history length (e.g., last 20 messages including the system message and current prompt)
    const maxHistoryLength = 20; // Adjust as needed based on model context window
    const messagesForApi = historyMessages.slice(Math.max(historyMessages.length - maxHistoryLength, 0));


    // Construct the system message - keep it simple initially
    const systemMessage = "You are ZAININ AI, an eloquent and helpful AI assistant. Format your responses using Markdown.";


    console.log("Sending streaming request to OpenRouter...");
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openrouterKey}`, // Use the user's key
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-chat', // Specify the model
                messages: [
                    { role: "system", content: systemMessage },
                    ...messagesForApi.map(msg => ({ role: msg.sender, content: msg.text })) // Format history for API
                ],
                stream: true // Request streaming response
            })
        });

        // Check for non-successful HTTP status codes
        if (!response.ok) {
             const errorBody = await response.text(); // Read error response body
             console.error(`OpenRouter API request failed: ${response.status} ${response.statusText}`, errorBody);
             let apiErrorMessage = `AI API failed: ${response.status} ${response.statusText}`;
             // Attempt to parse JSON error body for more specific message
             try {
                 const errorJson = JSON.parse(errorBody);
                 if (errorJson.error && errorJson.error.message) {
                     apiErrorMessage = `AI API Error: ${errorJson.error.message}`;
                 } else if (errorJson.message) { // Some APIs use 'message' instead of 'error.message'
                     apiErrorMessage = `AI API Error: ${errorJson.message}`;
                 }
             } catch (e) {
                 // If JSON parsing fails, just use the status text
             }
             throw new Error(apiErrorMessage); // Throw an error to be caught below
        }

        // Hide the static typing indicator now that streaming is starting
        hideTypingIndicator();

        const reader = response.body.getReader(); // Get a reader for the stream
        const decoder = new TextDecoder(); // Decoder for UTF-8
        let accumulatedResponse = ""; // Accumulate response text
        let aiMessageElement = null; // Reference to the DOM element displaying the streaming message content

         // Prepend search error note to the AI response if it occurred
        if (searchError) {
             accumulatedResponse += `*(Note: Web search failed or skipped: ${searchError})*\n\n`;
        }


        // Process the stream chunks
        while (true) {
            const { value, done } = await reader.read(); // Read the next chunk
            if (done) break; // Exit loop when stream is finished

            const chunk = decoder.decode(value); // Decode the chunk
            // OpenRouter sends data in 'data: {...}' format, potentially multiple per chunk
            const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));

            for (const line of lines) {
                const jsonStr = line.replace('data: ', ''); // Extract JSON string
                if (jsonStr === '[DONE]') continue; // Skip the DONE signal

                try {
                    const parsed = JSON.parse(jsonStr);
                    // Extract the token from the parsed JSON
                    // OpenRouter streaming format: delta includes 'role' in first chunk, 'content' in subsequent
                    const token = parsed.choices?.[0]?.delta?.content || "";

                    if (token) {
                        accumulatedResponse += token; // Add token to accumulated response
                        if (!aiMessageElement) {
                            // Create the message container the very first time we receive content
                            aiMessageElement = createAIMessageContainer();
                        }
                        // Update the content in the DOM with the accumulated text and cursor
                        updateStreamingMessage(aiMessageElement, accumulatedResponse);
                    }
                } catch (error) {
                    // Log non-JSON chunks or parsing errors but continue processing the stream
                    console.warn('Skipping non-JSON chunk or parsing error:', jsonStr, error);
                }
            }
        }

        // Step 3: Finalize the streamed message after the loop finishes (stream done)
        if (aiMessageElement) {
            // If content was streamed, finalize the message element
            finalizeStreamingMessage(aiMessageElement, accumulatedResponse);
        } else {
             // Case where streaming finished but no content was received (e.g., API error signal within stream)
             // or only the search error note was generated.
             console.warn("Streaming finished but no AI content received. Accumulated text:", accumulatedResponse);
             const fallbackText = accumulatedResponse || "No response received from AI.";
             // Create and finalize a message even if no AI tokens arrived, to show the search error note or a fallback
             const fallbackElement = createAIMessageContainer();
             finalizeStreamingMessage(fallbackElement, fallbackText);
             accumulatedResponse = fallbackText; // Ensure saved message has the fallback text
        }


        // Step 4: Save the complete AI message text to Firestore
        // Note: We save the final accumulated text, not the streamed tokens individually.
        // This assumes the stream successfully completed and accumulated the full response.
        await saveMessageToFirestore({ sender: 'ai', text: accumulatedResponse, timestamp: serverTimestamp() });
        // The Firestore onSnapshot listener will detect this new message and re-render,
        // but finalizeStreamingMessage already updated the UI, so this re-render mostly
        // ensures the message is permanently added to the list state.

    } catch (error) {
        // Catch errors that occurred during the fetch setup or stream reading
        console.error("Fetch or streaming error caught:", error);
        // If an AI message element was already created, try to add the error to it
        if (aiMessageElement) {
             // Append the error message to the accumulated text and finalize
             const errorText = `\n\n**Error:** ${error.message}`;
             accumulatedResponse += errorText;
             finalizeStreamingMessage(aiMessageElement, accumulatedResponse);
        } else {
             // If no AI message element was created (error happened early), render a new error message
             renderErrorMessage(error.message);
        }
        // Re-throw the error so the caller (processUserMessage) can handle cleanup (like disabling send button)
        throw error;
    }
}

/**
 * Creates the initial HTML container for a streaming AI message.
 * This container will be updated as tokens arrive.
 * @returns {HTMLElement} The .message-content element where the streaming text will be placed.
 */
function createAIMessageContainer() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message streaming'; // Add 'streaming' class to indicate it's being built
    messageDiv.innerHTML = `
        <div class="message-content-wrapper">
            <div class="message-content"></div>
            <!-- Action buttons will be added after finalizing -->
        </div>`;
    ui.chatMessages.appendChild(messageDiv); // Append the main message div to the chat area
    scrollToBottom(); // Scroll to the bottom immediately to show the new message container
    return messageDiv.querySelector('.message-content'); // Return the div that will hold the text
}

/**
 * Updates the content of a streaming message element with new accumulated text.
 * Parses the text as Markdown and ensures a blinking cursor is visible at the end.
 * @param {HTMLElement} element - The .message-content element to update.
 * @param {string} text - The full accumulated text received so far.
 */
function updateStreamingMessage(element, text) {
    // Use a temporary div to parse Markdown without interfering with the live DOM element
    const tempDiv = document.createElement('div');
    // Parse the text as Markdown. marked.parse returns HTML string.
    tempDiv.innerHTML = marked.parse(text);

    // Find the last node in the parsed content where the cursor should be placed.
    // This handles cases where the last part of the stream is within a paragraph,
    // a list item, a code block, etc.
    let lastNode = tempDiv.lastChild;
    // Traverse down into the last child until we find a node that doesn't have children,
    // or is a text node directly within an element (like a <p> or <li>).
    // Avoid placing cursor *inside* a code block's `<code>` tag itself, place it after the `<pre>`.
    while (lastNode && lastNode.lastChild && lastNode.tagName !== 'PRE' && lastNode.tagName !== 'CODE') {
        lastNode = lastNode.lastChild;
    }

    // Create the cursor span element
    const cursorSpan = document.createElement('span');
    cursorSpan.className = 'message-cursor';

    // Append the cursor after the determined last node
    if (lastNode && lastNode.parentElement) {
         // Insert the cursor after the last meaningful node
         lastNode.parentElement.insertBefore(cursorSpan, lastNode.nextSibling);
    } else {
         // If no meaningful last node was found (e.g., empty content), append to the tempDiv root
         tempDiv.appendChild(cursorSpan);
    }


    // Replace the content of the actual message element with the updated parsed HTML (including cursor)
    element.innerHTML = tempDiv.innerHTML;

    // Ensure the chat view scrolls down to show the new content and cursor
    scrollToBottom();
}

/**
 * Finalizes a streaming message. Removes the blinking cursor, adds action buttons,
 * and adds copy buttons to code blocks.
 * @param {HTMLElement} element - The .message-content element that was updated during streaming.
 * @param {string} fullText - The final, complete text of the message.
 */
function finalizeStreamingMessage(element, fullText) {
    console.log("Finalizing streamed message.");
    // Remove the blinking cursor span if it exists
    element.querySelector('.message-cursor')?.remove();

    // Ensure the final content is correctly parsed as Markdown one last time
    element.innerHTML = marked.parse(fullText);


    // Add action buttons (copy, rerun) to the message wrapper
    const wrapper = element.closest('.message-content-wrapper');
    // Only add actions if they don't already exist (prevents duplicates if rendering happens multiple times)
     if (wrapper && !wrapper.querySelector('.message-actions')) {
        const actionsHTML = `<div class="message-actions">
            <button data-action="copy" title="Copy"><i class="fas fa-copy"></i></button>
            <button data-action="rerun" title="Rerun Prompt"><i class="fas fa-redo"></i></button>
        </div>`;
        wrapper.insertAdjacentHTML('beforeend', actionsHTML); // Insert action buttons HTML after the content wrapper
    }


    // Add copy buttons to all <pre><code>...</code></pre> blocks within the final message
    element.querySelectorAll('pre code').forEach(codeBlock => {
        const pre = codeBlock.parentElement; // The <pre> element
        // Check if it's a PRE element and if a copy button doesn't already exist inside it
         if (pre.tagName === 'PRE' && !pre.querySelector('.copy-code-btn')) {
             const copyBtn = document.createElement('button');
             copyBtn.className = 'copy-code-btn';
             copyBtn.innerText = 'Copy';
             copyBtn.title = 'Copy Code'; // Add title for accessibility
             // Add event listener directly to this specific button
             copyBtn.addEventListener('click', () => {
                 navigator.clipboard.writeText(codeBlock.innerText).then(() => {
                     copyBtn.innerText = 'Copied!';
                     setTimeout(() => { copyBtn.innerText = 'Copy'; }, 2000);
                 }).catch(err => {
                     console.error('Failed to copy code: ', err);
                     copyBtn.innerText = 'Error';
                 });
             });
             pre.style.position = 'relative'; // Ensure positioning context for the absolute button
             pre.appendChild(copyBtn); // Append the button inside the <pre>
         }
    });


    // Remove the 'streaming' class from the main message div
    element.closest('.message.ai-message')?.classList.remove('streaming');

    scrollToBottom(); // Perform a final scroll to ensure the complete message is visible
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
        const searchUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${serpapiKey}`;
        console.log("Fetching SerpApi results via proxy URL:", `${CORS_PROXY_URL}${encodeURIComponent(searchUrl)}`);

        // Use the CORS proxy to fetch the SerpApi results
        const proxyResponse = await fetch(`${CORS_PROXY_URL}${encodeURIComponent(searchUrl)}`);

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
             results = JSON.parse(proxyData.contents);
        } catch (parseError) {
             console.error("Failed to parse SerpApi response from proxy contents:", parseError, proxyData.contents);
             return { error: `Failed to parse search results: ${parseError.message}` };
        }


        // Check if SerpApi itself returned an error
        if (results.error) {
             console.error("SerpApi returned an error:", results.error);
             return { error: `SerpApi error: ${results.error}` };
        }

        // Check if organic results are available
        if (results.organic_results && results.organic_results.length > 0) {
            console.log("SerpApi results received:", results.organic_results.slice(0, 3));
            // Format the top 3 organic results into a string
            const formattedResults = results.organic_results.slice(0, 3).map(r =>
                `Title: ${r.title}\nLink: ${r.link}\nSnippet: ${r.snippet}`
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