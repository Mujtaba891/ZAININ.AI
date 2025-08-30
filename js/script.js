// js/script.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp, collection, query, orderBy, limit, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { generateResponse } from "./apiHandler.js";

// Ensure marked.js is loaded before usage (it's loaded via script tag in HTML)
const marked = window.marked;

// --- Marked.js Custom Renderer for Code Blocks ---
const renderer = new marked.Renderer();
renderer.code = function(code, language) {
  const defaultCodeRendering = marked.Renderer.prototype.code.call(this, code, language);
  const langDisplay = language ? `<span class="code-lang">${escapeHTML(language)}</span>` : '';
  return `
    <div class="code-block-container">
      ${langDisplay}
      <button class="icon-button copy-code-btn" title="Copy code"><i class="fas fa-copy"></i></button>
      ${defaultCodeRendering}
    </div>
  `;
};
marked.setOptions({ breaks: true, renderer: renderer }); // Apply the custom renderer and breaks

// --- Global Variables and DOM Elements ---
const mainApp = document.getElementById('main-app');
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const chatHistoryList = document.getElementById('chat-history-list');
const chatMessagesDiv = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const webSearchToggle = document.getElementById('web-search-toggle');
const chatTitleElement = document.getElementById('chat-title');
const adminPanelLinkContainer = document.getElementById('admin-panel-link-container');

// Image Upload Elements
const imageUploadBtn = document.getElementById('image-upload-btn');
const imageInputFile = document.getElementById('image-input-file');
const imagePreviewArea = document.getElementById('image-preview-area');
const uploadedImagePreview = document.getElementById('uploaded-image-preview');
const clearImageBtn = document.getElementById('clear-image-btn');

// Freemium Elements
const freemiumMessageDisplay = document.getElementById('freemium-message-display');
const upgradeToPremiumSidebarLink = document.getElementById('upgrade-to-premium-sidebar-link'); // New: Sidebar link


let currentUser = null;
let currentChatId = null;
let appSettings = { // Global admin settings & user's web search preference
    openrouterKey: null,
    geminiVisionKey: null,
    serpapiKey: null,
    webSearchEnabled: false, // User's preference
    freemiumEnabled: false,
    freeTierMessageLimit: 10,
    razorpayKeyId: null // New: Razorpay Key ID
};
let userProfile = {
    isAdmin: false,
    isPremium: false
};
let uploadedImageBase64 = null; // Stores Base64 string of the uploaded image
let messageCountForCurrentChat = 0; // Tracks user messages in the current chat for freemium

// --- Authentication State & Initial Load ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log("User logged in:", user.uid);
        userEmailSpan.textContent = user.email || 'User';

        await loadAdminSettings(); // Load global API keys, freemium, razorpay settings
        await loadUserProfile(user.uid); // Load user's admin/premium/web search status
        await loadChatList(user.uid);
        await loadLatestChat(user.uid);

        // Show Admin Panel link if user is admin
        if (userProfile.isAdmin) {
            adminPanelLinkContainer.classList.remove('hidden');
        } else {
            adminPanelLinkContainer.classList.add('hidden');
        }

        document.getElementById('auth-container')?.classList.add('hidden');
        mainApp.classList.remove('hidden');

    } else {
        currentUser = null;
        console.log("No user detected, redirecting to auth.");
        window.location.replace('/auth.html');
    }
});

// --- Firebase Data Loading & Saving ---

/**
 * Loads global admin settings (API keys, freemium config, razorpay key) from Firestore.
 */
async function loadAdminSettings() {
    try {
        const adminSettingsRef = doc(db, 'admin_settings', 'global_settings');
        const docSnap = await getDoc(adminSettingsRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            appSettings.openrouterKey = data.openrouterKey || null;
            appSettings.geminiVisionKey = data.geminiVisionKey || null;
            appSettings.serpapiKey = data.serpapiKey || null;
            appSettings.freemiumEnabled = data.freemiumEnabled || false;
            appSettings.freeTierMessageLimit = data.freeTierMessageLimit || 10;
            appSettings.razorpayKeyId = data.razorpayKeyId || null; // Load Razorpay Key ID
            console.log("Loaded global admin settings:", appSettings);
        } else {
            console.warn("No admin settings document found, using defaults.");
        }
    } catch (error) {
        console.error("Error loading admin settings:", error);
    }
}

/**
 * Loads user-specific profile data (isAdmin, isPremium) and preferences (webSearchEnabled) from Firestore.
 */
async function loadUserProfile(uid) {
    try {
        const profileDocRef = doc(db, 'users', uid, 'profile', 'data');
        const profileSnap = await getDoc(profileDocRef);

        const userSettingsDocRef = doc(db, 'users', uid, 'settings', 'user_preferences');
        const userSettingsSnap = await getDoc(userSettingsDocRef);

        if (profileSnap.exists()) {
            const data = profileSnap.data();
            userProfile.isAdmin = data.isAdmin || false;
            userProfile.isPremium = data.isPremium || false;
            console.log("Loaded user profile:", userProfile);
        } else {
            console.log("No user profile found, assuming default non-admin/non-premium.");
            userProfile.isAdmin = false;
            userProfile.isPremium = false;
            // Create a default profile document if none exists
            await setDoc(profileDocRef, { isAdmin: false, isPremium: false, createdAt: serverTimestamp() }, { merge: true });
        }

        if (userSettingsSnap.exists()) {
            const data = userSettingsSnap.data();
            appSettings.webSearchEnabled = data.webSearchEnabled || false;
        } else {
            console.log("No user preferences found, using default web search disabled.");
            appSettings.webSearchEnabled = false;
            // Create a default user preferences document
            await setDoc(userSettingsDocRef, { webSearchEnabled: false, createdAt: serverTimestamp() }, { merge: true });
        }
        webSearchToggle.checked = appSettings.webSearchEnabled; // Update UI

        // Update sidebar link visibility based on premium status
        if (userProfile.isPremium) {
            upgradeToPremiumSidebarLink?.classList.add('hidden');
        } else {
            upgradeToPremiumSidebarLink?.classList.remove('hidden');
        }

    } catch (error) {
        console.error("Error loading user profile or preferences:", error);
        userProfile = { isAdmin: false, isPremium: false };
        appSettings.webSearchEnabled = false;
        webSearchToggle.checked = false;
    }
}


