// server.js
import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Setup ---
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// =========================================================
// FIX: Initialize GoogleGenAI client and define models
// =========================================================
// The client looks for the API key in process.env.GEMINI_API_KEY or process.env.AI_API_KEY
// Assuming GEMINI_API_KEY is set in your .env file
const ai = new GoogleGenAI({}); 

// Define model names used in API calls
const numerologyModel = "gemini-2.5-flash"; 
const chatModel = "gemini-2.5-flash"; 
// =========================================================

// Setup paths for serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_PATH = path.join(__dirname, 'public'); // Define the public path

// Middleware
app.use(express.json());

// 1. Static File Serving: Point ALL static asset requests to the /public folder
app.use(express.static(PUBLIC_PATH)); 

// 2. Explicit Root Route: Serve index.html from the /public folder
app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_PATH, 'index.html')); 
});

// --- REDUNDANT ROUTE REMOVED ---
// The following block was redundant and was pointing to the wrong index.html location.
/*
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
*/

// --- API Endpoints ---

// 1. Numerology Calculation Endpoint
app.post('/api/numerology', async (req, res) => {
    const { name, dob } = req.body;
// ... (rest of endpoint logic remains the same, but now 'ai' is defined)
    if (!name || !dob) {
        return res.status(400).send({ error: "Name and Date of Birth are required." });
    }

    const numerologyPrompt = `
        You are a highly skilled, engaging, and detailed numerologist. 
        Analyze the following person based on their details. The entire response 
        MUST be formatted using rich Markdown (headers, lists, bolding, italics) 
        for optimal presentation.

        **Details:**
        *   Full Name: ${name}
        *   Date of Birth: ${dob}

        **Instructions:**
        1.  Calculate and explain the **Life Path Number** (based on DOB).
        2.  Calculate and explain the **Destiny Number** (based on Name).
        3.  Provide a short summary section titled "🌟 Key Themes".
        4.  Ensure the Markdown is visually appealing and easy to read.
    `;

    try {
        const response = await ai.models.generateContent({
            model: numerologyModel,
            contents: numerologyPrompt,
        });
        
        // Gemini's text is already markdown, send it straight back.
        res.json({ result: response.text });

    } catch (error) {
        console.error("Gemini Numerology Error:", error);
        res.status(500).send({ error: "Failed to get numerology results from AI." });
    }
});


// 2. Floating Chatbot Endpoint
app.post('/api/chat', async (req, res) => {
    const { history, currentMessage } = req.body;
// ... (rest of endpoint logic remains the same, but now 'ai' and 'chatModel' are defined)
    if (!currentMessage) {
        return res.status(400).send({ error: "Message is required." });
    }
    
    // Convert client history format to Gemini's format
    const contents = history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));
    contents.push({ role: 'user', parts: [{ text: currentMessage }] });

    try {
        const response = await ai.models.generateContent({
            model: chatModel,
            contents: contents,
            config: {
                systemInstruction: "You are a friendly and helpful AI assistant embedded in a numerology website. Answer any question, but keep your responses engaging and professional. You MUST use Markdown for all formatting."
            }
        });

        res.json({ text: response.text });
        
    } catch (error) {
        console.error("Gemini Chat Error:", error);
        res.status(500).send({ error: "Failed to communicate with the chatbot." });
    }
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});