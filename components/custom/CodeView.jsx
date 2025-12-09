// =======================================================
// CodeView.jsx — FIXED VERSION with Deployment URL Display
// =======================================================
"use client";

import React, { useMemo, useState, useRef, useContext, useEffect } from "react";
import { MessagesContext } from "@/context/MessagesContext";
import React, { useMemo, useState, useRef, useContext } from "react";
import { WorkspaceContext } from "@/context/WorkspaceContext";
import {
    SandpackProvider,
    SandpackLayout,
    SandpackCodeEditor,
    SandpackFileExplorer,
} from "@codesandbox/sandpack-react";

import { workspaceApi } from "@/lib/workspaceApi";
import { useParams } from "next/navigation";

import { Loader2Icon, Rocket, CheckCircle2, Copy, ExternalLink, X } from "lucide-react";
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
    const [workspace, setWorkspace] = useState(null);
    const { isDeploying, refreshTrigger } = useContext(WorkspaceContext);

    React.useEffect(() => {
        if (id) {
            workspaceApi.getWorkspace(id).then(setWorkspace).catch(console.error);
        }
    }, [id, refreshTrigger]);

    const [previewLoading, setPreviewLoading] = useState(false);
    const zipBlobRef = useRef(null);
    const [deploying, setDeploying] = useState(false);
    const [deployStatus, setDeployStatus] = useState("");
    const [deployedUrl, setDeployedUrl] = useState(null); // ✅ Store deployed URL
    const [copied, setCopied] = useState(false);
    const { isGenerating } = useContext(MessagesContext);
    const [loadingText, setLoadingText] = useState("Generating code...");

    const loadingMessages = [
        "Generating code...",
        "Building components...",
        "Optimizing layout...",
        "Applying styles...",
        "Finalizing changes..."
    ];

    useEffect(() => {
        if (isGenerating) {
            setLoadingText(loadingMessages[0]);
            let i = 1;
            const interval = setInterval(() => {
                if (i < loadingMessages.length) {
                    setLoadingText(loadingMessages[i]);
                    i++;
                } else {
                    clearInterval(interval);
                }
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [isGenerating]);

    const files = useMemo(() => {
        if (!workspace) return {};
        return workspace.fileData || {};
    }, [workspace]);

    // 🚫 Forbidden files that break Next.js static export
    const FORBIDDEN = [
        "app/_global-error",
        "app/_not-found",
        "app/error",
        "app/not-found",
        "app/_error",
        "/app/_global-error",
        "/app/_not-found",
        "/app/error",
        "/app/not-found",
        "/app/_error",
    ];

    // ------------------------------------------------------
    // GENERATE ZIP (Helper function)
    // ------------------------------------------------------
    const generateZip = async () => {
        const zip = new JSZip();

        // 1) Add project files (skip forbidden)
        Object.entries(files).forEach(([path, file]) => {
            const normalized = path.replace(/^\//, "");

            if (FORBIDDEN.some((f) => normalized.startsWith(f))) {
                console.log("Skipping forbidden file:", normalized);
                return;
            }

            zip.file(normalized, ensureCodeString(file));
        });

        // 2) Add lib/utils.ts
        zip.file(
            "lib/utils.ts",
            `
export function cn(...inputs) {
  return inputs.filter(Boolean).join(" ");
}
`
        );

        // 3) Add postcss.config.js
        zip.file(
            "postcss.config.js",
            `
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
`
        );

        // 4) Add next.config.js
        zip.file(
            "next.config.js",
            `const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
    output: "export",
    images: { unoptimized: true },
    basePath: basePath,
    assetPrefix: basePath,
    trailingSlash: true,
};

module.exports = nextConfig;
`
        );

        // 5) Add tsconfig.json
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

        // 6) Generate missing shadcn components (if used)
        const used = detectShadcn(files);
        used.forEach((name) => {
            if (SHADCN_LIB[name]) {
                zip.file(`components/ui/${name}.tsx`, SHADCN_LIB[name]);
            }
        });

        // 7) Generate and return ZIP blob
        const blob = await zip.generateAsync({ type: "blob" });
        return blob;
    };



    // ------------------------------------------------------
    // AWS DEPLOY
    // ------------------------------------------------------
    // ------------------------------------------------------
    // AWS DEPLOY (COMPLETE FIXED VERSION WITH DEBUGGING)
    const deployToAWS = async () => {
        try {
            setDeploying(true);
            setDeployStatus("Preparing files...");
            setDeployedUrl(null);

            console.log("🔍 DEPLOY DEBUG START");

            // Generate fresh zip
            const blob = await generateZip();
            console.log("📦 Generated zip size:", blob.size);

            // Test: Compare with download zip
            const testArrayBuffer = await blob.arrayBuffer();
            console.log("📊 Zip first 100 bytes:", Array.from(new Uint8Array(testArrayBuffer.slice(0, 100))));

            // Fresh blob copy
            const freshBlob = new Blob([testArrayBuffer], { type: blob.type });
            console.log("✅ Fresh blob size:", freshBlob.size);

            zipBlobRef.current = freshBlob;

            // Create FormData with fresh blob
            const formData = new FormData();
            formData.append("zipFile", freshBlob);
            formData.append("raceName", workspace?.raceName);
            console.log('race name is ' + JSON.stringify(workspace))

            // DEBUG: Log FormData contents
            for (let [key, value] of formData.entries()) {
                console.log("📤 FormData entry:", key, value.size || value);
            }

            setDeployStatus("Building and deploying...");
            console.log("🚀 Sending to API...");

            const deployRes = await axios.post("/api/deploy-aws", formData, {
                timeout: 120000, // 2 min timeout
            });

            console.log("✅ API Response:", deployRes.data);

            if (!deployRes.data?.success) {
                alert("Deployment failed");
                setDeploying(false);
                return;
            }

            const url = deployRes.data.url;
            setDeploying(false);
            setDeployStatus("");
            setDeployedUrl(url);

        } catch (err) {
            console.error("❌ AWS deploy error:", err);
            console.error("Error response:", err.response?.data);
            setDeploying(false);
            setDeployStatus("");
            alert("Deployment failed: " + (err.response?.data?.error || err.message));
        }
    };


    // ------------------------------------------------------
    // Copy to Clipboard
    // ------------------------------------------------------
    const copyToClipboard = () => {
        navigator.clipboard.writeText(deployedUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
                    {/* Buttons removed */}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={deployToAWS}
                        disabled={deploying}
                        className="bg-green-600 px-4 py-2 text-white rounded flex items-center gap-2 disabled:opacity-50"
                    >
                        {deploying ? (
                            <Loader2Icon className="animate-spin h-5 w-5" />
                        ) : (
                            <Rocket size={16} />
                        )}
                        {deploying ? deployStatus || "Deploying..." : "Deploy to AWS"}
                    </button>
                </div>
            </div>

            {/* ✅ Deployment Success Banner */}
            {deployedUrl && (
                <div className="bg-green-50 border border-green-200 p-4 mx-4 mt-4 rounded-lg flex items-start gap-3">
                    <CheckCircle2 className="text-green-600 mt-1 flex-shrink-0" size={24} />
                    <div className="flex-1">
                        <h3 className="text-green-900 font-semibold mb-2">
                            ✅ Deployment Successful!
                        </h3>
                        <p className="text-green-700 text-sm mb-3">
                            Your website is now live and accessible at:
                        </p>
                        <div className="flex items-center gap-2 bg-white p-3 rounded border border-green-300">
                            <code className="text-sm text-green-800 flex-1 break-all">
                                {deployedUrl}
                            </code>
                            <button
                                onClick={copyToClipboard}
                                className="bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 flex items-center gap-2 flex-shrink-0"
                            >
                                {copied ? (
                                    <>
                                        <CheckCircle2 size={16} />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy size={16} />
                                        Copy
                                    </>
                                )}
                            </button>
                            <a
                                href={deployedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 flex items-center gap-2 flex-shrink-0"
                            >
                                <ExternalLink size={16} />
                                Visit
                            </a>
                        </div>
                    </div>
                    <button
                        onClick={() => setDeployedUrl(null)}
                        className="text-green-600 hover:text-green-800 flex-shrink-0"
                    >
                        <X size={20} />
                    </button>
                </div>
            )}

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
                <div className="relative w-full h-[80vh]">
                    {isDeploying && (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-50">
                            <Loader2Icon className="animate-spin h-12 w-12 text-blue-400" />
                            <p className="text-white mt-4 text-lg font-semibold">Editing...</p>
                        </div>
                    )}
                    <iframe
                        key={refreshTrigger} // Force iframe reload on refresh
                        src={workspace.demoUrl}
                        className="w-full h-full"
                    />
                </div>
            )}
        </div>
    );
}
