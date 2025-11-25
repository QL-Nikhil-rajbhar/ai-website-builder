import { NextResponse } from "next/server";
import { createClient } from "v0-sdk";

const v0 = createClient({
    apiKey: process.env.NEXT_PUBLIC_V0_API_KEY,
});

export async function POST(req) {
    try {
        const { userMessage, chatId, images = [] } = await req.json();

        if (!userMessage || !chatId) {
            return NextResponse.json({
                error: "Missing userMessage or chatId",
            });
        }

        // ⭐ Same rules as gen-ai-code
        const systemInstructions = `
    IMPORTANT UI RULES:
    - Do NOT use shadcn/ui.
    - Do NOT import from "@/components/ui/*".
    - Do NOT use Radix UI primitives.
    - Do NOT use external UI component libraries.
    - Build ALL UI components manually using Tailwind CSS only.
    - Use only .jsx files (never .tsx).

    IMPORTANT — IMAGE HANDLING RULES:
    - ALWAYS use provided image URLs AS-IS.
    - NEVER download, save, or copy images.
    - NEVER store images in /public.
    - NEVER output paths like /public/... or ./public/... .
    - ALWAYS use <img src="THE_EXTERNAL_URL" /> in JSX.

    When modifying files:
    - Return FULL multi-file project in JSON.
    - Maintain existing file names and structure.
    - Only modify files the user intends.
    `;

        // ⭐ Build final message to send
        const payload = `
${systemInstructions}

USER_MESSAGE:
${userMessage}

IMAGE_URLS:
${images.join("\n")}
`;

        // ⭐ Send message to existing chat
        const response = await v0.chats.sendMessage({
            chatId,
            message: payload,
        });

        const version = response?.latestVersion;

        if (!version) {
            return NextResponse.json({
                error: "No version returned from V0",
                raw: response,
            });
        }
        // ⭐ Extract new/updated files (same logic as gen-ai-code)
        const formatted = {};

        for (const f of version.files || []) {
            if (!f.name) continue;

            const raw = (f.content || "").trim().toLowerCase();

            // Skip deleted / placeholder files
            const deleteMarkers = [
                "deleted",
                "...deleted...",
                "remove this",
                "delete this file",
                "// deleted",
                "/* deleted */"
            ];

            if (deleteMarkers.includes(raw) || raw === "") {
                continue;
            }

            formatted[`/${f.name}`] = {
                code: f.content,
            };
        }



        // ⭐ Return like gen-ai-code
        return NextResponse.json({
            success: true,
            files: formatted,
            demoUrl: version.demoUrl,
            latestVersionId: version.id,
        });

    } catch (err) {
        console.error("❌ EDIT ERROR:", err);
        return NextResponse.json(
            { error: err.message || "Unknown error" },
            { status: 500 }
        );
    }
}
