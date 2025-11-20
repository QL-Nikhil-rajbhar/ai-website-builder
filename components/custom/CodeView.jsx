"use client"
import React, { useContext } from 'react';
import { useState, useEffect } from 'react';
import {
    SandpackProvider,
    SandpackLayout,
    SandpackCodeEditor,
    SandpackPreview,
    SandpackFileExplorer
} from "@codesandbox/sandpack-react";
import Lookup from '@/data/Lookup';
import { MessagesContext } from '@/context/MessagesContext';
import axios from 'axios';
import Prompt from '@/data/Prompt';
import { useConvex, useMutation } from 'convex/react';
import { useParams } from 'next/navigation';
import { api } from '@/convex/_generated/api';
import { Loader2Icon, Download, Rocket } from 'lucide-react';
import JSZip from 'jszip';
import { UrlsContext } from '@/context/UrlsContext';

function CodeView() {
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState('code');
    const [files, setFiles] = useState(Lookup?.DEFAULT_FILE || {});
    const { messages, setMessages } = useContext(MessagesContext);
    const { urls, setUrls } = useContext(UrlsContext);

    const updateFilesMutation = useMutation(api.workspace.UpdateFiles);
    const convex = useConvex();
    const [loading, setLoading] = useState(false);
    const [deploying, setDeploying] = useState(false);
    const [deploymentUrl, setDeploymentUrl] = useState(null);

    useEffect(() => {
        if (id) GetFiles();
    }, [id]);

    // Robust preprocessing: accepts array or object and returns Sandpack-friendly map:
    // { "/App.js": { code: "..." }, "/components/Footer.js": { code: "..." } }
    const preprocessFiles = (incoming) => {
        const out = {};

        if (!incoming) return out;

        // If backend returned an ARRAY of { filename, content } entries
        if (Array.isArray(incoming)) {
            incoming.forEach((entry) => {
                if (!entry) return;
                const rawName = entry.filename || entry.path || entry.fileName;
                if (!rawName) return;
                const name = rawName.startsWith('/') ? rawName : `/${rawName}`;
                const contentObj = entry.content ?? entry.body ?? entry.code ?? "";
                // contentObj might be a string or object { code: '...' }
                if (typeof contentObj === 'string') {
                    out[name] = { code: contentObj };
                } else if (typeof contentObj === 'object') {
                    // prefer code property if exists
                    out[name] = { code: contentObj.code ?? JSON.stringify(contentObj, null, 2) };
                } else {
                    out[name] = { code: String(contentObj) };
                }
            });
            return out;
        }

        // If backend returned an OBJECT map: { "/App.js": { code: "..." } } or { "/App.js": "..." }
        if (typeof incoming === 'object') {
            Object.entries(incoming).forEach(([path, content]) => {
                if (!path) return;
                const name = path.startsWith('/') ? path : `/${path}`;
                if (typeof content === 'string') {
                    out[name] = { code: content };
                } else if (content && typeof content === 'object') {
                    // If content already looks like { code: '...' }
                    out[name] = { code: content.code ?? JSON.stringify(content, null, 2) };
                } else {
                    out[name] = { code: String(content) };
                }
            });
            return out;
        }

        return out;
    };

    const GetFiles = async () => {
        try {
            const result = await convex.query(api.workspace.GetWorkspace, {
                workspaceId: id
            });
            console.log("Fetched workspace data:", result);

            // result.fileData may be array or object
            const processedFiles = preprocessFiles(result?.fileData);
            const mergedFiles = { ...Lookup.DEFAULT_FILE, ...processedFiles };
            setFiles(mergedFiles);
        } catch (error) {
            console.error("Error fetching files:", error);
        }
    };

    useEffect(() => {
        if (messages?.length > 0) {
            const role = messages[messages.length - 1]?.role;
            if (role === 'user') {
                GenerateAiCode();
            }
        }
    }, [messages]);

    const GenerateAiCode = async () => {
        setLoading(true);
        const PROMPT = messages.map(m => m.content).join("\n") + "\n" + `{imageUrls : ${urls} }` + Prompt.CODE_GEN_PROMPT;

        const payload = {
            prompt: PROMPT,
            urls: urls
        };
        console.log('payload is ', payload);

        try {
            const result = await axios.post('/api/gen-ai-code', payload);
            console.log('AI call response', result);

            if (!result.data?.files) {
                setLoading(false);
                return;
            }

            // Normalize AI files → sandpack map
            const processedAiFiles = preprocessFiles(result.data.files);

            // Persist canonical array shape to Convex: [{ filename, content }]
            const convexFilesArray = Object.entries(processedAiFiles).map(([filename, contentObj]) => ({
                filename,
                content: { code: contentObj.code ?? "" }
            }));

            // Update backend storage (mutation expects 'files' as any)
            await updateFilesMutation({
                workspaceId: id,
                files: convexFilesArray
            });

            // Merge to UI (keep Lookup defaults)
            const mergedFiles = { ...Lookup.DEFAULT_FILE, ...processedAiFiles };
            setFiles(mergedFiles);
            setLoading(false);
        } catch (error) {
            console.error("GenerateAiCode error:", error);
            setLoading(false);
        }
    };

    const deployToVercel = async () => {
        setDeploying(true);
        try {
            const deployFiles = {};

            // Copy and rename to .jsx when appropriate
            Object.entries(files).forEach(([filename, content]) => {
                const cleanName = filename.startsWith('/') ? filename.slice(1) : filename;

                // Skip index.css - we'll create our own
                if (cleanName === 'index.css') {
                    return;
                }

                if (
                    (cleanName.startsWith('components/') && cleanName.endsWith('.js')) ||
                    cleanName === 'App.js' || cleanName.endsWith('.jsx')
                ) {
                    const fileContent = typeof content === 'string' ? content : content?.code || '';
                    if (fileContent) {
                        let targetName = cleanName;
                        if ((cleanName.endsWith('.js') || cleanName.endsWith('.jsx')) && fileContent.includes('<')) {
                            targetName = targetName.replace(/\.js$/, '.jsx');
                        }
                        deployFiles[targetName] = fileContent;
                    }
                }
            });

            // Static skeleton files
            deployFiles['index.html'] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Race App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.jsx"></script>
  </body>
</html>`;

            deployFiles['main.jsx'] = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)`;

            deployFiles['index.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  -webkit-font-smoothing: antialiased;
}`;

            deployFiles['vite.config.js'] = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()]
})`;

            deployFiles['package.json'] = JSON.stringify({
                "name": "race-app",
                "version": "1.0.0",
                "type": "module",
                "scripts": {
                    "build": "vite build",
                    "preview": "vite preview"
                },
                "dependencies": {
                    "react": "^18.2.0",
                    "react-dom": "^18.2.0"
                },
                "devDependencies": {
                    "@vitejs/plugin-react": "^4.2.1",
                    "vite": "^5.0.0",
                    "tailwindcss": "^3.3.0",
                    "autoprefixer": "^10.4.16",
                    "postcss": "^8.4.32"
                }
            }, null, 2);

            deployFiles['tailwind.config.js'] = `export default {
  content: [
    './index.html',
    './*.{js,jsx}',
    './components/**/*.{js,jsx}'
  ],
  theme: { extend: {} },
  plugins: []
}`;

            deployFiles['postcss.config.js'] = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}`;

            console.log('Deploying:', Object.keys(deployFiles));

            const uniqueProjectName = `race-${id}-${Date.now()}`;

            const result = await axios.post('/api/deploy-vite', {
                files: deployFiles,
                projectName: uniqueProjectName
            });

            if (result.data.url) {
                setDeploymentUrl(result.data.url);
                alert(`✅ SUCCESS!\n\n${result.data.url}`);
            }

            setDeploying(false);
        } catch (error) {
            console.error('Error:', error);
            alert(`❌ Failed: ${error.response?.data?.error || error.message}`);
            setDeploying(false);
        }
    };

    const downloadFiles = async () => {
        try {
            const zip = new JSZip();

            Object.entries(files).forEach(([filename, content]) => {
                let fileContent;
                if (typeof content === 'string') {
                    fileContent = content;
                } else if (content && typeof content === 'object') {
                    fileContent = content.code ?? JSON.stringify(content, null, 2);
                }

                if (fileContent) {
                    const cleanFileName = filename.startsWith('/') ? filename.slice(1) : filename;
                    zip.file(cleanFileName, fileContent);
                }
            });

            const packageJson = {
                name: "generated-project",
                version: "1.0.0",
                private: true,
                dependencies: Lookup.DEPENDANCY,
                scripts: {
                    "dev": "vite",
                    "build": "vite build",
                    "preview": "vite preview"
                }
            };
            zip.file("package.json", JSON.stringify(packageJson, null, 2));

            const blob = await zip.generateAsync({ type: "blob" });

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'project-files.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading files:', error);
        }
    };

    return (
        <div className='relative'>
            <div className='bg-[#181818] w-full p-2 border'>
                <div className='flex items-center justify-between'>
                    <div className='flex items-center flex-wrap shrink-0 bg-black p-1 justify-center
                    w-[140px] gap-3 rounded-full'>
                        <h2 onClick={() => setActiveTab('code')}
                            className={`text-sm cursor-pointer 
                        ${activeTab == 'code' && 'text-blue-500 bg-blue-500 bg-opacity-25 p-1 px-2 rounded-full'}`}>
                            Code</h2>

                        <h2 onClick={() => setActiveTab('preview')}
                            className={`text-sm cursor-pointer 
                        ${activeTab == 'preview' && 'text-blue-500 bg-blue-500 bg-opacity-25 p-1 px-2 rounded-full'}`}>
                            Preview</h2>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={downloadFiles}
                            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full transition-colors duration-200"
                        >
                            <Download className="h-4 w-4" />
                            <span>Download</span>
                        </button>

                        <button
                            onClick={deployToVercel}
                            disabled={deploying}
                            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white px-4 py-2 rounded-full transition-colors duration-200"
                        >
                            {deploying ? (
                                <Loader2Icon className="h-4 w-4 animate-spin" />
                            ) : (
                                <Rocket className="h-4 w-4" />
                            )}
                            <span>{deploying ? 'Deploying...' : 'Deploy to Vercel'}</span>
                        </button>
                    </div>
                </div>

                {deploymentUrl && (
                    <div className="mt-2 p-2 bg-green-900 bg-opacity-30 rounded-lg">
                        <p className="text-sm text-green-400">
                            🚀 Deployed at: <a href={deploymentUrl} target="_blank" rel="noopener noreferrer" className="underline">{deploymentUrl}</a>
                        </p>
                    </div>
                )}
            </div>

            {Object.keys(files).length > 0 ? (
                <SandpackProvider
                    files={files}
                    template="react"
                    theme={'dark'}
                    customSetup={{
                        dependencies: {
                            ...Lookup.DEPENDANCY
                        },
                        entry: '/index.js'
                    }}
                    options={{
                        externalResources: ['https://cdn.tailwindcss.com'],
                        bundlerTimeoutSecs: 120,
                        recompileMode: "immediate",
                        recompileDelay: 300
                    }}
                >
                    <div className="relative">
                        <SandpackLayout>
                            {activeTab == 'code' ? <>
                                <SandpackFileExplorer style={{ height: '80vh' }} />
                                <SandpackCodeEditor
                                    style={{ height: '80vh' }}
                                    showTabs
                                    showLineNumbers
                                    showInlineErrors
                                    wrapContent />
                            </> :
                                <>
                                    <SandpackPreview
                                        style={{ height: '80vh' }}
                                        showNavigator={true}
                                        showOpenInCodeSandbox={false}
                                        showRefreshButton={true}
                                    />
                                </>}
                        </SandpackLayout>
                    </div>
                </SandpackProvider>
            ) : (
                <div className="p-10 text-white flex items-center justify-center h-[80vh]">
                    <Loader2Icon className='animate-spin h-10 w-10' />
                    <span className="ml-2">Loading files...</span>
                </div>
            )}

            {loading && <div className='p-10 bg-gray-900 opacity-80 absolute top-0 
            rounded-lg w-full h-full flex items-center justify-center'>
                <Loader2Icon className='animate-spin h-10 w-10 text-white' />
                <h2 className='text-white ml-2'>Generating files...</h2>
            </div>}
        </div>
    );
}

export default CodeView;
