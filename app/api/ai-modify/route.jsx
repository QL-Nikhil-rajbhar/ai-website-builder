// app/api/ai-modify/route.jsx
import { NextResponse } from "next/server";
import { createClient } from "v0-sdk";

const v0 = createClient({
    apiKey: process.env.NEXT_PUBLIC_V0_API_KEY,
});

export async function POST(req) {
    try {
        const body = await req.json();
        const { prompt, files } = body;

        const systemPrompt = `
You modify ONLY the provided project files.
Never regenerate everything unless asked.
Return JSON like:

{
  "files": {
    "/App.js": { "code": "..." },
    "/components/Hero.js": { "code": "..." }
  }
}

Only include files you changed.
Focus on the requested update (e.g., dark mode, color changes, adding logo, etc.).
`;

        const userBlock = `
USER_REQUEST:
${prompt}

CURRENT_FILES:
${Object.entries(files)
                .map(([f, c]) => `${f}:\n${c.code}`)
                .join("\n\n")}
`;

        const chat = await v0.chats.create({
            message: userBlock,
            system: systemPrompt,
            modelConfiguration: {
                modelId: "v0-1.5-md",
            },
        });

        const raw =
            chat?.latestMessage?.content ||
            (chat?.messages && chat.messages.at(-1)?.content) ||
            "";

        let parsed = null;
        try {
            parsed = JSON.parse(raw);
        } catch {
            const s = raw.indexOf("{");
            const e = raw.lastIndexOf("}");
            if (s !== -1 && e !== -1) {
                try {
                    parsed = JSON.parse(raw.slice(s, e + 1));
                } catch { }
            }
        }

        if (!parsed) {
            return NextResponse.json({
                error: "Invalid AI JSON",
                raw,
            });
        }

        return NextResponse.json(parsed);
    } catch (err) {
        console.error("ai-modify error:", err);
        return NextResponse.json({ error: err.message });
    }
}
