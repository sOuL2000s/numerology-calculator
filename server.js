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

// --- NEW: Detailed Personality Profile Matrix (Derived from Advice Text) ---
const NUMEROLOGY_PROFILES = {
    1: { core: "Leader, Independent, Confident", focus: "Authority, originality, achievement.", challenge: "Egoistic, impatient, dominating.", group: "Action & Power" },
    2: { core: "Diplomatic, Gentle, Cooperative", focus: "Harmony, relationships, balance.", challenge: "Over-sensitive, indecisive, dependent.", group: "Emotional & Relationship" },
    3: { core: "Creative, Expressive, Charming", focus: "Communication, ideas, art, fun.", challenge: "Scattered, impulsive, avoids discipline.", group: "Creative & Expressive" },
    4: { core: "Practical, Disciplined, Reliable", focus: "Stability, systems, order.", challenge: "Rigid, stubborn, overly cautious.", group: "Action & Power" },
    5: { core: "Adventurous, Energetic, Freedom-loving", focus: "Travel, change, excitement.", challenge: "Restless, inconsistent, impulsive.", group: "Creative & Expressive" },
    6: { core: "Caring, Nurturing, Responsible", focus: "Beauty, harmony, service, family.", challenge: "Over-giving, controlling, perfectionist.", group: "Emotional & Relationship" },
    7: { core: "Intellectual, Spiritual, Introspective", focus: "Solitude, research, deeper truths.", challenge: "Detached, skeptical, emotionally distant.", group: "Spiritual & Intellectual" },
    8: { core: "Ambitious, Disciplined, Strategic", focus: "Success, money, structure, power.", challenge: "Controlling, emotionally reserved, rigid.", group: "Action & Power" },
    9: { core: "Compassionate, Humanitarian, Wise", focus: "Helping others, big-picture thinking.", challenge: "Over-emotional, self-sacrificing, unrealistic.", group: "Emotional & Relationship" }
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

    // --- START: Calculation and Data Lookup (Moved outside try/catch) ---

    // Calculate necessary numbers (1-9)
    const birthNo = calculateBirthNumber(dob);
    const lifePathNo = calculateLifePathNumber(dob);
    const destinyNo = calculateDestinyNumber(name);

    // Lookup Archetype and Career based on matrices
    const archetype = ARCHETYPE_MATRIX[birthNo - 1][lifePathNo - 1];
    const career = CAREER_MATRIX[birthNo - 1][lifePathNo - 1];
    
    // Lookup Planetary Data
    const birthPlanet = PLANETARY_MAPPING[birthNo];
    const missionPlanet = PLANETARY_MAPPING[lifePathNo];
    const destinyPlanet = PLANETARY_MAPPING[destinyNo]; 
    
    // Lookup Detailed Profiles 
    const birthProfile = NUMEROLOGY_PROFILES[birthNo];
    const missionProfile = NUMEROLOGY_PROFILES[lifePathNo];
    const destinyProfile = NUMEROLOGY_PROFILES[destinyNo];

    // Basic Validation: Ensure numbers are mapped (i.e., not 0 due to bad input parsing)
    if (!birthPlanet || !missionPlanet || !destinyPlanet || !birthProfile || !missionProfile || !destinyProfile) {
         return res.status(400).send({ error: "Invalid date or name format. Could not map numerology numbers (expect 1-9)." });
    }

    // --- END: Calculation and Data Lookup ---

    try {
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

            // --- NEW CONTEXT INJECTION ---
            **Detailed Personality Coordinates (INSTRUCTIVE DATA):**
            *   Birth Number (${birthNo}) Core: ${birthProfile.core} (Focus: ${birthProfile.focus}) (Challenge: ${birthProfile.challenge})
            *   Life Path Number (${lifePathNo}) Core: ${missionProfile.core} (Focus: ${missionProfile.focus}) (Challenge: ${missionProfile.challenge})
            *   Destiny Number (${destinyNo}) Core: ${destinyProfile.core} (Focus: ${destinyProfile.focus})
            *   Numerical Group Synergy (Birth/Mission): ${birthProfile.group} meets ${missionProfile.group}

            **Instructions for JSON Content Generation:**
            1.  **title:** Must be the Archetype as the main title (e.g., "The ${archetype} Destiny Profile").
            2.  **lifePathSummary:** (Core Identity) Explain the fundamental meaning of the Birth/Life Path Archetype (${archetype}). Detail the synergy/friction between the groups (${birthProfile.group} vs ${missionProfile.group}).
            3.  **vedicFusion:** (Vedic Insight) Detailed Jyotish analysis of the governing planets—${birthPlanet.planet} (Personality) and ${missionPlanet.planet} (Mission)—discussing core karmic themes, disposition, and how the energies manifest.
            4.  **psychologicalProfile:** (Personality & Psychological Profile) A detailed analysis covering key strengths, emotional patterns, thinking style, and the inherent conflict/weakness derived from both Birth (${birthProfile.challenge}) and Life Path (${missionProfile.challenge}) numbers. Use markdown lists to structure strengths and challenges.
            5.  **relationshipAnalysis:** (Love & Relationships) Analyze the user's love style, emotional needs, and core relationship challenges derived from the combined numbers. Suggest ideal compatibility traits.
            6.  **careerFinancialOutlook:** (Career & Money) Based on the vocation (${career}), analyze the user's natural work style (leader/strategist/creator), money mindset, and earning potential. Provide practical, high-level career guidance.
            7.  **spiritualPurpose:** (Spiritual Growth & Purpose) Discuss the user's unique Karmic lessons and Soul Mission according to their numbers. Focus on inner healing themes.
            8.  **destinyExplanation:** (Ultimate Expression) Explain the Destiny Number (${destinyNo}) using its core traits (${destinyProfile.core}) to describe the ultimate life expression and impact on the world (the Name Vibe).
            9.  **remediesGuidance:** (Action Steps) Provide specific, practical remedies (Upayes) based on the combined planetary influences. Mention utilizing their Planetary Day of Strength (${birthPlanet.day}). Conclude with simple do's and don'ts. Use a markdown list.
            10. **keyTakeaways:** (Summary Snapshot) Provide a brief, bulleted list summary (1-2 sentences per point) covering: Top Strength, Biggest Growth Area, and Current Life Theme. Use a markdown list.
        `;

        // Define the JSON structure for the Gemini API call (EXPANDED)
        const numerologySchema = {
            type: "object",
            properties: {
                title: { type: "string" },
                lifePathSummary: { type: "string" },
                vedicFusion: { type: "string" },
                psychologicalProfile: { type: "string" }, // NEW
                relationshipAnalysis: { type: "string" }, // NEW
                careerFinancialOutlook: { type: "string" }, // NEW
                spiritualPurpose: { type: "string" }, // NEW
                remediesGuidance: { type: "string" }, // RENAMED/EXPANDED
                keyTakeaways: { type: "string" }, // NEW
                destinyExplanation: { type: "string" } // Kept, but moved to the end of the schema definition
            },
            required: ["title", "lifePathSummary", "vedicFusion", "psychologicalProfile", "relationshipAnalysis", "careerFinancialOutlook", "spiritualPurpose", "remediesGuidance", "destinyExplanation", "keyTakeaways"]
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
                destinyPlanet: destinyPlanet.planet,
                birthDay: birthPlanet.day // <-- ADDED: Expose the Planetary Day of Strength
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