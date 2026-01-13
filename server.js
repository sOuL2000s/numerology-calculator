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

// FIX 1: Initialize GoogleGenAI client and define models (to resolve 'ai is not defined' error)
// The client looks for the API key in process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({}); 
const numerologyModel = "gemini-2.5-flash"; 
const chatModel = "gemini-2.5-flash"; 

// Setup paths for serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_PATH = path.join(__dirname, 'public'); 

// Middleware
app.use(express.json());

// 1. Static File Serving: Point ALL static asset requests to the /public folder
app.use(express.static(PUBLIC_PATH)); 

// 2. Explicit Root Route: Serve index.html from the /public folder
app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_PATH, 'index.html')); 
});

// --- Numerology Helper Functions and Matrices ---

// Helper function to reduce a number to a single digit (1-9)
function calculateSingleDigit(num) {
    if (typeof num !== 'number') num = parseInt(num, 10);
    if (isNaN(num)) return 0;
    
    let s = String(num);
    
    while (s.length > 1) { 
        let sum = 0;
        for (let i = 0; i < s.length; i++) {
            sum += parseInt(s[i], 10);
        }
        s = String(sum);
    }
    return parseInt(s, 10);
}

// Helper function to calculate Birth Number (Day only)
function calculateBirthNumber(dob) {
    // Extract day component (DD)
    const day = new Date(dob).getUTCDate();
    return calculateSingleDigit(day);
}

// Helper function to calculate Life Path Number (M+D+Y)
function calculateLifePathNumber(dob) {
    const date = new Date(dob);
    // Note: JS Date month is 0-indexed, so add 1
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    
    // Sum all digits of M, D, and Y components and reduce
    const allDigits = String(month) + String(day) + String(year);
    let sum = 0;
    for (const digit of allDigits) {
        sum += parseInt(digit, 10);
    }
    
    return calculateSingleDigit(sum);
}

// Matrices: M[BirthNo - 1][LifePathNo - 1] 
const ARCHETYPE_MATRIX = [
    // Mission 1        2            3            4            5             6             7             8             9
    ["Pure Pioneer", "Diplomatic Leader", "Expressive Leader", "Structured Leader", "Versatile Leader", "Responsible Leader", "Intuitive Leader", "Powerful Leader", "Serving Leader"], 
    ["Leading Diplomat", "Pure Peacemaker", "Creative Partner", "Stable Partner", "Flexible Diplomat", "Nurturing Partner", "Analytical Partner", "Balanced Executive", "Supportive Humanitarian"], 
    ["Original Artist", "Harmonious Creator", "Pure Expression", "Structured Artist", "Free-Form Creator", "Nurturing Creator", "Inspirational Analyst", "Charming Executive", "Expressive Humanitarian"], 
    ["Leading Builder", "Cooperative Builder", "Social Organizer", "Pure Structure", "Rigid Freedom", "Nurturing Organizer", "Scientific Builder", "Executive Organizer", "Serving Builder"], 
    ["Dynamic Individual", "Social Adventurer", "Artistic Communicator", "Controlled Change", "Pure Seeker", "Restless Nurturer", "Intellectual Traveler", "Powerful Pioneer", "Global Adventurer"], 
    ["Authoritative Carer", "Pure Nurturer", "Joyful Healer", "Structured Provider", "Versatile Teacher", "Pure Service", "Intuitive Helper", "Executive Caretaker", "Serving Nurturer"], 
    ["Pioneering Seeker", "Harmonious Analyst", "Inspirational Thinker", "Technical Analyst", "Adventurous Seeker", "Responsible Philosopher", "Pure Wisdom", "Strategic Thinker", "Compassionate Seeker"], 
    ["Leading Executive", "Diplomatic Manager", "Charismatic Power", "Structured Authority", "Risk-Taking Leader", "Responsible Manager", "Analytical Executive", "Pure Power", "Serving Executive"], 
    ["Pioneering Altruist", "Peacekeeping Server", "Expressive Altruist", "Structured Compassion", "Versatile Server", "Pure Compassion", "Intuitive Humanitarian", "Powerful Philanthropist", "Pure Service"] 
];

const CAREER_MATRIX = [
    // Mission 1        2            3            4            5             6             7             8             9
    ["Solo Entrepreneur", "Team Lead / PM", "Advertising Executive", "Independent Architect", "Sales Pioneer", "Community Organizer", "Intellectual Property Lawyer", "Corporate CEO", "Global Change Agent"], 
    ["Diplomatic Negotiator", "Couples Counselor", "Event Planner / Host", "Collaborative Engineer", "HR Mediator", "Group Home Director", "Research Partner", "Financial Consultant", "International Aid Worker"], 
    ["Film Director", "Public Relations", "Motivational Speaker", "Graphic Designer", "Travel Writer / Blogger", "Teacher of the Arts", "Literary Critic / Editor", "Marketing Executive", "Documentary Filmmaker"], 
    ["General Contractor", "Office Administrator", "Technical Trainer", "Civil Engineer", "Operations Consultant", "Pediatric Nurse", "Technical Specialist", "Financial Controller", "Infrastructure Planner"], 
    ["Expedition Leader", "Foreign Service", "Stand-up Comedian", "Data Analyst", "Investigative Reporter", "Travel Agent", "Scientific Researcher", "Corporate Trainer", "Global Humanitarian"], 
    ["Primary Care Physician", "Marriage Counselor", "Music Therapist", "Home Builder", "Consumer Advocate", "Social Worker / Caretaker", "Veterinarian", "Hospital Administrator", "Nonprofit Director"], 
    ["Academic Dean", "Research Facilitator", "Spiritual Teacher", "Cryptographer", "Philosophical Lecturer", "Librarian / Archivist", "Theoretical Scientist", "Investment Strategist", "Ethicist / Philosopher"], 
    ["Business Owner", "Political Leader", "Corporate Lawyer", "Real Estate Developer", "Urban Planner", "Executive Recruiter", "M&A Analyst", "Stock Broker / Tycoon", "Political Lobbyist"], 
    ["Pioneering Altruist", "Peacekeeping Server", "Expressive Altruist", "Structured Compassion", "Versatile Server", "Pure Compassion", "Intuitive Humanitarian", "Powerful Philanthropist", "Global Activist / UN Worker"] 
];


