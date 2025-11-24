"use client";

import { useContext, useEffect, useState } from "react";
import { MessagesContext } from "@/context/MessagesContext";
import { UrlsContext } from "@/context/UrlsContext";
import { useParams } from "next/navigation";
import { useConvex, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2Icon, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import axios from "axios";

/**
 * NEW ChatView.jsx
 *
 * - ALWAYS uses chatId from workspace
 * - NEVER calls /api/gen-ai-code
 * - NEVER calls locator
 * - Every message = follow-up edit to the SAME V0 chat
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

    // --- Normalize message array -----------------------
    const messages = Array.isArray(ctxMessages) ? ctxMessages : [];
    const setMessages = typeof ctxSetMessages === "function" ? ctxSetMessages : () => { };

    // --- Load workspace ---------------------------------
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
                setLatestVersionId(res?.latestVersionId)
                setProjectId(res?.projectId)

                console.log("[ChatView] Workspace loaded - chatId:", res?.chatId);
            } catch (err) {
                console.error("[ChatView] failed loading workspace", err);
            }
        })();
    }, [id]);

    // ============================================================
    // 🔥 MAIN EDIT FUNCTION — Always uses chatId
    // ============================================================
    async function runEdit(userMsg) {
        if (!chatId) {
            console.error("[ChatView] Missing chatId — cannot edit");
            throw new Error("chatId missing in workspace");
        }

        setLoading(true);

        try {
            console.log("[ChatView] sending follow-up edit request...");

            const payload = {
                userMessage: userMsg,
                chatId,
            };

            const editRes = await axios.post("/api/edit-code", payload, {
                timeout: 120000,
            });

            console.log("editRes:", editRes.data);

            const changedFiles = editRes.data.files || {};

            // apply file updates only if any exists
            if (Object.keys(changedFiles).length > 0) {
                const updatedFiles = { ...files, ...changedFiles };
                setFiles(updatedFiles);

                await UpdateFiles({
                    workspaceId: id,
                    files: updatedFiles,
                });
            }

            // AI message
            const aiMessage = {
                role: "ai",
                content: `Changes applied. Preview updated.`,
            };

            const newMessages = [...messages, aiMessage];
            setMessages(newMessages);

            // 🔥 SAVE demoUrl + chatId
            await UpdateWorkspace({
                workspaceId: id,
                messages: newMessages,
                chatId,
                demoUrl: editRes.data.demoUrl || null,
                projectId,
                latestVersionId: editRes?.data?.latestVersionId || null
            });

        } catch (err) {
            console.error("[ChatView] edit error:", err);

            const errorMsg = {
                role: "ai",
                content: `Failed to edit: ${err.message}`,
            };

            const newList = [...messages, errorMsg];
            setMessages(newList);

            await UpdateWorkspace({
                workspaceId: id,
                messages: newList,
            });
        } finally {
            setLoading(false);
        }
    }


    // ============================================================
    // SEND message handler
    // ============================================================
    const onSend = async () => {
        if (!userInput.trim()) return;

        const newUserMsg = { role: "user", content: userInput.trim() };
        const updated = [...messages, newUserMsg];

        // Update UI immediately
        setMessages(updated);
        setUserInput("");

        // Save message in convex
        await UpdateWorkspace({
            workspaceId: id,
            messages: updated,
        });

        // Always run edit flow
        await runEdit(newUserMsg.content);
    };

    // ============================================================
    // RENDER UI
    // ============================================================
    return (
        <div className="relative h-[85vh] flex flex-col bg-gray-900">
            {/* Messages area */}
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
                        <div className="flex gap-3">
                            <textarea
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder="Ask to change theme, text, colors, layout..."
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
    );
}
