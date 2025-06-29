// script.js

"use strict";

/**
 * ZAININ AI - Main Application Logic
 * @version 4.1 - Secure API Edition (Backend Proxy)
 * @description This script manages all client-side functionality for the ZAININ AI chat application,
 * including Firebase authentication, Firestore database operations, and communication
 * with the secure backend API for AI responses and web search.
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
//===================== 2. API CONSTANTS (Removed API Keys) =======//
//================================================================//

// API keys are now stored securely as environment variables in the backend.
// const API_KEYS = { ... }; // REMOVED
// The CORS_PROXY_URL is also likely not needed on the client side when calling your own backend.
// const CORS_PROXY_URL = 'https://cors-anywhere.herokuapp.com/'; // REMOVED - backend handles external calls


//================================================================//
//=================== 3. DOM ELEMENT CACHE =======================//
//================================================================//

const ui = {
    authContainer: document.getElementById('auth-container'), emailInput: document.getElementById('email-input'), passwordInput: document.getElementById('password-input'), emailSignInBtn: document.getElementById('email-signin-btn'), emailSignUpBtn: document.getElementById('email-signup-btn'), googleSignInBtn: document.getElementById('google-signin-btn'), authError: document.getElementById('auth-error'),
    mainApp: document.getElementById('main-app'), userEmailDisplay: document.getElementById('user-email'), logoutBtn: document.getElementById('logout-btn'), newChatBtn: document.getElementById('new-chat-btn'), chatHistoryList: document.getElementById('chat-history-list'), sidebar: document.getElementById('sidebar'), sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'), sidebarCloseBtn: document.getElementById('sidebar-close-btn'),
    chatContainer: document.getElementById('chat-container'), chatTitle: document.getElementById('chat-title'), chatMessages: document.getElementById('chat-messages'), messageInput: document.getElementById('message-input'), sendBtn: document.getElementById('send-btn'), webSearchToggle: document.getElementById('web-search-toggle')
};


//================================================================//
//=================== 4. APPLICATION STATE =======================//
//================================================================//

let state = {
    currentUser: null, currentChatId: null, unsubscribeChatHistory: null, unsubscribeMessages: null,
    messagesData: [], isSendingMessage: false, waitingIndicatorElement: null // Keep track of the waiting indicator
};


//================================================================//
//==================== 5. INITIALIZATION =========================//
//================================================================//

document.addEventListener('DOMContentLoaded', initializeApplication);

/**
 * Initializes all core components of the application.
 */
function initializeApplication() {
    bindStaticEventListeners();
    onAuthStateChanged(auth, handleAuthStateChange);
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
    ui.chatMessages.addEventListener('click', handleMessageInteraction);

    // Adjust message input height dynamically
    ui.messageInput.addEventListener('input', autoResizeMessageInput);
}

/**
 * Automatically adjusts the height of the message input textarea.
 */
function autoResizeMessageInput() {
    ui.messageInput.style.height = 'auto';
    ui.messageInput.style.height = ui.messageInput.scrollHeight + 'px';
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
        state.currentUser = user;
        ui.authContainer.classList.add('hidden');
        ui.mainApp.classList.remove('hidden');
        ui.userEmailDisplay.textContent = user.email;
        fetchAndRenderChatHistory();
        // Only create a new chat session if one isn't already active
        if (!state.currentChatId || state.messagesData.length === 0) {
            createNewChatSession(false); // Don't save to DB initially
        } else {
            // If returning to a chat, ensure its messages are loaded
             switchActiveChat(state.currentChatId); // Re-subscribe to messages
        }
    } else {
        // Clear state and UI on logout
        state.currentUser = null;
        state.currentChatId = null;
        state.messagesData = [];
        ui.authContainer.classList.remove('hidden');
        ui.mainApp.classList.add('hidden');
        ui.userEmailDisplay.textContent = '';
        ui.chatHistoryList.innerHTML = '';
        ui.chatMessages.innerHTML = '';
        ui.chatTitle.textContent = 'New Chat';
        ui.messageInput.value = '';
        if (state.unsubscribeChatHistory) state.unsubscribeChatHistory();
        if (state.unsubscribeMessages) state.unsubscribeMessages();
    }
}

