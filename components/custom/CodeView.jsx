// =======================================================
// CodeView.jsx — FIXED VERSION (ZIP-based AWS Deployment)
// =======================================================
"use client";

import React, { useMemo, useState, useRef } from "react";
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
    const workspace = useQuery(
        api.workspace.GetWorkspace,
        id ? { workspaceId: id } : "skip"
    );

    const [activeTab, setActiveTab] = useState("preview");
    const [previewLoading, setPreviewLoading] = useState(false);
    const zipBlobRef = useRef(null);
    const [deploying, setDeploying] = useState(false);
    const [deployStatus, setDeployStatus] = useState("");

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
    // DOWNLOAD ZIP  (ALSO STORES ZIP BLOB FOR DEPLOYMENT)
    // ------------------------------------------------------
    const downloadProject = async () => {
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

        // 5) Add buildspec.yml
        zip.file(
            "buildspec.yml",
            `version: 0.2

phases:
  install:
    runtime-versions:
      nodejs: 18
    commands:
      - echo "Installing dependencies..."
      - aws --version
      - node --version
      - npm --version

  pre_build:
    commands:
      - echo "Downloading source code from S3..."
      - echo "Bucket: $SOURCE_BUCKET"
      - echo "Key: $SOURCE_KEY"
      - aws s3 cp s3://$SOURCE_BUCKET/$SOURCE_KEY project.zip
      - unzip project.zip -d ./project
      - cd project
      - echo "Source code extracted"
      - ls -la

  build:
    commands:
      - echo "Installing dependencies..."
      - npm install --legacy-peer-deps
      
      - echo "Building Next.js static export..."
      - npm run build
      
      - echo "Build complete, checking for out folder..."
      - ls -la
      - test -d out || (echo "❌ No out folder found!" && exit 1)

  post_build:
    commands:
      - echo "Uploading build to S3..."
      - aws s3 sync out/ s3://$DEPLOY_BUCKET/projects/$TIMESTAMP/ --delete --acl public-read
      
      - echo "Creating CloudFront invalidation..."
      - |
        INVALIDATION_ID=$(aws cloudfront create-invalidation \
          --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
          --paths "/projects/$TIMESTAMP/*" \
          --query 'Invalidation.Id' \
          --output text)
      
      - echo "CloudFront invalidation created: $INVALIDATION_ID"
      - echo "✅ Deployment complete!"
      - echo "🌐 Website URL: https://$CLOUDFRONT_DOMAIN/projects/$TIMESTAMP/"

artifacts:
  files:
    - '**/*'
  base-directory: project/out
`
        );

        // 6) Add tsconfig.json
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

        // 7) Generate missing shadcn components (if used)
        const used = detectShadcn(files);
        used.forEach((name) => {
            if (SHADCN_LIB[name]) {
                zip.file(`components/ui/${name}.tsx`, SHADCN_LIB[name]);
            }
        });

        // 8) Generate ZIP blob
        const blob = await zip.generateAsync({ type: "blob" });
        zipBlobRef.current = blob;

        // 9) Trigger browser download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "website.zip";
        a.click();
        URL.revokeObjectURL(url);
    };

    // ------------------------------------------------------
    // AWS DEPLOY (ZIP UPLOAD + POLLING)
    // ------------------------------------------------------
    const deployToAWS = async () => {
        try {
            if (!zipBlobRef.current) {
                alert("Please click Download once before deploying.");
                return;
            }

            setDeploying(true);
            setDeployStatus("Uploading source code...");

            // 1) Upload ZIP to AWS deploy API
            const formData = new FormData();
            formData.append("zipFile", zipBlobRef.current);

            const deployRes = await axios.post("/api/deploy-aws", formData);

            if (!deployRes.data?.success) {
                alert("Failed to start deployment");
                setDeploying(false);
                return;
            }

            const buildId = deployRes.data.buildId;
            const timestamp = deployRes.data.sourceKey.split('/')[1]; // Extract timestamp from source key

            setDeployStatus("Build started. Waiting for completion...");

            // 2) Poll build status every 10 seconds
            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await axios.get(
                        `/api/deploy-status?buildId=${buildId}&timestamp=${timestamp}`
                    );

                    const { status, phase, url, logs } = statusRes.data;

                    console.log("Build status:", status, "Phase:", phase);

                    if (status === "SUCCEEDED") {
                        clearInterval(pollInterval);
                        setDeploying(false);
                        setDeployStatus("");
                        alert(`✅ Deployment successful!\n🌐 Your website: ${url}`);
                        window.open(url, "_blank");
                    } else if (status === "FAILED" || status === "STOPPED") {
                        clearInterval(pollInterval);
                        setDeploying(false);
                        setDeployStatus("");
                        alert(`❌ Build ${status.toLowerCase()}.\nCheck logs: ${logs}`);
                        window.open(logs, "_blank");
                    } else {
                        // Still in progress
                        setDeployStatus(`Build in progress... (${phase || status})`);
                    }
                } catch (pollErr) {
                    console.error("Status poll error:", pollErr);
                }
            }, 10000); // Poll every 10 seconds

        } catch (err) {
            console.error("AWS deploy error:", err);
            setDeploying(false);
            setDeployStatus("");
            alert("Deployment failed: " + (err.response?.data?.error || err.message));
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
                    <button
                        onClick={downloadProject}
                        className="bg-blue-500 px-4 py-2 text-white"
                    >
                        <Download size={16} /> Download
                    </button>

                    <button
                        onClick={deployToAWS}
                        disabled={deploying}
                        className="bg-green-600 px-4 py-2 text-white flex items-center gap-2"
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
