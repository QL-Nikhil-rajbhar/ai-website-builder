// utils/sandpackFiles.js
// Normalize workspace.fileData into a Sandpack-friendly file map.
// Keeps only /public and /src files (Option A).
// Injects a minimal package.json if missing so Sandpack loads React.

export function normalizeSandpackFiles(fileData = {}) {
    const out = {};

    // prefer keys with leading slash; accept without as well
    for (const rawPath in fileData) {
        if (!rawPath) continue;
        // normalize leading slash
        const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

        // Accept only /public/* and /src/* (Option A)
        if (path.startsWith("/public/") || path.startsWith("/src/")) {
            const val = fileData[rawPath];
            if (typeof val === "string") out[path] = val;
            else if (val && typeof val === "object" && "code" in val) out[path] = val.code;
            else out[path] = JSON.stringify(val, null, 2);
        }
    }

    // If there is a top-level stylesheet at /styles.css, move it to /src/index.css
    if (fileData["/styles.css"] && !out["/src/index.css"]) {
        out["/src/index.css"] = fileData["/styles.css"];
    } else if (fileData["styles.css"] && !out["/src/index.css"]) {
        out["/src/index.css"] = fileData["styles.css"];
    }

    // Ensure an index entrypoint exists
    if (!out["/src/index.js"] && out["/src/index.jsx"]) {
        out["/src/index.js"] = out["/src/index.jsx"];
    }

    // If App exists but index doesn't, create a minimal index.js wrapper
    if (!out["/src/index.js"] && out["/src/App.js"]) {
        out["/src/index.js"] = [
            "import React from 'react';",
            "import { createRoot } from 'react-dom/client';",
            "import App from './App';",
            "import './index.css';",
            "",
            "const rootEl = document.getElementById('root');",
            "if (rootEl) {",
            "  const root = createRoot(rootEl);",
            "  root.render(<App />);",
            "}",
            "",
        ].join("\n");
    }

    // Ensure public/index.html is present — if not, create a minimal one
    if (!out["/public/index.html"]) {
        out["/public/index.html"] = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>AI Generated App</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
    }

    // Add package.json if missing so Sandpack will inject React dependencies
    if (!out["/package.json"]) {
        out["/package.json"] = JSON.stringify(
            {
                name: "ai-generated-app",
                version: "1.0.0",
                private: true,
                main: "src/index.js",
                scripts: {
                    start: "react-scripts start",
                },
                dependencies: {
                    react: "18.2.0",
                    "react-dom": "18.2.0",
                },
            },
            null,
            2
        );
    }

    // Ensure index.css exists (may be empty)
    if (!out["/src/index.css"]) {
        out["/src/index.css"] = out["/src/index.css"] || "body { margin: 0; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }";
    }

    return out;
}
