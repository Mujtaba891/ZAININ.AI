"use strict";

/**
 * ZAININ AI - Main Application Logic
 * @version 4.0 - Streaming Edition
 * @description This script manages all client-side functionality for the ZAININ AI chat application,
 * including Firebase authentication, Firestore database operations, real-time UI rendering with
 * response streaming, and external API communications.
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
//===================== 2. API CONSTANTS =========================//
//================================================================//

const API_KEYS = {
    OPENROUTER: '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',
    SERPAPI: 'a63a63f0831c360de9f948971028876f081dcfa45aec8d98e7a1834fd0e31dbc'
};
const CORS_PROXY_URL = 'https://cors-anywhere.herokuapp.com/';


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
        if (!state.currentChatId) createNewChatSession();
    } else {
        state.currentUser = null;
        ui.authContainer.classList.remove('hidden');
        ui.mainApp.classList.add('hidden');
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
    } catch (error) {
        ui.authError.textContent = error.message.replace('Firebase: ', '');
    }
}


//================================================================//
//=============== 7. FIRESTORE DATABASE OPERATIONS ===============//
//================================================================//

/**
 * Fetches and subscribes to the user's chat history from Firestore.
 */
function fetchAndRenderChatHistory() {
    if (state.unsubscribeChatHistory) state.unsubscribeChatHistory();
    const chatsQuery = query(collection(db, 'users', state.currentUser.uid, 'chats'), orderBy('timestamp', 'desc'));
    state.unsubscribeChatHistory = onSnapshot(chatsQuery, snapshot => {
        ui.chatHistoryList.innerHTML = '';
        snapshot.forEach(doc => renderChatItem(doc));
    });
}

/**
 * Switches the active chat session.
 * @param {string} chatId - The ID of the chat to switch to.
 */
async function switchActiveChat(chatId) {
    if (state.currentChatId === chatId) return;
    state.currentChatId = chatId;
    document.querySelectorAll('.chat-history-item').forEach(el => el.classList.toggle('active', el.dataset.id === chatId));
    const chatDocSnap = await getDoc(doc(db, 'users', state.currentUser.uid, 'chats', chatId));
    ui.chatTitle.textContent = chatDocSnap.data()?.title || 'Chat';

    if (state.unsubscribeMessages) state.unsubscribeMessages();
    const messagesQuery = query(collection(db, 'users', state.currentUser.uid, 'chats', chatId, 'messages'), orderBy('timestamp'));
    state.unsubscribeMessages = onSnapshot(messagesQuery, snapshot => {
        state.messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAllMessages(state.messagesData);
    });
    if (ui.sidebar.classList.contains('open')) ui.sidebar.classList.remove('open');
}

/**
 * Saves a message object to the current chat in Firestore.
 * @param {object} messageData - The message object to save.
 */
async function saveMessageToFirestore(messageData) {
    if (!state.currentChatId) {
        const title = messageData.text.substring(0, 30) + (messageData.text.length > 30 ? '...' : '');
        const newChatRef = await addDoc(collection(db, 'users', state.currentUser.uid, 'chats'), { title, timestamp: serverTimestamp() });
        await switchActiveChat(newChatRef.id);
    }
    await addDoc(collection(db, 'users', state.currentUser.uid, 'chats', state.currentChatId, 'messages'), messageData);
}

/**
 * Updates the title of a chat in Firestore.
 * @param {string} chatId - The ID of the chat to rename.
 * @param {string} oldTitle - The current title of the chat.
 */
async function renameChatInFirestore(chatId, oldTitle) {
    const newTitle = prompt("Enter new chat name:", oldTitle || '');
    if (newTitle && newTitle.trim()) {
        await updateDoc(doc(db, 'users', state.currentUser.uid, 'chats', chatId), { title: newTitle.trim() });
    }
}

/**
 * Deletes a chat and all its messages from Firestore.
 * @param {string} chatId - The ID of the chat to delete.
 */