async function loadChatList(uid) {
    chatHistoryList.innerHTML = '';
    const chatsCollectionRef = collection(db, 'users', uid, 'chats');
    const q = query(chatsCollectionRef, orderBy('updatedAt', 'desc'), limit(20));

    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            const listItem = document.createElement('li');
            listItem.innerHTML = '<span class="muted-text" style="padding:10px;">No history yet.</span>';
            chatHistoryList.appendChild(listItem);
            return;
        }

        querySnapshot.forEach((doc) => {
            const chatData = doc.data();
            const chatId = doc.id;

            const defaultTitle = "New Chat";
            const firstUserMessage = chatData.messages?.find(msg => msg.sender === 'user');
            const chatTitle = chatData.title
                ? chatData.title
                : (firstUserMessage?.text
                    ? firstUserMessage.text.substring(0, 30) + (firstUserMessage.text.length > 30 ? '...' : '')
                    : defaultTitle);


            const listItem = document.createElement('li');
            listItem.setAttribute('data-chat-id', chatId);
            listItem.innerHTML = `
                <a href="#">
                    <i class="fas fa-message" style="margin-right: 8px;"></i> ${escapeHTML(chatTitle)}
                </a>
                <div class="chat-history-item-actions">
                    <button class="icon-button edit-chat-btn" title="Edit Title"><i class="fas fa-edit"></i></button>
                    <button class="icon-button delete-chat-btn" title="Delete Chat"><i class="fas fa-trash"></i></button>
                </div>
            `;

            chatHistoryList.appendChild(listItem);
        });
        console.log("Chat list loaded.");
    } catch (error) {
        console.error("Error loading chat list:", error);
        const listItem = document.createElement('li');
        listItem.innerHTML = '<span class="error-message" style="padding:10px;">Error loading history.</span>';
        chatHistoryList.appendChild(listItem);
    }
}


async function loadChat(uid, chatId) {
    const previousChatId = currentChatId;
    currentChatId = chatId;
    console.log("Loading chat:", chatId);
    const chatDocRef = doc(db, 'users', uid, 'chats', chatId);

    messageInput.disabled = true;
    sendBtn.disabled = true;
    chatMessagesDiv.innerHTML = ''; // Clear existing messages
    chatMessagesDiv.classList.add('loading');
    clearImagePreview(); // Clear any pending image upload

    try {
        const docSnap = await getDoc(chatDocRef);

        let chatTitle = "New Chat";
        let messagesToDisplay = [];
        messageCountForCurrentChat = 0; // Reset message count for freemium

        if (docSnap.exists()) {
            const chatData = docSnap.data();
            messagesToDisplay = chatData.messages || [];
            chatTitle = chatData.title
                ? chatData.title
                : (messagesToDisplay.find(msg => msg.sender === 'user')?.text?.substring(0, 30) + '...' || "Chat");

            messagesToDisplay.forEach((msg, index) => {
                displayMessage(msg.sender, msg.text, msg.imageBase64, false, index); // Pass imageBase64
                if (msg.sender === 'user') {
                    messageCountForCurrentChat++;
                }
            });

        } else {
            console.warn(`Chat document ${chatId} not found during loadChat.`);
            displayMessage('bot', 'Error: Chat not found. Starting a new one...', null, false, 0);
            chatTitle = "Error / New Chat";
        }

        chatTitleElement.textContent = escapeHTML(chatTitle);

        chatHistoryList.querySelectorAll('li a').forEach(link => link.classList.remove('active'));
        const activeLi = chatHistoryList.querySelector(`li[data-chat-id="${chatId}"]`);
        if (activeLi) {
            activeLi.querySelector('a')?.classList.add('active');
        }

        scrollToBottom();
        checkFreemiumStatus(); // Update freemium status after loading chat
        console.log(`Chat ${chatId} loaded with ${messageCountForCurrentChat} user messages.`);
    } catch (error) {
        console.error("Error loading chat history:", error);
        chatMessagesDiv.innerHTML = '';
        displayMessage('bot', 'Error loading chat history.', null, false);
        chatTitleElement.textContent = 'Error Loading Chat';
        currentChatId = previousChatId; // Revert to previous ID on error
    } finally {
        messageInput.disabled = false;
        sendBtn.disabled = false;
        chatMessagesDiv.classList.remove('loading');
        messageInput.focus();
    }
}

async function loadLatestChat(uid) {
    const chatsCollectionRef = collection(db, 'users', uid, 'chats');
    const q = query(chatsCollectionRef, orderBy('updatedAt', 'desc'), limit(1));

    try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const latestChatDoc = querySnapshot.docs[0];
            await loadChat(uid, latestChatDoc.id);
        } else {
            console.log("No chats found, starting a new one.");
            await startNewChat(uid);
        }
    } catch (error) {
        console.error("Error finding latest chat:", error);
        console.log("Starting a new chat as fallback.");
        await startNewChat(uid);
    }
}

