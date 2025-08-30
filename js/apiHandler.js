// js/apiHandler.js
// ** CRITICAL SECURITY WARNING **
// DO NOT USE THIS CODE IN PRODUCTION WITH ACTUAL API KEYS ACCESSED CLIENT-SIDE.
// API KEYS ARE EXPOSED TO ANYONE INSPECTING THE BROWSER'S NETWORK OR SOURCE.
// ALWAYS USE A SECURE BACKEND SERVER OR SERVERLESS FUNCTION TO PROXY API CALLS.
// This implementation is SOLELY to fulfill the request for client-side functionality.

// --- Constants ---
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Updated Google AI Studio endpoint to use 'gemini-2.0-flash'
// If you specifically need 'gemini-pro-vision' and it's available for your key,
// you would revert this URL and ensure your API key/project has access.
const GOOGLE_AI_STUDIO_VISION_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const SERPAPI_API_URL = 'https://serpapi.com/search.json';

// Choose a reliable OpenRouter model that supports chat
const AI_MODEL = 'deepseek/deepseek-chat';
// Updated multimodal model name for consistency with the endpoint change.
const GEMINI_VISION_MODEL = 'google/gemini-2.0-flash';

// Heuristic keywords/patterns to trigger web search
const SEARCH_TRIGGERS = [
    /^search for\s/i,
    /^what is\s/i,
    /^tell me about\s/i,
    /^find information on\s/i,
    /^who is\s/i,
    /^when was\s/i,
    /^where is\s/i,
    /latest news/i,
    /current events/i,
    /recent updates/i,
    /\bweather\b/i,
    /\bdefinition of\b/i,
    /\bhow to\b/i, // Common search pattern
    /\bexample of\b/i,
    /\blyrics to\b/i,
    /\bstock price for\b/i,
    /\bmap of\b/i,
    /\bimages of\b/i, // Might indicate image search intent
    /\bvideos of\b/i, // Might indicate video search intent
];

// Maximum number of search results to include in the AI prompt
const MAX_SEARCH_RESULTS_TO_SUMMARIZE = 5;
// Maximum characters for snippets to include
const MAX_SNIPPET_LENGTH = 250;
// Maximum length of chat history messages to send for context
const MAX_HISTORY_MESSAGES = 20;

// --- Main Handler Function ---

/**
 * Handles fetching responses from OpenRouter, Google Gemini Vision, and SerpApi based on user input and settings.
 * Decides whether to perform a web search or directly call the AI model.
 * If a search is performed and successful, it might feed the results to the AI for synthesis.
 * If an image is provided, it uses a multimodal model.
 * @param {string} userMessage - The user's current message.
 * @param {object} appSettings - Global admin settings including API keys and web search preference.
 *                               Expected structure: { openrouterKey: '...', geminiVisionKey: '...', serpapiKey: '...', webSearchEnabled: true/false }.
 * @param {Array<object>} chatHistory - Array of previous {sender, text, timestamp, imageBase64?} messages for context.
 * @param {string|null} imageBase64 - Base64 encoded image string (e.g., "data:image/jpeg;base64,...") if an image is provided.
 * @returns {Promise<string>} - A promise resolving to the bot's response text (can be formatted markdown) or an error message.
 */