// --- API Endpoints ---

// 1. Numerology Calculation Endpoint (Detailed Profile - replaces the old route)
app.post('/api/numerology-profile', async (req, res) => {
    const { name, dob } = req.body;

    if (!name || !dob) {
        return res.status(400).send({ error: "Name and Date of Birth are required." });
    }

    try {
        // Calculate necessary numbers (1-9)
        const birthNo = calculateBirthNumber(dob);
        const lifePathNo = calculateLifePathNumber(dob);

        // Lookup Archetype and Career based on matrices
        const archetype = ARCHETYPE_MATRIX[birthNo - 1][lifePathNo - 1];
        const career = CAREER_MATRIX[birthNo - 1][lifePathNo - 1];
        
        const numerologyPrompt = `
            You are a highly skilled, engaging, and detailed numerologist. Your analysis must be structured, professional, and insightful.
            The entire response MUST be formatted using rich Markdown (headers, lists, bolding, italics) for optimal presentation.

            **User Details:**
            *   Full Name (at birth): ${name}
            *   Date of Birth: ${dob}

            **Numerological Coordinates:**
            *   Personality/Birth Number: ${birthNo} 
            *   Mission/Life Path Number: ${lifePathNo} 
            *   Combined Archetype: ${archetype}
            *   Best Fit Career Vocation: ${career}

            **Instructions for Report Generation (Must Address All Points):**
            1.  **Title the Report:** Use the Archetype as the main title (e.g., "# The ${archetype} Profile").
            2.  **Section 1: Core Energies & Numbers.** Explain the meaning of the Personality Number (${birthNo}) and the Mission Number (${lifePathNo}).
            3.  **Section 2: The Combined Archetype (${archetype}).** Provide a detailed analysis of what this specific combination means for the user's life path, blending their innate personality and ultimate mission.
            4.  **Section 3: Career & Vocation (${career}).** Offer insight into why the suggested career path of "${career}" is a powerful fit for their combined energies, explaining the required skills and potential environment.
            5.  **Section 4: Destiny Number (Based on Name).** Calculate the Destiny Number based on the letters of the name (${name}) and provide a detailed explanation of its influence on their destiny and drive (The 'Why').
            6.  **Summary:** Provide a short, actionable summary titled "🚀 Navigating Your Path."
        `;

        const response = await ai.models.generateContent({
            model: numerologyModel,
            contents: numerologyPrompt,
        });
        
        res.json({ result: response.text });

    } catch (error) {
        console.error("Gemini Numerology Error:", error);
        res.status(500).send({ error: "Failed to generate comprehensive profile from AI." });
    }
});


// 2. Word/Number Profile Endpoint (Arbitrary Text Analysis)
app.post('/api/word-profile', async (req, res) => {
    const { input } = req.body; 

    if (!input) {
        return res.status(400).send({ error: "Input text or number is required." });
    }

    const wordPrompt = `
        You are an expert numerological analyst focusing on the energy and vibrational frequency of words, names, or concepts.
        Analyze the following input: "${input}".

        **Instructions:**
        1.  **Title:** Use the input as the title (e.g., "# Analysis of: ${input}").
        2.  **Calculation:** Calculate the final single-digit numerological value for the input string (using standard methods). Show the calculation steps clearly in the response.
        3.  **Core Vibration:** Explain the meaning of the resulting single digit in the context of the input (e.g., purpose, challenge, energy).
        4.  **Vibrational Profile:** Describe the general 'vibe' or profile of the input, including its inherent strengths and potential challenges.
        5.  **Actionable Insight:** Provide an actionable insight or prediction based on this vibrational analysis.
        6.  The entire response MUST be formatted using clear, professional Markdown.
    `;

    try {
        const response = await ai.models.generateContent({
            model: numerologyModel,
            contents: wordPrompt,
        });
        
        res.json({ result: response.text });

    } catch (error) {
        console.error("Gemini Word Profile Error:", error);
        res.status(500).send({ error: "Failed to generate word/number profile from AI." });
    }
});


// 3. Floating Chatbot Endpoint (Unchanged logic)
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
                systemInstruction: "You are the Destiny AI, a friendly and professional assistant embedded in a numerology website. Answer any question, but keep your responses engaging and professional. You MUST use Markdown for all formatting."
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