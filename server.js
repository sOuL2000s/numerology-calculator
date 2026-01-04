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

// Get directory name for serving static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const numerologyModel = "gemini-2.5-flash"; 
const chatModel = "gemini-2.5-flash"; 

// Middleware
app.use(express.json());
// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public'))); 
app.use(express.static(__dirname)); // Serve files from the root directory

// --- API Endpoints ---

// 1. Numerology Calculation Endpoint
app.post('/api/numerology', async (req, res) => {
    const { name, dob } = req.body;

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