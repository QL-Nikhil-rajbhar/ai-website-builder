import { NextResponse } from "next/server";
import { createClient } from "v0-sdk";

const v0 = createClient({
  apiKey: process.env.NEXT_PUBLIC_V0_API_KEY,
});

export async function POST(req) {
  try {
    const body = await req.json();
    const { prompt = "", images = [], raceDetails = "" } = body;



    // ⭐ Insert the strict image-handling rule here
    const imageInstruction = `
IMPORTANT — IMAGE HANDLING RULES:
- You MUST use the image URLs provided by the user AS-IS.
- Do NOT download or copy the images.
- Do NOT save them in /public or any folder.
- Do NOT generate or use local paths like /public/xxx or ./public/xxx.
- Always use <img src="THE_EXTERNAL_URL" /> directly in JSX.
`;

    // 1️⃣ Create Chat
    const chat = await v0.chats.create({
      message: `
${imageInstruction}

IMPORTANT UI RULES:
- Do NOT use shadcn/ui.
- Do NOT import from "@/components/ui/*".
- Do NOT use Radix UI primitives.
- Do NOT rely on external component libraries.
- Build ALL UI components manually using Tailwind CSS only.

USER_PROMPT:
${prompt}

IMAGES:
${images.join("\n")}
      `,
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

    // 2️⃣ Extract files from latestVersion.files
    const formatted = {};

    for (const f of version.files || []) {
      if (!f.name) continue;

      formatted[`/${f.name}`] = {
        code: f.content ?? "",
      };
    }

    // 3️⃣ Return response
    return NextResponse.json({
      success: true,
      files: formatted,
      chatId: chat.id,
      projectId: chat.projectId,
      latestVersionId: version.id,
      demoUrl: version.demoUrl,
      raceName: raceDetails?.title
    });

  } catch (err) {
    console.error("❌ gen-ai-code error:", err);
    return NextResponse.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
