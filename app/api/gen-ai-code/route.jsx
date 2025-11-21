// app/api/gen-ai-code/route.jsx
import { NextResponse } from "next/server";
import { createClient } from "v0-sdk";
const v0 = createClient({ apiKey: process.env.NEXT_PUBLIC_V0_API_KEY });

/**
 * Expected body:
 * {
 *   prompt: "Complete requirement prompt...",
 *   images: ["https://..."]  // optional
 * }
 *
 * Response:
 *  { files: { "/App.jsx": { code: "..." }, "/components/Header.jsx": { code: "..." } } }
 */

export async function POST(req) {
    try {
        const body = await req.json();
        const { prompt = "", images = [] } = body;

        const systemPrompt = `
You are a professional frontend engineer. Generate a complete React + Tailwind (Vite) project
based on the user's requirements. Output ONLY valid JSON with the structure:
{
  "files": {
    "/index.html": { "code": "..." },
    "/main.jsx": { "code": "..." },
    "/App.jsx": { "code": "..." },
    "/components/Header.jsx": { "code": "..." },
    "/styles/index.css": { "code": "..." }
    // ... etc
  }
}
Make sure the code is ready to run with Vite, React 18, and Tailwind. Ensure JSX is syntactically valid.
Use images array for logos/hero. If you cannot generate everything, return partial files but still valid JSON.
`;

        // Compose a message that includes prompt & images
        const fullUser = `USER_PROMPT:\n${prompt}\n\nIMAGES:\n${images.join("\n")}`;

        const chat = await v0.chats.create({
            message: fullUser,
            system: systemPrompt,
            modelConfiguration: {
                modelId: "v0-1.5-md"
            }

        });

        const raw = chat?.latestMessage?.content || chat?.messages?.slice(-1)[0]?.content || "";

        // parse JSON strictly
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (err) {
            // try to extract JSON substring
            try {
                const first = raw.indexOf("{");
                const last = raw.lastIndexOf("}");
                if (first >= 0 && last > first) {
                    const sub = raw.slice(first, last + 1);
                    parsed = JSON.parse(sub);
                } else {
                    parsed = null;
                }
            } catch (e) {
                parsed = null;
            }
        }

        if (!parsed || !parsed.files) {
            // return an error object that the client can show
            return NextResponse.json({ error: "Failed to parse generation JSON", raw });
        }

        return NextResponse.json({ files: parsed.files });
    } catch (err) {
        console.error("gen-ai-code route error:", err);
        return NextResponse.json({ error: err.message || "Unknown error" });
    }
}
