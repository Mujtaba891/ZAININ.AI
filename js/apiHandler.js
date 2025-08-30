// js/apiHandler.js
// ** CRITICAL SECURITY WARNING **
// DO NOT USE THIS CODE IN PRODUCTION WITH ACTUAL API KEYS ACCESSED CLIENT-SIDE.
// API KEYS ARE EXPOSED TO ANYONE INSPECTING THE BROWSER'S NETWORK OR SOURCE.
// ALWAYS USE A SECURE BACKEND SERVER OR SERVERLESS FUNCTION TO PROXY API CALLS.
// This implementation is SOLELY to fulfill the request for client-side functionality.

// --- Embedded Knowledge Base ---
const KNOWLEDGE_BASE_DATA = {
  "version": "1.0.0",
  "last_updated": "2025-08-30",
  "bot_identity": {
    "product_name": "Zainin AI",
    "tagline": "Your personal AI copilot built by Mujtaba Alam.",
    "short_description": "Zainin AI answers questions about the founder, projects, and supported topics; it can also search the web when explicitly asked.",
    "languages_supported": ["en", "hi", "ur"]
  },
  "founder": {
    "name": "Mujtaba Alam",
    "role": "Founder & Developer",
    "email": "mujtabaalam010@gmail.com",
    "country": "India",
    "skills": [
      "Web Development",
      "UI/UX",
      "JavaScript, HTML, CSS",
      "React, Node.js",
      "Firebase",
      "Product Design",
      "SEO basics"
    ],
    "projects": [
      {"name": "ArticleGlobe 3", "url": "https://articleglobe3.vercel.app"},
      {"name": "MD Colab", "url": "https://md-colab.vercel.app"},
      {"name": "HSS Larnoo", "url": "https://hss-larnoo.vercel.app/"},
      {"name": "Portfolio", "url": "https://mujtabaalam.vercel.app"}
    ],
    "vision": "Build helpful, fast, mobile-first tools for learners and creators.",
    "socials": {
      "github": "https://github.com/Mujtaba891",
      "twitter": "",
      "linkedin": ""
    }
  },
  "integrations": {
    "llm": "Google Gemini",
    "search": "DuckDuckGo", // Updated
    "notes": "Prefer first-party knowledge below. Only use web search when user explicitly asks for latest web results."
  },
  "capabilities": [
    "Answer FAQs about Zainin AI and the founder",
    "Explain supported projects and how to use them",
    "Generate frontend code snippets on request",
    "Provide general tech tutoring summaries",
    "Switch to web search on user command (e.g., 'search the web', 'latest', 'news')",
    "Provide real-time weather updates", // New
    "Generate images from text descriptions" // New
  ],
  "limitations": [
    "Does not provide personal/private data beyond what is listed here",
    "Does not give emails of third parties",
    "Avoids medical, legal, and financial advice"
  ],
  "routing_rules": {
    "priority": [
      "image_generation", // New priority
      "weather_lookup",   // New priority
      "zainin_ai_kb",
      "user_message_history",
      "web_search_when_requested"
    ],
    "disambiguation_phrases": [
      "About Zainin AI",
      "About Mujtaba",
      "Founder details",
      "Projects by Mujtaba",
      "MD Code",
      "Editor project",
      "E-commerce React/Node project"
    ],
    "trigger_keywords_to_use_kb_first": [
      "Zainin",
      "Mujtaba",
      "founder",
      "portfolio",
      "MD Code",
      "my project",
      "about me",
      "who built you",
      "who created you"
    ],
    "when_to_use_search": [ // Renamed from when_to_use_serpapi
      "search the web for",
      "latest",
      "today's news",
      "price now",
      "current score",
      "news",
      "find information on",
      "who is",
      "when was",
      "where is",
      "how to",
      "example of",
      "lyrics to",
      "stock price for",
      "map of",
      "images of",
      "videos of"
    ],
    "when_to_generate_image": [ // New routing rule
        /^generate an image of/i,
        /^create an image of/i,
        /^show me an image of/i,
        /^make a picture of/i,
        /^(image|picture) (of|about) /i
    ],
    "when_to_lookup_weather": [ // New routing rule
        /^what is the weather in/i,
        /^weather in/i,
        /^temperature in/i,
        /^forecast for/i,
        /^(current|local) weather in/i // Added 'in' to help parse location
    ]
  },
  "style_guide": {
    "tone": "friendly, concise, helpful",
    "lang_preference_order": ["hi", "en", "ur"],
    "examples": {
      "hi": "Bilkul! Yahaan aapke liye seedha jawab hai.",
      "en": "Sure—here’s a direct answer.",
      "ur": "جی ضرور—یہ رہا واضح جواب۔"
    }
  },
  "entities": [
    {
      "id": "proj-md-code",
      "name": "MD Code",
      "type": "project",
      "description": "A full-stack code editor with terminals (VS Code-like) for web and Android, featuring hidden terminal/preview, file/folder management, ZIP import/export, and auto-snippets."
    },
    {
      "id": "proj-ecom-react-node",
      "name": "E-commerce React/Node app",
      "type": "project",
      "description": "React + Node.js e-commerce with admin panel, supplier flow, cart/checkout, live price updates, tracking statuses, and category/subcategory management."
    },
    {
      "id": "proj-pdf-creator",
      "name": "Drag & Drop PDF Creator",
      "type": "project",
      "description": "Pure HTML/CSS/JS drag-and-drop PDF creator with futuristic UI."
    },
    {
      "id": "proj-mobile-editor",
      "name": "Mobile Code Editor",
      "type": "project",
      "description": "VS Code-like editor for mobile using only HTML/CSS/JS."
    }
  ],
  "glossary": [
    {"term": "Zainin AI", "definition": "Mujtaba Alam’s custom AI assistant."},
    {"term": "Gemini", "definition": "Google’s Large Language Model used by Zainin AI."},
    {"term": "DuckDuckGo", "definition": "A search engine used to fetch web results programmatically."}, // Updated
    {"term": "WeatherAPI.com", "definition": "A service to fetch real-time weather information."}, // New
    {"term": "Replicate", "definition": "A platform used for AI image generation, running models like Ideogram."} // New
  ],
  "how_to_answer_about_search": {
    "default": "Use KB first. If user requests web results, say you will search and then use DuckDuckGo.", // Updated
    "sample_reply_hi": "Main pehle apne knowledge base se jawab doon-ga. Agar aap kahenge ‘web se dhoondo’, main DuckDuckGo se latest laa sakta hoon." // Updated
  },
  "faq_general": [
    {
      "q": "What is Zainin AI?",
      "a": "Zainin AI is a personal AI copilot built by Mujtaba Alam. It prioritizes first-party knowledge about the founder and his projects, and can optionally search the web when asked."
    },
    {
      "q": "Who created you?",
      "a": "I was created by Mujtaba Alam (India). You can view his work at mujtabaalam.vercel.app and GitHub @Mujtaba891."
    },
    {
      "q": "Which model do you use?",
      "a": "I run on Google Gemini (gemini-2.0-flash) for language understanding and generation." // Updated model info
    },
    {
      "q": "Do you track users?",
      "a": "No. I only use the conversation context and this knowledge base unless the user explicitly asks for a web search."
    }
  ],
  "faq_founder": [
    {
      "q": "Founder kaun hai?",
      "a": "Founder Mujtaba Alam hain—web developer & UI/UX designer—jin-hon ne Zainin AI aur kai projects banaye."
    },
    {
      "q": "Mujtaba ke top projects kaun se hain?",
      "a": "ArticleGlobe 3, MD Colab, HSS Larnoo, personal portfolio, MD Code editor, e-commerce React/Node app, drag-and-drop PDF creator, and a mobile code editor."
    },
    {
      "q": "Contact kaise karen?",
      "a": "Email: mujtabaalam010@gmail.com. GitHub: github.com/Mujtaba891."
    }
  ],
  "faq_product": [
    {
      "q": "Can you search the web for me?",
      "a": "Yes—say 'search the web' or 'latest news about X' and I’ll use DuckDuckGo. Otherwise I answer from this knowledge base." // Updated
    },
    {
      "q": "Kya tum coding mein madad kar sakte ho?",
      "a": "Haan, main HTML/CSS/JS, React/Node aur frontend UI/UX tips mein madad karta hoon. Example code bhi de sakta hoon."
    },
    {
      "q": "Kya tum third-party logon ke emails doge?",
      "a": "Nahin. Main privacy ko respect karta hoon aur sirf publicly shared ya founder-provided info batata hoon."
    },
    {
        "q": "How can I get weather updates?",
        "a": "You can ask me for the weather in a specific location, like 'What's the weather in London?' and I will use WeatherAPI.com to fetch it for you."
    },
    {
        "q": "Can you generate images?",
        "a": "Yes! You can ask me to generate an image using a prompt, for example, 'Generate an image of a boy playing cricket on the moon.' I use Replicate for this."
    }
  ],
  "sample_user_queries": [
    "Who is the founder of Zainin AI?",
    "Zainin AI kis model par chalta hai?",
    "Mujtaba Alam ke projects dikhao.",
    "MD Code editor ki features batao.",
    "Search the web for latest React trends.",
    "Tum mujhe e-commerce app structure bata sakte ho?",
    "What can you do without web search?",
    "Founder ke contact details?",
    "Explain how your DuckDuckGo integration works.", // Updated
    "What's the weather in London?", // New
    "Generate an image of a cat in a spaceship.", // New
    "Show me the current weather in New York." // New
  ],
  "qa_bank": [
    {
      "intent": "about_founder_en",
      "q": "Tell me about the founder.",
      "a": "Zainin AI was created by Mujtaba Alam, a web developer and UI/UX designer from India. He builds fast, mobile-first tools and open web projects.",
      "aliases": ["who built you", "creator", "founder details", "about Mujtaba"]
    },
    {
      "intent": "about_founder_hi",
      "q": "Founder kaun hai?",
      "a": "Founder Mujtaba Alam hain—web developer aur UI/UX designer—jin-hon ne Zainin AI aur kai web projects banaye."
    },
    {
      "intent": "about_ai_en",
      "q": "What is Zainin AI and how does it work?",
      "a": "Zainin AI is a personal copilot that first checks this knowledge base and your chat context. If you ask for 'latest' or 'search the web', it uses DuckDuckGo and summarizes results via Gemini." // Updated
    },
    {
      "intent": "projects_list_en",
      "q": "Show me Mujtaba's projects.",
      "a": "Highlighted projects: ArticleGlobe 3, MD Colab, HSS Larnoo, Portfolio, MD Code editor, React/Node e-commerce app, Drag-and-Drop PDF Creator, Mobile Code Editor."
    },
    {
      "intent": "projects_usage_hi",
      "q": "MD Code ka use kaise karoon?",
      "a": "MD Code ek VS Code-jaisa editor hai. Features: hidden terminal/preview toggle, file/folder management, ZIP import/export, auto-snippets. Mobile aur desktop dono ke liye optimised."
    },
    {
      "intent": "privacy_en",
      "q": "Do you keep my data?",
      "a": "No. I only use your chat and this KB. I don’t share personal data and I avoid giving third-party private contacts."
    },
    {
      "intent": "web_search_switch_en",
      "q": "Can you get the latest updates?",
      "a": "Yes. Say 'search the web for <topic>' and I’ll fetch recent sources with DuckDuckGo and summarize them." // Updated
    },
    {
      "intent": "hi_smalltalk",
      "q": "Tum kaise ho?",
      "a": "Main theek hoon! Aap batayein, main kis mein madad kar sakta hoon?"
    },
    {
      "intent": "ur_about",
      "q": "Zainin AI کیا ہے؟",
      "a": "Zainin AI ایک ذاتی اسسٹنٹ ہے جو پہلے اپنے نالج بیس سے جواب دیتا ہے۔ تازہ معلومات کے لیے آپ کہیں تو ویب سرچ بھی کر سکتا ہے۔"
    }
  ],
  "prompting_instructions": {
    "system_preface": "Always answer from this JSON first. If user explicitly asks for latest/web results, call DuckDuckGo; otherwise avoid generic Google descriptions.", // Updated
    "refusal_rules": [
      "Do not provide third-party emails/phone numbers.",
      "Avoid unsafe content.",
      "For medical/legal/financial questions, provide a safe general disclaimer."
    ],
    "formatting": {
      "bullets": true,
      "code_blocks": true,
      "citations_for_web": true
    }
  },
  "contact_and_support": {
    "support_email": "mujtabaalam010@gmail.com",
    "issue_reporting": "Describe the issue and steps to reproduce; include screenshots if possible."
  },
  "changelogs": [
    {"date": "2025-08-30", "changes": "Initial KB created for Zainin AI with founder profile, projects, FAQs, and routing rules."}
  ]
};

