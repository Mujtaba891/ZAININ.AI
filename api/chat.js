// api/chat.js

import fetch from 'node-fetch';

// Helper function to perform web search using SerpApi
async function performWebSearch(query) {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
        console.error("SERPAPI_API_KEY environment variable is not set.");
        // Return an error object or throw if you want search failure to block the response
        return { error: "SerpApi key not configured on server." };
    }

    try {
        const searchUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}`;
        console.log("Calling SerpApi:", searchUrl);

        const response = await fetch(searchUrl);

        if (!response.ok) {
             const errorBody = await response.text();
             console.error(`SerpApi request failed: ${response.status} ${response.statusText}`, errorBody);
             // Return an error object instead of null for clarity
             return { error: `SerpApi failed: ${response.status} ${response.statusText}` };
        }

        const results = await response.json();
        console.log("SerpApi Results:", results);

        if (results.organic_results && results.organic_results.length > 0) {
            return results.organic_results.slice(0, 3).map(r => `Title: ${r.title}\nLink: ${r.link}\nSnippet: ${r.snippet}`).join('\n---\n');
        } else {
            console.log("SerpApi returned no organic results.");
            return null; // Still return null if no results, as this isn't a hard error
        }

    } catch (error) {
        console.error("Error performing web search with SerpApi:", error);
        // Return an error object for unexpected errors
        return { error: `SerpApi error: ${error.message}` };
    }
}


// Vercel Serverless Function Entry Point
export default async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Consider replacing '*' with your domain in production
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterApiKey) {
        console.error("OPENROUTER_API_KEY environment variable is not set.");
        res.status(500).json({ error: 'Server configuration error: AI API key not available.' });
        return;
    }

    try {
        const { prompt, useWebSearch, messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            res.status(400).json({ error: 'Invalid request body: messages array is missing or malformed.' });
            return;
        }

        let systemMessage = "You are ZAININ AI, an eloquent and helpful AI assistant. Format your responses using Markdown.";
        let searchError = null;

        // Step 1: Perform Web Search if requested
        if (useWebSearch) {
            console.log(`Web search requested for prompt: "${prompt}"`);
            const searchResultsOrError = await performWebSearch(prompt);

            if (searchResultsOrError && searchResultsOrError.error) {
                // SerpApi failed or key missing
                searchError = searchResultsOrError.error;
                console.error("Web search failed:", searchError);
                // Decide how to handle search failure: proceed without search, or return early?
                // For now, we'll proceed without search results but note the error.
            } else if (searchResultsOrError) {
                // Search successful and returned results (searchResultsOrError is the results string)
                console.log("Web search successful. Augmenting prompt.");
                systemMessage += `\n\nUse the following web search results as context for the user's question:\n---\n${searchResultsOrError}\n---`;
            } else {
                 // Search successful but returned no *organic* results (searchResultsOrError is null)
                 console.log("Web search returned no organic results.");
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
                model: 'deepseek/deepseek-chat',
                messages: [
                    { role: "system", content: systemMessage },
                    ...messages
                ],
                stream: false
            })
        });

        // Step 3: Process OpenRouter response
        if (!openrouterResponse.ok) {
            const errorBody = await openrouterResponse.text();
            console.error(`OpenRouter API request failed: ${openrouterResponse.status} ${openrouterResponse.statusText}`, errorBody);

            let apiErrorMessage = `${openrouterResponse.status} ${openrouterResponse.statusText}`;
            try {
                const errorJson = JSON.parse(errorBody);
                if (errorJson.error && errorJson.error.message) {
                    apiErrorMessage = `OpenRouter Error: ${errorJson.error.message}`;
                } else if (errorJson.message) { // Some APIs might have a different error structure
                     apiErrorMessage = `OpenRouter Error: ${errorJson.message}`;
                } else {
                     apiErrorMessage = `OpenRouter Error: ${errorBody}`;
                }
            } catch (e) {
                 // ignore json parse error, use status text
            }

            // Send an error response back to the client
            res.status(openrouterResponse.status >= 400 && openrouterResponse.status < 500 ? openrouterResponse.status : 500).json({
                // Prefix error clearly so frontend can display it
                error: `AI API failed: ${apiErrorMessage}`
            });
            return;
        }

        // Read the response body
        const data = await openrouterResponse.json();
        let aiResponseText = data.choices?.[0]?.message?.content || "";

        console.log("OpenRouter Response received.");

        // Optionally prepend search error message if it occurred
        if (searchError) {
             aiResponseText = `*(Note: Web search failed: ${searchError})*\n\n` + aiResponseText;
        }


        // Step 4: Send the AI response text back to the client
        res.status(200).json({ text: aiResponseText });

    } catch (error) {
        console.error("Serverless function error during processing:", error);
        res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
    }
};