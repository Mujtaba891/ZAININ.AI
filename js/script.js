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

let currentUser = null;
let currentChatId = null;
let userSettings = { openrouter: null, serpapi: null, webSearchEnabled: false };

// --- Authentication State & Initial Load ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log("User logged in:", user.uid);
        userEmailSpan.textContent = user.email || 'User';

        await loadUserSettings(user.uid);
        await loadChatList(user.uid);
        await loadLatestChat(user.uid);

         document.getElementById('auth-container')?.classList.add('hidden');
         mainApp.classList.remove('hidden');


    } else {
        currentUser = null;
        console.log("No user detected, redirecting to auth.");
        window.location.replace('/auth.html');
    }
});

// --- Firebase Data Loading & Saving ---

async function loadUserSettings(uid) {
    try {
        const settingsDocRef = doc(db, 'users', uid, 'settings', 'apikeys');
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            userSettings.openrouter = data.openrouter || null;
            userSettings.serpapi = data.serpapi || null;
            userSettings.webSearchEnabled = data.webSearchEnabled || false;

            webSearchToggle.checked = userSettings.webSearchEnabled;

            console.log("Loaded user settings:", userSettings);
        } else {
             console.log("No user settings found, using defaults.");
             webSearchToggle.checked = userSettings.webSearchEnabled;
        }
    } catch (error) {
        console.error("Error loading user settings:", error);
        userSettings = { openrouter: null, serpapi: null, webSearchEnabled: false };
        webSearchToggle.checked = userSettings.webSearchEnabled;
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

             // Use dedicated 'title' field if it exists, otherwise use first user message
            const defaultTitle = "New Chat";
             // Find the first user message text
             const firstUserMessage = chatData.messages?.find(msg => msg.sender === 'user');
             const chatTitle = chatData.title // Prioritize saved title
                               ? chatData.title
                               : (firstUserMessage?.text
                                   ? firstUserMessage.text.substring(0, 30) + (firstUserMessage.text.length > 30 ? '...' : '')
                                   : defaultTitle);


            const listItem = document.createElement('li');
            listItem.setAttribute('data-chat-id', chatId); // Set chat ID as data attribute
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

            // Add event listeners using delegation at the list level (more efficient)
            // Handled below the function definitions


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

    // Disable input/send while loading
    messageInput.disabled = true;
    sendBtn.disabled = true;
    chatMessagesDiv.innerHTML = ''; // Clear existing messages
     chatMessagesDiv.classList.add('loading'); // Optional: Add loading class for visual feedback


    try {
        const docSnap = await getDoc(chatDocRef);

        let chatTitle = "New Chat";
        let messagesToDisplay = [];

        if (docSnap.exists()) {
            const chatData = docSnap.data();
            messagesToDisplay = chatData.messages || [];
             chatTitle = chatData.title // Use saved title if available
                         ? chatData.title
                         : (messagesToDisplay.find(msg => msg.sender === 'user')?.text?.substring(0, 30) + '...' || "Chat");


            // Re-render messages with updated indices from loaded data
            messagesToDisplay.forEach((msg, index) => {
                displayMessage(msg.sender, msg.text, false, index); // Pass index from Firestore array
            });

        } else {
             console.warn(`Chat document ${chatId} not found during loadChat.`);
             displayMessage('bot', 'Error: Chat not found. Starting a new one...', false, 0);
             chatTitle = "Error / New Chat";
        }

         chatTitleElement.textContent = escapeHTML(chatTitle);

         // Highlight active chat in sidebar
         chatHistoryList.querySelectorAll('li a').forEach(link => link.classList.remove('active'));
         const activeLi = chatHistoryList.querySelector(`li[data-chat-id="${chatId}"]`);
         if (activeLi) {
             activeLi.querySelector('a')?.classList.add('active');
         }

        scrollToBottom();
        console.log(`Chat ${chatId} loaded.`);
    } catch (error) {
        console.error("Error loading chat history:", error);
        chatMessagesDiv.innerHTML = '';
        displayMessage('bot', 'Error loading chat history.', false);
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
     chatMessagesDiv.classList.add('loading');


    try {
         await setDoc(newChatDocRef, {
             messages: [], // Start with an empty array
             createdAt: serverTimestamp(), // OK at top level
             updatedAt: serverTimestamp() // OK at top level
         });
         console.log("New chat document created.");

         await loadChat(uid, newChatId); // Load the newly created chat

         loadChatList(uid); // Update the chat list in the sidebar

    } catch (error) {
         console.error("Error creating new chat:", error);
         chatMessagesDiv.innerHTML = '';
         displayMessage('bot', 'Could not start a new chat. Please try again.', false);
         currentChatId = null;
         chatTitleElement.textContent = 'Error Starting Chat';
    } finally {
         messageInput.disabled = false;
         sendBtn.disabled = false;
         chatMessagesDiv.classList.remove('loading');
         messageInput.focus();
    }
}

/**
 * Saves a single message to the current chat session in Firestore.
 * Uses arrayUnion for appending.
 * @param {string} uid - The user's UID.
 * @param {string} chatId - The ID of the chat to save to.
 * @param {object} message - The message object {sender, text}.
 */
async function saveMessage(uid, chatId, message) {
    if (!chatId) {
         console.warn("Attempted to save message but currentChatId is null.");
         return;
    }
    const chatDocRef = doc(db, 'users', uid, 'chats', chatId);
    try {
        // Create a new message object with client-side timestamp
        const messageToSave = {
            ...message,
            timestamp: new Date() // Use client-side timestamp for array elements
        };

        // Use arrayUnion for appending and update top-level timestamp
        await updateDoc(chatDocRef, {
            messages: arrayUnion(messageToSave),
            updatedAt: serverTimestamp() // OK at top level
        });
         console.log(`Message saved to chat ${chatId}.`);

         // Reload chat list to update order/potentially title (especially after first user message)
          loadChatList(uid);


    } catch (error) {
         console.error("Error saving message:", error);
         // Optional: Inform user message wasn't saved
    }
}

 /**
  * Edits a message in the current chat session in Firestore.
  * Reads the array, modifies the element, and writes the whole array back.
  * @param {string} uid - The user's UID.
  * @param {string} chatId - The ID of the chat.
  * @param {number} messageIndex - The index of the message in the messages array.
  * @param {string} newText - The new text content for the message.
  */
 async function editMessageInFirestore(uid, chatId, messageIndex, newText) {
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

         // Create a shallow copy of the array and the message object
         const updatedMessages = [...messages];
         // Ensure the message at index exists before trying to update
         if (!updatedMessages[messageIndex]) {
             console.warn("Message object not found at index", messageIndex);
              throw new Error("Message not found at index.");
         }
         // FIX: Use client-side timestamp for editedAt within the array element
         updatedMessages[messageIndex] = { ...updatedMessages[messageIndex], text: newText, editedAt: new Date() };


         // Update the document with the modified array and update top-level timestamp
         // FIX: Use serverTimestamp() at the top level
         await updateDoc(chatDocRef, {
             messages: updatedMessages,
             updatedAt: serverTimestamp() // OK at top level
         });
         console.log(`Message ${messageIndex} in chat ${chatId} edited in Firestore.`);

     } catch (error) {
          console.error(`Error editing message ${messageIndex} in chat ${chatId} in Firestore:`, error);
          // Re-throw the original error message if it's an Error object, otherwise wrap it.
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
         return; // Or throw error if strictness is needed
     }
     const chatDocRef = doc(db, 'users', uid, 'chats', chatId);
      try {
         const docSnap = await getDoc(chatDocRef);
         if (!docSnap.exists() || !docSnap.data().messages) {
             console.warn("Chat document or messages array not found for deletion.");
             return; // Or throw error
         }

         const messages = docSnap.data().messages;

         if (startIndex < 0 || startIndex > messages.length) {
             console.warn("Start index out of bounds for deletion.", startIndex, messages.length);
             return; // Or throw error
         }

         // Create a new array with messages from the start index removed
         const updatedMessages = messages.slice(0, startIndex);

          // Update the document with the modified array and update top-level timestamp
         await updateDoc(chatDocRef, {
             messages: updatedMessages,
             updatedAt: serverTimestamp() // OK at top level
         });
         console.log(`Messages from index ${startIndex} onwards deleted in chat ${chatId} in Firestore.`);

     } catch (error) {
          console.error(`Error deleting messages from index ${startIndex} in chat ${chatId} in Firestore:`, error);
          // Decide how to handle this error. For rerun, silent failure might be okay,
          // but better to log and potentially inform the user.
     }
 }

 async function editChatTitle(uid, chatId, currentTitle, linkElement) {
     // Use prompt for simplicity. A modal would be better UX.
     const newTitle = prompt("Edit chat title:", currentTitle);

     if (newTitle !== null) { // User didn't click cancel
        const trimmedTitle = newTitle.trim();
        if (trimmedTitle !== '' && trimmedTitle !== currentTitle) {
            const chatDocRef = doc(db, 'users', uid, 'chats', chatId);
            try {
                 await updateDoc(chatDocRef, {
                     title: trimmedTitle, // Add a dedicated title field
                     updatedAt: serverTimestamp()
                 });
                 console.log(`Chat ${chatId} title updated to: ${trimmedTitle}`);

                  // Update the sidebar link text immediately
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

                 // If the edited chat is the current one, also update the chat header title
                 if (currentChatId === chatId) {
                      chatTitleElement.textContent = escapeHTML(trimmedTitle);
                 }


            } catch (error) {
                console.error(`Error editing chat ${chatId} title:`, error);
                alert("Failed to update chat title.");
            }
        } else {
            console.log("Edit chat title unchanged or empty.");
             // Handle case where title is deliberately cleared?
             // If you want clearing the prompt to remove the title:
             if (trimmedTitle === '' && chatData?.title) { // Check if it had a saved title (need chatData here)
                 // Requires Firestore deleteField
                 // updateDoc(chatDocRef, { title: deleteField() });
                 console.log("Logic to remove chat title on empty input needed.");
             }
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

            listItem.remove(); // Remove the item from the sidebar list

            // If the deleted chat was the currently active one, load a new one
            if (currentChatId === chatId) {
                 currentChatId = null; // Clear the current chat ID
                 chatMessagesDiv.innerHTML = '';
                 displayMessage('bot', 'Chat deleted. Starting a new one...', false);
                 chatTitleElement.textContent = 'Chat Deleted';
                 await startNewChat(uid); // Start a new chat
            } else {
                 loadChatList(uid); // Reload list to update order/items
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
 * @param {boolean} [save=true] - Whether to save the message to Firestore.
 * @param {number} [messageIndex] - The index of the message in the messages array *when displayed*.
 *                                  Used for setting data-message-index attribute. Firestore index
 *                                  might differ slightly depending on save timing.
 */
function displayMessage(sender, text, save = true, messageIndex = undefined) {
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

    // Use marked.js with the custom renderer for code blocks
    try {
         // Use DOMPurify if available (recommended for untrusted AI output)
         // const cleanHtml = DOMPurify.sanitize(marked.parse(text));
         // contentElement.innerHTML = cleanHtml;

         // Without DOMPurify (less safe for untrusted AI output):
         contentElement.innerHTML = marked.parse(text);

    } catch (e) {
         console.error("Error parsing markdown:", e);
         contentElement.textContent = text; // Fallback to plain text
    }


    const actionsElement = document.createElement('div');
    actionsElement.classList.add('message-actions', `${sender}-actions`);

    // Common actions: Copy, Rerun
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
         // TODO: Add visual state/classes for liked/disliked if saved in Firestore
         // You would need to load the feedback status from Firestore when loading the chat
         // and apply the 'liked' or 'disliked' class here to the buttons.
         // Example: if (msg.feedback === 'liked') { actionsElement.querySelector('.like-btn').classList.add('liked'); }
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
    // Scroll to bottom after adding the message, with a slight delay
    scrollToBottom();

    // Save the message to Firestore if needed
    if (save && currentUser && currentChatId) {
        // Note: timestamp is added when saving to Firestore inside saveMessage
        saveMessage(currentUser.uid, currentChatId, { sender, text });
        // messageIndex is NOT passed to saveMessage because arrayUnion handles appending
    } else if (save && currentUser && !currentChatId) {
         console.warn("Message not saved: currentChatId is not set.");
    }
}

function showTypingIndicator() {
    // Only add if not already present and it's the last message
    if (chatMessagesDiv.querySelector('.chat-message.bot.typing')) return;

     // Optional: Check if the last message is already a bot message before adding typing
     // const lastMessage = chatMessagesDiv.lastElementChild;
     // if (lastMessage && lastMessage.classList.contains('bot') && !lastMessage.classList.contains('typing')) {
     //    // Do nothing or replace? For now, just append.
     // }


    const typingMessageElement = document.createElement('div');
    typingMessageElement.classList.add('chat-message', 'bot', 'typing');

    // Add a simplified avatar for the typing indicator if desired, or hide it with CSS
    const avatarElement = document.createElement('div');
    avatarElement.classList.add('avatar');
    avatarElement.innerHTML = '<i class="fas fa-robot"></i>'; // Bot icon for typing


    const contentElement = document.createElement('div');
    contentElement.classList.add('message-content');
    contentElement.innerHTML = '<img src="assets/typing.gif" alt="AI is typing...">';

    typingMessageElement.appendChild(avatarElement); // Append avatar
    typingMessageElement.appendChild(contentElement); // Content always needed

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
    // Use a slight delay to ensure DOM updates complete before scrolling
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
        // Optional: Show a brief "Copied!" message near the button/message
        // Example: You could add a temporary span next to the button or message bubble
    } catch (err) {
        console.error('Failed to copy text: ', err);
        alert(`Failed to copy text: ${err}`); // Inform user about failure
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
        displayMessage('bot', 'Please log in or start a new chat to rerun messages.', false);
        return;
    }

    const sender = messageElement.classList.contains('user') ? 'user' : 'bot';
    // The data-message-index reflects the position in the DOM *when loaded*.
    // We need to use this index to find the correct message in the Firestore array.
    const messageIndexInDom = parseInt(messageElement.getAttribute('data-message-index'));

    if (isNaN(messageIndexInDom)) {
         console.error("Cannot rerun: Message element missing valid data-message-index.");
         displayMessage('bot', 'Cannot rerun this message (index missing).', false);
         return;
    }

    let userMessageTextToRerun = null;
    let firestoreStartIndexToDelete = -1; // The index in the Firestore array from which to start deleting


    // Get the messages array directly from Firestore for accurate state and indexing
    const chatDocSnap = await getDoc(doc(db, 'users', currentUser.uid, 'chats', currentChatId));
    const messagesFromFirestore = chatDocSnap.exists() ? (chatDocSnap.data().messages || []) : [];

    // Find the correct message index in the Firestore array corresponding to the DOM index
    // This assumes the order in the DOM matches the order in Firestore after a load.
    // We can find the message object based on index.
    const targetMessage = messagesFromFirestore[messageIndexInDom];

     if (!targetMessage) {
         console.error("Cannot rerun: Message not found in Firestore data at DOM index", messageIndexInDom);
          displayMessage('bot', 'Cannot rerun this message (data mismatch).', false);
          return;
     }


     if (sender === 'user') {
         // Rerunning a user message: Use its text, delete from the *next* message index in Firestore onwards
         userMessageTextToRerun = targetMessage.text;
         firestoreStartIndexToDelete = messageIndexInDom + 1; // Index in Firestore array


     } else { // sender === 'bot'
         // Rerunning a bot message: Find the *immediately preceding user message* in the Firestore array
         let precedingUserMessage = null;
         let precedingUserMessageIndexInFirestore = -1;
         // Search backwards from the current bot message's index in the Firestore array
         for (let i = messageIndexInDom - 1; i >= 0; i--) {
             if (messagesFromFirestore[i]?.sender === 'user') {
                 precedingUserMessage = messagesFromFirestore[i];
                 precedingUserMessageIndexInFirestore = i;
                 break;
             }
         }

         if (!precedingUserMessage) {
              console.warn("Cannot rerun bot message: No preceding user message found in Firestore history.");
              displayMessage('bot', 'Cannot rerun this bot message as no preceding user message was found in history.', false);
              return;
         }

         userMessageTextToRerun = precedingUserMessage.text;
         // Start deleting from the message *after* the user message we are rerunning (index in Firestore array)
         firestoreStartIndexToDelete = precedingUserMessageIndexInFirestore + 1;
    }

    if (!userMessageTextToRerun) {
         console.warn("Could not retrieve message text for rerun from Firestore data.");
         displayMessage('bot', 'Could not retrieve the original message text to rerun.', false);
         return;
    }

    console.log(`Rerunning based on DOM index ${messageIndexInDom} (sender: ${sender}). Deleting from Firestore index ${firestoreStartIndexToDelete}.`);

    // 1. Delete messages from the specified index onwards in Firestore
    await deleteMessagesFromIndex(currentUser.uid, currentChatId, firestoreStartIndexToDelete);

    // 2. Reload the chat UI from Firestore to reflect the deletion
    await loadChat(currentUser.uid, currentChatId);

    // 3. Simulate sending the original user message text again
     // We call handleSendMessage directly with the text. It will fetch messages again
     // to get the correct context after the deletion.
     await handleSendMessage(userMessageTextToRerun);

}

/**
 * Initiates the editing process for a user message.
 * @param {HTMLElement} messageElement - The user message element to edit in the DOM.
 */
async function editMessage(messageElement) {
    if (!currentUser || !currentChatId) {
        console.warn("Cannot edit message: User not logged in or no chat ID.");
        displayMessage('bot', 'Please log in to edit messages.', false);
        return;
    }

    const messageIndexInDom = parseInt(messageElement.getAttribute('data-message-index'));
     const contentDiv = messageElement.querySelector('.message-content');
     const actionsDiv = messageElement.querySelector('.message-actions');

     if (isNaN(messageIndexInDom) || !contentDiv || !actionsDiv) {
          console.error("Cannot edit: Message element missing index, content div, or actions div.");
          displayMessage('bot', 'Cannot edit this message.', false);
          return;
     }

    // Fetch the *original* message text (markdown) from Firestore
     const chatDocSnap = await getDoc(doc(db, 'users', currentUser.uid, 'chats', currentChatId));
     const messagesFromFirestore = chatDocSnap.exists() ? (chatDocSnap.data().messages || []) : [];
     const originalMessage = messagesFromFirestore[messageIndexInDom]; // Get the message object from Firestore data

     if (!originalMessage || originalMessage.sender !== 'user') {
         console.error("Cannot edit: Original message not found in Firestore or is not a user message.", originalMessage);
         displayMessage('bot', 'Cannot edit this message (data mismatch or not a user message).', false);
         return;
     }

    const originalText = originalMessage.text || ''; // Use the text from Firestore


     // Hide original content and actions
     contentDiv.style.display = 'none';
     actionsDiv.style.display = 'none';


     // Check if an edit area already exists to prevent duplicates
     if (messageElement.querySelector('.message-edit-area')) {
         console.warn("Edit area already exists for this message.");
         return;
     }

     // Create editing interface
     const editArea = document.createElement('div');
     editArea.classList.add('message-edit-area');
     editArea.style.width = '100%';

     const textarea = document.createElement('textarea');
     textarea.value = originalText; // Use original markdown text
     textarea.style.width = '100%';
     textarea.style.boxSizing = 'border-box';
     textarea.style.minHeight = '50px';
     textarea.style.marginBottom = '10px';
     textarea.style.resize = 'vertical';
     // Apply styling from chat input textarea
     textarea.style.backgroundColor = 'var(--input-bg)';
     textarea.style.color = 'var(--text-color)';
     textarea.style.border = '1px solid var(--border-color)';
     textarea.style.borderRadius = '8px';
     textarea.style.padding = '10px';
     textarea.style.fontSize = '1em';
     textarea.style.fontFamily = 'Poppins, sans-serif';
     textarea.style.outline = 'none';
     textarea.style.lineHeight = '1.6';


     // Adjust height immediately and on input
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

     // Insert edit area into the message element
     const avatarOrActions = messageElement.querySelector('.avatar') || actionsDiv;
     messageElement.insertBefore(editArea, avatarOrActions);


     // Focus the textarea
     textarea.focus();

     // Adjust scroll to make edit area visible
     textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });


     // Event listeners for edit actions
     saveBtn.addEventListener('click', async () => {
        const newText = textarea.value.trim();
        if (newText === originalText || newText === '') {
             console.log("Edit cancelled: no change or empty message.");
             cancelEditing(); // Cancel if no change or empty
             return;
        }

        saveBtn.disabled = true;
        cancelBtn.disabled = true;

        try {
            // Save the edited message text to Firestore
            // Use the index from the DOM element which matches the Firestore array index
            await editMessageInFirestore(currentUser.uid, currentChatId, messageIndexInDom, newText);

            // Remove the edit area
            editArea.remove();

            // Update the message content in the UI (re-render markdown)
             contentDiv.innerHTML = marked.parse(newText);
             contentDiv.style.display = ''; // Show original content div again

            // Show actions again
             actionsDiv.style.display = 'flex'; // Restore actions div display

           console.log("Message edited and saved.");

           // Rerun the conversation from the edited user message onwards
            rerunMessage(messageElement);


       } catch (error) {
            console.error("Error saving edited message:", error);
            // Display a user-friendly error message using the caught error's message
            displayMessage('bot', `Failed to save edited message: ${error.message}`, false); // Don't save the error message to history
            // Re-enable buttons on error
            saveBtn.disabled = false;
            cancelBtn.disabled = false;
            // Keep edit area open on error? Or cancel? Let's cancel on error for simplicity
            cancelEditing(); // Might need a more robust error UI
       }
    });

     cancelBtn.addEventListener('click', cancelEditing);

     function cancelEditing() {
         editArea.remove();
         contentDiv.style.display = ''; // Show original content div again
         actionsDiv.style.display = 'flex'; // Show actions again
         console.log("Editing cancelled.");
     }
}


// --- Placeholder Action Functions (Like/Dislike) ---
function handleLike(messageElement) {
     console.log("Liked message with index:", messageElement.getAttribute('data-message-index'));
     // TODO: Implement saving 'liked' status to Firestore for this message
     // Find the message in Firestore by index and update its 'feedback' field
     const likeBtn = messageElement.querySelector('.like-btn');
     const dislikeBtn = messageElement.querySelector('.dislike-btn');

     // Simple UI toggle
     const isLiked = likeBtn.classList.toggle('liked');
     dislikeBtn.classList.remove('disliked'); // Unlike if disliked

     // TODO: Save state to Firestore (Requires uid, chatId, message index, and new feedback state)
      const messageIndexInDom = parseInt(messageElement.getAttribute('data-message-index'));
     if (!isNaN(messageIndexInDom) && currentUser && currentChatId) {
          console.log(`Saving like status ${isLiked ? 'liked' : 'none'} for message ${messageIndexInDom}`);
          // updateMessageFeedback(currentUser.uid, currentChatId, messageIndexInDom, isLiked ? 'liked' : null); // Implement this function
     } else {
          console.warn("Cannot save like status: data missing.");
     }
}

function handleDislike(messageElement) {
     console.log("Disliked message with index:", messageElement.getAttribute('data-message-index'));
     // TODO: Implement saving 'disliked' status to Firestore for this message
     const likeBtn = messageElement.querySelector('.like-btn');
     const dislikeBtn = messageElement.querySelector('.dislike-btn');

     // Simple UI toggle
     const isDisliked = dislikeBtn.classList.toggle('disliked');
     likeBtn.classList.remove('liked'); // Undislike if liked

     // TODO: Save state to Firestore (Requires uid, chatId, message index, and new feedback state)
     const messageIndexInDom = parseInt(messageElement.getAttribute('data-message-index'));
     if (!isNaN(messageIndexInDom) && currentUser && currentChatId) {
          console.log(`Saving dislike status ${isDisliked ? 'disliked' : 'none'} for message ${messageIndexInDom}`);
           // updateMessageFeedback(currentUser.uid, currentChatId, messageIndexInDom, isDisliked ? 'disliked' : null); // Implement this function
     } else {
          console.warn("Cannot save dislike status: data missing.");
     }
}

// TODO: Implement updateMessageFeedback function to save like/dislike status to Firestore


// --- Event Listeners ---

// Sidebar Toggle (already implemented)
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
// Close sidebar when clicking outside (already implemented)
mainApp.addEventListener('click', (e) => {
    if (sidebar.classList.contains('active') &&
        !sidebar.contains(e.target) &&
        !sidebarToggleBtn.contains(e.target))
    {
         sidebar.classList.remove('active');
         mainApp.classList.remove('sidebar-active');
         sidebarToggleBtn.setAttribute('aria-expanded', 'false');
    }
});

// New Chat Button (already implemented)
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

     // Handle click on the link to load chat
     const chatLink = target.closest('li a');
     if (chatLink) {
         e.preventDefault(); // Prevent default link behavior
         const listItem = chatLink.closest('li');
         const clickedChatId = listItem?.getAttribute('data-chat-id');
         if (clickedChatId && clickedChatId !== currentChatId && currentUser) {
              loadChat(currentUser.uid, clickedChatId);
              // Highlighting is handled inside loadChat now
              // Closing sidebar on mobile is handled inside loadChat now
         } else if (!currentUser) {
             console.warn("User not logged in, cannot load chat.");
         }
         return; // Stop processing after handling link click
     }

     // Handle clicks on action buttons within list items
     const actionBtn = target.closest('.chat-history-item-actions .icon-button');
     if (actionBtn) {
         e.stopPropagation(); // Prevent triggering list item/link clicks
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


// Send Message Button & Enter Key (Wrap existing logic)
async function handleSendMessage(text) {
     if (!text || text.trim() === '') return;

    if (!currentUser || !currentChatId) {
         console.warn("Cannot send message: User not logged in or no chat ID set.");
         displayMessage('bot', 'Please log in or start a new chat to send messages.', false);
         return;
    }

    const messageText = text.trim();

    // Get current messages count from Firestore *before* adding the user message to get its index
    const chatDocSnapBeforeUserMsg = await getDoc(doc(db, 'users', currentUser.uid, 'chats', currentChatId));
    const currentMessagesCount = chatDocSnapBeforeUserMsg.exists() ? (chatDocSnapBeforeUserMsg.data().messages || []).length : 0;

    // Display user message immediately (this also saves it to Firestore and adds to internal state)
    // Pass the index it will have in the array *after* it's added
    displayMessage('user', messageText, true, currentMessagesCount); // Pass index for the new message


    // Disable input while waiting
    messageInput.disabled = true;
    sendBtn.disabled = true;
    showTypingIndicator(); // Show typing indicator

    try {
        // Fetch messages *again* after the user message has been displayed and saved (via displayMessage)
        // to get the latest context including the message just added
         const updatedChatDocSnap = await getDoc(doc(db, 'users', currentUser.uid, 'chats', currentChatId));
         const messagesForContext = updatedChatDocSnap.exists() ? (updatedChatDocSnap.data().messages || []).map(msg => ({ sender: msg.sender, text: msg.text })) : []; // Map to sender/text


        // Pass the user's message (redundant since it's in messagesForContext but kept for clarity),
        // their loaded settings, and the full chat history for context
        const botResponse = await generateResponse(messageText, userSettings, messagesForContext); // Pass the full array


        removeTypingIndicator(); // Remove typing indicator

        // Get the count *after* the bot message is added by displayMessage
        // The index for the bot message will be the current length *before* adding it.
        const finalChatDocSnap = await getDoc(doc(db, 'users', currentUser.uid, 'chats', currentChatId));
        const messagesCountBeforeBotMsg = finalChatDocSnap.exists() ? (finalChatDocSnap.data().messages || []).length : currentMessagesCount + 1; // Should be count after user msg added

        displayMessage('bot', botResponse, true, messagesCountBeforeBotMsg); // Display and Save bot response

    } catch (error) {
        console.error("Error getting bot response:", error);
        removeTypingIndicator();
        // Display an error message for the user
        // Find the index for the error message
        const errorChatDocSnap = await getDoc(doc(db, 'users', currentUser.uid, 'chats', currentChatId));
        const messagesCountBeforeErrorMsg = errorChatDocSnap.exists() ? (errorChatDocSnap.data().messages || []).length : currentMessagesCount + 1;

        displayMessage('bot', `Error: ${error.message}`, true, messagesCountBeforeErrorMsg); // Display and Save detailed error
    } finally {
        // Re-enable input
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus(); // Put focus back on input
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
        adjustTextareaHeight(messageInput);
    }
});

// Auto-resize textarea (already implemented)
messageInput.addEventListener('input', function() {
     adjustTextareaHeight(this);
 });


// Global Event Listener for Message Actions (Using Event Delegation)
chatMessagesDiv.addEventListener('click', (e) => {
    const target = e.target; // Get the actual clicked element
    const targetBtn = target.closest('.icon-button'); // Find the closest button

    if (!targetBtn) return; // Not a button

    // Handle code block copy button specifically
     if (targetBtn.classList.contains('copy-code-btn')) {
         // Find the code element associated with this button
         const codeBlockContainer = targetBtn.closest('.code-block-container');
         const codeElement = codeBlockContainer?.querySelector('pre code'); // Code is inside pre inside container

         if (codeElement && codeElement.textContent) {
             copyTextToClipboard(codeElement.textContent);
         } else {
             console.warn("Code element not found for copy action.");
         }
         e.stopPropagation(); // Prevent this click from also triggering message-level actions
         return; // Stop here, it was a code copy button
     }


    // Handle message-level action buttons (Copy, Rerun, Edit, Like, Dislike)
    const messageElement = targetBtn.closest('.chat-message');
    if (!messageElement) return; // Button is not inside a message element

    // messageIndexInDom is used to find the element in the UI.
    const messageIndexInDom = parseInt(messageElement.getAttribute('data-message-index'));


    if (targetBtn.classList.contains('copy-btn')) {
        // Copy the entire message content text (rendered markdown text)
         const messageTextToCopy = messageElement.querySelector('.message-content')?.textContent || '';
         if (messageTextToCopy) {
             copyTextToClipboard(messageTextToCopy);
         } else {
             console.warn("Message content not found for copy action.");
         }


    } else if (targetBtn.classList.contains('rerun-btn')) {
         rerunMessage(messageElement); // Pass the UI element


    } else if (messageElement.classList.contains('user') && targetBtn.classList.contains('edit-btn')) {
         editMessage(messageElement); // Pass the UI element


    } else if (messageElement.classList.contains('bot') && targetBtn.classList.contains('like-btn')) {
         handleLike(messageElement); // Pass the UI element (for UI toggle and future Firestore save)


    } else if (messageElement.classList.contains('bot') && targetBtn.classList.contains('dislike-btn')) {
         handleDislike(messageElement); // Pass the UI element (for UI toggle and future Firestore save)
    }
});


// Web Search Toggle - Save setting on change (already implemented)
webSearchToggle.addEventListener('change', async () => {
    if (!currentUser) { console.warn("User not logged in, cannot save setting."); webSearchToggle.checked = !webSearchToggle.checked; return; }
    const isEnabled = webSearchToggle.checked;
    userSettings.webSearchEnabled = isEnabled;
    try {
        const settingsDocRef = doc(db, 'users', currentUser.uid, 'settings', 'apikeys');
        await setDoc(settingsDocRef, { webSearchEnabled: isEnabled }, { merge: true });
        console.log("Web search setting saved:", isEnabled);
    } catch (error) {
        console.error("Error saving web search setting:", error);
        alert("Failed to save web search setting.");
        webSearchToggle.checked = !isEnabled;
         userSettings.webSearchEnabled = !isEnabled;
    }
});


// Handle Logout (already implemented)
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.replace('/auth.html'); // Redirect after successful logout
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