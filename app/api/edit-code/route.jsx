import { NextResponse } from "next/server";
import { createClient } from "v0-sdk";
import fs from "fs";
import path from "path";

const v0 = createClient({
    apiKey: process.env.NEXT_PUBLIC_V0_API_KEY,
});



export async function POST(req) {
    try {
        const { userMessage, chatId, fullFiles } = await req.json();

        if (!userMessage || !chatId) {
            return NextResponse.json({ error: "Missing userMessage or chatId" });
        }

        console.log("✏️ Using chatId:", chatId);


        const payload = `
${userMessage}
`;

        const response = await v0.chats.sendMessage({
            chatId,
            message: payload,
        });



        console.log("✔ Parsed successfully");
        return NextResponse.json({ files: {}, demoUrl: response?.latestVersion?.demoUrl, latestVersionId: response?.latestVersion?.id });

    } catch (err) {
        console.error("❌ EDIT ERROR:", err);
        return NextResponse.json({ error: err.message });
    }
}