/**
 * A wrapper for handling different authentication methods.
 * @param {string} type - The type of authentication ('signin', 'signup', 'google').
 */
async function handleAuthAction(type) {
    ui.authError.textContent = '';
    try {
        const actions = {
            signup: () => createUserWithEmailAndPassword(auth, ui.emailInput.value, ui.passwordInput.value),
            signin: () => signInWithEmailAndPassword(auth, ui.emailInput.value, ui.passwordInput.value),
            google: () => signInWithPopup(auth, new GoogleAuthProvider())
        };
        await actions[type]();
        // Clear input fields on success
        ui.emailInput.value = '';
        ui.passwordInput.value = '';
    } catch (error) {
        ui.authError.textContent = error.message.replace('Firebase: ', '').replace('Auth (', '').replace(').', ''); // Clean up Firebase error messages
    }
}


//================================================================//
//=============== 7. FIRESTORE DATABASE OPERATIONS ===============//
//================================================================//

/**
 * Fetches and subscribes to the user's chat history from Firestore.
 */
function fetchAndRenderChatHistory() {
    if (!state.currentUser) return;
    if (state.unsubscribeChatHistory) state.unsubscribeChatHistory();
    const chatsQuery = query(collection(db, 'users', state.currentUser.uid, 'chats'), orderBy('timestamp', 'desc'));

    state.unsubscribeChatHistory = onSnapshot(chatsQuery, snapshot => {
        ui.chatHistoryList.innerHTML = '';
        let foundActiveChat = false;
        snapshot.forEach(doc => {
            renderChatItem(doc);
            if (doc.id === state.currentChatId) {
                foundActiveChat = true;
            }
        });
        // If the current chat was deleted, create a new one
        if (state.currentChatId && !foundActiveChat && snapshot.docs.length > 0) {
             // Fallback to the latest chat if the active one is deleted
             switchActiveChat(snapshot.docs[0].id);
        } else if (state.currentChatId && !foundActiveChat && snapshot.docs.length === 0) {
             // If all chats are deleted, create a new session
             createNewChatSession();
        } else if (!state.currentChatId && snapshot.docs.length > 0) {
             // If no chat is active on login, switch to the latest
             switchActiveChat(snapshot.docs[0].id);
        } else if (!state.currentChatId && snapshot.docs.length === 0) {
            // If no chats exist on login, create a new session
            createNewChatSession();
        }
    }, error => {
         console.error("Error fetching chat history:", error);
         renderErrorMessage("Failed to load chat history.");
    });
}

/**
 * Switches the active chat session.
 * @param {string} chatId - The ID of the chat to switch to.
 */
async function switchActiveChat(chatId) {
    if (!state.currentUser || state.currentChatId === chatId) return;

    // Unsubscribe from previous messages listener
    if (state.unsubscribeMessages) state.unsubscribeMessages();

    state.currentChatId = chatId;
    // Update active class in the UI
    document.querySelectorAll('.chat-history-item').forEach(el => el.classList.toggle('active', el.dataset.id === chatId));

    // Fetch chat title (optional, onSnapshot will update it if needed)
    try {
        const chatDocSnap = await getDoc(doc(db, 'users', state.currentUser.uid, 'chats', chatId));
        ui.chatTitle.textContent = chatDocSnap.data()?.title || 'Chat';
    } catch (error) {
        console.error("Error fetching chat title:", error);
        ui.chatTitle.textContent = 'Error Loading Chat';
    }


    // Subscribe to messages for the new chat
    const messagesQuery = query(collection(db, 'users', state.currentUser.uid, 'chats', chatId, 'messages'), orderBy('timestamp'));
    state.unsubscribeMessages = onSnapshot(messagesQuery, snapshot => {
        state.messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAllMessages(state.messagesData);
    }, error => {
         console.error("Error fetching messages:", error);
         renderErrorMessage("Failed to load messages.");
    });

    // Hide sidebar on mobile after switching
    if (ui.sidebar.classList.contains('open')) ui.sidebar.classList.remove('open');

    // Clear input area and scroll
    ui.messageInput.value = '';
    autoResizeMessageInput();
    scrollToBottom(true); // Scroll instantly to the bottom of the new chat
}

