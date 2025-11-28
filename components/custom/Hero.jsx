"use client";

import React, { useState, useContext, useEffect, useRef } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import axios from "axios";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { MessagesContext } from "@/context/MessagesContext";
import { UrlsContext } from "@/context/UrlsContext";

export default function Hero() {
    const router = useRouter();
    const CreateWorkspace = useMutation(api.workspace.CreateWorkspace);
    const { messages, setMessages } = useContext(MessagesContext);
    const { urls, setUrls } = useContext(UrlsContext);

    const [chatMessages, setChatMessages] = useState([]);
    const [currentAnswer, setCurrentAnswer] = useState("");
    const [loadingQuestion, setLoadingQuestion] = useState(false);
    const [lastQuestion, setLastQuestion] = useState(null);

    const [uploadedImageUrls, setUploadedImageUrls] = useState([]);
    const fileInputRef = useRef(null);

    const [firstname, setFirstname] = useState("");
    const [races, setRaces] = useState([]);
    const [showRaceList, setShowRaceList] = useState(false);
    const [selectedRace, setSelectedRace] = useState(null); // ✅ Store selected race

    const [isEnhancing, setIsEnhancing] = useState(false);
    const [loaderText, setLoaderText] = useState("Analyzing...");
    const [errorMsg, setErrorMsg] = useState(null);

    const [initialLoading, setInitialLoading] = useState(true);
    const [waitingForResponse, setWaitingForResponse] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showGenerateButton, setShowGenerateButton] = useState(false); // ✅ Always show after race selection

    const chatEndRef = useRef(null);

    const AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3N2Y2ZjliNDIyNWY3NDBmMDJhOTY4MyIsImZpcnN0X25hbWUiOiJRTCIsImxhc3RfbmFtZSI6IlJEIiwicHJvZmlsZV9pbWFnZSI6bnVsbCwiZW1haWwiOiJwYWxpLmp1Z3JhbkBxdW9ra2FsYWJzLmNvbSIsInBob25lX2NvZGUiOiIrMSIsInBob25lX2NvdW50cnkiOiJVUyIsInBob25lIjoiNTMzNDUzNTM0NTMiLCJzaWdudXBfbWV0aG9kIjoiRU1BSUwiLCJyb2xlIjoiUkFDRV9ESVJFQ1RPUiIsImlzX29uYm9hcmRlZCI6dHJ1ZSwibG9naW5fdHlwZSI6Im5vcm1hbCIsImlzX2RlbGV0ZWQiOmZhbHNlLCJsb2dpbl9wbGF0Zm9ybSI6IldFQiIsImVtZXJnZW5jeV9jb250YWN0X2luZm8iOnsibmFtZSI6IlJpYWEiLCJwaG9uZSI6IjQ1MzQ1MzQ1MzU0IiwicGhvbmVfY29kZSI6IisxIiwicGhvbmVfY291bnRyeSI6IlVTIn0sImlhdCI6MTc2NDMxMzQ2MywiZXhwIjoxNzY2OTA1NDYzfQ.XppXCxfmpTm5M00wKjAGGgO8e_e-LahDBRJshwRN9po"
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages, waitingForResponse]);

    // =============================
    // FETCH USER + RACES ON LOAD
    // =============================
    useEffect(() => {
        async function fetchUserAndRaces() {
            try {
                setInitialLoading(true);

                const res = await axios.get(
                    "http://localhost:3000/api/v2/director-my-races?searchText=",
                    {
                        headers: {
                            AuthorizationToken: AUTH_TOKEN,
                            "Content-Type": "application/json",
                        },
                    }
                );
                console.log("respone is " + JSON.stringify(res))

                const data = res.data?.data;
                const name = data?.race_director_name?.split(" ")[0] || "there";
                const raceList = data?.list || [];

                setFirstname(name);
                setRaces(raceList);

                setChatMessages([
                    {
                        role: "ai",
                        text: `Hi ${name}, for what race would you like to build the website?`,
                    },
                ]);

                setShowRaceList(true);
            } catch (err) {
                console.error("Failed to fetch races", err);
                setErrorMsg("Failed to load races. Please refresh the page.");
            } finally {
                setInitialLoading(false);
            }
        }

        fetchUserAndRaces();
    }, []);

    // =============================
    // HELPER: Format race details for AI
    // =============================
    const formatRaceDetails = (race) => {
        return `
Race Details:
- Title: ${race.title}
- Date: ${race.local_date_time}
- Timezone: ${race.time_zone}
- Status: ${race.status}
- Race URL: ${race.race_url}
- Events: ${race.events.map(e => e.name).join(", ")}
- Virtual Race: ${race.is_virtual_race ? "Yes" : "No"}
- Logo: ${race.logo || "No logo"}
`.trim();
    };

    // =============================
    // IMAGE UPLOAD
    // =============================
    const readFileAsBase64 = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        for (const file of files) {
            try {
                const base64 = await readFileAsBase64(file);
                const res = await axios.post("/api/upload-image", { base64 });
                const url = res.data?.url;

                if (url) {
                    setUploadedImageUrls((prev) => [...prev, url]);

                    setChatMessages((prev) => [
                        ...prev,
                        {
                            role: "user",
                            text: "(uploaded image)",
                            imageUrl: url,
                        },
                    ]);
                }
            } catch (err) {
                console.error("Image upload failed", err);
            }
        }
    };

    // =============================
    // RACE SELECTION
    // =============================
    const selectRace = async (race) => {
        if (waitingForResponse || isSending) return;

        setSelectedRace(race); // ✅ Store race
        setShowRaceList(false);
        setShowGenerateButton(true); // ✅ Show generate button immediately

        const raceDetails = formatRaceDetails(race);
        const message = `I want to create a website for "${race.title}".`;

        // Add user selection message
        setChatMessages((prev) => [
            ...prev,
            { role: "user", text: message },
        ]);

        // Ask design-related clarification with race context
        await askClarifyingQuestion(message, raceDetails);
    };

    // =============================
    // CLARIFY API
    // =============================
    const askClarifyingQuestion = async (text, raceContext = "") => {
        setWaitingForResponse(true);
        setLoadingQuestion(true);

        try {
            const contextPrompt = raceContext
                ? `${raceContext}\n\nUser message: ${text}\n\nAsk questions about website design, components, colors, sections, and features the user wants. Don't ask about race details since we already have them.`
                : text;

            const payload = {
                prompt: contextPrompt,
                history: chatMessages.map((m) => ({
                    role: m.role,
                    content: m.text,
                })),
                images: uploadedImageUrls,
            };

            const res = await axios.post("/api/clarify-question", payload);
            const data = res.data;

            if (data?.question) {
                setChatMessages((prev) => [...prev, { role: "ai", text: data.question }]);
                setLastQuestion(data.question);
            } else if (data?.enough) {
                setChatMessages((prev) => [
                    ...prev,
                    { role: "ai", text: "Great! I have all the details. Ready to generate your website!" },
                ]);
            }
        } catch (err) {
            console.error("Clarification error:", err);
            setErrorMsg("Failed to get response. Please try again.");
        } finally {
            setLoadingQuestion(false);
            setWaitingForResponse(false);
        }
    };

    // =============================
    // GENERATE WEBSITE
    // =============================
    const startLoaderSequence = () => {
        setIsEnhancing(true);
        setLoaderText("Analyzing race details...");
        setTimeout(() => setLoaderText("Designing components..."), 3000);
        setTimeout(() => setLoaderText("Building your website..."), 6000);
    };

    const generateWebsite = async () => {
        if (!selectedRace) {
            setErrorMsg("No race selected. Please select a race first.");
            return;
        }

        const raceDetails = formatRaceDetails(selectedRace);

        // Combine race details + chat history for generation
        const fullPrompt = `
${raceDetails}

User Conversation:
${chatMessages.map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.text}`).join("\n")}

