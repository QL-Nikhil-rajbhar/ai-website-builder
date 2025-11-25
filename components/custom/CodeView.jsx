// =======================================================
// CodeView.jsx — FIXED VERSION (Download-ready Next.js ZIP)
// =======================================================
"use client";

import React, { useMemo, useState } from "react";
import {
    SandpackProvider,
    SandpackLayout,
    SandpackCodeEditor,
    SandpackFileExplorer,
} from "@codesandbox/sandpack-react";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";

import { Loader2Icon, Download, Rocket } from "lucide-react";
import JSZip from "jszip";
import axios from "axios";

// ------------------------------------------------------
// Utility Helpers
// ------------------------------------------------------
const ensureCodeString = (content) => {
    if (!content) return "";
    if (typeof content === "string") return content;
    if (content.code) return content.code;
    return String(content);
};

// Detect used shadcn/ui components
function detectShadcn(files) {
    const REGEX = /@\/components\/ui\/([a-zA-Z0-9-_]+)/g;
    const found = new Set();

    for (const f of Object.values(files)) {
        let match;
        while ((match = REGEX.exec(f.code || ""))) {
            found.add(match[1]);
        }
    }
    return Array.from(found);
}

// Local default shadcn/ui library source
const SHADCN_LIB = {
    button: `
import * as React from "react";
import { cn } from "@/lib/utils";

export function Button({ className, ...props }) {
  return (
    <button
      className={cn("bg-primary text-white px-4 py-2 rounded-md", className)}
      {...props}
    />
  );
}
`,
    card: `
import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow", className)} {...props} />
  );
}
`,
};

// ------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------
export default function CodeView() {
    const { id } = useParams();
    const workspace = useQuery(
        api.workspace.GetWorkspace,
        id ? { workspaceId: id } : "skip"
    );

    const [activeTab, setActiveTab] = useState("preview");
    const [previewLoading, setPreviewLoading] = useState(false);

    const files = useMemo(() => {
        if (!workspace) return {};
        return workspace.fileData || {};
    }, [workspace]);

    // ------------------------------------------------------
    // DOWNLOAD ZIP (FIXED)
    // ------------------------------------------------------
    const downloadProject = async () => {
        const zip = new JSZip();

        // 1) Add all AI-generated project files
        Object.entries(files).forEach(([path, file]) => {
            zip.file(path.replace(/^\//, ""), ensureCodeString(file));
        });

        // 2) Add lib/utils.ts (required by shadcn)
        zip.file(
            "lib/utils.ts",
            `
export function cn(...inputs) {
  return inputs.filter(Boolean).join(" ");
}
`
        );
        // 4) postcss.config.js (required for Tailwind v4)
        zip.file(
            "postcss.config.js",
            `
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
`
        );




        // 5) tsconfig
        zip.file(
            "tsconfig.json",
            `
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": false,
    "noEmit": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["app", "components", "lib"]
}
`
        );

        // // 6) Public folder assets
        // zip.file("public/placeholder.svg", `<svg xmlns="http://www.w3.org/2000/svg"></svg>`);
        // zip.file("public/icon.svg", `<svg xmlns="http://www.w3.org/2000/svg"></svg>`);
        // zip.file("public/icon-dark-32x32.png", "");
        // zip.file("public/icon-light-32x32.png", "");

        // 7) Detect & inject used shadcn/ui components
        const used = detectShadcn(files);
        used.forEach((name) => {
            if (SHADCN_LIB[name]) {
                zip.file(`components/ui/${name}.tsx`, SHADCN_LIB[name]);
            }
        });

        // 8) Generate ZIP
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "website.zip";
        a.click();
        URL.revokeObjectURL(url);
    };

    // ------------------------------------------------------
    // DEPLOY BUTTON
    // ------------------------------------------------------
    const deployToVercel = async () => {
        try {
            const res = await axios.post("/api/deploy-vercel", {
                projectId: workspace.projectId,
                chatId: workspace.chatId,
                versionId: workspace.latestVersionId,
            });

            alert(res.data?.url || "Deployment started!");
        } catch (err) {
            console.error(err);
            alert("Deployment failed");
        }
    };

    // ------------------------------------------------------
    // UI
    // ------------------------------------------------------
    if (!workspace) {
        return (
            <div className="flex justify-center items-center h-[80vh]">
                <Loader2Icon className="animate-spin h-10 w-10" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between bg-black p-2">
                <div className="flex gap-3">
                    <button onClick={() => setActiveTab("preview")}>Preview</button>
                    <button onClick={() => setActiveTab("code")}>Code</button>
                </div>

                <div className="flex gap-2">
                    <button onClick={downloadProject} className="bg-blue-500 px-4 py-2 text-white">
                        <Download size={16} /> Download
                    </button>
                    <button onClick={deployToVercel} className="bg-green-600 px-4 py-2 text-white">
                        <Rocket size={16} /> Deploy
                    </button>
                </div>
            </div>

            {/* Sandpack Preview + Code View */}
            {activeTab === "code" && (
                <SandpackProvider
                    files={files}
                    template="react"
                    theme="dark"
                    customSetup={{
                        dependencies: { react: "19", "react-dom": "19" },
                    }}
                >
                    <SandpackLayout>
                        <SandpackFileExplorer style={{ height: "80vh" }} />
                        <SandpackCodeEditor style={{ height: "80vh" }} />
                    </SandpackLayout>
                </SandpackProvider>
            )}

            {activeTab === "preview" && (
                <iframe src={workspace.demoUrl} className="w-full h-[80vh]" />
            )}
        </div>
    );
}
