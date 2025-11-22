"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import {
    SandpackProvider,
    SandpackLayout,
    SandpackCodeEditor,
    SandpackPreview,
    SandpackFileExplorer,
} from "@codesandbox/sandpack-react";

import Lookup from "@/data/Lookup";
import { MessagesContext } from "@/context/MessagesContext";
import axios from "axios";
import Prompt from "@/data/Prompt";
import { useConvex, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { Loader2Icon, Download, Rocket } from "lucide-react";
import JSZip from "jszip";
import { UrlsContext } from "@/context/UrlsContext";

/* --------------------------------------------------------------------------
🔧 UTILITIES (must come BEFORE preprocessFiles!) 
-------------------------------------------------------------------------- */

const normalizePath = (p) => {
    if (p == null) return null;
    if (typeof p !== "string") {
        try {
            p = String(p);
        } catch {
            return null;
        }
    }
    if (p === "") return "/";
    return p.startsWith("/") ? p : `/${p}`;
};

const ensureCodeString = (content) => {
    if (content == null) return "";
    if (typeof content === "string") return content;
    if (typeof content === "object" && typeof content.code === "string")
        return content.code;
    try {
        return JSON.stringify(content, null, 2);
    } catch {
        return String(content);
    }
};

/* --------------------------------------------------------------------------
🔧 preprocessFiles — SAFE, NO ERRORS
-------------------------------------------------------------------------- */

function preprocessFiles(rawFiles) {
    if (!rawFiles || typeof rawFiles !== "object") return {};

    const processed = {};
    try {
        Object.entries(rawFiles).forEach(([rawPath, content]) => {
            if (rawPath == null) return;

            let pathKey = rawPath;
            if (typeof pathKey !== "string") {
                try {
                    pathKey = String(pathKey);
                } catch {
                    return; // skip invalid key
                }
            }

            const path = normalizePath(pathKey);
            if (!path) return;

            processed[path] = { code: ensureCodeString(content) };
        });
    } catch (e) {
        console.warn("preprocessFiles error:", e);
    }

    return processed;
}

/* --------------------------------------------------------------------------
🔧 Full project detector
-------------------------------------------------------------------------- */

function isFullAiProject(files) {
    if (!files) return false;
    const keys = Object.keys(files);

    return (
        keys.some((k) => k.startsWith("/src/")) ||
        keys.includes("/package.json") ||
        keys.includes("/vite.config.js") ||
        keys.includes("/tailwind.config.js") ||
        keys.includes("/main.jsx") ||
        keys.includes("/src/main.jsx")
    );
}

/* --------------------------------------------------------------------------
🔧 Entry point detector
-------------------------------------------------------------------------- */

function determineEntry(files) {
    if (!files) return "/index.js";

    const candidates = [
        "/src/main.jsx",
        "/src/main.js",
        "/main.jsx",
        "/main.js",
        "/src/index.jsx",
        "/src/index.js",
        "/index.jsx",
        "/index.js",
        "/App.jsx",
        "/src/App.jsx",
    ];

    for (const c of candidates) if (files[c]) return c;

    const anyJs = Object.keys(files).find((k) => k.match(/\.(jsx|js|tsx|ts)$/));
    return anyJs || "/index.js";
}

/* --------------------------------------------------------------------------
🔧 Sandpack Payload Sanitizer (no PostCSS/Tailwind errors)
-------------------------------------------------------------------------- */

function prepareSandpackPayload(files) {
    const copy = { ...files };

    // remove configs — sandbox can't compile them
    ["/postcss.config.js", "/tailwind.config.js", "/tailwind.config.cjs"].forEach(
        (p) => {
            if (copy[p]) {
                copy[`/.backup${p}`] = copy[p];
                delete copy[p];
            }
        }
    );

    // remove deps causing postcss errors
    const forbidden = new Set([
        "tailwindcss",
        "postcss",
        "autoprefixer",
        "postcss-import",
        "postcss-load-config",
    ]);

    const baseDeps = { react: "^18.2.0", "react-dom": "^18.2.0" };
    const lookupDeps = Lookup.DEPENDANCY || {};
    const sanitized = {};

    Object.entries(lookupDeps).forEach(([k, v]) => {
        if (!forbidden.has(k)) sanitized[k] = v;
    });

    return {
        files: copy,
        dependencies: { ...baseDeps, ...sanitized },
        externalResources: ["https://cdn.tailwindcss.com"],
    };
}

/* --------------------------------------------------------------------------
📌 MAIN COMPONENT 
-------------------------------------------------------------------------- */

function CodeView() {
    const { id } = useParams();
    const convex = useConvex();
    const UpdateFiles = useMutation(api.workspace.UpdateFiles);

    const messagesCtx = useContext(MessagesContext) || {};
    const messages = Array.isArray(messagesCtx.messages)
        ? messagesCtx.messages
        : [];

    const urlsCtx = useContext(UrlsContext) || {};
    const urls = urlsCtx.urls || [];

    const [activeTab, setActiveTab] = useState("code");
    const [files, setFiles] = useState(() =>
        preprocessFiles(Lookup.DEFAULT_FILE)
    );
    const [loading, setLoading] = useState(false);
    const [deploying, setDeploying] = useState(false);

    /* --------------------------------------------------------------------------
    FETCH FILES
    -------------------------------------------------------------------------- */
    useEffect(() => {
        if (!id) return;

        (async () => {
            try {
                const result = await convex.query(api.workspace.GetWorkspace, {
                    workspaceId: id,
                });

                const processed = preprocessFiles(result?.fileData || {});

                if (!Object.keys(processed).length) {
                    setFiles(preprocessFiles(Lookup.DEFAULT_FILE));
                    return;
                }

                if (isFullAiProject(processed)) {
                    setFiles(processed);
                } else {
                    const defaults = preprocessFiles(Lookup.DEFAULT_FILE);
                    setFiles({ ...defaults, ...processed });
                }
            } catch (e) {
                console.error(e);
                setFiles(preprocessFiles(Lookup.DEFAULT_FILE));
            }
        })();
    }, [id]);

    /* --------------------------------------------------------------------------
    TRIGGER AI GENERATION
    -------------------------------------------------------------------------- */
    useEffect(() => {
        if (!messages?.length) return;
        const last = messages[messages.length - 1];
        if (last.role === "user") GenerateAiCode();
    }, [messages]);

    async function GenerateAiCode() {
        setLoading(true);
        try {
            const prompt = messages.map((m) => m.content).join("\n");

            const payload = {
                prompt,
                urls,
            };

            const res = await axios.post("/api/gen-ai-code", payload, {
                timeout: 300000,
            });

            const incoming = preprocessFiles(res?.data?.files || {});
            if (!incoming || !Object.keys(incoming).length) {
                setLoading(false);
                return;
            }

            if (isFullAiProject(incoming)) setFiles(incoming);
            else {
                const defaults = preprocessFiles(Lookup.DEFAULT_FILE);
                setFiles({ ...defaults, ...incoming });
            }

            await UpdateFiles({ workspaceId: id, files: res.data.files });
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }

    /* --------------------------------------------------------------------------
    DOWNLOAD ZIP
    -------------------------------------------------------------------------- */
    const downloadFiles = async () => {
        const zip = new JSZip();
        Object.entries(files).forEach(([p, content]) => {
            zip.file(p.replace(/^\//, ""), ensureCodeString(content));
        });
        const blob = await zip.generateAsync({ type: "blob" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "project.zip";
        a.click();
    };

    /* --------------------------------------------------------------------------
    DEPLOY TO VERCEL
    -------------------------------------------------------------------------- */
    const deployToVercel = async () => {
        setDeploying(true);
        try {
            const cleaned = {};
            Object.entries(files).forEach(([p, content]) => {
                cleaned[p.replace(/^\//, "")] = ensureCodeString(content);
            });

            const res = await axios.post("/api/deploy-vite", {
                files: cleaned,
                projectName: `project-${id}-${Date.now()}`,
            });

            alert(res.data.url || "Deployment done.");
        } catch (e) {
            console.error(e);
            alert("Deployment failed");
        }
        setDeploying(false);
    };

    /* --------------------------------------------------------------------------
    PREPARE SANDBOX PAYLOAD
    -------------------------------------------------------------------------- */
    const sandpack = useMemo(() => prepareSandpackPayload(files), [files]);
    const entry = determineEntry(sandpack.files);

    /* --------------------------------------------------------------------------
    RENDER
    -------------------------------------------------------------------------- */
    return (
        <div className="relative">
            {/* TOP BAR */}
            <div className="bg-[#181818] p-2 border flex justify-between items-center">
                <div className="flex gap-3 bg-black rounded-full p-1">
                    <h2
                        onClick={() => setActiveTab("code")}
                        className={`px-2 py-1 cursor-pointer ${activeTab === "code"
                            ? "text-blue-500 bg-blue-500/25 rounded-full"
                            : ""
                            }`}
                    >
                        Code
                    </h2>
                    <h2
                        onClick={() => setActiveTab("preview")}
                        className={`px-2 py-1 cursor-pointer ${activeTab === "preview"
                            ? "text-blue-500 bg-blue-500/25 rounded-full"
                            : ""
                            }`}
                    >
                        Preview
                    </h2>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={downloadFiles}
                        className="bg-blue-500 text-white px-4 py-2 rounded-full flex items-center gap-2"
                    >
                        <Download size={16} /> Download
                    </button>

                    <button
                        onClick={deployToVercel}
                        disabled={deploying}
                        className="bg-green-500 text-white px-4 py-2 rounded-full flex items-center gap-2"
                    >
                        {deploying ? (
                            <Loader2Icon className="animate-spin" />
                        ) : (
                            <Rocket size={16} />
                        )}
                        {deploying ? "Deploying..." : "Deploy to Vercel"}
                    </button>
                </div>
            </div>

            {/* SANDBOX */}
            <SandpackProvider
                files={sandpack.files}
                template="react"
                theme="dark"
                customSetup={{
                    entry,
                    dependencies: sandpack.dependencies,
                }}
                options={{
                    bundlerTimeoutSecs: 120,
                    recompileMode: "immediate",
                    externalResources: sandpack.externalResources,
                }}
            >
                <SandpackLayout>
                    {activeTab === "code" ? (
                        <>
                            <SandpackFileExplorer style={{ height: "80vh" }} />
                            <SandpackCodeEditor
                                style={{ height: "80vh" }}
                                showTabs
                                showLineNumbers
                                wrapContent
                            />
                        </>
                    ) : (
                        <SandpackPreview
                            style={{ height: "80vh" }}
                            showNavigator
                            showRefreshButton
                        />
                    )}
                </SandpackLayout>
            </SandpackProvider>

            {loading && (
                <div className="absolute inset-0 bg-black/60 flex justify-center items-center text-white z-50">
                    <Loader2Icon className="animate-spin h-10 w-10 mr-3" />
                    Generating...
                </div>
            )}
        </div>
    );
}

export default CodeView;
