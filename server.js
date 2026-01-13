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

// Initialize GoogleGenAI client and define models
const ai = new GoogleGenAI({}); 
const numerologyModel = "gemini-2.5-flash-preview-09-2025"; 
const chatModel = "gemini-2.5-flash-preview-09-2025"; 

// Setup paths for serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_PATH = path.join(__dirname, 'public'); 

// Middleware
app.use(express.json());

// 1. Static File Serving
app.use(express.static(PUBLIC_PATH)); 

// 2. Explicit Root Route
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
    const date = new Date(dob);
    // Ensure we handle date parsing robustly, using UTC methods
    const day = date.getUTCDate();
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
    
    // Note: The reduction maintains consistency with the 1-9 planetary mapping.
    return calculateSingleDigit(sum);
}

// --- NEW: Name Calculation (Destiny Number) ---
const NAME_MAPPING = {
    A: 1, I: 1, J: 1, Q: 1, Y: 1,
    B: 2, K: 2, R: 2,
    C: 3, G: 3, L: 3, S: 3,
    D: 4, M: 4, T: 4,
    E: 5, H: 5, N: 5, X: 5,
    U: 6, V: 6, W: 6,
    O: 7, Z: 7,
    F: 8, P: 8,
};

function calculateDestinyNumber(name) {
    if (!name) return 0;
    // Normalize name: uppercase and remove non-alphabetic characters
    name = name.toUpperCase().replace(/[^A-Z]/g, ''); 
    let sum = 0;
    for (const letter of name) {
        sum += NAME_MAPPING[letter] || 0;
    }
    // The Destiny Number is often reduced fully
    return calculateSingleDigit(sum);
}


// --- Planetary Mapping Matrix (Vedic Grahas) ---
const PLANETARY_MAPPING = {
    1: { planet: "Sun (Surya ☉)", day: "Sunday", influence: "Authority, Soul, Leadership, Vitality, Ego." },
    2: { planet: "Moon (Chandra ☽)", day: "Monday", influence: "Mind, Emotions, Intuition, Fluctuation, Nurturing." },
    3: { planet: "Jupiter (Guru ♃)", day: "Thursday", influence: "Wisdom, Growth, Guidance, Fortune, Expansion." },
    4: { planet: "Rahu (☊ - North Node)", day: "Saturday/Wednesday (often mixed)", influence: "Innovation, Rebellion, Illusions, Unexpected Change, Material Obsession." },
    5: { planet: "Mercury (Budh ☿)", day: "Wednesday", influence: "Communication, Intellect, Versatility, Business Acumen, Youthfulness." },
    6: { planet: "Venus (Shukra ♀)", day: "Friday", influence: "Love, Beauty, Luxury, Comforts, Relationships, Arts." },
    7: { planet: "Ketu (☋ - South Node)", day: "Thursday/Tuesday (often mixed)", influence: "Spirituality, Detachment, Research, Introspection, Past Life Karma." },
    8: { planet: "Saturn (Shani ♄)", day: "Saturday", influence: "Karma, Discipline, Delays, Structure, Responsibility, Hard Work." },
    9: { planet: "Mars (Mangal ♂)", day: "Tuesday", influence: "Energy, Courage, Action, Initiative, Conflict, Drive." }
};

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