// --- API Endpoints and Models ---
// Google Gemini API endpoints - unified to gemini-2.0-flash
const GOOGLE_GEMINI_CHAT_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GOOGLE_GEMINI_VISION_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const DUCKDUCKGO_API_URL = 'https://api.duckduckgo.com/?q='; // For programmatic search
const WEATHER_API_BASE_URL = 'https://api.weatherapi.com/v1/current.json'; // WeatherAPI.com
const REPLICATE_API_BASE_URL = 'https://api.replicate.com/v1/predictions'; // Replicate for image generation

// AI Model identifiers
const GEMINI_CHAT_MODEL = 'gemini-2.0-flash';
const GEMINI_VISION_MODEL = 'gemini-2.0-flash';
const REPLICATE_IMAGE_MODEL_SLUG = 'ideogram-ai/ideogram-v3-turbo'; // User specified model slug
const REPLICATE_IMAGE_MODEL_VERSION = '0a19e564d272793259ce2f80164b30113c2ce22c77d01340b8f04179e0996f57'; // Specific version for Ideogram v3 Turbo

// Heuristic keywords/patterns for new features (from KB for clarity)
// Note: These regex patterns need to be carefully designed to extract the *intent* and *parameters*
// The KB provides phrases, we convert them to Regex.
const SEARCH_TRIGGERS_REGEX = KNOWLEDGE_BASE_DATA.routing_rules.when_to_use_search.map(phrase => new RegExp(phrase, 'i'));
const IMAGE_GEN_TRIGGERS_REGEX = KNOWLEDGE_BASE_DATA.routing_rules.when_to_generate_image;
const WEATHER_TRIGGERS_REGEX = KNOWLEDGE_BASE_DATA.routing_rules.when_to_lookup_weather;