async function generateResponse(userMessage, appSettings, chatHistory = [], imageBase64 = null) {
    console.log("generateResponse called.");
    console.log(`Using AI Model: ${AI_MODEL}`);
    console.log(`Using Gemini Vision Model: ${GEMINI_VISION_MODEL}`); // This will now log 'google/gemini-2.0-flash'
    console.log("Settings received (includes UNSAFE exposed keys if present):", {
        openrouterKey: appSettings?.openrouterKey ? '***' : 'N/A',
        geminiVisionKey: appSettings?.geminiVisionKey ? '***' : 'N/A',
        serpapiKey: appSettings?.serpapiKey ? '***' : 'N/A',
        webSearchEnabled: appSettings?.webSearchEnabled
    });
    console.log("Chat History length provided for context:", chatHistory.length);
    console.log(`Image provided: ${!!imageBase64}`);

    const openrouterKey = appSettings?.openrouterKey || null;
    const geminiVisionKey = appSettings?.geminiVisionKey || null;
    const serpapiKey = appSettings?.serpapiKey || null;
    const webSearchEnabled = appSettings?.webSearchEnabled || false;

    if (!openrouterKey && !geminiVisionKey) {
        console.error("No primary AI API key (OpenRouter or Gemini Vision) is available.");
        return "Error: No primary AI API key (OpenRouter or Gemini Vision) is configured by the admin. Please contact support.";
    }

    // --- Decide on Action (Image, Search, or Direct AI) ---

    // Prioritize image recognition if an image is provided
    if (imageBase64) {
        if (!geminiVisionKey) {
            console.error("Gemini Vision API key is missing for image recognition.");
            return "Error: Google Gemini Pro Vision API key is missing. Admin needs to configure it to use image recognition.";
        }
        console.log("Performing Google Gemini Vision multimodal chat using gemini-2.0-flash...");
        try {
            const visionResponse = await performGeminiVisionChat(userMessage, geminiVisionKey, chatHistory, imageBase64);
            console.log("Gemini Vision response received.");
            return visionResponse;
        } catch (error) {
            console.error("Google Gemini Vision failed:", error);
            let userFacingError = `An error occurred with image recognition: ${error.message}.`;
            if (error.message.includes("403")) {
                userFacingError += " Please check the Google Gemini Vision API key in the Admin Panel and ensure the Generative Language API is enabled.";
            }
            return userFacingError;
        }
    }

    // If no image, proceed with potential web search or text-only AI
    const needsSearch = webSearchEnabled && SEARCH_TRIGGERS.some(trigger => trigger.test(userMessage));
    console.log(`Web search enabled: ${webSearchEnabled}, Query triggers search: ${needsSearch}. Final decision: ${needsSearch ? 'Perform Search' : 'Direct to AI'}`);

    let searchResultsText = null; // Will store formatted search results if search is done

    if (needsSearch) {
        if (!serpapiKey) {
            console.warn("Web search triggered but SerpApi key is missing.");
            // Continue to AI chat, but inform the user search failed
            searchResultsText = "Web search requested but SerpApi key is missing. Proceeding without search results.";
        } else {
            console.log("Performing SerpApi search...");
            try {
                const serpData = await performSerpSearch(userMessage, serpapiKey);
                searchResultsText = formatSerpResults(serpData);
                console.log("Formatted Search Results:\n", searchResultsText);

            } catch (error) {
                console.error("SerpApi search failed:", error);
                searchResultsText = `Web search failed: ${error.message}. Proceeding without search results.`;
            }
        }
    }

    // --- Perform OpenRouter Chat Completion (Text-only) ---
    console.log("Performing OpenRouter chat completion...");
    try {
        const aiResponse = await performOpenRouterChat(userMessage, openrouterKey, chatHistory, searchResultsText);
        console.log("AI response received.");
        return aiResponse; // Return the AI's generated response

    } catch (error) {
        console.error("OpenRouter chat completion failed:", error);
        // Improve error message based on common API issues
        let userFacingError = `An error occurred while getting the AI response: ${error.message}.`;
        if (error.message.includes("401") || error.message.includes("403")) {
            userFacingError += " Please check your OpenRouter API key in the Admin Panel.";
        } else if (error.message.includes("400") && error.message.includes("model")) {
            userFacingError += ` The model '${AI_MODEL}' might be incorrect or unavailable.`;
        } else if (error.message.includes("rate limit")) {
            userFacingError += " You might have hit a rate limit.";
        }
        return userFacingError; // Return a user-friendly error message
    }
}


// --- Helper Functions ---

/**
 * Performs the actual fetch call to SerpApi.
 * @param {string} query - The search query.
 * @param {string} apiKey - The SerpApi key.
 * @returns {Promise<object>} - Promise resolving to the parsed JSON response from SerpApi.
 * @throws {Error} - Throws an error if the fetch fails or returns a non-OK status.
 */
async function performSerpSearch(query, apiKey) {
    const searchParams = new URLSearchParams({
        q: query,
        api_key: apiKey,
        engine: 'google',
    });
    const serpApiUrl = `${SERPAPI_API_URL}?${searchParams.toString()}`;
    console.log("Fetching SerpApi URL:", serpApiUrl);

    const response = await fetch(serpApiUrl);

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("SerpApi HTTP Error Details:", response.status, response.statusText, errorBody);
        let errorMessage = `SerpApi HTTP Error: ${response.status} ${response.statusText}.`;
        try {
            const errorJson = JSON.parse(errorBody);
            if (errorJson.error) {
                errorMessage += ` Details: ${errorJson.error}`;
            }
        } catch (parseError) {
            // Body wasn't JSON, use plain text or status text
        }
        throw new Error(errorMessage);
    }

    const serpData = await response.json();
    console.log("Raw SerpApi Response:", serpData);
    return serpData;
}

/**
 * Formats the raw JSON response from SerpApi into a readable markdown string
 * suitable for including in an AI prompt.
 * @param {object} serpData - The parsed JSON response from SerpApi.
 * @returns {string} - Formatted markdown text summarizing search results.
 */