/**
 * Saves a message object to the current chat in Firestore.
 * If no chat is active, creates a new one first.
 * @param {object} messageData - The message object to save ({ sender, text, timestamp }).
 * @returns {Promise<void>}
 */
async function saveMessageToFirestore(messageData) {
    if (!state.currentUser) {
        console.error("Cannot save message: User not authenticated.");
        return;
    }

    // If this is the very first message and no chat is active, create one
    if (!state.currentChatId) {
        const title = messageData.text.substring(0, 30) + (messageData.text.length > 30 ? '...' : '');
        try {
             const newChatRef = await addDoc(collection(db, 'users', state.currentUser.uid, 'chats'), {
                 title: title || 'New Chat',
                 timestamp: serverTimestamp()
             });
             state.currentChatId = newChatRef.id; // Set the newly created chat as active
             // The chat history listener will render the new chat item
             console.log("New chat created:", state.currentChatId);
             // Subscribe to messages for this new chat immediately
             // This might happen automatically if fetchAndRenderChatHistory re-runs quickly,
             // but manual switch ensures listener is set up.
             switchActiveChat(state.currentChatId);

        } catch (error) {
             console.error("Error creating new chat:", error);
             renderErrorMessage("Failed to create a new chat.");
             state.isSendingMessage = false; // Ensure UI is not stuck
             hideWaitingIndicator();
             return; // Stop here if chat creation failed
        }
    }

    // Save the message to the active chat
    try {
        await addDoc(collection(db, 'users', state.currentUser.uid, 'chats', state.currentChatId, 'messages'), {
            sender: messageData.sender,
            text: messageData.text,
            timestamp: serverTimestamp() // Ensure server timestamp is used
        });
        console.log(`Message saved to chat ${state.currentChatId}: ${messageData.sender}`);
    } catch (error) {
        console.error("Error saving message to Firestore:", error);
        renderErrorMessage("Failed to save message.");
        state.isSendingMessage = false; // Ensure UI is not stuck
        hideWaitingIndicator();
    }
}

/**
 * Updates the title of a chat in Firestore.
 * @param {string} chatId - The ID of the chat to rename.
 * @param {string} oldTitle - The current title of the chat.
 */
async function renameChatInFirestore(chatId, oldTitle) {
    if (!state.currentUser) return;
    const newTitle = prompt("Enter new chat name:", oldTitle || 'Untitled Chat');
    if (newTitle && newTitle.trim() && newTitle.trim() !== oldTitle) {
        try {
            await updateDoc(doc(db, 'users', state.currentUser.uid, 'chats', chatId), { title: newTitle.trim() });
        } catch (error) {
            console.error("Error renaming chat:", error);
            renderErrorMessage("Failed to rename chat.");
        }
    }
}

/**
 * Deletes a chat and all its messages from Firestore.
 * @param {string} chatId - The ID of the chat to delete.
 */
async function deleteChatFromFirestore(chatId) {
    if (!state.currentUser) return;
    if (confirm("Are you sure you want to permanently delete this chat? This action cannot be undone.")) {
        try {
            // Delete messages subcollection first
            const messagesSnapshot = await getDocs(collection(db, 'users', state.currentUser.uid, 'chats', chatId, 'messages'));
            // Use batched writes for better performance on many messages, but for simplicity,
            // deleting one by one is shown here. For large chats, batching is recommended.
            await Promise.all(messagesSnapshot.docs.map(msgDoc => deleteDoc(msgDoc.ref)));
            console.log(`Deleted ${messagesSnapshot.size} messages from chat ${chatId}`);

            // Delete the chat document
            await deleteDoc(doc(db, 'users', state.currentUser.uid, 'chats', chatId));
            console.log(`Deleted chat ${chatId}`);

            // If the deleted chat was the active one, create a new session
            if (chatId === state.currentChatId) {
                createNewChatSession();
            }
             // The chat history listener will update the sidebar UI automatically
        } catch (error) {
            console.error("Error deleting chat:", error);
            renderErrorMessage("Failed to delete chat.");
        }
    }
}