Based on the race details and user preferences above, generate a professional race website.
`.trim();

        try {
            startLoaderSequence();

            const res = await axios.post("/api/gen-ai-code", {
                prompt: fullPrompt,
                images: uploadedImageUrls,
                raceDetails: selectedRace, // Send to API for generation
            });

            const data = res.data;

            // ✅ Store only raw chat messages (what was actually typed)
            const rawMessages = chatMessages.map((m) => ({
                role: m.role,
                content: m.text,
            }));

            setMessages(rawMessages); // Store raw messages in context
            setUrls(uploadedImageUrls);

            const workspaceId = await CreateWorkspace({
                messages: rawMessages, // ✅ Only raw chat messages
                urls: uploadedImageUrls,
                files: data.files,
                chatId: data.chatId,
                demoUrl: data.demoUrl,
                projectId: data.projectId,
                latestVersionId: data.latestVersionId,
                // ❌ Don't store raceDetails in workspace
            });

            router.push("/workspace/" + workspaceId);
        } catch (err) {
            console.error("Website generation error:", err);
            setErrorMsg("Failed to generate website. Please try again.");
        } finally {
            setIsEnhancing(false);
        }
    };

    // =============================
    // SEND MESSAGE
    // =============================
    const handleSendClick = async () => {
        if (!currentAnswer.trim() || isSending || waitingForResponse) return;

        const userMessage = currentAnswer.trim();
        setCurrentAnswer("");
        setIsSending(true);

        setChatMessages((prev) => [...prev, { role: "user", text: userMessage }]);

        const raceContext = selectedRace ? formatRaceDetails(selectedRace) : "";
        await askClarifyingQuestion(userMessage, raceContext);

        setIsSending(false);
    };

    // =============================
    // UI
    // =============================
    return (
        <div className="min-h-screen bg-gray-950">
            {isEnhancing && (
                <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
                    <Loader2 className="h-16 w-16 animate-spin text-blue-400" />
                    <p className="text-blue-300 mt-2 text-lg">{loaderText}</p>
                </div>
            )}

            <div className="container mx-auto px-4 py-16">
                <div className="bg-gray-900 p-6 rounded-lg border border-blue-500/20 max-w-4xl mx-auto">
                    {/* ✅ Selected Race Info Bar */}
                    {selectedRace && (
                        <div className="mb-4 p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-blue-300 font-semibold">{selectedRace.title}</h3>
                                    <p className="text-blue-400 text-sm">{selectedRace.local_date_time}</p>
                                </div>
                                <span className="text-xs bg-blue-600 px-3 py-1 rounded-full text-white">
                                    {selectedRace.status}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="h-[60vh] overflow-y-auto bg-gray-800 p-4 rounded">
                        {initialLoading ? (
                            <div className="flex flex-col items-center justify-center h-full">
                                <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
                                <p className="text-gray-400 mt-3">Loading your races...</p>
                            </div>
                        ) : (
                            <>
                                {chatMessages.map((m, i) => (
                                    <div
                                        key={i}
                                        className={`mb-3 ${m.role === "user" ? "text-right" : "text-left"}`}
                                    >
                                        <div
                                            className={`inline-block p-3 rounded max-w-[80%] ${m.role === "user"
                                                ? "bg-blue-500 text-white"
                                                : "bg-gray-700 text-gray-100"
                                                }`}
                                        >
                                            {m.text}
                                            {m.imageUrl && (
                                                <img
                                                    src={m.imageUrl}
                                                    alt="uploaded"
                                                    className="mt-2 max-w-xs rounded"
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {waitingForResponse && (
                                    <div className="mb-3 text-left">
                                        <div className="inline-block p-3 rounded bg-gray-700 text-gray-400">
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span className="italic">Thinking...</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {showRaceList && (
                                    <div className="mt-4 space-y-2">
                                        {races.map((race) => (
                                            <button
                                                key={race.id}
                                                onClick={() => selectRace(race)}
                                                disabled={waitingForResponse}
                                                className="block w-full text-left bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white p-4 rounded transition"
                                            >
                                                <div className="font-semibold">{race.title}</div>
                                                <div className="text-sm text-blue-200 mt-1">
                                                    {race.local_date_time} • {race.events.map(e => e.name).join(", ")}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div ref={chatEndRef} />
                            </>
                        )}
                    </div>

                    {!initialLoading && selectedRace && (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleFileSelect}
                                disabled={waitingForResponse}
                                className="mt-3 text-gray-300 disabled:opacity-50"
                            />

                            <div className="flex gap-2 mt-3">
                                <input
                                    value={currentAnswer}
                                    onChange={(e) => setCurrentAnswer(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSendClick()}
                                    disabled={waitingForResponse || isSending}
                                    placeholder={lastQuestion || "Describe your website preferences..."}
                                    className="flex-1 bg-gray-800 text-white p-3 rounded border border-gray-700 focus:border-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <button
                                    onClick={handleSendClick}
                                    disabled={!currentAnswer.trim() || waitingForResponse || isSending}
                                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 rounded transition flex items-center justify-center"
                                >
                                    {isSending ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <Send size={20} />
                                    )}
                                </button>
                            </div>
                        </>
                    )}

                    {/* ✅ GENERATE BUTTON - Always visible after race selection */}
                    {showGenerateButton && !initialLoading && (
                        <button
                            onClick={generateWebsite}
                            disabled={isEnhancing || waitingForResponse}
                            className="mt-4 w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white px-4 py-3 rounded font-semibold transition flex items-center justify-center gap-2"
                        >
                            <Sparkles size={20} />
                            {isEnhancing ? "Generating..." : "Generate Website"}
                        </button>
                    )}

                    {errorMsg && (
                        <div className="mt-3 p-3 bg-red-900/30 border border-red-500 rounded text-red-300">
                            {errorMsg}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