function formatSerpResults(serpData) {
    let formattedText = "--- Search Results ---\n\n";
    let resultsCount = 0;

    if (serpData.answer_box?.snippet || serpData.answer_box?.answer) {
        formattedText += `**Answer Box:** ${escapeMarkdown(serpData.answer_box.snippet || serpData.answer_box.answer)}\n\n`;
        resultsCount++;
    } else if (serpData.knowledge_graph?.snippet) {
        formattedText += `**Knowledge Graph:** ${escapeMarkdown(serpData.knowledge_graph.snippet)}\n\n`;
        resultsCount++;
        if (serpData.knowledge_graph.title) formattedText += `Title: ${escapeMarkdown(serpData.knowledge_graph.title)}\n`;
        if (serpData.knowledge_graph.type) formattedText += `Type: ${escapeMarkdown(serpData.knowledge_graph.type)}\n`;
        formattedText += '\n';
    } else if (serpData.sports_results) {
        formattedText += `**Sports Results:**\n${JSON.stringify(serpData.sports_results, null, 2)}\n\n`;
        resultsCount++;
    } else if (serpData.local_results) {
        formattedText += `**Local Results:**\n`;
        serpData.local_results.slice(0, 3).forEach(loc => {
            formattedText += `* ${escapeMarkdown(loc.title || 'N/A')} - ${escapeMarkdown(loc.address || loc.snippet || 'N/A')}\n`;
        });
        formattedText += '\n';
        resultsCount++;
    }

    if (serpData.organic_results && serpData.organic_results.length > 0) {
        if (resultsCount > 0) formattedText += "**More Results:**\n";
        else formattedText += "**Top Web Results:**\n";

        serpData.organic_results.slice(0, MAX_SEARCH_RESULTS_TO_SUMMARIZE).forEach(result => {
            if (result.title && result.link && result.snippet) {
                const snippet = result.snippet.length > MAX_SNIPPET_LENGTH
                    ? result.snippet.substring(0, MAX_SNIPPET_LENGTH) + '...'
                    : result.snippet;
                formattedText += `* **[${escapeMarkdown(result.title)}](${result.link})**: ${escapeMarkdown(snippet)}\n`;
                resultsCount++;
            }
        });
        if (resultsCount === 0 && serpData.organic_results.length > 0) {
            formattedText += "Could not parse top web results.\n";
            resultsCount++;
        }
        formattedText += '\n';
    }

    if (resultsCount === 0) {
        formattedText += "No relevant search results found.\n";
    }

    formattedText += "--------------------\n\n";

    return formattedText;
}


/**
 * Performs the actual fetch call to the OpenRouter chat completions endpoint.
 * @param {string} userMessage - The current user's message.
 * @param {string} apiKey - The OpenRouter API key.
 * @param {Array<object>} chatHistory - Array of previous {sender, text} messages.
 * @param {string|null} searchResultsText - Formatted search results text to include in the prompt, or null.
 * @returns {Promise<string>} - Promise resolving to the bot's generated text.
 * @throws {Error} - Throws an error if the fetch fails or returns a non-OK status.
 */
async function performOpenRouterChat(userMessage, apiKey, chatHistory, searchResultsText = null) {
    const messages = [];

    if (searchResultsText) {
        messages.push({
            role: 'system',
            content: `You are ZAININ AI, a helpful AI assistant.
            Use the provided search results below to answer the user's question if relevant.
            If the results do not directly answer the question, state that or provide a general answer based on your knowledge.
            Do not mention "search results" explicitly unless necessary for clarity.
            Format your response using Markdown.
            ${searchResultsText}`
        });
    } else {
        messages.push({
            role: 'system',
            content: `You are ZAININ AI, a helpful AI assistant. Respond to the user's messages based on the conversation history. Format your response using Markdown.`
        });
    }

    const limitedHistory = chatHistory.slice(-MAX_HISTORY_MESSAGES);
    limitedHistory.forEach(msg => {
        messages.push({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        });
    });

    messages.push({ role: 'user', content: userMessage });

    console.log("Messages sent to OpenRouter API:", messages);

    const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: AI_MODEL,
            messages: messages,
            stream: false
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("OpenRouter HTTP Error Details:", response.status, response.statusText, errorBody);
        let errorMessage = `OpenRouter HTTP Error: ${response.status} ${response.statusText}.`;

        try {
            const errorJson = JSON.parse(errorBody);
            if (errorJson.error?.message) {
                errorMessage += ` Details: ${errorJson.error.message}`;
            } else if (errorJson.message) {
                errorMessage += ` Details: ${errorJson.message}`;
            } else {
                errorMessage += ` Body: ${errorBody.substring(0, 150)}...`;
            }
        } catch (parseError) { }

        if (response.status === 401 || response.status === 403) {
            errorMessage += " Please check your OpenRouter API key in the Admin Panel.";
        } else if (response.status === 400 && errorMessage.includes("model")) {
            errorMessage += ` The model '${AI_MODEL}' might be incorrect or unavailable. Try a different model ID or contact support.`;
        }

        throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("Raw OpenRouter Response:", data);

    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        if (typeof data.choices[0].message.content === 'string') {
            return data.choices[0].message.content;
        } else {
            console.warn("OpenRouter response content is not a string:", data.choices[0].message.content);
            throw new Error("Received unexpected content format from the AI.");
        }
    } else {
        console.warn("OpenRouter response missing choices or message content:", data);
        throw new Error("Received an empty or unexpected response from the AI.");
    }
}