//================================================================//
//================== 8. UI RENDERING & EVENTS ====================//
//================================================================//

/**
 * Renders a single item in the chat history list.
 * @param {object} doc - The Firestore document for the chat.
 */
function renderChatItem(doc) {
    const chat = doc.data();
    const li = document.createElement('li');
    li.className = 'chat-history-item';
    li.dataset.id = doc.id;
    const title = chat.title || 'Untitled Chat';
    li.innerHTML = `
        <span class="chat-title-text" title="${title}">${title}</span>
        <div class="chat-item-actions">
            <button class="rename-chat-btn" title="Rename"><i class="fas fa-pen"></i></button>
            <button class="delete-chat-btn" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
    `;
    if (doc.id === state.currentChatId) li.classList.add('active');
    li.querySelector('.chat-title-text').addEventListener('click', () => switchActiveChat(doc.id));
    li.querySelector('.rename-chat-btn').addEventListener('click', e => { e.stopPropagation(); renameChatInFirestore(doc.id, chat.title); });
    li.querySelector('.delete-chat-btn').addEventListener('click', e => { e.stopPropagation(); deleteChatFromFirestore(doc.id); });
    ui.chatHistoryList.appendChild(li);
}

/**
 * Renders all messages for the active chat. This is typically triggered
 * by the Firestore onSnapshot listener.
 * @param {Array<object>} messages - An array of message objects.
 */
function renderAllMessages(messages) {
     // Clear the chat area but keep the initial welcome message if present and empty state
     const welcomeMessage = ui.chatMessages.querySelector('.welcome-message');
     ui.chatMessages.innerHTML = '';
     if (messages.length === 0 && welcomeMessage) {
         ui.chatMessages.appendChild(welcomeMessage);
     } else if (messages.length === 0) {
         // Render default welcome message if no messages exist
         renderDefaultWelcomeMessage();
     }


    messages.forEach(renderMessage);

    // Ensure waiting indicator persists if present after re-render (e.g. new message comes in while waiting)
    if (state.waitingIndicatorElement) {
        // Check if it's still in the DOM, re-append if not (Firestore snapshot might clear it)
        if (!ui.chatMessages.contains(state.waitingIndicatorElement)) {
            ui.chatMessages.appendChild(state.waitingIndicatorElement);
        }
    }

    scrollToBottom();
}

/**
 * Renders a single message in the chat window.
 * @param {object} msg - The message object ({ id, sender, text }).
 */
function renderMessage(msg) {
    const { sender, text, id } = msg;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.dataset.messageId = id; // Use message ID for actions

    const actionsHTML = sender === 'ai'
        ? `<button data-action="copy" title="Copy"><i class="fas fa-copy"></i></button><button data-action="rerun" title="Rerun"><i class="fas fa-redo"></i></button>`
        : `<button data-action="edit" title="Edit"><i class="fas fa-pen"></i></button><button data-action="copy" title="Copy"><i class="fas fa-copy"></i></button>`;

    // Use marked.parse for Markdown rendering
    messageDiv.innerHTML = `
        <div class="message-content-wrapper">
            <div class="message-content">${marked.parse(text || '')}</div>
            <div class="message-actions">${actionsHTML}</div>
        </div>
    `;

    // Add copy buttons to code blocks
    messageDiv.querySelectorAll('pre').forEach(pre => {
        // Check if a copy button already exists to avoid duplicates on re-render
        if (!pre.previousElementSibling || !pre.previousElementSibling.classList.contains('copy-code-btn')) {
             const copyButton = document.createElement('button');
             copyButton.className = 'copy-code-btn';
             copyButton.textContent = 'Copy';
             copyButton.addEventListener('click', () => {
                 navigator.clipboard.writeText(pre.querySelector('code')?.innerText || pre.innerText);
                 copyButton.textContent = 'Copied!';
                 setTimeout(() => { copyButton.textContent = 'Copy'; }, 2000);
             });
            pre.insertAdjacentElement('beforebegin', copyButton); // Insert button before <pre>
        }
    });

     // Check if this message already exists before appending (can happen with snapshots)
     if (!ui.chatMessages.querySelector(`[data-message-id="${id}"]`)) {
         ui.chatMessages.appendChild(messageDiv);
     }
}

