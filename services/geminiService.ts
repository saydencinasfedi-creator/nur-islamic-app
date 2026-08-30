
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export async function generateSpiritualResponse(prompt: string, history: { role: 'user' | 'model', parts: { text: string }[] }[] = [], context: string = "") {
    if (!apiKey) {
        return "API key not configured. Please check your environment.";
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
                ...history,
                { role: 'user', parts: [{ text: prompt }] }
            ],
            config: {
                systemInstruction: `You are Nur AI, a spiritual companion for a Muslim user.
        Current Date: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
        ${context}
        Your goal is to provide accessible knowledge based on authentic Islamic sources (Quran, Sahih Hadith) while respecting privacy.
        Always provide references where possible.
        If asked for fatwas or complex jurisprudence, recommend consulting a qualified scholar.
        Be compassionate, respectful, and supportive of the user's spiritual journey.`,
                temperature: 0.7,
                topP: 0.95,
            },
        });

        return response.text || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "I encountered an error while processing your request. Please try again later.";
    }
}