async function startNewChat(uid) {
    const newChatDocRef = doc(collection(db, 'users', uid, 'chats'));
    const newChatId = newChatDocRef.id;

    console.log("Starting new chat with ID:", newChatId);

    chatMessagesDiv.innerHTML = '';
    chatTitleElement.textContent = 'Starting New Chat...';
    messageInput.disabled = true;
    sendBtn.disabled = true;
    imageUploadBtn.disabled = true; // Disable image upload initially for new chat loading
    chatMessagesDiv.classList.add('loading');
    clearImagePreview(); // Clear any pending image upload
    messageCountForCurrentChat = 0; // Reset message count for new chat

    try {
        await setDoc(newChatDocRef, {
            messages: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        console.log("New chat document created.");

        await loadChat(uid, newChatId); // Load the newly created chat
        loadChatList(uid); // Update the chat list in the sidebar

        displayMessage('bot', 'Hello! How can I help?', null, false, 0); // Initial welcome message
        messageCountForCurrentChat = 0; // Bot message doesn't count towards limit
        checkFreemiumStatus(); // Update freemium status after new chat

    } catch (error) {
        console.error("Error creating new chat:", error);
        chatMessagesDiv.innerHTML = '';
        displayMessage('bot', 'Could not start a new chat. Please try again.', null, false);
        currentChatId = null;
        chatTitleElement.textContent = 'Error Starting Chat';
    } finally {
        messageInput.disabled = false;
        sendBtn.disabled = false;
        imageUploadBtn.disabled = false; // Re-enable image upload
        chatMessagesDiv.classList.remove('loading');
        messageInput.focus();
    }
}

/**
 * Saves a single message to the current chat session in Firestore.
 * Uses arrayUnion for appending.
 * @param {string} uid - The user's UID.
 * @param {string} chatId - The ID of the chat to save to.
 * @param {object} message - The message object {sender, text, imageBase64?}.
 */
async function saveMessage(uid, chatId, message) {
    if (!chatId) {
        console.warn("Attempted to save message but currentChatId is null.");
        return;
    }
    const chatDocRef = doc(db, 'users', uid, 'chats', chatId);
    try {
        const messageToSave = {
            ...message,
            timestamp: new Date()
        };

        await updateDoc(chatDocRef, {
            messages: arrayUnion(messageToSave),
            updatedAt: serverTimestamp()
        });
        console.log(`Message saved to chat ${chatId}.`);

        loadChatList(uid); // Reload chat list to update order/potentially title

    } catch (error) {
        console.error("Error saving message:", error);
    }
}

/**
 * Edits a message in the current chat session in Firestore.
 * Reads the array, modifies the element, and writes the whole array back.
 * @param {string} uid - The user's UID.
 * @param {string} chatId - The ID of the chat.
 * @param {number} messageIndex - The index of the message in the messages array.
 * @param {string} newText - The new text content for the message.
 * @param {string|null} newImageBase64 - The new image data for the message, or null.
 */
async function editMessageInFirestore(uid, chatId, messageIndex, newText, newImageBase64) {
    if (!chatId || messageIndex === undefined) {
        console.warn("Cannot edit message in Firestore: chat ID or index missing.");
        throw new Error("Internal error: chat ID or message index missing.");
    }
    const chatDocRef = doc(db, 'users', uid, 'chats', chatId);
    try {
        const docSnap = await getDoc(chatDocRef);
        if (!docSnap.exists() || !docSnap.data().messages) {
            console.warn("Chat document or messages array not found for editing.");
            throw new Error("Chat data not found.");
        }

        const messages = docSnap.data().messages;

        if (messageIndex < 0 || messageIndex >= messages.length) {
            console.warn("Message index out of bounds for editing.");
            throw new Error("Invalid message index.");
        }

        const updatedMessages = [...messages];
        if (!updatedMessages[messageIndex]) {
            console.warn("Message object not found at index", messageIndex);
            throw new Error("Message not found at index.");
        }

        updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            text: newText,
            imageBase64: newImageBase64, // Update image
            editedAt: new Date()
        };

        await updateDoc(chatDocRef, {
            messages: updatedMessages,
            updatedAt: serverTimestamp()
        });
        console.log(`Message ${messageIndex} in chat ${chatId} edited in Firestore.`);

    } catch (error) {
        console.error(`Error editing message ${messageIndex} in chat ${chatId} in Firestore:`, error);
        if (error instanceof Error) {
            throw error;
        } else {
            throw new Error(`Firestore edit failed: ${error}`);
        }
    }
}


async function deleteMessagesFromIndex(uid, chatId, startIndex) {
    if (!chatId || startIndex === undefined) {
        console.warn("Cannot delete messages in Firestore: chat ID or start index missing.");
        return;
    }
    const chatDocRef = doc(db, 'users', uid, 'chats', chatId);
    try {
        const docSnap = await getDoc(chatDocRef);
        if (!docSnap.exists() || !docSnap.data().messages) {
            console.warn("Chat document or messages array not found for deletion.");
            return;
        }

        const messages = docSnap.data().messages;

        if (startIndex < 0 || startIndex > messages.length) {
            console.warn("Start index out of bounds for deletion.", startIndex, messages.length);
            return;
        }

        const updatedMessages = messages.slice(0, startIndex);

        await updateDoc(chatDocRef, {
            messages: updatedMessages,
            updatedAt: serverTimestamp()
        });
        console.log(`Messages from index ${startIndex} onwards deleted in chat ${chatId} in Firestore.`);

    } catch (error) {
        console.error(`Error deleting messages from index ${startIndex} in chat ${chatId} in Firestore:`, error);
    }
}

async function editChatTitle(uid, chatId, currentTitle, linkElement) {
    const newTitle = prompt("Edit chat title:", currentTitle);

    if (newTitle !== null) {
        const trimmedTitle = newTitle.trim();
        if (trimmedTitle !== '' && trimmedTitle !== currentTitle) {
            const chatDocRef = doc(db, 'users', uid, 'chats', chatId);
            try {
                await updateDoc(chatDocRef, {
                    title: trimmedTitle,
                    updatedAt: serverTimestamp()
                });
                console.log(`Chat ${chatId} title updated to: ${trimmedTitle}`);

                const icon = linkElement.querySelector('i');
                if (icon) {
                    let node = icon.nextSibling;
                    while (node && node.nodeType !== Node.TEXT_NODE) {
                        node = node.nextSibling;
                    }
                    if (node) {
                        node.textContent = ` ${escapeHTML(trimmedTitle)}`;
                    } else {
                        linkElement.innerHTML = `<i class="fas fa-message"></i> ${escapeHTML(trimmedTitle)}`;
                    }
                } else {
                    linkElement.textContent = escapeHTML(trimmedTitle);
                }

                if (currentChatId === chatId) {
                    chatTitleElement.textContent = escapeHTML(trimmedTitle);
                }

            } catch (error) {
                console.error(`Error editing chat ${chatId} title:`, error);
                alert("Failed to update chat title.");
            }
        } else {
            console.log("Edit chat title unchanged or empty.");
        }
    } else {
        console.log("Edit chat title cancelled by user.");
    }
}

async function deleteChat(uid, chatId, listItem) {
    if (confirm("Are you sure you want to delete this chat? This cannot be undone.")) {
        const chatDocRef = doc(db, 'users', uid, 'chats', chatId);
        try {
            await deleteDoc(chatDocRef);
            console.log(`Chat ${chatId} deleted.`);

            listItem.remove();

            if (currentChatId === chatId) {
                currentChatId = null;
                chatMessagesDiv.innerHTML = '';
                displayMessage('bot', 'Chat deleted. Starting a new one...', null, false);
                chatTitleElement.textContent = 'Chat Deleted';
                await startNewChat(uid);
            } else {
                loadChatList(uid);
            }

        } catch (error) {
            console.error(`Error deleting chat ${chatId}:`, error);
            alert("Failed to delete chat.");
        }
    } else {
        console.log("Chat deletion cancelled.");
    }
}


// --- UI Display Functions ---

/**
 * Displays a message in the chat box.
 * Automatically saves to Firestore if save=true and user/chat are available.
 * @param {'user'|'bot'} sender - The message sender.
 * @param {string} text - The message text (can contain markdown).
 * @param {string|null} imageBase64 - Base64 image data to display, or null.
 * @param {boolean} [save=true] - Whether to save the message to Firestore.
 * @param {number} [messageIndex] - The index of the message in the messages array *when displayed*.
 */
function displayMessage(sender, text, imageBase64 = null, save = true, messageIndex = undefined) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender);
    if (messageIndex !== undefined) {
        messageElement.setAttribute('data-message-index', messageIndex);
    }

    const avatarElement = document.createElement('div');
    avatarElement.classList.add('avatar');
    if (sender === 'bot') {
        avatarElement.innerHTML = '<i class="fas fa-robot"></i>';
    } else if (currentUser && currentUser.photoURL) {
        avatarElement.innerHTML = `<img src="${currentUser.photoURL}" alt="You">`;
    } else {
        avatarElement.innerHTML = '<i class="fas fa-user"></i>';
    }

    const contentElement = document.createElement('div');
    contentElement.classList.add('message-content');

    // Add image if present
    if (imageBase64) {
        const img = document.createElement('img');
        img.src = imageBase64;
        img.alt = sender === 'user' ? 'User uploaded image' : 'AI generated image';
        img.classList.add('chat-image-content');
        contentElement.appendChild(img);
    }

    // Add text content (markdown)
    try {
        contentElement.innerHTML += marked.parse(text); // Append, not overwrite if image is there
    } catch (e) {
        console.error("Error parsing markdown:", e);
        contentElement.innerHTML += `<p>${escapeHTML(text)}</p>`; // Fallback to plain text
    }


    const actionsElement = document.createElement('div');
    actionsElement.classList.add('message-actions', `${sender}-actions`);

    actionsElement.innerHTML += `
        <button class="icon-button copy-btn" title="Copy Message Text"><i class="fas fa-copy"></i></button>
        <button class="icon-button rerun-btn" title="Rerun"><i class="fas fa-redo"></i></button>
    `;

    if (sender === 'user') {
        actionsElement.innerHTML += `
            <button class="icon-button edit-btn" title="Edit Message"><i class="fas fa-edit"></i></button>
        `;
    } else { // sender === 'bot'
        actionsElement.innerHTML += `
            <button class="icon-button like-btn" title="Like Response"><i class="fas fa-thumbs-up"></i></button>
            <button class="icon-button dislike-btn" title="Dislike Response"><i class="fas fa-thumbs-down"></i></button>
        `;
    }

    if (sender === 'user') {
        messageElement.appendChild(contentElement);
        messageElement.appendChild(avatarElement);
        messageElement.appendChild(actionsElement);
    } else { // sender === 'bot'
        messageElement.appendChild(avatarElement);
        messageElement.appendChild(contentElement);
        messageElement.appendChild(actionsElement);
    }

    chatMessagesDiv.appendChild(messageElement);
    scrollToBottom();

    if (save && currentUser && currentChatId) {
        saveMessage(currentUser.uid, currentChatId, { sender, text, imageBase64 });
    } else if (save && currentUser && !currentChatId) {
        console.warn("Message not saved: currentChatId is not set.");
    }
}