// --- API Configuration ---
const MAX_SEARCH_RESULTS_TO_SUMMARIZE = 3;
const MAX_SNIPPET_LENGTH = 150;
const MAX_HISTORY_MESSAGES = 10;

// --- Main Handler Function ---

/**
 * Handles fetching responses from Google Gemini (text or vision), DuckDuckGo, WeatherAPI, or Replicate.
 * Prioritizes answers from the embedded Knowledge Base (KB) and new external tools.
 * @param {string} userMessage - The user's current message.
 * @param {object} appSettings - Global admin settings including API keys/tokens and web search preference.
 *                               Expected structure: { geminiApiKey: '...', weatherApiKey: '...', replicateApiToken: '...', webSearchEnabled: true/false }.
 * @param {Array<object>} chatHistory - Array of previous {sender, text, timestamp, imageBase64?} messages for context.
 * @param {string|null} imageBase64 - Base64 encoded image string if an image is provided.
 * @returns {Promise<string>} - A promise resolving to the bot's response text (can be formatted markdown), an image URL, or an error message.
 */
async function generateResponse(userMessage, appSettings, chatHistory = [], imageBase64 = null) {
    console.log("generateResponse called.");
    console.log(`Using Gemini Chat Model: ${GEMINI_CHAT_MODEL}`);
    console.log(`Using Gemini Vision Model: ${GEMINI_VISION_MODEL}`);
    console.log(`Using Replicate Image Model: ${REPLICATE_IMAGE_MODEL_SLUG}`);
    console.log("Settings received (includes UNSAFE exposed keys/tokens if present):", {
        geminiApiKey: appSettings?.geminiApiKey ? '***' : 'N/A',
        weatherApiKey: appSettings?.weatherApiKey ? '***' : 'N/A',
        replicateApiToken: appSettings?.replicateApiToken ? '***' : 'N/A',
        webSearchEnabled: appSettings?.webSearchEnabled
    });
    console.log("Chat History length provided for context:", chatHistory.length);
    console.log(`Image provided: ${!!imageBase64}`);

    const geminiApiKey = appSettings?.geminiApiKey || null;
    const weatherApiKey = appSettings?.weatherApiKey || null;
    const replicateApiToken = appSettings?.replicateApiToken || null;
    const webSearchEnabled = appSettings?.webSearchEnabled || false;

    if (!geminiApiKey) {
        console.error("Google Gemini API key is missing.");
        return "Error: Google Gemini API key is missing. Please contact support (admin needs to configure it).";
    }

    // --- 1. Prioritize Image Recognition if an image is provided ---
    if (imageBase64) {
        console.log("Performing Google Gemini Vision multimodal chat...");
        try {
            const visionResponse = await performGeminiVisionChat(userMessage, geminiApiKey, chatHistory, imageBase64);
            console.log("Gemini Vision response received.");
            return visionResponse;
        } catch (error) {
            console.error("Google Gemini Vision failed:", error);
            let userFacingError = `An error occurred with image recognition: ${error.message}.`;
            if (error.message.includes("403")) {
                userFacingError += " Please check the Google Gemini API key in the Admin Panel and ensure the Generative Language API is enabled.";
            } else if (error.message.includes("404")) {
                userFacingError += ` The model '${GEMINI_VISION_MODEL}' might not be available for your API key.`;
            }
            return userFacingError;
        }
    }

    // --- 2. Check for Image Generation Command ---
    const imagePromptMatch = IMAGE_GEN_TRIGGERS_REGEX.find(trigger => trigger.test(userMessage));
    if (imagePromptMatch) {
        if (!replicateApiToken) {
            console.warn("Image generation requested but Replicate API Token is missing.");
            return "Error: Replicate API Token is missing. Admin needs to configure it to generate images.";
        }
        const imagePrompt = userMessage.replace(imagePromptMatch, '').trim();
        if (!imagePrompt) {
            return "Please provide a description for the image you want to generate (e.g., 'generate an image of a cat').";
        }
        console.log(`Generating image for prompt: "${imagePrompt}"`);
        try {
            return await generateImage(imagePrompt, replicateApiToken); // This will return an image URL
        } catch (error) {
            console.error("Image generation failed:", error);
            return `Error generating image: ${error.message}`;
        }
    }

    // --- 3. Check for Weather Lookup Command ---
    const weatherMatch = WEATHER_TRIGGERS_REGEX.find(trigger => trigger.test(userMessage));
    if (weatherMatch) {
        if (!weatherApiKey) {
            console.warn("Weather lookup requested but WeatherAPI.com Key is missing.");
            return "Error: WeatherAPI.com Key is missing. Admin needs to configure it to get weather updates.";
        }
        // Extract location: Attempt to capture what follows the trigger phrase.
        const locationMatch = userMessage.match(/(?:in|for)\s+([a-zA-Z\s]+(?:,\s*[a-zA-Z\s]+)*)/i); // e.g., "in London", "for New York, USA"
        let location = locationMatch ? locationMatch[1].trim() : userMessage.replace(weatherMatch, '').trim();
        
        // Refine location for generic queries or if still empty
        if (!location || location.toLowerCase().includes('today') || location.toLowerCase().includes('now')) {
            return "Please specify a clear city or region for the weather update (e.g., 'weather in London' or 'temperature in Paris').";
        }

        console.log(`Looking up weather for: "${location}"`);
        try {
            return await performWeatherLookup(location, weatherApiKey);
        } catch (error) {
            console.error("Weather lookup failed:", error);
            return `Error getting weather for ${location}: ${error.message}. Please check the location spelling or try a different place.`;
        }
    }


    // --- 4. Check Embedded Knowledge Base for an answer (text-only queries) ---
    const kbAnswer = findAnswerInKB(userMessage);
    if (kbAnswer) {
        console.log("Answer found in Knowledge Base.");
        return formatKBAnswer(kbAnswer);
    }

    // --- 5. If no KB answer, proceed with potential web search or general Gemini AI ---
    const needsSearch = webSearchEnabled && SEARCH_TRIGGERS_REGEX.some(trigger => trigger.test(userMessage));
    console.log(`Web search enabled: ${webSearchEnabled}, Query triggers search: ${needsSearch}. Final decision: ${needsSearch ? 'Perform Search' : 'Direct to AI'}`);

    let searchResultsText = null;

    if (needsSearch) {
        console.log("Performing DuckDuckGo search...");
        try {
            const duckduckgoData = await performWebSearch(userMessage); // Renamed
            searchResultsText = formatWebSearchResults(duckduckgoData); // Renamed
            console.log("Formatted Web Search Results:\n", searchResultsText);

        } catch (error) {
            console.error("Web search failed:", error);
            searchResultsText = `Web search failed: ${error.message}. Proceeding without search results.`;
        }
    }

    // --- 6. Perform Gemini Chat Completion (Text-only, potentially with search results) ---
    console.log("Performing Google Gemini chat completion (text-only)...");
    try {
        const aiResponse = await performGeminiChat(userMessage, geminiApiKey, chatHistory, searchResultsText);
        console.log("Gemini chat response received.");
        return aiResponse;

    } catch (error) {
        console.error("Google Gemini chat completion failed:", error);
        let userFacingError = `An error occurred while getting the AI response: ${error.message}.`;
        if (error.message.includes("403")) {
            userFacingError += " Please check your Google Gemini API key in the Admin Panel and ensure the Generative Language API is enabled.";
        } else if (error.message.includes("404")) {
            userFacingError += ` The model '${GEMINI_CHAT_MODEL}' might not be available for your API key.`;
        } else if (error.message.includes("rate limit")) {
            userFacingError += " You might have hit a rate limit.";
        }
        return userFacingError;
    }
}