// 1. Numerology Calculation Endpoint (Structured Profile Output)
app.post('/api/numerology-profile', async (req, res) => {
    const { name, dob } = req.body;

    if (!name || !dob) {
        return res.status(400).send({ error: "Name and Date of Birth are required." });
    }

    try {
        // Calculate necessary numbers (1-9)
        const birthNo = calculateBirthNumber(dob);
        const lifePathNo = calculateLifePathNumber(dob);
        const destinyNo = calculateDestinyNumber(name); // Destiny Number

        // Lookup Archetype and Career based on matrices
        const archetype = ARCHETYPE_MATRIX[birthNo - 1][lifePathNo - 1];
        const career = CAREER_MATRIX[birthNo - 1][lifePathNo - 1];
        
        // Lookup Planetary Data
        const birthPlanet = PLANETARY_MAPPING[birthNo];
        const missionPlanet = PLANETARY_MAPPING[lifePathNo];
        const destinyPlanet = PLANETARY_MAPPING[destinyNo]; 
        
        if (!birthPlanet || !missionPlanet || !destinyPlanet) {
             throw new Error("Invalid numerology calculation result (1-9 mapping failure).");
        }

        const numerologyPrompt = `
            You are a highly skilled, engaging, and detailed numerologist and Vedic astrologer (Jyotish). Your response MUST be a single, clean JSON object that strictly adheres to the provided schema. Do not include any text outside the JSON object. Use rich Markdown syntax (lists, bolding, headings) within the string fields for optimal rendering.

            **Core Data:**
            *   Full Name: ${name}
            *   Date of Birth: ${dob}
            *   Personality/Birth Number: ${birthNo} (Governed by ${birthPlanet.planet})
            *   Mission/Life Path Number: ${lifePathNo} (Governed by ${missionPlanet.planet})
            *   Destiny Number (Name Vibe): ${destinyNo} (Governed by ${destinyPlanet.planet})
            *   Combined Archetype: ${archetype}
            *   Best Fit Career Vocation: ${career}
            *   Planetary Day of Strength: ${birthPlanet.day}

            **Instructions for JSON Content Generation:**
            1.  **title:** Must be the Archetype as the main title (e.g., "The ${archetype} Destiny Profile").
            2.  **lifePathSummary:** Explain the meaning of the combined Archetype (${archetype}). Detail the interplay between the Birth Number (${birthNo}) and the Life Path Number (${lifePathNo}) in Chaldean terms.
            3.  **vedicFusion:** Provide a deep, detailed analysis (Jyotish Focus) of how the governing planets—${birthPlanet.planet} (Personality) and ${missionPlanet.planet} (Mission)—flavor the user's life according to Vedic wisdom. Discuss core karmic themes and disposition (Prakriti) imparted by these two Grahas.
            4.  **strengths:** Identify three key positive personality traits and inherent talents resulting from this specific numerical and planetary fusion. Use a markdown list.
            5.  **challenges:** Identify three key potential struggles, pitfalls, or growth areas (often linked to planetary doshas or numerical conflicts). Use a markdown list.
            6.  **remedies:** Provide three specific, practical Vedic remedial suggestions (Upayes) based on the combined planetary influences (e.g., mantra recommendations, specific days/colors to utilize, offerings, or activities). Mention utilizing their Planetary Day of Strength (${birthPlanet.day}). Use a markdown list.
            7.  **destinyExplanation:** Provide a detailed explanation of the Destiny Number (${destinyNo}) and its planetary ruler (${destinyPlanet.planet}). Explain how this energy shapes the user's ultimate life expression and impact on the world.
        `;

        // Define the JSON structure for the Gemini API call
        const numerologySchema = {
            type: "object",
            properties: {
                title: { type: "string" },
                lifePathSummary: { type: "string" },
                vedicFusion: { type: "string" },
                strengths: { type: "string" },
                challenges: { type: "string" },
                remedies: { type: "string" },
                destinyExplanation: { type: "string" }
            },
            required: ["title", "lifePathSummary", "vedicFusion", "strengths", "challenges", "remedies", "destinyExplanation"]
        };


        const aiResponse = await ai.models.generateContent({
            model: numerologyModel,
            contents: numerologyPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: numerologySchema
            }
        });
        
        // Parse the AI's JSON text output
        const resultJson = JSON.parse(aiResponse.text);

        // Structure the response data for the UI and Destiny Vault
        res.json({ 
            result: resultJson, // Structured JSON
            metadata: {
                name,
                dob,
                birthNo,
                lifePathNo,
                destinyNo, 
                archetype,
                career,
                dateGenerated: new Date().toISOString(),
                birthPlanet: birthPlanet.planet,
                missionPlanet: missionPlanet.planet,
                destinyPlanet: destinyPlanet.planet
            }
        });

    } catch (error) {
        console.error("Gemini Numerology Error:", error);
        if (error.response && error.response.text) {
             console.error("Raw AI Response:", error.response.text.substring(0, 500));
        }
        res.status(500).send({ error: "Failed to generate comprehensive profile from AI. Check API key and model setup." });
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