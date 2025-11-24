"use client";

import React, { useContext, useMemo, useState } from "react";
import {
    SandpackProvider,
    SandpackLayout,
    SandpackCodeEditor,
    SandpackFileExplorer,
} from "@codesandbox/sandpack-react";

import Lookup from "@/data/Lookup";
import { MessagesContext } from "@/context/MessagesContext";
import axios from "axios";
import Prompt from "@/data/Prompt";

import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";

import { Loader2Icon, Download, Rocket } from "lucide-react";
import JSZip from "jszip";
import { UrlsContext } from "@/context/UrlsContext";

/* --------------------------------------------------------------------------
  Utilities
-------------------------------------------------------------------------- */

const normalizePath = (p) => {
    if (!p) return null;
    if (typeof p !== "string") p = String(p);
    return p.startsWith("/") ? p : `/${p}`;
};

const ensureCodeString = (content) => {
    if (content == null) return "";
    if (typeof content === "string") return content;
    if (content.code) return content.code;
    try {
        return JSON.stringify(content, null, 2);
    } catch {
        return String(content);
    }
};

function preprocessFiles(rawFiles) {
    if (!rawFiles || typeof rawFiles !== "object") return {};

    const processed = {};

    Object.entries(rawFiles).forEach(([rawPath, content]) => {
        const path = normalizePath(rawPath);
        if (!path) return;
        processed[path] = { code: ensureCodeString(content) };
    });

    return processed;
}

/* --------------------------------------------------------------------------
  Project helpers
-------------------------------------------------------------------------- */

function isFullAiProject(files) {
    const keys = Object.keys(files || {});
    return (
        keys.some((k) => k.startsWith("/src/")) ||
        keys.includes("/package.json") ||
        keys.includes("/vite.config.js") ||
        keys.includes("/tailwind.config.js") ||
        keys.includes("/main.jsx") ||
        keys.includes("/src/main.jsx")
    );
}

function determineEntry(files) {
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

    return Object.keys(files)[0] || "/index.js";
}

/* --------------------------------------------------------------------------
  Sandpack Helpers
-------------------------------------------------------------------------- */

function prepareSandpackPayload(files) {
    return {
        files,
        dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0",
        },
        externalResources: ["https://cdn.tailwindcss.com"],
    };
}

/* --------------------------------------------------------------------------
  MAIN COMPONENT
-------------------------------------------------------------------------- */

export default function CodeView() {
    const { id } = useParams();
    const convex = useConvex();

    const UpdateFiles = useMutation(api.workspace.UpdateFiles);

    // ⭐ REAL TIME WORKSPACE
    const workspace = useQuery(api.workspace.GetWorkspace, id ? { workspaceId: id } : "skip");

    // ⭐ DEFAULT TAB = preview
    const [activeTab, setActiveTab] = useState("preview");

    // ⭐ PREVIEW LOADING STATE
    const [previewLoading, setPreviewLoading] = useState(false);

    const files = useMemo(() => {
        if (!workspace) return preprocessFiles(Lookup.DEFAULT_FILE);

        // ⭐ When demoUrl is empty → show loader
        if (!workspace.demoUrl) setPreviewLoading(true);
        else setPreviewLoading(false);

        const raw = workspace.fileData || {};
        const processed = preprocessFiles(raw);

        if (isFullAiProject(processed)) return processed;

        return { ...preprocessFiles(Lookup.DEFAULT_FILE), ...processed };
    }, [workspace]);

    const sandpackPayload = useMemo(() => prepareSandpackPayload(files), [files]);
    const entry = determineEntry(files);

    /* ------------------------------------------------------------
      Loading workspace
    ------------------------------------------------------------ */
    if (!workspace) {
        return (
            <div className="p-10 flex justify-center items-center h-[80vh] text-white">
                <Loader2Icon className="animate-spin h-10 w-10" />
            </div>
        );
    }

    /* ------------------------------------------------------------
      DOWNLOAD ZIP
    ------------------------------------------------------------ */
    const downloadFiles = async () => {
        const zip = new JSZip();
        Object.entries(files || {}).forEach(([path, file]) => {
            zip.file(path.startsWith("/") ? path.slice(1) : path, ensureCodeString(file));
        });

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "project-files.zip";
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ------------------------------------------------------------
      DEPLOY BUTTON (same as before)
    ------------------------------------------------------------ */
    const deployToVercel = async () => {
        try {
            const res = await axios.post("/api/deploy-vercel", {
                projectId: workspace.projectId,
                chatId: workspace.chatId,
                versionId: workspace.latestVersionId,  // ⭐ FIXED
            });

            alert(res?.data?.url || "Deployment started");
        } catch (err) {
            console.error(err);
            alert("Deployment failed");
        }
    };

    /* ------------------------------------------------------------
      UI RENDER
    ------------------------------------------------------------ */
    return (
        <div className="relative">

            {/* TOP BAR */}
            <div className="bg-[#181818] p-2 border flex justify-between items-center">

                {/* Tabs */}
                <div className="flex gap-3 bg-black rounded-full p-1">

                    <h2
                        onClick={() => setActiveTab("preview")}
                        className={`px-2 py-1 cursor-pointer ${activeTab === "preview"
                            ? "text-blue-500 bg-blue-500/25 rounded-full"
                            : ""}`}
                    >
                        Preview
                    </h2>

                    <h2
                        onClick={() => setActiveTab("code")}
                        className={`px-2 py-1 cursor-pointer ${activeTab === "code"
                            ? "text-blue-500 bg-blue-500/25 rounded-full"
                            : ""}`}
                    >
                        Code
                    </h2>

                </div>

                {/* ⭐ Download + Deploy buttons */}
                <div className="flex gap-2">
                    <button
                        className="bg-blue-500 text-white px-4 py-2 rounded-full flex items-center gap-2"
                        onClick={downloadFiles}
                    >
                        <Download size={16} /> Download
                    </button>

                    <button
                        className="bg-green-500 text-white px-4 py-2 rounded-full flex items-center gap-2"
                        onClick={deployToVercel}
                    >
                        <Rocket size={16} /> Deploy
                    </button>
                </div>
            </div>

            {/* ⭐⭐⭐ PREVIEW TAB ─ ONLY IFRAME ⭐⭐⭐ */}
            {activeTab === "preview" && (
                <div className="w-full h-[80vh] bg-white flex items-center justify-center">

                    {previewLoading ? (
                        <div className="flex flex-col items-center text-gray-500 gap-3">
                            <Loader2Icon className="animate-spin h-8 w-8 text-gray-400" />
                            <p>Editing preview…</p>
                        </div>
                    ) : workspace.demoUrl ? (
                        <iframe
                            src={workspace.demoUrl}
                            className="w-full h-full"
                            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                            onLoad={() => setPreviewLoading(false)}
                        />
                    ) : (
                        <div className="text-gray-500">No Preview Available</div>
                    )}

                </div>
            )}

            {/* ⭐⭐⭐ CODE TAB ─ ONLY FILE EXPLORER + EDITOR ⭐⭐⭐ */}
            {activeTab === "code" && (
                <SandpackProvider
                    files={sandpackPayload.files}
                    template="react"
                    theme="dark"
                    customSetup={{
                        entry,
                        dependencies: sandpackPayload.dependencies,
                    }}
                >
                    <SandpackLayout>
                        <SandpackFileExplorer style={{ height: "80vh" }} />
                        <SandpackCodeEditor
                            style={{ height: "80vh" }}
                            showTabs
                            showLineNumbers
                            wrapContent
                        />
                    </SandpackLayout>
                </SandpackProvider>
            )}

        </div>
    );
}
