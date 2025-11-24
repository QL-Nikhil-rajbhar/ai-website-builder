import { NextResponse } from "next/server";
import { createClient } from "v0-sdk";

const v0 = createClient({
  apiKey: process.env.NEXT_PUBLIC_V0_API_KEY,
});

export async function POST(req) {
  try {
    const body = await req.json();
    const { prompt = "", images = [] } = body;

    // 1️⃣ Create Chat
    const chat = await v0.chats.create({
      message: `USER_PROMPT:\n${prompt}\n\nIMAGES:\n${images.join("\n")}`,
      modelConfiguration: {
        modelId: "v0-1.5-md",
      },
    });

    if (!chat?.latestVersion) {
      return NextResponse.json({
        error: "No version returned from V0",
        raw: chat,
      });
    }

    const version = chat.latestVersion;

    // 2️⃣ Extract files from chat.latestVersion.files
    const formatted = {};

    for (const f of version.files || []) {
      if (!f.name) continue;

      formatted[`/${f.name}`] = {
        code: f.content ?? "",
      };
    }

    // 3️⃣ Return the correct response
    return NextResponse.json({
      success: true,
      files: formatted,
      chatId: chat.id,
      projectId: chat.projectId,
      latestVersionId: version.id,
      demoUrl: version.demoUrl,
    });

  } catch (err) {
    console.error("❌ gen-ai-code error:", err);
    return NextResponse.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
