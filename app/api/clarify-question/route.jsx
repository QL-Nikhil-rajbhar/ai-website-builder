// app/api/clarify-question/route.jsx
import { NextResponse } from "next/server";
import { createClient } from "v0-sdk";

const v0 = createClient({
    apiKey: process.env.NEXT_PUBLIC_V0_API_KEY,
});

export async function POST(req) {
    try {
        const body = await req.json();
        const { prompt = "", history = [], images = [], imageData = [] } = body;

        const systemPrompt = `
You are an assistant that asks clarifying questions to collect requirements for building a website.
Always output ONLY JSON.
Valid responses:

1️⃣ Need more info:
{"question":"<single question here>", "enough": false}

2️⃣ Enough info to generate website:
{"question": null, "enough": true}

Do NOT output anything else. No commentary.
Use images list only for context.
`;

        const messages = [
            { role: "system", content: systemPrompt },
            ...history.map((h) => ({
                role: h.role === "user" ? "user" : "assistant",
                content: h.content,
            })),
            { role: "user", content: prompt },
            { role: "user", content: `IMAGES: ${images.join(", ")}` },
        ];

        // ❗ FIXED MODEL — must be one of the allowed names
        const chat = await v0.chats.create({
            message: messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
            system: systemPrompt,
            modelConfiguration: {
                modelId: "v0-gpt-5",
            },
        });

        const replyText =
            chat?.latestMessage?.content ||
            chat?.messages?.[chat.messages.length - 1]?.content ||
            "";

        let parsed = null;

        try {
            parsed = JSON.parse(replyText);
        } catch {
            try {
                const start = replyText.indexOf("{");
                const end = replyText.lastIndexOf("}");
                if (start >= 0 && end > start) {
                    parsed = JSON.parse(replyText.slice(start, end + 1));
                }
            } catch { }
        }

        if (!parsed) {
            const lc = replyText.toLowerCase();
            const enough = lc.includes("enough") || lc.includes("ready") || lc.includes("generate");
            return NextResponse.json({
                question: enough ? null : replyText.trim().slice(0, 300),
                enough,
            });
        }

        return NextResponse.json({
            question: parsed.question || null,
            enough: parsed.enough ?? true,
        });
    } catch (err) {
        console.error("Clarify route error:", err);
        return NextResponse.json({ question: null, enough: true });
    }
}