/**
 * Renders the initial welcome message.
 */
function renderDefaultWelcomeMessage() {
     ui.chatMessages.innerHTML = `
        <div class="message ai-message welcome-message">
            <div class="message-content-wrapper">
                <div class="message-content">
                    <p>Welcome to <strong>ZAININ AI</strong>. I am your advanced AI assistant, ready to help you with research, coding, and creative tasks. How may I assist you today?</p>
                </div>
            </div>
        </div>`;
}

/**
 * Shows a simple text-based waiting indicator in the chat window.
 */
function showWaitingIndicator() {
    if (state.waitingIndicatorElement) return; // Indicator already exists
    state.waitingIndicatorElement = document.createElement('div');
    state.waitingIndicatorElement.className = 'message ai-message waiting-indicator';
    state.waitingIndicatorElement.innerHTML = `
        <div class="message-content-wrapper">
            <div class="message-content">...</div>
        </div>`;
    ui.chatMessages.appendChild(state.waitingIndicatorElement);
    scrollToBottom();
}

/**
 * Removes the waiting indicator.
 */
function hideWaitingIndicator() {
    if (state.waitingIndicatorElement) {
        state.waitingIndicatorElement.remove();
        state.waitingIndicatorElement = null;
    }
}


/**
 * Handles all keydown events on the message input field.
 * @param {KeyboardEvent} e - The keyboard event.
 */
function handleInputKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        processUserMessage();
    }
}

/**
 * Handles clicks on message action buttons using event delegation.
 * @param {MouseEvent} e - The click event.
 */
function handleMessageInteraction(e) {
    const target = e.target;

    // Handle code copy button clicks (delegated from renderMessage)
    if (target.matches('.copy-code-btn')) {
        const codeElement = target.nextElementSibling?.querySelector('code') || target.nextElementSibling;
        if (codeElement) {
            navigator.clipboard.writeText(codeElement.innerText).then(() => {
                target.textContent = 'Copied!';
                setTimeout(() => { target.textContent = 'Copy'; }, 2000);
            }).catch(err => console.error('Failed to copy code:', err));
        }
        return;
    }

    // Handle message action button clicks
    const actionButton = target.closest('[data-action]');
    if (!actionButton) return;

    // Find the corresponding message data from the state
    const messageElement = actionButton.closest('.message');
    const messageId = messageElement?.dataset.messageId;
     // Note: When switching to non-streaming backend, the AI message might not have an ID
     // immediately if we render a placeholder before saving.
     // A safer approach is to find the text content directly from the element for copy/edit,
     // but for rerun, we still need the *last user message*.
    const messageData = state.messagesData.find(m => m.id === messageId);

    const action = actionButton.dataset.action;

    // Actions that don't require message data
    if (action === 'copy') {
         const textToCopy = messageElement?.querySelector('.message-content')?.innerText;
         if (textToCopy) {
             navigator.clipboard.writeText(textToCopy).catch(err => console.error('Failed to copy message:', err));
         }
         return;
    }

    // Actions that require message data
    if (!messageData) {
        console.warn("Message data not found for action:", action, messageId);
        return;
    }

    const actions = {
        edit: () => {
            ui.messageInput.value = messageData.text;
            autoResizeMessageInput(); // Adjust height for the content
            ui.messageInput.focus();
        },
        rerun: () => {
            // Find the last user message before the AI response being reran (if applicable)
            // Or, more simply, just find the *actual* last user message in the entire history.
            // Rerunning an AI response typically means sending the *last user prompt* again.
            const lastUserMessage = state.messagesData.slice().reverse().find(m => m.sender === 'user');
            if (lastUserMessage) {
                 // Pass the text of the last user message to processUserMessage
                 processUserMessage(lastUserMessage.text);
            } else {
                 console.warn("Cannot rerun: No previous user message found.");
            }
        }
    };
    actions[action]?.();
}