function showTypingIndicator() {
    if (chatMessagesDiv.querySelector('.chat-message.bot.typing')) return;

    const typingMessageElement = document.createElement('div');
    typingMessageElement.classList.add('chat-message', 'bot', 'typing');

    const avatarElement = document.createElement('div');
    avatarElement.classList.add('avatar');
    avatarElement.innerHTML = '<i class="fas fa-robot"></i>';

    const contentElement = document.createElement('div');
    contentElement.classList.add('message-content');
    contentElement.innerHTML = '<img src="assets/typing.gif" alt="AI is typing...">';

    typingMessageElement.appendChild(avatarElement);
    typingMessageElement.appendChild(contentElement);

    chatMessagesDiv.appendChild(typingMessageElement);
    scrollToBottom();
}

function removeTypingIndicator() {
    const typingIndicator = chatMessagesDiv.querySelector('.chat-message.bot.typing');
    if (typingIndicator) {
        chatMessagesDiv.removeChild(typingIndicator);
    }
}

function scrollToBottom() {
    setTimeout(() => {
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    }, 50);
}

function adjustTextareaHeight(textarea) {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 150);
    textarea.style.height = newHeight + 'px';
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}


// --- Freemium Logic ---
function checkFreemiumStatus() {
    if (!appSettings.freemiumEnabled || userProfile.isPremium) {
        freemiumMessageDisplay.classList.add('hidden');
        messageInput.disabled = false;
        sendBtn.disabled = false;
        imageUploadBtn.disabled = false;
        // Also ensure web search toggle is enabled if user is premium
        webSearchToggle.disabled = false;
        return true; // User is premium or freemium is disabled
    }

    // If freemium is enabled and user is not premium, check message limits
    if (messageCountForCurrentChat >= appSettings.freeTierMessageLimit) {
        freemiumMessageDisplay.classList.remove('hidden');
        freemiumMessageDisplay.innerHTML = `
            <i class="fas fa-lock"></i> Free limit reached (${appSettings.freeTierMessageLimit} messages).
            <a href="/pricing.html" class="freemium-upgrade-link">Upgrade to Premium</a> for unlimited access!
        `;
        messageInput.disabled = true;
        sendBtn.disabled = true;
        imageUploadBtn.disabled = true;
        webSearchToggle.disabled = true; // Disable web search for free users after limit
        clearImagePreview(); // Clear any pending image upload when input is disabled
        return false; // Limit reached
    } else {
        freemiumMessageDisplay.classList.add('hidden');
        messageInput.disabled = false;
        sendBtn.disabled = false;
        imageUploadBtn.disabled = false;
        // Web search availability based on user's preference for free users within limit
        webSearchToggle.disabled = false; // The toggle is enabled, actual search depends on key + toggle state
        return true; // Within limit
    }
}


