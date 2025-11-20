import { NextResponse } from "next/server";
import { createClient } from "v0-sdk";

/**
 * Generate UI frontend skeleton using explicit v0 client.
 * Fallback: simple JSX if v0 fails.
 *
 * Request body:
 * { prompt: string, componentName?: string }
 *
 * Response:
 * { success: true, files: [{ filename, content }] }
 */

// Explicit v0 client using API key
const v0 = createClient({
    apiKey: process.env.NEXT_PUBLIC_V0_API_KEY,   // EXPLICIT KEY USAGE
});

export async function POST(req) {
    try {
        const body = await req.json();
        const { prompt = "", componentName = "GeneratedHero", style = "tailwind" } = body;
        console.log('promot at generate ui is ', prompt)

        // ===========================================================
        // TRY USING REAL V0 SDK
        // ===========================================================
        try {
            const chat = await v0.chats.create({
                message: `Generate a Next.js + React component named ${componentName}. 
Use Tailwind CSS. It should export a default React component. Do not use any placeholder images, use images if the user provides. If latitude and longitude is then fetch the image from google of that location. Other don't use any placeholder images.
Prompt: ${prompt}`,

                system: "You are an expert React/Next.js UI developer. Return code files.",
                modelConfiguration: {
                    modelId: "v0-1.5-md",
                },
            });

            let latest = chat?.latestVersion;
            let files = [];

            // ===================================
            // Different SDK versions return files in different shapes.
            // Normalize them.
            // ===================================
            if (latest?.files && Array.isArray(latest.files)) {
                files = latest.files.map((f) => ({
                    filename: f.path || f.filename || `app/components/generated/${componentName}.jsx`,
                    content: f.content || "",
                }));
            } else if (chat?.files && Array.isArray(chat.files)) {
                files = chat.files.map((f) => ({
                    filename: f.path || f.filename || `app/components/generated/${componentName}.jsx`,
                    content: f.content || "",
                }));
            } else {
                // No structured files found → fallback to text extraction
                const text = String(chat?.text || latest?.text || "");
                files = [
                    {
                        filename: `app/components/generated/${componentName}.jsx`,
                        content: extractCode(text, componentName),
                    },
                ];
            }

            return NextResponse.json({ success: true, files });
        } catch (sdkErr) {
            console.error("❌ v0 SDK failed:", sdkErr);
        }

        // ===========================================================
        // FALLBACK — If v0 SDK is not available or failed
        // ===========================================================

        console.log("⚠️ Falling back to simple generated UI component");

        const fallbackCode = `
import React from "react";

export default function ${componentName}() {
  return (
    <section className="p-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-md">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold">${escapeJs(
            (prompt || "Generated Page").split("\n")[0]
        )}</h2>
        <p className="mt-4">This UI was generated using fallback mode.</p>
        <button className="mt-6 inline-block bg-white text-blue-600 px-4 py-2 rounded">
          Continue
        </button>
      </div>
    </section>
  );
}
`.trim();

        return NextResponse.json({
            success: true,
            files: [
                {
                    filename: `app/components/generated/${componentName}.jsx`,
                    content: fallbackCode,
                },
            ],
        });
    } catch (err) {
        console.error("API /generate-ui error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * Extracts code from a v0 text-only response.
 * Rudimentary but effective.
 */
function extractCode(text, componentName) {
    if (!text) {
        return `
import React from "react";
export default function ${componentName}(){
  return <div>Generated UI</div>;
}
`;
    }

    // Try to extract from ``` blocks
    const match = text.match(/```[\s\S]*?```/);
    if (match) {
        return match[0].replace(/```(jsx|tsx|js|ts)?/g, "").replace(/```/g, "").trim();
    }

    // Fallback: wrap raw text
    return `
import React from "react";
export default function ${componentName}(){
  return (
    <div className="p-10">
      <pre>${escapeJs(text)}</pre>
    </div>
  );
}
`;
}

function escapeJs(str) {
    return String(str)
        .replace(/`/g, "\\`")
        .replace(/\$/g, "\\$")
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n");
}