// --- KB Helper Functions ---

/**
 * Searches the embedded knowledge base for a direct answer or relevant entry.
 * @param {string} query - The user's message.
 * @returns {object|null} - The matched KB entry (e.g., from qa_bank, faq_general, etc.) or null.
 */
function findAnswerInKB(query) {
    const lowerQuery = query.toLowerCase();

    // Check FAQ sections first
    for (const faqCategory of ['faq_general', 'faq_founder', 'faq_product']) {
        for (const entry of KNOWLEDGE_BASE_DATA[faqCategory]) {
            if (entry.q.toLowerCase().includes(lowerQuery)) {
                return entry;
            }
        }
    }

    // Check QA Bank with aliases and keywords
    for (const entry of KNOWLEDGE_BASE_DATA.qa_bank) {
        if (entry.q.toLowerCase().includes(lowerQuery) ||
            (entry.aliases && entry.aliases.some(alias => lowerQuery.includes(alias.toLowerCase()))) ||
            KNOWLEDGE_BASE_DATA.routing_rules.trigger_keywords_to_use_kb_first.some(keyword => lowerQuery.includes(keyword.toLowerCase()))) {
            return entry;
        }
    }

    // Check Projects entities (e.g., asking about "MD Code")
    for (const entity of KNOWLEDGE_BASE_DATA.entities) {
        if (lowerQuery.includes(entity.name.toLowerCase()) ||
            KNOWLEDGE_BASE_DATA.routing_rules.disambiguation_phrases.some(phrase => lowerQuery.includes(phrase.toLowerCase()))) {
            return {
                q: query,
                a: `${entity.name}: ${entity.description} (Learn more at ${KNOWLEDGE_BASE_DATA.founder.projects.find(p => p.name === entity.name)?.url || 'link not available'})`,
                source: 'Entities'
            };
        }
    }
    
    // Check founder details if explicitly asked or keywords hit
    if (KNOWLEDGE_BASE_DATA.routing_rules.trigger_keywords_to_use_kb_first.some(keyword => lowerQuery.includes(keyword.toLowerCase())) || lowerQuery.includes('founder') || lowerQuery.includes('mujtaba')) {
         if (lowerQuery.includes('contact') || lowerQuery.includes('email')) {
             return { q: query, a: `You can contact Mujtaba Alam at ${KNOWLEDGE_BASE_DATA.founder.email}. You can also find him on GitHub: ${KNOWLEDGE_BASE_DATA.founder.socials.github}`, source: 'Founder Contact' };
         }
         if (lowerQuery.includes('skills') || lowerQuery.includes('expertise')) {
             return { q: query, a: `Mujtaba Alam's skills include: ${KNOWLEDGE_BASE_DATA.founder.skills.join(', ')}.`, source: 'Founder Skills' };
         }
         if (lowerQuery.includes('projects')) {
            const projectList = KNOWLEDGE_BASE_DATA.founder.projects.map(p => `* [${p.name}](${p.url})`).join('\n');
            return { q: query, a: `Mujtaba Alam's projects include:\n${projectList}`, source: 'Founder Projects' };
         }
         // Generic founder info
         return { q: query, a: `${KNOWLEDGE_BASE_DATA.founder.name} is the ${KNOWLEDGE_BASE_DATA.founder.role} of ${KNOWLEDGE_BASE_DATA.bot_identity.product_name}. He is based in ${KNOWLEDGE_BASE_DATA.founder.country}.`, source: 'Founder Info' };
    }

    // Check general bot info if query matches
    if (lowerQuery.includes(KNOWLEDGE_BASE_DATA.bot_identity.product_name.toLowerCase()) || lowerQuery.includes('what are you') || lowerQuery.includes('who are you')) {
         return { q: query, a: `${KNOWLEDGE_BASE_DATA.bot_identity.short_description} ${KNOWLEDGE_BASE_DATA.bot_identity.tagline}`, source: 'Bot Identity' };
    }


    return null; // No relevant answer found in KB
}