// --- Image Upload Logic ---
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5 MB limit for image
            alert('Image size exceeds 5MB limit.');
            clearImagePreview();
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedImageBase64 = e.target.result; // data:image/jpeg;base64,...
            uploadedImagePreview.src = uploadedImageBase64;
            imagePreviewArea.classList.remove('hidden');
            console.log("Image uploaded and preview displayed.");
            messageInput.focus();
        };
        reader.readAsDataURL(file);
    } else {
        clearImagePreview();
    }
}

function clearImagePreview() {
    uploadedImageBase64 = null;
    uploadedImagePreview.src = '#';
    imagePreviewArea.classList.add('hidden');
    imageInputFile.value = ''; // Clear file input
    console.log("Image preview cleared.");
}

// --- Message Action Functions ---

/**
 * Copies the text content to the clipboard.
 * @param {string} text - The text to copy.
 */
async function copyTextToClipboard(text) {
    if (!navigator.clipboard) {
        console.error("Clipboard API not available.");
        alert("Copying is not supported in your browser or context (try HTTPS).");
        return;
    }
    try {
        await navigator.clipboard.writeText(text);
        console.log("Text copied to clipboard.");
    } catch (err) {
        console.error('Failed to copy text: ', err);
        alert(`Failed to copy text: ${err}`);
    }
}


/**
 * Reruns the prompt associated with a user message, deleting subsequent bot messages.
 * If called on a bot message, reruns the *preceding* user message.
 * @param {HTMLElement} messageElement - The message element being rerun in the DOM.
 */
async function rerunMessage(messageElement) {
    if (!currentUser || !currentChatId) {
        console.warn("Cannot rerun message: User not logged in or no chat ID.");
        displayMessage('bot', 'Please log in or start a new chat to rerun messages.', null, false);
        return;
    }

    const sender = messageElement.classList.contains('user') ? 'user' : 'bot';
    const messageIndexInDom = parseInt(messageElement.getAttribute('data-message-index'));

    if (isNaN(messageIndexInDom)) {
        console.error("Cannot rerun: Message element missing valid data-message-index.");
        displayMessage('bot', 'Cannot rerun this message (index missing).', null, false);
        return;
    }

    let userMessageTextToRerun = null;
    let userMessageImageToRerun = null;
    let firestoreStartIndexToDelete = -1;

    const chatDocSnap = await getDoc(doc(db, 'users', currentUser.uid, 'chats', currentChatId));
    const messagesFromFirestore = chatDocSnap.exists() ? (chatDocSnap.data().messages || []) : [];

    const targetMessage = messagesFromFirestore[messageIndexInDom];

    if (!targetMessage) {
        console.error("Cannot rerun: Message not found in Firestore data at DOM index", messageIndexInDom);
        displayMessage('bot', 'Cannot rerun this message (data mismatch).', null, false);
        return;
    }

    if (sender === 'user') {
        userMessageTextToRerun = targetMessage.text;
        userMessageImageToRerun = targetMessage.imageBase64 || null;
        firestoreStartIndexToDelete = messageIndexInDom + 1;
    } else { // sender === 'bot'
        let precedingUserMessage = null;
        let precedingUserMessageIndexInFirestore = -1;
        for (let i = messageIndexInDom - 1; i >= 0; i--) {
            if (messagesFromFirestore[i]?.sender === 'user') {
                precedingUserMessage = messagesFromFirestore[i];
                precedingUserMessageIndexInFirestore = i;
                break;
            }
        }

        if (!precedingUserMessage) {
            console.warn("Cannot rerun bot message: No preceding user message found in Firestore history.");
            displayMessage('bot', 'Cannot rerun this bot message as no preceding user message was found in history.', null, false);
            return;
        }

        userMessageTextToRerun = precedingUserMessage.text;
        userMessageImageToRerun = precedingUserMessage.imageBase64 || null;
        firestoreStartIndexToDelete = precedingUserMessageIndexInFirestore + 1;
    }

    if (!userMessageTextToRerun && !userMessageImageToRerun) {
        console.warn("Could not retrieve message text or image for rerun from Firestore data.");
        displayMessage('bot', 'Could not retrieve the original message to rerun.', null, false);
        return;
    }

    console.log(`Rerunning based on DOM index ${messageIndexInDom} (sender: ${sender}). Deleting from Firestore index ${firestoreStartIndexToDelete}.`);

    await deleteMessagesFromIndex(currentUser.uid, currentChatId, firestoreStartIndexToDelete);
    await loadChat(currentUser.uid, currentChatId);

    await handleSendMessage(userMessageTextToRerun, userMessageImageToRerun);
}

