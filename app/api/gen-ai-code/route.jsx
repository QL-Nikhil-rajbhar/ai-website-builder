import { NextResponse } from "next/server";
import { GenAiCode } from "@/configs/AiModel";

/**
 * Combined route:
 * - Call your existing GenAiCode (Gemini) generator (keeps current behavior)
 * - Normalize Gemini output into files array
 * - If useV0UI === true, call /api/generate-ui to get v0 UI files and merge them
 * - Return an object containing { files, rawModelResponse, info }
 *
 * The client will then call api.workspace.CreateWorkspace (Convex mutation) with messages, urls, and files.
 */

function looksLikeJSON(text) {
    const t = String(text || "").trim();
    return t.startsWith("{") && t.endsWith("}");
}

function normalizeFiles(files) {
    if (!files) return [];

    if (Array.isArray(files)) return files.map((f) => {
        if (typeof f === "string") {
            // cannot infer name; push into a default file
            return { filename: "app/page.jsx", content: f };
        }
        // ensure keys
        return {
            filename: f.filename || f.path || f.fileName || "app/page.jsx",
            content: f.content || f.body || String(f),
        };
    });

    if (typeof files === "object") {
        // object map: { "app/page.jsx": "..." }
        return Object.keys(files).map((filename) => ({
            filename,
            content: files[filename],
        }));
    }

    return [];
}

export async function POST(req) {
    try {
        const { prompt, urls = [], useV0UI = false } = await req.json();

        console.log("Received:", { prompt: String(prompt).slice(0, 200), urlsLength: urls.length, useV0UI });

        // === Call Gemini (existing code) ===
        let result = await GenAiCode.sendMessage(prompt);
        const textResponse = await result.response.text();

        // Validate JSON
        if (!looksLikeJSON(textResponse)) {
            console.error("Gemini returned non-JSON. Raw response:", textResponse.slice(0, 2000));
            return NextResponse.json({
                error: "Gemini returned invalid JSON. See raw for details.",
                raw: textResponse,
            });
        }

        let parsed;
        function safeJsonExtract(text) {
            try {
                // direct attempt
                return JSON.parse(text);
            } catch (e) { }

            // Try to extract the first {...} block
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    return JSON.parse(match[0]);
                } catch (e) { }
            }

            // Try removing trailing commas
            const noTrailingCommas = text.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
            try {
                return JSON.parse(noTrailingCommas);
            } catch (e) { }

            throw new Error("Could not parse model JSON");
        }

        try {
            parsed = safeJsonExtract(textResponse);

        } catch (err) {
            console.error("Error parsing Gemini response:", err);
            return NextResponse.json({ error: "Failed to parse model JSON", raw: textResponse });
        }

        // Normalize model files into array
        let generatedFiles = normalizeFiles(parsed.files);

        // If requested, call generate-ui (v0) and merge results
        if (useV0UI) {
            try {
                const baseURL = getBaseURL();
                const uiResp = await fetch(`${baseURL}/api/generate-ui`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt, componentName: "GeneratedHero" }),
                });

                const uiJson = await uiResp.json();
                if (uiJson?.success && Array.isArray(uiJson.files)) {
                    const uiFiles = uiJson.files.map((f) => ({
                        filename: f.filename,
                        content: f.content,
                    }));

                    // Merge: overwrite same filenames, else push
                    for (const uiFile of uiFiles) {
                        const idx = generatedFiles.findIndex((f) => f.filename === uiFile.filename);
                        if (idx >= 0) {
                            generatedFiles[idx] = uiFile;
                        } else {
                            generatedFiles.push(uiFile);
                        }
                    }
                    console.log("Merged UI files count:", uiFiles.length);
                } else {
                    console.warn("generate-ui returned invalid shape, skipping merge:", uiJson);
                }
            } catch (uiErr) {
                console.error("Failed to obtain UI from generate-ui:", uiErr);
                // Non-fatal — continue with Gemini-generated files
            }
        }

        // Return merged files to the client — client will persist via CreateWorkspace
        return NextResponse.json({
            success: true,
            files: generatedFiles,
            raw: parsed,
            info: {
                usedUIEnhancer: useV0UI,
                imageCount: urls.length,
            },
        });
    } catch (err) {
        console.error("gen-ai-code error:", err);
        return NextResponse.json({ error: err?.message || "Unknown gen-ai-code error" }, { status: 500 });
    }
}

// Determine server base URL for internal calls
function getBaseURL() {
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return "http://localhost:3000";
}