/**
 * Formats a KB answer according to style guide.
 * @param {object} entry - The KB entry.
 * @returns {string} - Formatted answer.
 */
function formatKBAnswer(entry) {
    let answer = entry.a;
    // const styleGuide = KNOWLEDGE_BASE_DATA.style_guide; // Not directly used for simple KB formatting here

    if (entry.source) {
        answer += `\n\n(Source: ${entry.source})`;
    }
    return answer;
}


// --- External API Fetcher Functions ---

/**
 * Performs a search using DuckDuckGo API (Instant Answer).
 * @param {string} query - The search query.
 * @returns {Promise<object>} - Promise resolving to the parsed JSON response from DuckDuckGo.
 * @throws {Error} - Throws an error if the fetch fails or returns a non-OK status.
 */
async function performWebSearch(query) { // Renamed from performDuckDuckGoSearch
    const webSearchApiUrl = `${DUCKDUCKGO_API_URL}${encodeURIComponent(query)}&format=json`;
    console.log("Fetching DuckDuckGo URL:", webSearchApiUrl);

    const response = await fetch(webSearchApiUrl);

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("DuckDuckGo HTTP Error Details:", response.status, response.statusText, errorBody);
        throw new Error(`DuckDuckGo HTTP Error: ${response.status} ${response.statusText}.`);
    }

    const webSearchData = await response.json(); // Renamed
    console.log("Raw DuckDuckGo Response:", webSearchData);
    return webSearchData;
}