/**
 * Initiates the editing process for a user message.
 * @param {HTMLElement} messageElement - The user message element to edit in the DOM.
 */
async function editMessage(messageElement) {
    if (!currentUser || !currentChatId) {
        console.warn("Cannot edit message: User not logged in or no chat ID.");
        displayMessage('bot', 'Please log in to edit messages.', null, false);
        return;
    }

    const messageIndexInDom = parseInt(messageElement.getAttribute('data-message-index'));
    const contentDiv = messageElement.querySelector('.message-content');
    const actionsDiv = messageElement.querySelector('.message-actions');
    const chatImage = contentDiv.querySelector('.chat-image-content');

    if (isNaN(messageIndexInDom) || !contentDiv || !actionsDiv) {
        console.error("Cannot edit: Message element missing index, content div, or actions div.");
        displayMessage('bot', 'Cannot edit this message.', null, false);
        return;
    }

    const chatDocSnap = await getDoc(doc(db, 'users', currentUser.uid, 'chats', currentChatId));
    const messagesFromFirestore = chatDocSnap.exists() ? (chatDocSnap.data().messages || []) : [];
    const originalMessage = messagesFromFirestore[messageIndexInDom];

    if (!originalMessage || originalMessage.sender !== 'user') {
        console.error("Cannot edit: Original message not found in Firestore or is not a user message.", originalMessage);
        displayMessage('bot', 'Cannot edit this message (data mismatch or not a user message).', null, false);
        return;
    }

    const originalText = originalMessage.text || '';
    const originalImageBase64 = originalMessage.imageBase64 || null;

    contentDiv.style.display = 'none';
    actionsDiv.style.display = 'none';

    if (messageElement.querySelector('.message-edit-area')) {
        console.warn("Edit area already exists for this message.");
        return;
    }

    const editArea = document.createElement('div');
    editArea.classList.add('message-edit-area');
    editArea.style.width = '100%';

    // Image preview in edit mode
    const editImagePreviewArea = document.createElement('div');
    editImagePreviewArea.classList.add('image-preview-area', 'edit-mode');
    if (!originalImageBase64) {
        editImagePreviewArea.classList.add('hidden');
    }
    editImagePreviewArea.innerHTML = `
        <img src="${originalImageBase64 || '#'}" alt="Image Preview" class="uploaded-image-preview">
        <button class="icon-button clear-image-btn" title="Clear Image"><i class="fas fa-times"></i></button>
    `;
    editArea.appendChild(editImagePreviewArea);

    const editImageInputFile = document.createElement('input');
    editImageInputFile.type = 'file';
    editImageInputFile.accept = 'image/*';
    editImageInputFile.classList.add('hidden');
    editArea.appendChild(editImageInputFile);

    const editImageUploadBtn = document.createElement('button');
    editImageUploadBtn.classList.add('icon-button', 'upload-button-in-edit');
    editImageUploadBtn.innerHTML = '<i class="fas fa-image"></i> Change Image';
    editArea.appendChild(editImageUploadBtn);

    let currentEditedImageBase64 = originalImageBase64;

    editImageUploadBtn.addEventListener('click', () => editImageInputFile.click());
    editImageInputFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('Image size exceeds 5MB limit.');
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                currentEditedImageBase64 = ev.target.result;
                editImagePreviewArea.querySelector('img').src = currentEditedImageBase64;
                editImagePreviewArea.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });
    editImagePreviewArea.querySelector('.clear-image-btn').addEventListener('click', () => {
        currentEditedImageBase64 = null;
        editImagePreviewArea.querySelector('img').src = '#';
        editImagePreviewArea.classList.add('hidden');
        editImageInputFile.value = '';
    });


    const textarea = document.createElement('textarea');
    textarea.value = originalText;
    textarea.style.width = '100%';
    textarea.style.boxSizing = 'border-box';
    textarea.style.minHeight = '50px';
    textarea.style.marginBottom = '10px';
    textarea.style.resize = 'vertical';
    textarea.style.backgroundColor = 'var(--input-bg)';
    textarea.style.color = 'var(--text-color)';
    textarea.style.border = '1px solid var(--border-color)';
    textarea.style.borderRadius = '8px';
    textarea.style.padding = '10px';
    textarea.style.fontSize = '1em';
    textarea.style.fontFamily = 'Poppins, sans-serif';
    textarea.style.outline = 'none';
    textarea.style.lineHeight = '1.6';

    textarea.addEventListener('input', () => adjustTextareaHeight(textarea));
    adjustTextareaHeight(textarea);


    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.marginRight = '10px';
    saveBtn.style.padding = '8px 15px';
    saveBtn.style.fontSize = '0.9em';
    saveBtn.style.background = 'var(--button-bg)';
    saveBtn.style.color = 'var(--button-color)';


    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.padding = '8px 15px';
    cancelBtn.style.fontSize = '0.9em';


    editArea.appendChild(textarea);
    const buttonRow = document.createElement('div');
    buttonRow.style.display = 'flex';
    buttonRow.style.justifyContent = 'flex-end';
    buttonRow.style.gap = '10px';
    buttonRow.appendChild(saveBtn);
    buttonRow.appendChild(cancelBtn);
    editArea.appendChild(buttonRow);

    const avatarOrActions = messageElement.querySelector('.avatar') || actionsDiv;
    messageElement.insertBefore(editArea, avatarOrActions);

    textarea.focus();
    textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });


    saveBtn.addEventListener('click', async () => {
        const newText = textarea.value.trim();
        const newImage = currentEditedImageBase64;

        if (newText === originalText && newImage === originalImageBase64) {
            console.log("Edit cancelled: no change.");
            cancelEditing();
            return;
        }
        if (newText === '' && !newImage) {
             console.log("Edit cancelled: message became empty.");
             cancelEditing();
             return;
        }

        saveBtn.disabled = true;
        cancelBtn.disabled = true;

        try {
            await editMessageInFirestore(currentUser.uid, currentChatId, messageIndexInDom, newText, newImage);

            editArea.remove();

            contentDiv.innerHTML = '';
            if (newImage) {
                const img = document.createElement('img');
                img.src = newImage;
                img.alt = 'User uploaded image';
                img.classList.add('chat-image-content');
                contentDiv.appendChild(img);
            }
            contentDiv.innerHTML += marked.parse(newText);
            contentDiv.style.display = '';

            actionsDiv.style.display = 'flex';

            console.log("Message edited and saved.");

            rerunMessage(messageElement);

        } catch (error) {
            console.error("Error saving edited message:", error);
            displayMessage('bot', `Failed to save edited message: ${error.message}`, null, false);
            saveBtn.disabled = false;
            cancelBtn.disabled = false;
            cancelEditing();
        }
    });

    cancelBtn.addEventListener('click', cancelEditing);

    function cancelEditing() {
        editArea.remove();
        contentDiv.style.display = '';
        actionsDiv.style.display = 'flex';
        console.log("Editing cancelled.");
    }
}


