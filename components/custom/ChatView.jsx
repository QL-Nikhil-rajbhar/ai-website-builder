"use client";

import { useContext, useEffect, useState, useRef } from "react";
import { MessagesContext } from "@/context/MessagesContext";
import { UrlsContext } from "@/context/UrlsContext";
import { useParams } from "next/navigation";
import { useConvex, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2Icon, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import axios from "axios";

/**
 * ChatView.jsx (FINAL — fixed hidden image URLs)
 * - User uploads images → image URLs stored silently.
 * - Image URLs NEVER appear in textarea or chat.
 * - On send → hidden URLs appended internally (not visible to user).
 */

export default function ChatView() {
    const { id } = useParams();
    const convex = useConvex();

    const { messages: ctxMessages, setMessages: ctxSetMessages } =
        useContext(MessagesContext);
    const { urls } = useContext(UrlsContext);

    const UpdateWorkspace = useMutation(api.workspace.UpdateWorkspace);
    const UpdateFiles = useMutation(api.workspace.UpdateFiles);

    const [files, setFiles] = useState({});
    const [chatId, setChatId] = useState(null);
    const [projectId, setProjectId] = useState(null);
    const [latestVersionId, setLatestVersionId] = useState(null);

    const [userInput, setUserInput] = useState("");
    const [loading, setLoading] = useState(false);

    // ⭐ store image URLs silently (never shown to UI)
    const [uploadedImageUrls, setUploadedImageUrls] = useState([]);
    const fileInputRef = useRef(null);

    const messages = Array.isArray(ctxMessages) ? ctxMessages : [];
    const setMessages = typeof ctxSetMessages === "function" ? ctxSetMessages : () => { };

    // ============================================================
    // Load workspace
    // ============================================================
    useEffect(() => {
        if (!id) return;

        (async () => {
            try {
                const res = await convex.query(api.workspace.GetWorkspace, {
                    workspaceId: id,
                });

                setMessages(res?.messages || []);
                setFiles(res?.fileData || {});
                setChatId(res?.chatId || null);
                setProjectId(res?.projectId || null);
                setLatestVersionId(res?.latestVersionId || null);
            } catch (err) {
                console.error("[ChatView] failed loading workspace", err);
            }
        })();
    }, [id]);

    // ============================================================
    // Convert file → base64
    // ============================================================
    const readFileAsBase64 = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    // ============================================================
    // Handle image upload (SILENT)
    // ============================================================
    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        for (const file of files) {
            try {
                const base64 = await readFileAsBase64(file);

                const res = await axios.post("/api/upload-image", { base64 });
                const url = res.data?.url;

                if (url) {
                    // ⭐ Do NOT show URL in UI — save silently
                    setUploadedImageUrls((prev) => [...prev, url]);
                }
            } catch (err) {
                console.error("Image upload failed", err);
            }
        }
    };

    // ============================================================
    // MAIN EDIT FUNCTION (always uses chatId)
    // ============================================================
    async function runEdit(finalMessage) {
        if (!chatId) throw new Error("chatId missing in workspace");

        setLoading(true);

        try {
            const payload = {
                userMessage: finalMessage,
                chatId,
                images: uploadedImageUrls, // ⭐ pass hidden images
            };

            const editRes = await axios.post("/api/edit-code", payload, {
                timeout: 120000,
            });

            const changedFiles = editRes.data.files || {};

            if (Object.keys(changedFiles).length > 0) {
                const updatedFiles = { ...files, ...changedFiles };
                setFiles(updatedFiles);

                await UpdateFiles({
                    workspaceId: id,
                    files: updatedFiles,
                });
            }

            const aiMessage = {
                role: "ai",
                content: `Changes applied. Preview updated.`,
            };

            const newMessages = [...messages, aiMessage];
            setMessages(newMessages);

            await UpdateWorkspace({
                workspaceId: id,
                messages: newMessages,
                chatId,
                demoUrl: editRes.data.demoUrl || null,
                fileData: changedFiles,
                projectId,
                latestVersionId: editRes?.data?.latestVersionId || null,
            });

        } catch (err) {
            console.error("[ChatView] edit error:", err);

            const errorMsg = {
                role: "ai",
                content: `Failed to edit: ${err.message}`,
            };

            const updated = [...messages, errorMsg];
            setMessages(updated);

            await UpdateWorkspace({
                workspaceId: id,
                messages: updated,
            });
        } finally {
            setLoading(false);
        }
    }

    // ============================================================
    // SEND handler — builds hidden image metadata
    // ============================================================
    const onSend = async () => {
        if (!userInput.trim()) return;

        // ⭐ SECRETLY append image URLs ONLY to finalMessage — not to UI
        let hiddenBlock = "";
        if (uploadedImageUrls.length > 0) {
            hiddenBlock =
                "\n\nIMAGE_URLS:\n" + uploadedImageUrls.map((u) => `- ${u}`).join("\n");
        }

        const finalMessage = userInput.trim() + hiddenBlock;

        // UI shows only user's clean message
        const visibleUserMsg = { role: "user", content: userInput.trim() };
        const updated = [...messages, visibleUserMsg];

        setMessages(updated);
        setUserInput("");

        // Store message (with hidden image URLs)
        await UpdateWorkspace({
            workspaceId: id,
            messages: [...messages, { role: "user", content: finalMessage }],
        });

        await runEdit(finalMessage);
    };

    // ============================================================
    // UI
    // ============================================================
    return (
        <div className="relative h-[85vh] flex flex-col bg-gray-900">

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-4xl mx-auto space-y-4">
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`p-4 rounded-lg ${msg.role === "user"
                                ? "bg-gray-800/50 border border-gray-700"
                                : "bg-gray-800/30 border border-gray-700"
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div
                                    className={`p-2 rounded-lg ${msg.role === "user"
                                        ? "bg-blue-500/20 text-blue-400"
                                        : "bg-purple-500/20 text-purple-400"
                                        }`}
                                >
                                    {msg.role === "user" ? "You" : "AI"}
                                </div>

                                <ReactMarkdown className="prose prose-invert flex-1">
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                            <div className="flex items-center gap-3 text-gray-400">
                                <Loader2Icon className="animate-spin h-5 w-5" />
                                <p>Applying changes...</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Input */}
            <div className="border-t border-gray-800 bg-gray-900/50 p-4">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                        <div className="flex flex-col gap-3">

                            {/* ⭐ Hidden-only image upload */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleFileSelect}
                                className="text-sm text-gray-300"
                            />

                            <div className="flex gap-3">
                                <textarea
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    placeholder="Change layout, theme, add image, etc..."
                                    className="w-full bg-gray-900/50 border border-gray-700 rounded-xl p-4 text-white resize-none h-32"
                                />

                                <button
                                    onClick={onSend}
                                    disabled={loading}
                                    className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl px-4 flex items-center justify-center"
                                >
                                    <Send className="h-6 w-6 text-white" />
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