/**
 * Formats the raw JSON response from DuckDuckGo into a readable markdown string.
 * @param {object} webSearchData - The parsed JSON response from DuckDuckGo.
 * @returns {string} - Formatted markdown text summarizing search results.
 */
function formatWebSearchResults(webSearchData) { // Renamed from formatDuckDuckGoResults
    let formattedText = "--- Web Search Results (DuckDuckGo) ---\n\n";
    let resultsCount = 0;

    // Direct answer (AbstractText or Abstract)
    if (webSearchData.AbstractText) {
        formattedText += `**Summary:** ${escapeMarkdown(webSearchData.AbstractText)}\n\n`;
        resultsCount++;
    } else if (webSearchData.Abstract) {
        formattedText += `**Summary:** ${escapeMarkdown(webSearchData.Abstract)}\n\n`;
        resultsCount++;
    }

    // Related topics
    if (webSearchData.RelatedTopics && webSearchData.RelatedTopics.length > 0) {
        formattedText += "**Related Topics:**\n";
        webSearchData.RelatedTopics.slice(0, MAX_SEARCH_RESULTS_TO_SUMMARIZE).forEach(topic => {
            if (topic.Text && topic.FirstURL) {
                formattedText += `* **[${escapeMarkdown(topic.Text)}](${topic.FirstURL})**\n`;
                resultsCount++;
            }
        });
        formattedText += '\n';
    }

    // Wikipedia/Source
    if (webSearchData.AbstractSource && webSearchData.AbstractURL) {
         formattedText += `**Source:** [${escapeMarkdown(webSearchData.AbstractSource)}](${webSearchData.AbstractURL})\n\n`;
         resultsCount++;
    }

    if (resultsCount === 0) {
        formattedText += "No highly relevant web search results found.\n"; // More specific message
    }

    formattedText += "--------------------\n\n";
    return formattedText;
}


/**
 * Performs a weather lookup using WeatherAPI.com.
 * @param {string} location - The city/location for weather.
 * @param {string} apiKey - The WeatherAPI.com key.
 * @returns {Promise<string>} - Formatted weather string.
 * @throws {Error} - Throws an error if the API call fails.
 */
async function performWeatherLookup(location, apiKey) {
    const weatherApiUrl = `${WEATHER_API_BASE_URL}?key=${apiKey}&q=${encodeURIComponent(location)}`;
    console.log("Fetching WeatherAPI URL:", weatherApiUrl);

    const response = await fetch(weatherApiUrl);

    if (!response.ok) {
        const errorBody = await response.json();
        console.error("WeatherAPI HTTP Error Details:", response.status, response.statusText, errorBody);
        if (errorBody.error && errorBody.error.message) {
            // Provide a more specific error message based on common WeatherAPI errors
            if (errorBody.error.code === 1006) { // No matching location found
                throw new Error(`Location not found: "${location}". Please provide a valid city or region.`);
            }
            if (errorBody.error.code === 2007 || errorBody.error.code === 2008) { // API key issues
                 throw new Error(`WeatherAPI key issue. Please check the key in the Admin Panel.`);
            }
            throw new Error(`WeatherAPI Error: ${errorBody.error.message}`);
        }
        throw new Error(`WeatherAPI HTTP Error: ${response.status} ${response.statusText}.`);
    }

    const weatherData = await response.json();
    console.log("Raw WeatherAPI Response:", weatherData);

    if (weatherData.current && weatherData.location) {
        const { temp_c, feelslike_c, condition, wind_kph, humidity } = weatherData.current;
        const { name, region, country, localtime } = weatherData.location;

        return `Current weather in ${name}, ${region}, ${country} (Local time: ${localtime}):
*   **Condition:** ${condition.text}
*   **Temperature:** ${temp_c}°C (Feels like ${feelslike_c}°C)
*   **Wind:** ${wind_kph} kph
*   **Humidity:** ${humidity}%`;
    } else {
        throw new Error("Could not retrieve current weather data for the specified location.");
    }
}