// --- Placeholder Action Functions (Like/Dislike) ---
function handleLike(messageElement) {
    console.log("Liked message with index:", messageElement.getAttribute('data-message-index'));
    const likeBtn = messageElement.querySelector('.like-btn');
    const dislikeBtn = messageElement.querySelector('.dislike-btn');

    const isLiked = likeBtn.classList.toggle('liked');
    dislikeBtn.classList.remove('disliked');

    const messageIndexInDom = parseInt(messageElement.getAttribute('data-message-index'));
    if (!isNaN(messageIndexInDom) && currentUser && currentChatId) {
        console.log(`Saving like status ${isLiked ? 'liked' : 'none'} for message ${messageIndexInDom}`);
        // TODO: Implement updateMessageFeedback(currentUser.uid, currentChatId, messageIndexInDom, isLiked ? 'liked' : null);
    } else {
        console.warn("Cannot save like status: data missing.");
    }
}

function handleDislike(messageElement) {
    console.log("Disliked message with index:", messageElement.getAttribute('data-message-index'));
    const likeBtn = messageElement.querySelector('.like-btn');
    const dislikeBtn = messageElement.querySelector('.dislike-btn');

    const isDisliked = dislikeBtn.classList.toggle('disliked');
    likeBtn.classList.remove('liked');

    const messageIndexInDom = parseInt(messageElement.getAttribute('data-message-index'));
    if (!isNaN(messageIndexInDom) && currentUser && currentChatId) {
        console.log(`Saving dislike status ${isDisliked ? 'disliked' : 'none'} for message ${messageIndexInDom}`);
        // TODO: Implement updateMessageFeedback(currentUser.uid, currentChatId, messageIndexInDom, isDisliked ? 'disliked' : null);
    } else {
        console.warn("Cannot save dislike status: data missing.");
    }
}

// --- Event Listeners ---

// Sidebar Toggle
sidebarToggleBtn.addEventListener('click', () => {
    sidebar.classList.add('active');
    mainApp.classList.add('sidebar-active');
    sidebarToggleBtn.setAttribute('aria-expanded', 'true');
});
sidebarCloseBtn.addEventListener('click', () => {
    sidebar.classList.remove('active');
    mainApp.classList.remove('sidebar-active');
    sidebarToggleBtn.setAttribute('aria-expanded', 'false');
});
mainApp.addEventListener('click', (e) => {
    if (sidebar.classList.contains('active') &&
        !sidebar.contains(e.target) &&
        !sidebarToggleBtn.contains(e.target)) {
        sidebar.classList.remove('active');
        mainApp.classList.remove('sidebar-active');
        sidebarToggleBtn.setAttribute('aria-expanded', 'false');
    }
});

// New Chat Button
newChatBtn.addEventListener('click', () => {
    if (currentUser) {
        startNewChat(currentUser.uid);
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('active');
            mainApp.classList.remove('sidebar-active');
            sidebarToggleBtn.setAttribute('aria-expanded', 'false');
        }
    } else {
        console.warn("Cannot start new chat, user not logged in.");
    }
});

// Add Event delegation for chat history list items (click on link and action buttons)
chatHistoryList.addEventListener('click', (e) => {
    const target = e.target;

    const chatLink = target.closest('li a');
    if (chatLink) {
        e.preventDefault();
        const listItem = chatLink.closest('li');
        const clickedChatId = listItem?.getAttribute('data-chat-id');
        if (clickedChatId && clickedChatId !== currentChatId && currentUser) {
            loadChat(currentUser.uid, clickedChatId);
        } else if (!currentUser) {
            console.warn("User not logged in, cannot load chat.");
        }
        return;
    }

    const actionBtn = target.closest('.chat-history-item-actions .icon-button');
    if (actionBtn) {
        e.stopPropagation();
        const listItem = actionBtn.closest('li');
        const chatId = listItem?.getAttribute('data-chat-id');
        if (!chatId || !currentUser) {
            console.warn("Cannot perform chat action: Chat ID or user missing.");
            return;
        }

        if (actionBtn.classList.contains('edit-chat-btn')) {
            const currentTitle = listItem.querySelector('a')?.textContent?.replace('💬 ', '').trim() || '';
            editChatTitle(currentUser.uid, chatId, currentTitle, listItem.querySelector('a'));
        } else if (actionBtn.classList.contains('delete-chat-btn')) {
            deleteChat(currentUser.uid, chatId, listItem);
        }
    }
});


