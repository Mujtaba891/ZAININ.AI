// js/apiHandler.js
// ** CRITICAL SECURITY WARNING **
// DO NOT USE THIS CODE IN PRODUCTION WITH ACTUAL API KEYS ACCESSED CLIENT-SIDE.
// API KEYS ARE EXPOSED TO ANYONE INSPECTING THE BROWSER'S NETWORK OR SOURCE.
// ALWAYS USE A SECURE BACKEND SERVER OR SERVERLESS FUNCTION TO PROXY API CALLS.
// This implementation is SOLELY to fulfill the request for client-side functionality.

// --- Constants ---
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const SERPAPI_API_URL = 'https://serpapi.com/search.json';

// Choose a reliable OpenRouter model that supports chat (check OpenRouter docs for availability/cost)
// Using DeepSeek Chat as requested, but have alternatives commented out.
const AI_MODEL = 'deepseek/deepseek-chat';
// const AI_MODEL = 'openai/gpt-3.5-turbo';
// const AI_MODEL = 'mistralai/mistral-7b-instruct-v0.2';
// const AI_MODEL = 'google/gemini-pro'; // Requires checking OpenRouter support/cost

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
const MAX_HISTORY_MESSAGES = 20; // Adjusted history limit


// --- Main Handler Function ---

/**
 * Handles fetching responses from OpenRouter and SerpApi based on user input and settings.
 * Decides whether to perform a web search or directly call the AI model.
 * If a search is performed and successful, it might feed the results to the AI for synthesis.
 * @param {string} userMessage - The user's current message.
 * @param {object} settings - User settings including API keys and web search preference. Expected structure: { openrouter: '...', serpapi: '...', webSearchEnabled: true/false }.
 * @param {Array<object>} chatHistory - Array of previous {sender, text, timestamp} messages for context.
 * @returns {Promise<string>} - A promise resolving to the bot's response text (can be formatted markdown) or an error message.
 */
