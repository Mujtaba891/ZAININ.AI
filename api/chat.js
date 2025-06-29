// api/chat.js

import fetch from 'node-fetch'; // Vercel provides node-fetch

// Helper function to perform web search using SerpApi
async function performWebSearch(query) {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
        console.error("SERPAPI_API_KEY environment variable is not set.");
        // In a real app, you might want to alert monitoring or throw a specific error
        return null;
    }

    try {
        // Fetch directly from SerpApi - no need for CORS proxy on the server
        const searchUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}`;
        console.log("Calling SerpApi:", searchUrl);

        const response = await fetch(searchUrl);

        if (!response.ok) {
             // Log the error response from SerpApi
             const errorBody = await response.text();
             console.error(`SerpApi request failed: ${response.status} ${response.statusText}`, errorBody);
             // Decide how to handle this: return null, throw, or return specific message
             return null; // Indicate failure
        }

        const results = await response.json();
        console.log("SerpApi Results:", results); // Log results for debugging

        // Format the results
        if (results.organic_results && results.organic_results.length > 0) {
            // Limit results to a reasonable number and format them clearly
            return results.organic_results.slice(0, 3).map(r => `Title: ${r.title}\nLink: ${r.link}\nSnippet: ${r.snippet}`).join('\n---\n');
        } else {
            console.log("SerpApi returned no organic results.");
            return null; // No results found
        }

    } catch (error) {
        console.error("Error performing web search with SerpApi:", error);
        return null; // Indicate failure
    }
}


// Vercel Serverless Function Entry Point
export default async (req, res) => {
    // Set CORS headers to allow requests from your frontend domain.
    // For production, replace '*' with your specific Vercel domain(s).
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS'); // Include GET/OPTIONS if needed, POST for this endpoint
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS pre-flight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Ensure it's a POST request
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    // Access the OpenRouter API key from environment variables
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterApiKey) {
        console.error("OPENROUTER_API_KEY environment variable is not set.");
        res.status(500).json({ error: 'Server configuration error: AI API key not available.' });
        return;
    }

    try {
        // Extract data from the request body sent by the client
        const { prompt, useWebSearch, messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            res.status(400).json({ error: 'Invalid request body: messages array is missing or malformed.' });
            return;
        }

        let finalPrompt = prompt; // Start with the original prompt
        let systemMessage = "You are ZAININ AI, an eloquent and helpful AI assistant. Format your responses using Markdown.";

        // Step 1: Perform Web Search if requested
        if (useWebSearch) {
            console.log(`Web search requested for prompt: "${prompt}"`);
            const searchResults = await performWebSearch(prompt);

            if (searchResults) {
                console.log("Web search successful. Augmenting prompt.");
                // Augment the system message or prepend results to the last user message
                // Prepending to system message is often more reliable for some models
                 systemMessage += `\n\nUse the following web search results as context for the user's question:\n---\n${searchResults}\n---`;
                // Optionally, you could augment the last user message instead:
                // const lastUserMessage = messages[messages.length - 1];
                // if (lastUserMessage && lastUserMessage.role === 'user') {
                //    lastUserMessage.content = `Web search results:\n---\n${searchResults}\n---\nMy question: ${lastUserMessage.content}`;
                // } else {
                //    // Fallback or error if last message wasn't user? Unlikely with current client logic.
                // }
            } else {
                console.warn("Web search failed or returned no results.");
                // Optionally inform the user about the search failure within the AI response
                // e.g., prepend a note to the AI's response: "Note: Web search failed."
            }
        } else {
            console.log("Web search not requested.");
        }

        // Step 2: Call OpenRouter API with the augmented prompt and history
        console.log("Calling OpenRouter API...");

        const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openrouterApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-chat', // Ensure this model is correct and available
                messages: [
                    { role: "system", content: systemMessage }, // Use the potentially augmented system message
                     ...messages // Include the conversation history from the client
                ],
                stream: false // Keep as false for simpler non-streaming backend
            })
        });

        // Step 3: Process OpenRouter response
        if (!openrouterResponse.ok) {
            const errorBody = await openrouterResponse.text();
            console.error(`OpenRouter API request failed: ${openrouterResponse.status} ${openrouterResponse.statusText}`, errorBody);

            // Attempt to parse JSON error if possible, otherwise use status text
            let errorMessage = `AI API Error: ${openrouterResponse.status} ${openrouterResponse.statusText}`;
            try {
                 const errorJson = JSON.parse(errorBody);
                 if (errorJson.error && errorJson.error.message) {
                     errorMessage = `AI API Error: ${errorJson.error.message}`;
                 } else {
                      errorMessage = `AI API Error: ${errorBody}`; // Use raw body if JSON structure unexpected
                 }
            } catch (e) {
                 // Ignore parsing error, use status text
            }

            // Send an error response back to the client
            res.status(openrouterResponse.status >= 400 && openrouterResponse.status < 500 ? 400 : 500).json({ error: errorMessage });
            return;
        }

        // Read the response body (non-streaming)
        const data = await openrouterResponse.json();
        const aiResponseText = data.choices?.[0]?.message?.content || "";

        console.log("OpenRouter Response (non-streaming) received.");

        // Step 4: Send the AI response text back to the client
        res.status(200).json({ text: aiResponseText });

    } catch (error) {
        console.error("Serverless function error during processing:", error);
        res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
    }
};