/**
 * Scrolls the chat messages container to the bottom.
 * @param {boolean} instant - Whether to scroll instantly or smoothly.
 */
function scrollToBottom(instant = false) {
    ui.chatMessages.scrollTo({
        top: ui.chatMessages.scrollHeight,
        behavior: instant ? 'instant' : 'smooth'
    });
}

/**
 * Renders an error message directly in the chat UI.
 * @param {string} errorMessage - The error message to display.
 */
function renderErrorMessage(errorMessage) {
     const errorDiv = document.createElement('div');
     errorDiv.className = 'message ai-message error-message-bubble'; // Add a specific class
     errorDiv.innerHTML = `
        <div class="message-content-wrapper">
            <div class="message-content">
                <p><strong>Error:</strong> ${errorMessage}</p>
            </div>
        </div>`;
     ui.chatMessages.appendChild(errorDiv);
     scrollToBottom();
}


//================================================================//
//================== 9. CORE APPLICATION LOGIC ===================//
//================================================================//

/**
 * Creates a new, empty chat session in the UI.
 * Optionally saves it to the database immediately.
 * @param {boolean} saveToDb - Whether to save the new chat document to Firestore. Defaults to true.
 */
async function createNewChatSession(saveToDb = true) {
    if (state.unsubscribeMessages) state.unsubscribeMessages(); // Unsubscribe from previous chat's messages

    state.currentChatId = null; // Clear the active chat ID
    state.messagesData = []; // Clear message data

    ui.chatMessages.innerHTML = ''; // Clear UI messages
    renderDefaultWelcomeMessage(); // Add the default welcome message
    ui.chatTitle.textContent = 'New Chat';
    ui.messageInput.value = '';
    autoResizeMessageInput(); // Reset input height
    ui.messageInput.focus();
    hideWaitingIndicator(); // Ensure waiting indicator is hidden

    // Remove 'active' class from all chat history items
    document.querySelectorAll('.chat-history-item.active').forEach(el => el.classList.remove('active'));

     // If saveToDb is true, a new chat document will be created when the first message is sent
     // in processUserMessage. If saveToDb is false (e.g., on initial load when no chats exist),
     // we just show the empty state, and the chat doc is created on the first interaction.
     // This function primarily resets the *client-side* view to an empty chat state.
}


/**
 * Processes the user's input, saves it, and fetches a response from the backend.
 * @param {string|null} rerunText - Optional text to use for rerunning a prompt.
 */
async function processUserMessage(rerunText = null) {
    if (state.isSendingMessage) return; // Prevent sending multiple messages at once

    const userText = (rerunText || ui.messageInput.value).trim();
    if (!userText) return; // Do nothing if input is empty

    state.isSendingMessage = true; // Set flag to indicate message is being processed
    ui.messageInput.value = ''; // Clear input field
    autoResizeMessageInput(); // Reset input height

    // Save the user message to Firestore immediately.
    // The onSnapshot listener will pick this up and render it in the UI.
    // This happens asynchronously.
    await saveMessageToFirestore({ sender: 'user', text: userText });

    // Show a waiting indicator while the backend processes the request
    showWaitingIndicator();

    try {
        // Call the backend function to get the AI response
        await fetchAIResponseFromBackend(userText); // Pass the user's prompt

    } catch (error) {
        // Errors are caught and rendered inside fetchAIResponseFromBackend
        console.error("Error during AI processing (caught in processUserMessage):", error);
        // ensure indicator is hidden and state is reset if an error occurred somewhere
        hideWaitingIndicator();
        state.isSendingMessage = false;
    } finally {
        // This block will execute whether try succeeds or catch fails
        // The isSendingMessage flag is cleared, indicator hidden, and scroll happens
        // after fetchAIResponseFromBackend completes (or errors).
    }
}