async function generateResponse(userMessage, settings, chatHistory = []) {
    console.log("generateResponse called.");
    console.log(`Using AI Model: ${AI_MODEL}`);
    // Avoid logging keys directly in console in production, even here
    console.log("Settings received (includes UNSAFE exposed keys if present):", {
        openrouter: settings?.openrouter ? '***' : 'N/A',
        serpapi: settings?.serpapi ? '***' : 'N/A',
        webSearchEnabled: settings?.webSearchEnabled
    });
    console.log("Chat History length provided for context:", chatHistory.length);

    const openrouterKey = settings?.openrouter || null;
    const serpapiKey = settings?.serpapi || null;
    const webSearchEnabled = settings?.webSearchEnabled || false;

    if (!openrouterKey) {
        console.error("OpenRouter API key is missing.");
        return "Error: OpenRouter API key is missing. Please add it in the API Keys page to use the chat.";
    }

    // --- Decide on Action (Search or Direct AI) ---
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

                 // If search returned results, we'll pass them to the AI.
                 // If search failed or returned no useful data, searchResultsText will reflect that.

            } catch (error) {
                console.error("SerpApi search failed:", error);
                searchResultsText = `Web search failed: ${error.message}. Proceeding without search results.`;
            }
        }
    }

    // --- Perform AI Chat Completion ---
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
            userFacingError += " Please check your OpenRouter API key on the API Keys page.";
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
        // hl: 'en', // Host language (optional)
        // gl: 'us'  // Geo location (optional)
        // add more parameters as needed, e.g., tbm for image/video search
        // tbm: 'isch', // Uncomment for Image Search
        // tbm: 'vid', // Uncomment for Video Search
        // tbm: 'nws', // Uncomment for News Search
    });
    const serpApiUrl = `${SERPAPI_API_URL}?${searchParams.toString()}`;
    console.log("Fetching SerpApi URL:", serpApiUrl); // Log the URL being fetched (without key)

    const response = await fetch(serpApiUrl);

    if (!response.ok) {
         const errorBody = await response.text(); // Read response body
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
         throw new Error(errorMessage); // Throw a specific error
    }

    const serpData = await response.json();
    console.log("Raw SerpApi Response:", serpData); // Log the full raw response
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

    // Process various result types, prioritizing definitive answers
    if (serpData.answer_box?.snippet || serpData.answer_box?.answer) {
         formattedText += `**Answer Box:** ${escapeMarkdown(serpData.answer_box.snippet || serpData.answer_box.answer)}\n\n`;
         resultsCount++;
    } else if (serpData.knowledge_graph?.snippet) {
         formattedText += `**Knowledge Graph:** ${escapeMarkdown(serpData.knowledge_graph.snippet)}\n\n`;
         resultsCount++;
         // Add other knowledge graph details if relevant (e.g., title, type, description)
         if (serpData.knowledge_graph.title) formattedText += `Title: ${escapeMarkdown(serpData.knowledge_graph.title)}\n`;
         if (serpData.knowledge_graph.type) formattedText += `Type: ${escapeMarkdown(serpData.knowledge_graph.type)}\n`;
          formattedText += '\n';
    } else if (serpData.sports_results) {
         formattedText += `**Sports Results:**\n${JSON.stringify(serpData.sports_results, null, 2)}\n\n`; // Basic stringify for sports
         resultsCount++;
    } else if (serpData.local_results) {
         formattedText += `**Local Results:**\n`;
         serpData.local_results.slice(0, 3).forEach(loc => { // Limit local results
              formattedText += `* ${escapeMarkdown(loc.title || 'N/A')} - ${escapeMarkdown(loc.address || loc.snippet || 'N/A')}\n`;
         });
          formattedText += '\n';
         resultsCount++;
    }


    // Process organic results (web links)
    if (serpData.organic_results && serpData.organic_results.length > 0) {
        if (resultsCount > 0) formattedText += "**More Results:**\n"; // Header if other types were found
        else formattedText += "**Top Web Results:**\n"; // Main header if only organic

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
             // Handle case where organic results exist but none had title/link/snippet? Unlikely.
             formattedText += "Could not parse top web results.\n";
             resultsCount++; // Count the fact that we tried
        }
        formattedText += '\n';
    }

    // Process other types if needed (e.g., images, videos, news - requires different tbm parameter in performSerpSearch)
    // if (serpData.images_results) { ... }
    // if (serpData.videos_results) { ... }
    // if (serpData.news_results) { ... }


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
     // Prepare messages for the AI model, including relevant history and search results
     const messages = [];

     // Add a system message if search results are available, instructing the AI to use them
     if (searchResultsText) {
         // Include a system message explaining its role and providing the search context
         messages.push({
             role: 'system',
             content: `You are ZAININ AI, a helpful AI assistant.
             Use the provided search results below to answer the user's question if relevant.
             If the results do not directly answer the question, state that or provide a general answer based on your knowledge.
             Do not mention "search results" explicitly unless necessary for clarity.
             Format your response using Markdown.
             ${searchResultsText}` // Inject search results into the system message or before history
         });
          // The original user query that triggered the search is already in the userMessage variable
     } else {
          // Standard system message if no search results
           messages.push({
             role: 'system',
             content: `You are ZAININ AI, a helpful AI assistant. Respond to the user's messages based on the conversation history. Format your response using Markdown.`
         });
     }


     // Add limited chat history for context (excluding the system message we just added)
     const limitedHistory = chatHistory.slice(-MAX_HISTORY_MESSAGES);
     limitedHistory.forEach(msg => {
         // Map 'user' and 'bot' senders to 'user' and 'assistant' roles for the API
         messages.push({
             role: msg.sender === 'user' ? 'user' : 'assistant',
             content: msg.text
         });
     });


     // Add the current user message
     // If search results were included in a system message, the final user message is just the original query.
     // If search failed or wasn't done, the final user message is just the original query.
     messages.push({ role: 'user', content: userMessage });


     console.log("Messages sent to OpenRouter API:", messages); // Log messages payload

     const response = await fetch(OPENROUTER_API_URL, {
         method: 'POST',
         headers: {
             'Authorization': `Bearer ${apiKey}`,
             'Content-Type': 'application/json',
             // 'HTTP-Referer': YOUR_SITE_URL, // Optional but recommended by OpenRouter
             // 'X-Title': YOUR_APP_NAME,     // Optional but recommended by OpenRouter
             // Replace with your actual site URL and app name if deploying
         },
         body: JSON.stringify({
             model: AI_MODEL, // Use the selected AI model constant
             messages: messages,
             stream: false // Set to true if you implement streaming UI in script.js
         })
     });

     if (!response.ok) {
          const errorBody = await response.text(); // Read response body
          console.error("OpenRouter HTTP Error Details:", response.status, response.statusText, errorBody);
          let errorMessage = `OpenRouter HTTP Error: ${response.status} ${response.statusText}.`;

          // Attempt to parse JSON error body for more details
          try {
              const errorJson = JSON.parse(errorBody);
              if (errorJson.error?.message) {
                    errorMessage += ` Details: ${errorJson.error.message}`;
              } else if (errorJson.message) { // Sometimes the error is at the top level
                    errorMessage += ` Details: ${errorJson.message}`;
              } else {
                   errorMessage += ` Body: ${errorBody.substring(0, 150)}...`; // Show part of body if not structured
              }
          } catch (parseError) {
               // Body wasn't JSON, just use the text status
          }

         // Add a hint for common API errors
         if (response.status === 401 || response.status === 403) {
              errorMessage += " Please check your API key on the API Keys page."; // Direct to Profile for keys
         } else if (response.status === 400 && errorMessage.includes("model")) {
             errorMessage += ` The model '${AI_MODEL}' might be incorrect or unavailable. Try a different model ID or contact support.`;
         }

          throw new Error(errorMessage); // Throw a specific error
     }

     const data = await response.json();
     console.log("Raw OpenRouter Response:", data); // Log the full raw response

     if (data.choices && data.choices.length > 0 && data.choices[0].message) {
         // Ensure the content is a string
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
 * Helper function to escape markdown special characters in text that shouldn't be markdown
 * (like characters in titles, snippets, or URLs that might be misinterpreted).
 * @param {string} text - The string to escape.
 * @returns {string} - The escaped string.
 */
function escapeMarkdown(text) {
    if (!text) return '';
    // Escape common markdown characters that might appear in titles/snippets/URLs
    // List from https://www.markdowngide.org/basic-syntax/#escaping-backslashes
    // Includes: backslash, backtick, asterisk, underscore, curly braces, square brackets, parentheses, hash symbol, plus sign, hyphen, dot, exclamation mark
    // Escape > which can interfere with blockquotes
    return text.replace(/[\\`*_{}\[\]()#+\-.!>]/g, '\\$&'); // Use $& to substitute the whole matched string
}


export { generateResponse }; // Export the main function