/**
 * Performs the actual fetch call to Google Gemini Pro Vision endpoint.
 * @param {string} userMessage - The current user's message.
 * @param {string} apiKey - The Google Gemini Pro Vision API key.
 * @param {Array<object>} chatHistory - Array of previous {sender, text, imageBase64} messages.
 * @param {string} imageBase64 - Base64 encoded image string.
 * @returns {Promise<string>} - Promise resolving to the bot's generated text.
 * @throws {Error} - Throws an error if the fetch fails or returns a non-OK status.
 */
async function performGeminiVisionChat(userMessage, apiKey, chatHistory, imageBase64) {
    const contents = [];

    // Add limited chat history for context (text-only parts, as re-uploading images from history is complex and resource-intensive)
    const limitedHistory = chatHistory.slice(-MAX_HISTORY_MESSAGES);
    limitedHistory.forEach(msg => {
        // Gemini API expects alternating 'user' and 'model' roles.
        // For historical context, we only send the text part of previous messages.
        // If a past message had an image, it's not re-sent to avoid exceeding token limits and complexity.
        contents.push({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        });
    });

    // Construct the parts for the *current* user message, including text and image.
    const currentUserMessageParts = [];

    if (userMessage) {
        currentUserMessageParts.push({ text: userMessage });
    }

    // Extract base64 data and MIME type from the data URI
    const base64Parts = imageBase64.split(',');
    const mimeType = base64Parts[0].split(':')[1].split(';')[0]; // e.g., "image/jpeg"
    const rawBase64Data = base64Parts[1];

    if (rawBase64Data && mimeType) {
        currentUserMessageParts.push({
            inline_data: { // Correct: 'inline_data' for base64 images
                mime_type: mimeType,
                data: rawBase64Data
            }
        });
    } else {
        throw new Error("Invalid imageBase64 format provided for Gemini Vision API.");
    }

    // Add the current user message with its multimodal parts to the conversation.
    contents.push({ role: 'user', parts: currentUserMessageParts });

    console.log("Contents sent to Gemini Vision API:", JSON.stringify(contents, null, 2)); // Pretty print JSON for debugging

    const response = await fetch(`${GOOGLE_AI_STUDIO_VISION_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: contents,
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 1000,
            },
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Gemini Vision HTTP Error Details:", response.status, response.statusText, errorBody);
        let errorMessage = `Gemini Vision HTTP Error: ${response.status} ${response.statusText}.`;

        try {
            const errorJson = JSON.parse(errorBody);
            if (errorJson.error?.message) {
                errorMessage += ` Details: ${errorJson.error.message}`;
            } else {
                errorMessage += ` Body: ${errorBody.substring(0, 150)}...`;
            }
        } catch (parseError) { /* Body wasn't JSON, use plain text or status text */ }

        if (response.status === 403) {
            errorMessage += " Please check your Google Gemini Vision API key in the Admin Panel and ensure the Generative Language API is enabled for your Google Cloud Project.";
        } else if (response.status === 404) {
             errorMessage += " The model might not be available or incorrectly specified. Double-check the model ID and API key in the Admin Panel.";
        }

        throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("Raw Gemini Vision Response:", data);

    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts) {
        const textParts = data.candidates[0].content.parts
            .filter(part => part.text)
            .map(part => part.text)
            .join('\n');
        if (textParts) {
            return textParts;
        } else {
            console.warn("Gemini Vision response missing text content:", data.candidates[0].content);
            throw new Error("Received an empty or unexpected content from the AI.");
        }
    } else if (data.promptFeedback?.blockReason) {
         console.warn("Gemini Vision response blocked:", data.promptFeedback.blockReason);
         throw new Error(`AI response blocked due to safety concerns: ${data.promptFeedback.blockReason}`);
    } else {
        console.warn("Gemini Vision response missing candidates or content:", data);
        throw new Error("Received an empty or unexpected response from the AI.");
    }
}


/**
 * Helper function to escape markdown special characters in text that shouldn't be markdown
 * (like characters in titles, snippets, or URLs that might be misinterpreted).
 * @param {string} text - The string to escape.
 * @returns {string} - The escaped string.
 */
function escapeMarkdown(text) {
    if (!text) return '';
    return text.replace(/[\\`*_{}\[\]()#+\-.!>]/g, '\\$&');
}


export { generateResponse };