/**
 * Generates an image using Replicate's Ideogram v3 Turbo model.
 * @param {string} prompt - The text prompt for image generation.
 * @param {string} apiToken - The Replicate API token.
 * @returns {Promise<string>} - URL of the generated image.
 * @throws {Error} - Throws an error if the generation fails.
 */
async function generateImage(prompt, apiToken) {
    console.log(`Sending image generation request to Replicate for prompt: "${prompt}"`);

    const headers = {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json',
    };

    // The endpoint for a specific model's predictions is /v1/models/{owner}/{name}/predictions
    const replicateModelUrl = `https://api.replicate.com/v1/models/${REPLICATE_IMAGE_MODEL_SLUG}/predictions`;

    // 1. Create a prediction (initial request)
    const createPredictionResponse = await fetch(replicateModelUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            input: {
                prompt: prompt,
                // Using a specific version ID is more reliable for Replicate.
                // You would need to get the latest version ID from Replicate's website or API.
                // For Ideogram v3 Turbo, a known version ID (as of early 2024) is used.
                version: REPLICATE_IMAGE_MODEL_VERSION, // Ensure this version ID is correct and active
                width: 1024,
                height: 1024,
                num_outputs: 1,
            },
        }),
    });

    if (!createPredictionResponse.ok) {
        const errorBody = await createPredictionResponse.json();
        console.error("Replicate Create Prediction Error:", createPredictionResponse.status, createPredictionResponse.statusText, errorBody);
        if (createPredictionResponse.status === 401) {
             throw new Error("Replicate API Token is invalid or expired. Please check Admin Panel.");
        }
        throw new Error(`Failed to start image generation: ${errorBody.detail || errorBody.message || createPredictionResponse.statusText}`);
    }

    const predictionData = await createPredictionResponse.json();
    console.log("Replicate Prediction Created:", predictionData);

    const predictionUrl = predictionData.urls.get; // URL to poll for results

    // 2. Poll for the result
    let imageUrl = null;
    let status = predictionData.status;

    // Set a timeout for polling to prevent infinite loops on stuck predictions
    const maxPollAttempts = 30; // 30 attempts * 2 seconds = 60 seconds timeout
    let attempt = 0;

    while (status !== 'succeeded' && status !== 'failed' && status !== 'canceled' && attempt < maxPollAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2 seconds
        const pollResponse = await fetch(predictionUrl, { headers: headers });
        if (!pollResponse.ok) {
            const errorBody = await pollResponse.json();
            console.error("Replicate Poll Error:", pollResponse.status, pollResponse.statusText, errorBody);
            throw new Error(`Failed to poll image generation status: ${errorBody.detail || errorBody.message || pollResponse.statusText}`);
        }
        const pollData = await pollResponse.json();
        status = pollData.status;
        console.log(`Replicate polling status: ${status}`);

        if (status === 'succeeded' && pollData.output && pollData.output.length > 0) {
            imageUrl = pollData.output[0]; // Assuming the first output image is desired
            break;
        } else if (status === 'failed' || status === 'canceled') {
            throw new Error(`Image generation ${status}: ${pollData.error || 'Unknown error'}`);
        }
        attempt++;
    }

    if (!imageUrl) {
        if (attempt >= maxPollAttempts) {
             throw new Error("Image generation timed out. Please try a different prompt or try again later.");
        }
        throw new Error("Image generation completed, but no image URL was returned.");
    }

    return imageUrl;
}


/**
 * Performs the actual fetch call to the Google Gemini chat completions endpoint (text-only).
 * Using gemini-2.0-flash for consistency and availability.
 * @param {string} userMessage - The current user's message.
 * @param {string} apiKey - The Google Gemini API key.
 * @param {Array<object>} chatHistory - Array of previous {sender, text} messages.
 * @param {string|null} searchResultsText - Formatted search results text to include in the prompt, or null.
 * @returns {Promise<string>} - Promise resolving to the bot's generated text.
 * @throws {Error} - Throws an error if the fetch fails or returns a non-OK status.
 */
