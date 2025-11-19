"use client"
import React, { use, useContext } from 'react';
import { useState } from 'react';
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
import { useEffect } from 'react';
import { UpdateFiles } from '@/convex/workspace';
import { useConvex, useMutation } from 'convex/react';
import { useParams } from 'next/navigation';
import { api } from '@/convex/_generated/api';
import { Loader2Icon, Download, Rocket } from 'lucide-react';
import JSZip from 'jszip';
import { UrlsContext } from '@/context/UrlsContext';

function CodeView() {
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState("code");
    const [files, setFiles] = useState(Lookup?.DEFAULT_FILE);
    const { messages, setMessages } = useContext(MessagesContext);
    const { urls, setUrls } = useContext(UrlsContext);
    const UpdateFiles = useMutation(api.workspace.UpdateFiles);
    const convex = useConvex();
    const [loading, setLoading] = useState(false);
    const [deploying, setDeploying] = useState(false);
    const [deploymentUrl, setDeploymentUrl] = useState(null);
    const [uploadedImages, setUploadedImages] = useState([]); // Array of base64 strings or URLs
    const [waitingForClarification, setWaitingForClarification] = useState(false);

    useEffect(() => {
        if (id) {
            GetFiles();
        }
    }, [id]);

    const GetFiles = async () => {
        try {
            const result = await convex.query(api.workspace.GetWorkspace, { workspaceId: id });
            console.log("Fetched workspace data:", result);

            // Preprocess and validate files before merging
            const processedFiles = preprocessFiles(result?.fileData);
            const mergedFiles = { ...Lookup.DEFAULT_FILE, ...processedFiles };
            setFiles(mergedFiles);
        } catch (error) {
            console.error("Error fetching files:", error);
        }
    };

    // Add file preprocessing function
    const preprocessFiles = (files) => {
        if (!files || typeof files !== 'object') {
            console.error("Invalid files object:", files);
            return {};
        }

        const processed = {};
        Object.entries(files).forEach(([path, content]) => {
            // Ensure the file has proper content structure
            if (typeof content === 'string') {
                processed[path] = { code: content };
            } else if (content && typeof content === 'object') {
                if (!content.code && typeof content === 'object') {
                    processed[path] = { code: JSON.stringify(content, null, 2) };
                } else {
                    processed[path] = content;
                }
            }
        });

        console.log("Processed files:", Object.keys(processed));
        return processed;
    };

    useEffect(() => {
        if (messages?.length > 0) {
            const role = messages[messages?.length - 1].role;
            if (role === 'user' && !waitingForClarification) {
                GenerateAiCode();
            }
        }
    }, [messages]);

    const GenerateAiCode = async () => {
        setLoading(true);

        // First call: Check if this is the initial prompt (ask clarifications)
        const userMessages = messages.filter(m => m.role === 'user');
        const isInitialPrompt = userMessages.length === 1 && !messages.some(m => m.questions);

        if (isInitialPrompt) {
            // First time - ask clarification questions
            const payload = {
                prompt: messages[0].content,
                urls: urls || [],
                shouldGenerate: false,
                skipQuestions: false
            };

            console.log("Asking clarification questions...", payload);

            try {
                const result = await axios.post('/api/gen-ai-code', payload);

                if (result.data.needsClarification) {
                    // Add AI's clarification questions to messages
                    const aiMessage = {
                        role: 'ai',
                        content: result.data.message,
                        questions: result.data.questions
                    };
                    setMessages(prev => [...prev, aiMessage]);
                    setWaitingForClarification(true);
                    setLoading(false);
                    return; // Don't generate code yet
                }
            } catch (error) {
                console.error("Error getting clarifications:", error);
                setLoading(false);
                return;
            }
        }

        // Second call: Generate actual code with all clarifications
        setWaitingForClarification(false);
        const fullConversation = messages
            .filter(m => m.role === 'user')
            .map(m => m.content)
            .join("\n\n");

        const payload = {
            prompt: fullConversation,
            urls: urls || [],
            conversationHistory: messages,
            shouldGenerate: true
        };

        console.log("Generating code with clarifications...", payload);

        try {
            const result = await axios.post('/api/gen-ai-code', payload);

            if (!result.data?.files) {
                setLoading(false);
                return;
            }

            const processedAiFiles = preprocessFiles(result.data.files);
            const mergedFiles = { ...Lookup.DEFAULT_FILE, ...processedAiFiles };
            setFiles(mergedFiles);

            await UpdateFiles({
                workspaceId: id,
                files: result.data.files
            });

            setLoading(false);
        } catch (error) {
            setLoading(false);
            console.error("Error generating code:", error);
        }
    };

    const deployToVercel = async () => {
        setDeploying(true);
        try {
            const deployFiles = {};

            // Copy and rename to .jsx
            Object.entries(files).forEach(([filename, content]) => {
                const cleanName = filename.startsWith('/') ? filename.slice(1) : filename;

                // Skip index.css - we'll create our own
                if (cleanName === 'index.css') return;

                // Only rename component files
                if (cleanName.startsWith('components/') || cleanName.endsWith('.js') || cleanName === 'App.js') {
                    const fileContent = typeof content === 'string' ? content : content?.code;

                    if (fileContent) {
                        let targetName = cleanName;
                        if (cleanName.endsWith('.js') && fileContent.includes('<')) {
                            targetName = cleanName.replace('.js', '.jsx');
                        }
                        deployFiles[targetName] = fileContent;
                    }
                }
            });

            deployFiles['index.html'] = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
  </React.StrictMode>,
)`;

            // CLEAN index.css - no custom classes
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
  plugins: [react()],
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

            // Fixed Tailwind config - specific paths only
            deployFiles['tailwind.config.js'] = `export default {
  content: [
    "./index.html",
    "./**/*.{js,jsx}",
    "./components/**/*.{js,jsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;

            deployFiles['postcss.config.js'] = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`;

            console.log("Deploying:", Object.keys(deployFiles));

            const uniqueProjectName = `race-${id}-${Date.now()}`;
            const result = await axios.post('/api/deploy-vite', {
                files: deployFiles,
                projectName: uniqueProjectName
            });

            if (result.data.url) {
                setDeploymentUrl(result.data.url);
                alert(`✅ SUCCESS!\n${result.data.url}`);
            }

            setDeploying(false);
        } catch (error) {
            console.error("Error:", error);
            alert(`❌ Failed: ${error.response?.data?.error || error.message}`);
            setDeploying(false);
        }
    };

    const downloadFiles = async () => {
        try {
            // Create a new JSZip instance
            const zip = new JSZip();

            // Add each file to the zip
            Object.entries(files).forEach(([filename, content]) => {
                // Handle the file content based on its structure
                let fileContent;
                if (typeof content === 'string') {
                    fileContent = content;
                } else if (content && typeof content === 'object') {
                    if (content.code) {
                        fileContent = content.code;
                    } else {
                        // If it's an object without code property, stringify it
                        fileContent = JSON.stringify(content, null, 2);
                    }
                }

                // Only add the file if we have content
                if (fileContent) {
                    // Remove leading slash if present
                    const cleanFileName = filename.startsWith('/') ? filename.slice(1) : filename;
                    zip.file(cleanFileName, fileContent);
                }
            });

            // Add package.json with dependencies
            const packageJson = {
                "name": "generated-project",
                "version": "1.0.0",
                "private": true,
                "dependencies": Lookup.DEPENDANCY,
                "scripts": {
                    "dev": "vite",
                    "build": "vite build",
                    "preview": "vite preview"
                }
            };
            zip.file('package.json', JSON.stringify(packageJson, null, 2));

            // Generate the zip file
            const blob = await zip.generateAsync({ type: 'blob' });

            // Create download link and trigger download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'project-files.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Error downloading files:", error);
        }
    };

    return (
        <div className='relative'>
            <div className="bg-[#181818] w-full p-2 border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center flex-wrap shrink-0 bg-black p-1 justify-center w-[140px] gap-3 rounded-full">
                        <h2
                            onClick={() => setActiveTab("code")}
                            className={`text-sm cursor-pointer ${activeTab === 'code' && 'text-blue-500 bg-blue-500 bg-opacity-25 p-1 px-2 rounded-full'}`}
                        >
                            Code
                        </h2>
                        <h2
                            onClick={() => setActiveTab("preview")}
                            className={`text-sm cursor-pointer ${activeTab === 'preview' && 'text-blue-500 bg-blue-500 bg-opacity-25 p-1 px-2 rounded-full'}`}
                        >
                            Preview
                        </h2>
                    </div>

                    {/* Action Buttons */}
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

                {/* Show deployment URL if available */}
                {deploymentUrl && (
                    <div className="mt-2 p-2 bg-green-900 bg-opacity-30 rounded-lg">
                        <p className="text-sm text-green-400">
                            Deployed at:{' '}
                            <a href={deploymentUrl} target="_blank" rel="noopener noreferrer" className="underline">
                                {deploymentUrl}
                            </a>
                        </p>
                    </div>
                )}
            </div>

            {Object.keys(files).length > 0 ? (
                <SandpackProvider
                    files={files}
                    template="react"
                    theme="dark"
                    customSetup={{
                        dependencies: {
                            ...Lookup.DEPENDANCY,
                        },
                        entry: "/index.js",
                    }}
                    options={{
                        externalResources: ["https://cdn.tailwindcss.com"],
                        bundlerTimeoutSecs: 120,
                        recompileMode: "immediate",
                        recompileDelay: 300,
                    }}
                >
                    <div className='relative'>
                        <SandpackLayout>
                            {activeTab === 'code' ? (
                                <>
                                    <SandpackFileExplorer style={{ height: "80vh" }} />
                                    <SandpackCodeEditor
                                        style={{ height: "80vh" }}
                                        showTabs
                                        showLineNumbers
                                        showInlineErrors
                                        wrapContent
                                    />
                                </>
                            ) : (
                                <SandpackPreview
                                    style={{ height: "80vh" }}
                                    showNavigator={true}
                                    showOpenInCodeSandbox={false}
                                    showRefreshButton={true}
                                />
                            )}
                        </SandpackLayout>
                    </div>
                </SandpackProvider>
            ) : (
                <div className="p-10 text-white flex items-center justify-center h-[80vh]">
                    <Loader2Icon className="animate-spin h-10 w-10" />
                    <span className="ml-2">Loading files...</span>
                </div>
            )}

            {loading && (
                <div className='p-10 bg-gray-900 opacity-80 absolute top-0 rounded-lg w-full h-full flex items-center justify-center'>
                    <Loader2Icon className='animate-spin h-10 w-10 text-white' />
                    <h2 className='text-white ml-2'>Generating files...</h2>
                </div>
            )}
        </div>
    );
}

export default CodeView;
