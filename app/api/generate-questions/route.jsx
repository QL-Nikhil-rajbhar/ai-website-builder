import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
    try {
        const { prompt } = await req.json();

        if (!prompt || prompt.trim() === "") {
            return NextResponse.json(
                { status: false, error: "Prompt is empty" },
                { status: 400 }
            );
        }

        const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
        });

        const ask = `
Your task is to generate clarifying questions for a website creation prompt.

User prompt:
"${prompt}"

Return ONLY JSON in this exact shape:

{
  "questions": [
    "question 1?",
    "question 2?",
    "question 3?"
  ]
}

Rules:
- NO markdown
- NO code fences
- NO explanation
- NO extra text.
Only return valid JSON.
`;

        // 1) First attempt
        const result = await model.generateContent(ask);
        let text = await result.response.text();

        let cleaned = text
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        let parsed = null;

        // Try parse 1
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            // Try extract { ... }
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    parsed = JSON.parse(match[0]);
                } catch {
                    parsed = null;
                }
            }
        }

        // If still no valid JSON → fallback
        if (!parsed || !parsed.questions) {
            parsed = {
                questions: [
                    "Who is the target audience?",
                    "What main sections should the website include?",
                    "Do you prefer light or dark theme?"
                ]
            };
        }

        return NextResponse.json({ status: true, questions: parsed.questions });

    } catch (err) {
        console.error("generate-questions error:", err);

        return NextResponse.json(
            {
                status: true,
                questions: [
                    "Who is the target audience?",
                    "What type of content should appear?",
                    "Any preferred colors or theme?"
                ],
                fallback: true
            },
            { status: 200 }
        );
    }
}