// Send Message Button & Enter Key
async function handleSendMessage(text, image = null) {
    const messageText = text ? text.trim() : '';
    const messageImage = image || uploadedImageBase64;

    if (!messageText && !messageImage) return;

    if (!currentUser || !currentChatId) {
        console.warn("Cannot send message: User not logged in or no chat ID set.");
        displayMessage('bot', 'Please log in or start a new chat to send messages.', null, false);
        return;
    }

    if (!checkFreemiumStatus()) {
        return;
    }

    messageCountForCurrentChat++;

    const chatDocSnapBeforeUserMsg = await getDoc(doc(db, 'users', currentUser.uid, 'chats', currentChatId));
    const currentMessagesCount = chatDocSnapBeforeUserMsg.exists() ? (chatDocSnapBeforeUserMsg.data().messages || []).length : 0;

    displayMessage('user', messageText, messageImage, true, currentMessagesCount);

    messageInput.disabled = true;
    sendBtn.disabled = true;
    imageUploadBtn.disabled = true;
    webSearchToggle.disabled = true; // Disable web search toggle while bot is thinking
    showTypingIndicator();
    clearImagePreview();

    try {
        const updatedChatDocSnap = await getDoc(doc(db, 'users', currentUser.uid, 'chats', currentChatId));
        const messagesForContext = (updatedChatDocSnap.exists() ? updatedChatDocSnap.data().messages : [])
            .map(msg => ({ sender: msg.sender, text: msg.text, imageBase64: msg.imageBase64 || null }));

        const botResponse = await generateResponse(messageText, appSettings, messagesForContext, messageImage);


        removeTypingIndicator();

        const finalChatDocSnap = await getDoc(doc(db, 'users', currentUser.uid, 'chats', currentChatId));
        const messagesCountBeforeBotMsg = finalChatDocSnap.exists() ? (finalChatDocSnap.data().messages || []).length : currentMessagesCount + 1;

        displayMessage('bot', botResponse, null, true, messagesCountBeforeBotMsg);

    } catch (error) {
        console.error("Error getting bot response:", error);
        removeTypingIndicator();
        messageCountForCurrentChat--;
        const errorChatDocSnap = await getDoc(doc(db, 'users', currentUser.uid, 'chats', currentChatId));
        const messagesCountBeforeErrorMsg = errorChatDocSnap.exists() ? (errorChatDocSnap.data().messages || []).length : currentMessagesCount + 1;

        displayMessage('bot', `Error: ${error.message}`, null, true, messagesCountBeforeErrorMsg);
    } finally {
        messageInput.disabled = false;
        sendBtn.disabled = false;
        imageUploadBtn.disabled = false;
        // Re-enable web search toggle based on freemium/premium status
        webSearchToggle.disabled = (appSettings.freemiumEnabled && !userProfile.isPremium && messageCountForCurrentChat >= appSettings.freeTierMessageLimit);
        messageInput.focus();
        checkFreemiumStatus();
    }
}

sendBtn.addEventListener('click', () => {
    handleSendMessage(messageInput.value);
    messageInput.value = '';
    adjustTextareaHeight(messageInput);
});

messageInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage(messageInput.value);
        messageInput.value = '';
        adjustTextareaHeight(this);
    }
});

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    adjustTextareaHeight(this);
});


// Global Event Listener for Message Actions
chatMessagesDiv.addEventListener('click', (e) => {
    const target = e.target;
    const targetBtn = target.closest('.icon-button');

    if (!targetBtn) return;

    if (targetBtn.classList.contains('copy-code-btn')) {
        const codeBlockContainer = targetBtn.closest('.code-block-container');
        const codeElement = codeBlockContainer?.querySelector('pre code');

        if (codeElement && codeElement.textContent) {
            copyTextToClipboard(codeElement.textContent);
        } else {
            console.warn("Code element not found for copy action.");
        }
        e.stopPropagation();
        return;
    }

    const messageElement = targetBtn.closest('.chat-message');
    if (!messageElement) return;

    if (targetBtn.classList.contains('copy-btn')) {
        const messageTextToCopy = messageElement.querySelector('.message-content')?.textContent || '';
        if (messageTextToCopy) {
            copyTextToClipboard(messageTextToCopy);
        } else {
            console.warn("Message content not found for copy action.");
        }
    } else if (targetBtn.classList.contains('rerun-btn')) {
        rerunMessage(messageElement);
    } else if (messageElement.classList.contains('user') && targetBtn.classList.contains('edit-btn')) {
        editMessage(messageElement);
    } else if (messageElement.classList.contains('bot') && targetBtn.classList.contains('like-btn')) {
        handleLike(messageElement);
    } else if (messageElement.classList.contains('bot') && targetBtn.classList.contains('dislike-btn')) {
        handleDislike(messageElement);
    }
});


// Web Search Toggle - Save setting on change
webSearchToggle.addEventListener('change', async () => {
    if (!currentUser) { console.warn("User not logged in, cannot save setting."); webSearchToggle.checked = !webSearchToggle.checked; return; }
    const isEnabled = webSearchToggle.checked;
    appSettings.webSearchEnabled = isEnabled;
    try {
        const userSettingsDocRef = doc(db, 'users', currentUser.uid, 'settings', 'user_preferences');
        await setDoc(userSettingsDocRef, { webSearchEnabled: isEnabled }, { merge: true });
        console.log("User web search setting saved:", isEnabled);
    } catch (error) {
        console.error("Error saving web search setting:", error);
        alert("Failed to save web search setting.");
        webSearchToggle.checked = !isEnabled;
        appSettings.webSearchEnabled = !isEnabled;
    }
});

// Image Upload Button and Input File
imageUploadBtn.addEventListener('click', () => {
    imageInputFile.click();
});
imageInputFile.addEventListener('change', handleImageUpload);
clearImageBtn.addEventListener('click', clearImagePreview);


// Handle Logout
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.replace('/auth.html');
    } catch (error) {
        console.error("Logout error:", error);
        alert("Error logging out. Please try again.");
    }
});

// Set initial textarea height on load
adjustTextareaHeight(messageInput);

// Initial focus on message input
setTimeout(() => {
    if (messageInput && mainApp.classList.contains('hidden') === false) {
        messageInput.focus();
    }
}, 100);

// Initial freemium status check
checkFreemiumStatus();