import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
    try {
        const { prompt } = await req.json();

        const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash"
        });

        // Ask Gemini for clarifying questions
        const result = await model.generateContent(`
            The user wants to build a website with this description:

            "${prompt}"

            Your task:
            - Understand the category of website.
            - It will always be a static website, so generate questions accordingly.No backend logic.
            - Generate 3–6 short clarifying questions that are REQUIRED to build the website.
            - Questions MUST depend on the website type and They should be non-technical.
            - Do NOT return anything except questions.
            - Each question should be on a new line.
        `);

        const text = result.response.text();
        const questions = text
            .split("\n")
            .map(q => q.trim())
            .filter(q => q.length > 0);

        return Response.json({ questions });
    } catch (err) {
        console.error("Clarify API error:", err);
        return Response.json({ error: "Failed to generate questions" }, { status: 500 });
    }
}
