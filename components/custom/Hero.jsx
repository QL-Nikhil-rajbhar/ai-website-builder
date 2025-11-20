"use client";
import Lookup from "@/data/Lookup";
import { MessagesContext } from "@/context/MessagesContext";
import { Sparkles, Send, Loader2, Link } from "lucide-react";
import React, { useContext, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import axios from "axios";
import { UrlsContext } from "@/context/UrlsContext";

function Hero() {
    const [userInput, setUserInput] = useState("");
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [loaderText, setLoaderText] = useState("Analyzing...");
    const [selectedImages, setSelectedImages] = useState([]);
    const [uploading, setUploading] = useState(false);
    const { messages, setMessages } = useContext(MessagesContext);
    const { urls, setUrls } = useContext(UrlsContext);

    const CreateWorkspace = useMutation(api.workspace.CreateWorkspace);
    const router = useRouter();

    // Clarify modal states
    const [showClarifyModal, setShowClarifyModal] = useState(false);
    const [clarifyingQuestions, setClarifyingQuestions] = useState([]);
    const [clarifyingAnswers, setClarifyingAnswers] = useState({});
    const [loadingQuestions, setLoadingQuestions] = useState(false);

    // Always true — removed checkbox UI
    const useV0UI = true;

    const IMGBB_API_KEY = "aaa8c1e37a0fedd86ab07c15ec0e2052";
    const IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload";

    const handleFileChange = (e) => {
        setSelectedImages(Array.from(e.target.files));
    };

    async function uploadImagesAndGetUrls(files) {
        const urls = [];
        for (const file of files) {
            const base64 = await readFileAsBase64(file);
            const base64Data = base64.split(",")[1];
            const params = new URLSearchParams();
            params.append("image", base64Data);

            try {
                const response = await axios.post(
                    `${IMGBB_UPLOAD_URL}?key=${IMGBB_API_KEY}`,
                    params.toString(),
                    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
                );

                if (response.data?.data?.url) urls.push(response.data.data.url);
            } catch (error) {
                console.error("Image upload failed:", error);
            }
        }
        return urls;
    }

    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ----------- CLARIFICATION QUESTIONS FLOW -----------
    async function generateClarifyingQuestions(prompt) {
        setLoadingQuestions(true);
        try {
            const res = await axios.post("/api/clarify-question", { prompt });
            if (res.data?.questions?.length) {
                setClarifyingQuestions(res.data.questions);
                setShowClarifyModal(true);
            } else {
                await triggerGeneration(prompt);
            }
        } catch (err) {
            console.error("Clarify API error:", err);
            await triggerGeneration(prompt);
        } finally {
            setLoadingQuestions(false);
        }
    }

    const onGenerateClick = async () => {
        if (!userInput.trim()) return;
        await generateClarifyingQuestions(userInput);
    };

    const finalizeAndGenerate = async () => {
        const finalPrompt =
            userInput +
            "\n\nADDITIONAL DETAILS:\n" +
            Object.entries(clarifyingAnswers)
                .map(([q, a]) => `- ${q}: ${a}`)
                .join("\n");

        // start loader immediately
        startLoaderSequence();
        setShowClarifyModal(false);

        await triggerGeneration(finalPrompt);
    };

    // ----------- LOADER SEQUENCE HANDLER -----------
    const startLoaderSequence = () => {
        setIsEnhancing(true);
        setLoaderText("Analyzing...");

        setTimeout(() => setLoaderText("Thinking..."), 6000);
        setTimeout(() => setLoaderText("Enhancing..."), 12000);
    };

    // ----------- MAIN GENERATION FLOW -----------
    const triggerGeneration = async (prompt) => {
        startLoaderSequence();

        let imageUrls = [];
        if (selectedImages.length > 0) {
            setUploading(true);
            imageUrls = await uploadImagesAndGetUrls(selectedImages);
            setUploading(false);
        }

        try {
            const res = await axios.post("/api/gen-ai-code", {
                prompt,
                urls: imageUrls,
                useV0UI: true, // ALWAYS true
            });

            if (res.data?.error) {
                console.error("Generator error:", res.data);
                setIsEnhancing(false);
                return;
            }

            const files = res.data?.files || [];

            const msg = { role: "user", content: prompt };
            setMessages(msg);
            setUrls(imageUrls || []);

            const workspaceID = await CreateWorkspace({
                messages: [msg],
                urls: imageUrls,
                files,
            });

            router.push("/workspace/" + workspaceID);
        } catch (err) {
            console.error("Generation error:", err);
        } finally {
            setSelectedImages([]);
            setIsEnhancing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 relative overflow-hidden">

            {/* LOADER OVERLAY */}
            {isEnhancing && (
                <div className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-[9999]">
                    <Loader2 className="h-16 w-16 text-blue-400 animate-spin mb-4" />
                    <p className="text-xl text-blue-300 font-semibold">{loaderText}</p>
                </div>
            )}

            {/* Clarify modal */}
            {showClarifyModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999]">
                    <div className="bg-gray-900 p-8 rounded-xl w-[500px] border border-blue-500 shadow-xl">
                        <h2 className="text-xl font-bold mb-4 text-blue-400">Additional Details Required</h2>

                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                            {clarifyingQuestions.map((q, i) => (
                                <div key={i}>
                                    <p className="text-gray-300 mb-1">{q}</p>
                                    <input
                                        className="w-full bg-gray-800 p-2 rounded-md border border-gray-600 text-gray-100"
                                        onChange={(e) =>
                                            setClarifyingAnswers({
                                                ...clarifyingAnswers,
                                                [q]: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                className="px-4 py-2 bg-gray-700 rounded-md hover:bg-gray-600"
                                onClick={() => setShowClarifyModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700"
                                onClick={finalizeAndGenerate}
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MAIN HERO UI */}
            <div className="container mx-auto px-4 py-16 relative z-10">
                <div className="flex flex-col items-center justify-center space-y-12">

                    <div className="text-center space-y-6">
                        <div className="inline-flex items-center justify-center space-x-2 bg-electric-blue-500/20 rounded-full px-6 py-3 mb-6 border border-electric-blue-500/30">
                            <Sparkles className="h-6 w-6 text-electric-blue-400" />
                            <span className="text-electric-blue-400 text-lg font-semibold tracking-wide">
                                NEXT-GEN AI DEVELOPMENT
                            </span>
                        </div>

                        <h1 className="text-6xl md:text-7xl font-bold text-transparent bg-clip-text bg-[linear-gradient(45deg,#60a5fa_30%,#ec4899)] leading-tight">
                            Code the <br className="md:hidden" />Impossible
                        </h1>

                        <p className="text-xl text-neon-cyan max-w-3xl mx-auto font-mono tracking-tight">
                            Transform your wildest ideas into production-ready code with AI-powered assistance
                        </p>
                    </div>

                    <div className="w-full max-w-3xl bg-gray-900/40 backdrop-blur-2xl rounded-xl border-2 border-electric-blue-500/40 shadow-[0_0_40px_5px_rgba(59,130,246,0.15)]">
                        <div className="p-2 bg-gradient-to-r from-electric-blue-500/10 to-purple-500/10">
                            <div className="bg-gray-900/80 p-6 rounded-lg">

                                <div className="flex gap-4 items-start">
                                    <textarea
                                        placeholder="DESCRIBE YOUR VISION..."
                                        value={userInput}
                                        onChange={(e) => setUserInput(e.target.value)}
                                        className="w-full bg-transparent border-2 border-electric-blue-500/30 rounded-lg p-5 text-gray-100 placeholder-electric-blue-500/60 focus:border-electric-blue-500 focus:ring-0 outline-none font-mono text-lg h-40 resize-none"
                                        disabled={loadingQuestions || uploading || isEnhancing}
                                    />

                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleFileChange}
                                            disabled={loadingQuestions || uploading || isEnhancing}
                                            className="bg-gray-700 text-white rounded-xl px-2 py-2 border border-gray-600"
                                        />
                                        {selectedImages.length > 0 && (
                                            <div className="text-xs text-green-400">
                                                {selectedImages.length} image(s) selected
                                            </div>
                                        )}
                                        {uploading && (
                                            <div className="text-xs text-yellow-300">Uploading...</div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        {/* Checkbox removed */}
                                        <button
                                            onClick={onGenerateClick}
                                            disabled={loadingQuestions || uploading || isEnhancing}
                                            className="flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl px-4 py-4"
                                        >
                                            <Send className="h-8 w-8" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-end mt-4">
                                    <Link className="h-6 w-6 text-electric-blue-400/80" />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default Hero;