async function performGeminiChat(userMessage, apiKey, chatHistory, searchResultsText = null) {
    const contents = [];

    // System instruction (from KB)
    let systemInstruction = `You are ${KNOWLEDGE_BASE_DATA.bot_identity.product_name}, ${KNOWLEDGE_BASE_DATA.bot_identity.tagline}. ${KNOWLEDGE_BASE_DATA.prompting_instructions.system_preface}`;
    systemInstruction += `\nRefusal Rules: ${KNOWLEDGE_BASE_DATA.prompting_instructions.refusal_rules.join(' ')}`;
    systemInstruction += `\nMaintain a ${KNOWLEDGE_BASE_DATA.style_guide.tone} tone.`;


    // Add limited chat history for context
    const limitedHistory = chatHistory.slice(-MAX_HISTORY_MESSAGES);
    limitedHistory.forEach(msg => {
        contents.push({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        });
    });

    // Add the current user message.
    // If searchResultsText is present, prepend it to the user's message for context.
    let userContent = userMessage;
    if (searchResultsText) {
        userContent = `${systemInstruction}\n\n--- Web Search Results ---\n${searchResultsText}\n------------------------\n\nUser Query: ${userMessage}`;
    } else {
        userContent = `${systemInstruction}\n\nUser Query: ${userMessage}`;
    }

    contents.push({
        role: 'user',
        parts: [{ text: userContent }]
    });

    console.log("Contents sent to Gemini Chat API:", JSON.stringify(contents, null, 2));

    const response = await fetch(`${GOOGLE_GEMINI_CHAT_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: contents,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1000,
            },
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Gemini Chat HTTP Error Details:", response.status, response.statusText, errorBody);
        let errorMessage = `Gemini Chat HTTP Error: ${response.status} ${response.statusText}.`;

        try {
            const errorJson = JSON.parse(errorBody);
            if (errorJson.error?.message) {
                errorMessage += ` Details: ${errorJson.error.message}`;
            } else {
                errorMessage += ` Body: ${errorBody.substring(0, 150)}...`;
            }
        } catch (parseError) { }

        if (response.status === 403) {
            errorMessage += " Please check your Google Gemini API key in the Admin Panel and ensure the Generative Language API is enabled.";
        } else if (response.status === 404) {
             errorMessage += ` The model '${GEMINI_CHAT_MODEL}' might not be available for your API key.`;
        }

        throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("Raw Gemini Chat Response:", data);

    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts) {
        const textParts = data.candidates[0].content.parts
            .filter(part => part.text)
            .map(part => part.text)
            .join('\n');
        if (textParts) {
            return textParts;
        } else {
            console.warn("Gemini Chat response missing text content:", data.candidates[0].content);
            throw new Error("Received an empty or unexpected content from the AI.");
        }
    } else if (data.promptFeedback?.blockReason) {
         console.warn("Gemini Chat response blocked:", data.promptFeedback.blockReason);
         throw new Error(`AI response blocked due to safety concerns: ${data.promptFeedback.blockReason}`);
    } else {
        console.warn("Gemini Chat response missing candidates or content:", data);
        throw new Error("Received an empty or unexpected response from the AI.");
    }
}


/**
 * Performs the actual fetch call to Google Gemini Vision endpoint (multimodal).
 * Using gemini-2.0-flash for consistency and availability.
 * @param {string} userMessage - The current user's message.
 * @param {string} apiKey - The Google Gemini API key.
 * @param {Array<object>} chatHistory - Array of previous {sender, text, imageBase64} messages.
 * @param {string} imageBase64 - Base64 encoded image string.
 * @returns {Promise<string>} - Promise resolving to the bot's generated text.
 * @throws {Error} - Throws an error if the fetch fails or returns a non-OK status.
 */
async function performGeminiVisionChat(userMessage, apiKey, chatHistory, imageBase64) {
    const contents = [];

    // System instruction (from KB)
    const systemInstruction = `You are ${KNOWLEDGE_BASE_DATA.bot_identity.product_name}, ${KNOWLEDGE_BASE_DATA.bot_identity.tagline}. ${KNOWLEDGE_BASE_DATA.prompting_instructions.system_preface}` +
                              `\nRefusal Rules: ${KNOWLEDGE_BASE_DATA.prompting_instructions.refusal_rules.join(' ')}` +
                              `\nMaintain a ${KNOWLEDGE_BASE_DATA.style_guide.tone} tone.`;


    // Add limited chat history for context (text-only parts)
    const limitedHistory = chatHistory.slice(-MAX_HISTORY_MESSAGES);
    limitedHistory.forEach(msg => {
        contents.push({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        });
    });

    // Construct the parts for the *current* user message, including system instruction, text and image.
    const currentUserMessageParts = [{ text: systemInstruction }];

    if (userMessage) {
        currentUserMessageParts.push({ text: userMessage });
    }

    // Extract base64 data and MIME type from the data URI
    const base64Parts = imageBase64.split(',');
    const mimeType = base64Parts[0].split(':')[1].split(';')[0];
    const rawBase64Data = base64Parts[1];

    if (rawBase64Data && mimeType) {
        currentUserMessageParts.push({
            inline_data: {
                mime_type: mimeType,
                data: rawBase64Data
            }
        });
    } else {
        throw new Error("Invalid imageBase64 format provided for Gemini Vision API.");
    }

    // Add the current user message with its multimodal parts to the conversation.
    contents.push({ role: 'user', parts: currentUserMessageParts });

    console.log("Contents sent to Gemini Vision API:", JSON.stringify(contents, null, 2));

    const response = await fetch(`${GOOGLE_GEMINI_VISION_API_URL}?key=${apiKey}`, {
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
        } catch (parseError) { }

        if (response.status === 403) {
            errorMessage += " Please check your Google Gemini API key in the Admin Panel and ensure the Generative Language API is enabled for your Google Cloud Project.";
        } else if (response.status === 404) {
             errorMessage += ` The model '${GEMINI_VISION_MODEL}' might not be available or incorrectly specified for your API key.`;
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