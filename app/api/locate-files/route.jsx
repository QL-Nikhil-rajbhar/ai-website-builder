import { NextResponse } from "next/server";
import { createClient } from "v0-sdk";

const v0 = createClient({
    apiKey: process.env.NEXT_PUBLIC_V0_API_KEY,
});

// Remove fences + extract JSON safely
function safeParseJSON(text) {
    if (!text) return null;
    text = text.replace(/```json|```/gi, "").trim();
    try {
        return JSON.parse(text);
    } catch {
        const first = text.indexOf("{");
        const last = text.lastIndexOf("}");
        if (first >= 0 && last > first) {
            try {
                return JSON.parse(text.slice(first, last + 1));
            } catch { }
        }
        return null;
    }
}

export async function POST(req) {
    try {
        const { userMessage, fileList } = await req.json();

        if (!userMessage || !Array.isArray(fileList)) {
            return NextResponse.json({ error: "Missing userMessage or fileList" });
        }

        const systemPrompt = `
You are an expert FRONTEND FILE LOCATOR.

Your job:
Given a user request + list of project files,
identify EXACTLY which files must be modified.

RULES:
- Only return EXISTING files from the provided fileList.
- STRICT JSON ONLY. No explanations. No extra text.
- Do NOT guess unknown files.
- Do NOT propose new files.
- Do NOT return irrelevant files.
- If the change is global UI/theme → return "/App.jsx", "/styles/index.css".
- If change relates to text or UI section → return only that component.

FORMAT:
{
  "files": ["/App.jsx", "/styles/index.css"]
}
        `;

        const prompt = `
USER REQUEST:
${userMessage}

AVAILABLE FILES:
${JSON.stringify(fileList, null, 2)}
        `;

        const chat = await v0.chats.create({
            system: systemPrompt,
            message: prompt,
            modelConfiguration: { modelId: "v0-1.5-md" }
        });

        const raw = chat?.latestMessage?.content || "";
        console.log("🔍 LOCATOR RAW:", raw);

        const parsed = safeParseJSON(raw);

        if (!parsed || !parsed.files) {
            console.log("❌ Locator JSON parsing failed");
            return NextResponse.json({
                error: "Invalid JSON from locator",
                raw
            });
        }

        // FINAL SAFETY FILTER — remove anything that isn't real
        const validated = parsed.files.filter(f => fileList.includes(f));

        return NextResponse.json({ files: validated });

    } catch (err) {
        console.error("❌ LOCATE-FILES ERROR:", err);
        return NextResponse.json({ error: err.message });
    }
}
