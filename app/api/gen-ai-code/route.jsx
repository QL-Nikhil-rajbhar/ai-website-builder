import { NextResponse } from "next/server";
import { createClient } from "v0-sdk";

const v0 = createClient({ apiKey: process.env.NEXT_PUBLIC_V0_API_KEY });

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
  }
}
Make sure the code is ready to run with Vite, React 18, and Tailwind. Ensure JSX is syntactically valid.
Use images array for logos/hero. If you cannot generate everything, return partial files but still valid JSON.
`;

    const fullUser = `USER_PROMPT:\n${prompt}\n\nIMAGES:\n${images.join("\n")}`;

    // Create chat
    const chat = await v0.chats.create({
      message: fullUser,
      // system: systemPrompt,
      modelConfiguration: { modelId: "v0-1.5-md" },
    });

    console.log("CHAT OBJECT:", JSON.stringify(chat));

    // -----------------------------
    // ⭐ NEW EXTRACTION LOGIC
    // -----------------------------
    // const versionFiles = chat?.latestVersion?.files;s
    // console.log("chat is" + JSON.stringify(chat))


    // if (!versionFiles || versionFiles.length === 0) {
    //     return NextResponse.json({
    //         error: "No files found in latestVersion.files",
    //         raw: chat
    //     });
    // }

    // Convert v0 format into your required format:
    // { "/path": { code: "..." } }
    const formatted = {};

    // for (const file of versionFiles) {
    //     if (file.name && file.content !== undefined) {

    //         // 🔥 Force TSX → JSX (minimal change)
    //         let fileName = file.name.replace(/\.tsx$/, ".jsx");

    //         const path = "/" + fileName;
    //         formatted[path] = { code: file.content };
    //     }
    // }

    console.log("formateed" + JSON.stringify(formatted))

    return NextResponse.json({ files: formatted, demoUrl: chat.latestVersion.demoUrl, chatId: chat?.id, projectId: chat?.projectId, latestVersionId: chat?.latestVersion?.id });

  } catch (err) {
    console.error("gen-ai-code route error:", err);
    return NextResponse.json({ error: err.message || "Unknown error" });
  }
}