async function deleteChatFromFirestore(chatId) {
    if (confirm("Are you sure you want to permanently delete this chat?")) {
        const messagesSnapshot = await getDocs(collection(db, 'users', state.currentUser.uid, 'chats', chatId, 'messages'));
        await Promise.all(messagesSnapshot.docs.map(msgDoc => deleteDoc(msgDoc.ref)));
        await deleteDoc(doc(db, 'users', state.currentUser.uid, 'chats', chatId));
        if (chatId === state.currentChatId) createNewChatSession();
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
    li.innerHTML = `
        <span class="chat-title-text">${chat.title || 'Untitled Chat'}</span>
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
 * Renders all messages for the active chat.
 * @param {Array<object>} messages - An array of message objects.
 */
function renderAllMessages(messages) {
    ui.chatMessages.innerHTML = '';
    messages.forEach(renderMessage);
    scrollToBottom(true);
}

/**
 * Renders a single message in the chat window.
 * @param {object} msg - The message object.
 */
function renderMessage(msg) {
    const { sender, text, id } = msg;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.dataset.messageId = id;
    const actionsHTML = sender === 'ai'
        ? `<button data-action="copy" title="Copy"><i class="fas fa-copy"></i></button><button data-action="rerun" title="Rerun"><i class="fas fa-redo"></i></button>`
        : `<button data-action="edit" title="Edit"><i class="fas fa-pen"></i></button><button data-action="copy" title="Copy"><i class="fas fa-copy"></i></button>`;
    
    messageDiv.innerHTML = `
        <div class="message-content-wrapper">
            <div class="message-content">${marked.parse(text)}</div>
            <div class="message-actions">${actionsHTML}</div>
        </div>
    `;

    messageDiv.querySelectorAll('pre').forEach(pre => {
        pre.insertAdjacentHTML('afterbegin', `<button class="copy-code-btn">Copy</button>`);
    });
    ui.chatMessages.appendChild(messageDiv);
}

/**
 * Shows the GIF typing indicator in the chat window.
 */
function showTypingIndicator() {
    if (document.getElementById('typing-indicator')) return;
    const indicatorHTML = `
        <div id="typing-indicator" class="message ai-message">
            <div class="typing-indicator">
                <img src="assets/typing.gif" alt="AI is typing...">
            </div>
        </div>`;
    ui.chatMessages.insertAdjacentHTML('beforeend', indicatorHTML);
    scrollToBottom();
}

/**
 * Removes the GIF typing indicator.
 */
function hideTypingIndicator() {
    document.getElementById('typing-indicator')?.remove();
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
    if (target.matches('.copy-code-btn')) {
        navigator.clipboard.writeText(target.nextElementSibling.innerText);
        target.innerText = 'Copied!';
        setTimeout(() => { target.innerText = 'Copy'; }, 2000);
        return;
    }
    const actionButton = target.closest('[data-action]');
    if (!actionButton) return;

    const message = state.messagesData.find(m => m.id === actionButton.closest('.message').dataset.messageId);
    if (!message) return;

    const actions = {
        copy: () => navigator.clipboard.writeText(message.text),
        edit: () => { ui.messageInput.value = message.text; ui.messageInput.focus(); },
        rerun: () => {
            const lastUserMessage = state.messagesData.slice().reverse().find(m => m.sender === 'user');
            if (lastUserMessage) processUserMessage(lastUserMessage.text);
        }
    };
    actions[actionButton.dataset.action]?.();
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

//================================================================//
//================== 9. CORE APPLICATION LOGIC ===================//
//================================================================//

/**
 * Creates a new, empty chat session in the UI.
 */
function createNewChatSession() {
    if (state.unsubscribeMessages) state.unsubscribeMessages();
    state.currentChatId = null;
    state.messagesData = [];
    ui.chatMessages.innerHTML = `
        <div class="message ai-message">
            <div class="message-content-wrapper">
                <div class="message-content">
                    <p>Welcome to <strong>ZAININ AI</strong>. I am your advanced AI assistant, ready to help you with research, coding, and creative tasks. How may I assist you today?</p>
                </div>
            </div>
        </div>`;
    ui.chatTitle.textContent = 'New Chat';
    ui.messageInput.value = '';
    ui.messageInput.focus();
    document.querySelectorAll('.chat-history-item.active').forEach(el => el.classList.remove('active'));
}

/**
 * Processes the user's input, saves it, and fetches a streaming response.
 * @param {string|null} rerunText - Optional text to use for rerunning a prompt.
 */
async function processUserMessage(rerunText = null) {
    if (state.isSendingMessage) return;
    const userText = (rerunText || ui.messageInput.value).trim();
    if (!userText) return;
    state.isSendingMessage = true;
    ui.messageInput.value = '';
    ui.messageInput.style.height = 'auto';

    if (!rerunText) {
        await saveMessageToFirestore({ sender: 'user', text: userText, timestamp: serverTimestamp() });
    }

    showTypingIndicator();

    try {
        await fetchAndStreamAIResponse(userText);
    } catch (error) {
        console.error("Error during AI processing:", error);
        renderErrorMessage(error.message);
    } finally {
        hideTypingIndicator();
        state.isSendingMessage = false;
    }
}

/**
 * Renders an error message directly in the chat UI.
 * @param {string} errorMessage - The error message to display.
 */
function renderErrorMessage(errorMessage) {
     const errorDiv = document.createElement('div');
     errorDiv.className = 'message ai-message';
     errorDiv.innerHTML = `<div class="message-content-wrapper"><div class="message-content"><p><strong>Error:</strong> ${errorMessage}</p></div></div>`;
     ui.chatMessages.appendChild(errorDiv);
     scrollToBottom();
}

//================================================================//
//================= 10. API & STREAMING SERVICES =================//
//================================================================//

/**
 * Fetches and processes a streaming AI response from OpenRouter.
 * @param {string} prompt - The user's prompt.
 */
async function fetchAndStreamAIResponse(prompt) {
    let finalPrompt = prompt;
    if (ui.webSearchToggle.checked) {
        const searchResults = await performWebSearch(prompt);
        if (searchResults) finalPrompt = `Web search results for context:\n---\n${searchResults}\n---\nUser question: ${prompt}`;
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEYS.OPENROUTER}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'deepseek/deepseek-chat',
            messages: [
                { role: "system", content: "You are ZAININ AI, an eloquent and helpful AI assistant. Format your responses using Markdown." },
                { role: "user", content: finalPrompt }
            ],
            stream: true
        })
    });

    if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
    hideTypingIndicator();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedResponse = "";
    let aiMessageElement = null;

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));

        for (const line of lines) {
            const jsonStr = line.replace('data: ', '');
            if (jsonStr === '[DONE]') continue;
            try {
                const parsed = JSON.parse(jsonStr);
                const token = parsed.choices[0]?.delta?.content || "";
                if (token) {
                    accumulatedResponse += token;
                    if (!aiMessageElement) {
                        aiMessageElement = createAIMessageContainer();
                    }
                    updateStreamingMessage(aiMessageElement, accumulatedResponse);
                }
            } catch (error) {
                console.warn('Skipping non-JSON chunk:', jsonStr);
            }
        }
    }

    if (aiMessageElement) finalizeStreamingMessage(aiMessageElement, accumulatedResponse);
    await saveMessageToFirestore({ sender: 'ai', text: accumulatedResponse, timestamp: serverTimestamp() });
}

/**
 * Creates the initial HTML container for a streaming AI message.
 * @returns {HTMLElement} The content element of the new message.
 */
function createAIMessageContainer() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message streaming';
    messageDiv.innerHTML = `<div class="message-content-wrapper"><div class="message-content"></div></div>`;
    ui.chatMessages.appendChild(messageDiv);
    return messageDiv.querySelector('.message-content');
}

/**
 * Updates the content of a streaming message with new tokens.
 * @param {HTMLElement} element - The content element to update.
 * @param {string} text - The full accumulated text.
 */
function updateStreamingMessage(element, text) {
    element.innerHTML = marked.parse(text + '<span class="message-cursor"></span>');
    scrollToBottom();
}

/**
 * Finalizes a streaming message, removing the cursor and adding action buttons.
 * @param {HTMLElement} element - The content element that was updated.
 * @param {string} fullText - The final, complete text of the message.
 */
function finalizeStreamingMessage(element, fullText) {
    element.innerHTML = marked.parse(fullText);
    const wrapper = element.closest('.message-content-wrapper');
    const actionsHTML = `<div class="message-actions">
        <button data-action="copy" title="Copy"><i class="fas fa-copy"></i></button>
        <button data-action="rerun" title="Rerun"><i class="fas fa-redo"></i></button>
    </div>`;
    wrapper.insertAdjacentHTML('beforeend', actionsHTML);
    wrapper.parentElement.classList.remove('streaming');
}

/**
 * Performs a web search using SerpApi.
 * @param {string} query - The search query.
 * @returns {Promise<string|null>} A formatted string of search results or null on error.
 */
async function performWebSearch(query) {
    try {
        const searchUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${API_KEYS.SERPAPI}`;
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`);
        const data = await response.json();
        const results = JSON.parse(data.contents);
        return results.organic_results?.slice(0, 3).map(r => `Title: ${r.title}\nSnippet: ${r.snippet}`).join('\n\n');
    } catch (error) {
        console.error("SerpApi search failed:", error);
        return null;
    }
}