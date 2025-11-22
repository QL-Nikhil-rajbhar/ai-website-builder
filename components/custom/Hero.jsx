"use client";

import React, { useState, useContext, useEffect, useRef } from "react";
import { Sparkles, Send, Loader2, Link as IconLink } from "lucide-react";
import axios from "axios";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { MessagesContext } from "@/context/MessagesContext";
import { UrlsContext } from "@/context/UrlsContext";

/**
 * Hero.jsx
 * - Step-by-step chat clarifier on main page
 * - Upload images or paste image URL
 * - Asks clarifying questions one-by-one (server returns a question or enough=true)
 * - When enough=true, shows "We have enough info..." message and allows user to click Generate
 * - Loader sequence: "Analyzing..." (0-3s) -> "Thinking..." (3-6s) -> "Enhancing..." (6s until response)
 * - After generation, it creates a Convex workspace and navigates to /workspace/{id}
 *
 * NOTE: Keep existing project logic (Convex workspace) intact. This component only replaces
 * the old plain textarea-based flow with a chat clarifier flow.
 */

export default function Hero() {
    const router = useRouter();
    const CreateWorkspace = useMutation(api.workspace.CreateWorkspace);
    const { messages, setMessages } = useContext(MessagesContext);
    const { urls, setUrls } = useContext(UrlsContext);

    // Chat state for clarifications
    const [chatMessages, setChatMessages] = useState([]); // { role: 'user'|'ai', text: string, imageUrl?: string }
    const [currentAnswer, setCurrentAnswer] = useState("");
    const [loadingQuestion, setLoadingQuestion] = useState(false);
    const [askingDone, setAskingDone] = useState(false); // becomes true when server says "enough"
    const [lastQuestion, setLastQuestion] = useState(null);

    // File/image upload
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploadedImageUrls, setUploadedImageUrls] = useState([]); // returned urls or user-provided
    const fileInputRef = useRef(null);

    // Loader states for final generation
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [loaderText, setLoaderText] = useState("Analyzing...");

    // UI small states
    const [errorMsg, setErrorMsg] = useState(null);

    useEffect(() => {
        // If chat starts empty, prompt the user to enter the initial prompt (no auto-call)
        if (chatMessages.length === 0) {
            // No action by default
        }
    }, []);

    // read file as base64 for upload; (we assume backend /api/clarify-question or /api/gen-ai-code accepts URLs or base64)
    const readFileAsBase64 = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        setSelectedFiles(files);
    };

    // If user supplies image URL (paste)
    const addImageUrl = (url) => {
        if (!url) return;
        setUploadedImageUrls((s) => [...s, url]);
    };

    // Send initial prompt or answer to server to get next question
    // history: chatMessages array
    const askClarifyingQuestion = async (text) => {
        if (!text || !text.trim()) return;
        setErrorMsg(null);
        setLoadingQuestion(true);

        // push user's message locally
        const userMsg = { role: "user", text, imageUrl: null };
        setChatMessages((c) => [...c, userMsg]);
        setCurrentAnswer("");

        try {
            // if user uploaded files, convert to base64 to attach (optional)
            const imageData = [];
            for (const f of selectedFiles) {
                // read to base64
                try {
                    const data = await readFileAsBase64(f);
                    imageData.push({ name: f.name, data });
                } catch (e) {
                    console.warn("Failed to read file", e);
                }
            }

            const payload = {
                prompt: text,
                history: chatMessages.map((m) => ({ role: m.role, content: m.text })),
                images: [...uploadedImageUrls], // these are URLs if user pasted them
                imageData, // optional base64s
            };

            const res = await axios.post("/api/clarify-question", payload);
            const data = res.data;

            // Expect JSON: { question: string|null, enough: boolean, reason?: string }
            if (data?.question) {
                setChatMessages((c) => [...c, { role: "ai", text: data.question }]);
                setLastQuestion(data.question);
            } else if (data?.enough) {
                setChatMessages((c) => [
                    ...c,
                    { role: "ai", text: "Okay — looks like we have enough info to generate a website." },
                ]);
                setAskingDone(true);
            } else {
                // fallback: show entire text as ai reply
                const fallback = data?.reply || "Sorry, I couldn't generate a clarifying question.";
                setChatMessages((c) => [...c, { role: "ai", text: fallback }]);
            }
        } catch (err) {
            console.error("Clarify API error", err);
            setErrorMsg("Failed to get clarifying question. Check server logs.");
        } finally {
            setLoadingQuestion(false);
        }
    };

    // start loader sequence: analyzing -> thinking -> enhancing
    const startLoaderSequence = () => {
        setIsEnhancing(true);
        setLoaderText("Analyzing...");
        // two timeouts: after 3s -> Thinking, after 6s -> Enhancing
        setTimeout(() => setLoaderText("Thinking..."), 3000);
        setTimeout(() => setLoaderText("Enhancing..."), 6000);
    };

    // final generate function: will call /api/gen-ai-code and then create convex workspace (keep same flow)
    const generateWebsite = async () => {
        // Combine all chatMessages + uploadedImageUrls into a final prompt
        const finalPrompt =
            chatMessages.map((m) => `${m.role === "user" ? "User:" : "AI:"} ${m.text}`).join("\n") +
            "\n\nGENERATE_WEBSITE: Create a multi-file React + Tailwind UI project. Return JSON mapping filenames to code.";

        try {
            startLoaderSequence();

            // Attach images (we'll send URLs only — the server expects images[] array)
            const payload = {
                prompt: finalPrompt,
                images: uploadedImageUrls,
            };

            const res = await axios.post("/api/gen-ai-code", payload, {
                timeout: 300000, // 5 mins
            });
            const data = res.data;

            // Expect { files: { "/App.jsx": { code: "..." }, ... } }
            if (!data?.files) {
                setErrorMsg("Generator did not return files. See server logs.");
                setIsEnhancing(false);
                return;
            }

            // Save messages and urls to Convex workspace (as your app did previously)
            const msg = { role: "user", content: finalPrompt };
            setMessages(msg);
            setUrls(uploadedImageUrls || []);

            // Create workspace with files saved
            const workspaceId = await CreateWorkspace({
                messages: [msg],
                urls: uploadedImageUrls || [],
                files: data.files,
            });

            // navigate
            router.push("/workspace/" + workspaceId);
        } catch (err) {
            console.error("Generation error", err);
            setErrorMsg("Failed to generate website. Check server logs.");
        } finally {
            setIsEnhancing(false);
        }
    };

    // UI helpers
    const handleSendClick = async () => {
        // If there is a last question (asked by AI), treat currentAnswer as its response
        if (!currentAnswer || !currentAnswer.trim()) return;
        await askClarifyingQuestion(currentAnswer.trim());
    };

    return (
        <div className="min-h-screen bg-gray-950 relative overflow-hidden">
            {/* Loader overlay */}
            {isEnhancing && (
                <div className="fixed inset-0 bg-black/70 z-[9999] flex flex-col items-center justify-center">
                    <Loader2 className="h-16 w-16 text-blue-400 animate-spin mb-4" />
                    <p className="text-xl text-blue-300 font-semibold">{loaderText}</p>
                </div>
            )}

            {/* Main container */}
            <div className="container mx-auto px-4 py-16 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Chat clarifier */}
                    <div className="bg-gray-900/80 p-6 rounded-lg border border-electric-blue-500/30">
                        <div className="flex items-center gap-3 mb-4">
                            <Sparkles className="h-6 w-6 text-electric-blue-400" />
                            <h2 className="text-xl text-electric-blue-300 font-semibold">Build a website — let's get details</h2>
                        </div>

                        <div className="h-[60vh] overflow-y-auto p-3 bg-gray-800 rounded-md mb-4">
                            {/* Render chatMessages */}
                            {chatMessages.length === 0 && (
                                <div className="text-gray-400">Start by describing your idea — the assistant will ask questions to clarify.</div>
                            )}

                            {chatMessages.map((m, i) => (
                                <div
                                    key={i}
                                    className={`mb-3 ${m.role === "user" ? "text-right" : "text-left"}`}
                                >
                                    <div
                                        className={`inline-block px-3 py-2 rounded-md ${m.role === "user" ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-100"
                                            }`}
                                    >
                                        {m.text}
                                        {m.imageUrl && (
                                            <div className="mt-2">
                                                <img src={m.imageUrl} alt="user-upload" className="max-w-xs rounded" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Image upload and URL */}
                        <div className="flex gap-2 items-center mb-3">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleFileSelect}
                                className="text-sm text-gray-200"
                            />
                            <div className="flex-1">
                                <input
                                    placeholder="Or paste image URL (logo/hero)..."
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            addImageUrl(e.target.value.trim());
                                            e.currentTarget.value = "";
                                        }
                                    }}
                                    className="w-full bg-gray-800 text-gray-200 p-2 rounded"
                                />
                                {uploadedImageUrls.length > 0 && (
                                    <div className="flex gap-2 mt-2 overflow-x-auto">
                                        {uploadedImageUrls.map((u, idx) => (
                                            <div key={idx} className="px-1">
                                                <img src={u} alt={`uploaded-${idx}`} className="w-20 h-12 object-cover rounded" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Answer input */}
                        <div className="flex gap-2">
                            <input
                                value={currentAnswer}
                                onChange={(e) => setCurrentAnswer(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSendClick();
                                }}
                                placeholder={loadingQuestion ? "Waiting..." : lastQuestion || "Describe your idea to start..."}
                                className="flex-1 bg-gray-800 p-3 rounded text-gray-100"
                                disabled={loadingQuestion}
                            />
                            <button
                                onClick={handleSendClick}
                                disabled={loadingQuestion || !currentAnswer.trim()}
                                className="bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 rounded"
                            >
                                <Send className="h-5 w-5 text-white" />
                            </button>
                        </div>

                        {/* If server decided we have enough info, show Generate CTA */}
                        {askingDone && (
                            <div className="mt-4 p-3 bg-green-900 bg-opacity-30 rounded">
                                <p className="text-green-300 mb-2 font-semibold">
                                    ✅ Okay — looks like we have enough info to generate a website.
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={generateWebsite}
                                        className="bg-green-500 px-4 py-2 rounded hover:bg-green-600"
                                    >
                                        Generate Website
                                    </button>
                                    <button
                                        onClick={() => {
                                            // allow user to continue clarifying if they wish
                                            setAskingDone(false);
                                            setLastQuestion(null);
                                        }}
                                        className="bg-gray-700 px-4 py-2 rounded"
                                    >
                                        Continue clarifying
                                    </button>
                                </div>
                            </div>
                        )}

                        {errorMsg && <div className="mt-3 text-red-400">{errorMsg}</div>}
                    </div>

                    {/* Right: Placeholder for "preview / code" area (preserve preview functionality) */}
                    <div className="bg-gray-900/80 p-6 rounded-lg border border-electric-blue-500/30">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg text-electric-blue-300 font-semibold">Generated Code & Preview</h3>
                            <IconLink className="text-electric-blue-400" />
                        </div>

                        <div className="h-[60vh] overflow-auto bg-gray-800 rounded p-4">
                            <div className="text-gray-400">
                                After you press <strong>Generate Website</strong>, code files will be created and you'll be redirected to the workspace where the left-side editor and right-side preview are available (exactly like your current flow).
                            </div>

                            <div className="mt-3 text-sm text-gray-300">
                                Tip: After generation, you can continue to chat in the workspace to request changes (e.g., "use dark theme") — those are handled as follow-up messages and patch/update files accordingly.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