//================================================================//
//================= 10. API & BACKEND SERVICES ===================//
//================================================================//

/**
 * Fetches the AI response from the backend serverless function.
 * The backend handles the actual calls to external AI APIs.
 * @param {string} prompt - The user's prompt.
 */
async function fetchAIResponseFromBackend(prompt) {
    if (!state.currentUser || !state.currentChatId) {
        console.error("Cannot fetch AI response: User not authenticated or no active chat.");
        renderErrorMessage("Authentication or chat session error. Please try logging in again.");
        hideWaitingIndicator();
        state.isSendingMessage = false;
        return;
    }

    const useWebSearch = ui.webSearchToggle.checked;

    // Prepare conversation history to send to the backend
    // We need to map our {sender, text} format to the API's {role, content} format.
    // Filter out any messages without text or the temporary waiting indicator.
    const conversationHistory = state.messagesData
        .filter(msg => msg.text && msg.sender && !msg.id.startsWith('waiting-')) // Filter out incomplete/temp messages
        .map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        }));

    // Add the current user message (the one just saved to Firestore) to the history sent to the backend.
    // We find it by text matching, assuming the most recent message with this text is the one.
    // A more robust way would be to pass the ID after saving, but simple text match works for now.
    // Better approach: send the messages *including* the user message that was just saved.
    // Find the last user message that matches the prompt
    const lastUserMessage = state.messagesData.findLast(msg => msg.sender === 'user' && msg.text === prompt);

    const messagesToSend = [
         // Send the last 10 messages for context (or adjust number)
         // Filter out the specific last user message if we're adding it explicitly later
         ...conversationHistory.slice(-10).filter(msg => !(msg.role === 'user' && msg.content === prompt && msg !== lastUserMessage)),
         // Add the current user message explicitly at the end to ensure it's the latest prompt
         { role: 'user', content: prompt }
    ].filter((msg, index, self) => // Basic deduplication based on role+content+position
        index === self.findIndex((m) => (
            m.role === msg.role && m.content === msg.content
        ))
    );


    try {
        const response = await fetch('/api/chat', { // Call your serverless function endpoint
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt, // Although history is sent, sometimes sending the specific prompt is useful
                useWebSearch: useWebSearch, // Send the web search setting
                messages: messagesToSend // Send relevant conversation history
            })
        });

        // Hide the waiting indicator once the response starts coming back
        hideWaitingIndicator();

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Backend API Error:", errorData.error);
             // Render an error message directly if the backend signals an error
            renderErrorMessage(`AI Error: ${errorData.error || 'Unknown error from backend'}`);
            return; // Stop processing on error
        }

        // Process the non-streaming JSON response from the backend
        const result = await response.json();
        const aiResponseText = result.text;

        if (aiResponseText) {
            // Save the received AI response to Firestore.
            // The onSnapshot listener will automatically add and render this message.
            await saveMessageToFirestore({ sender: 'ai', text: aiResponseText });
        } else {
             console.warn("Backend returned empty AI response.");
             renderErrorMessage("Received an empty response from the AI.");
        }


    } catch (error) {
        console.error("Error fetching AI response via backend:", error);
         // Render a generic error message for network or unexpected errors
        renderErrorMessage(`Communication Error: ${error.message || 'Could not get a response from the AI.'}`);
    } finally {
        // This function is called by processUserMessage, which handles isSendingMessage and final scroll.
        // No need to set isSendingMessage = false here.
    }
}

// Removed the old client-side streaming functions as they are no longer needed
// if the backend sends a complete response:
// updateStreamingMessage, finalizeStreamingMessage.
// The typing indicator GIF is also likely not needed if using the "..." style indicator.