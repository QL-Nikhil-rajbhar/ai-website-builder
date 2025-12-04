"use client";

import React, { useState, useContext, useEffect, useRef } from "react";
import {
    Sparkles,
    Send,
    Loader2,
    ChevronRight,
    Calendar,
    MapPin,
    CheckCircle,
    Circle,
    Layout,
    Map,
    Info,
    FileText,
    Image as ImageIcon,
    HelpCircle,
    Mail,
    Clock,
    Upload,
    X,
    Plus,
} from "lucide-react";
import axios from "axios";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { MessagesContext } from "@/context/MessagesContext";
import { UrlsContext } from "@/context/UrlsContext";

const AVAILABLE_SECTIONS = [
    { id: "hero", label: "Hero Section", description: "Eye-catching banner with race name and date", icon: Layout, default: true },
    { id: "nav", label: "Navigation Bar", description: "Sticky navigation with quick links", icon: Map, default: true },
    { id: "about", label: "About the Race", description: "Tell participants about your race story", icon: Info, default: true },
    { id: "registration", label: "Registration CTA", description: "Prominent call-to-action for sign-ups", icon: FileText, default: true },
    { id: "course", label: "Course Details", description: "Route map and course information", icon: Map, default: false },
    { id: "schedule", label: "Event Schedule", description: "Timeline of race day activities", icon: Clock, default: false },
    { id: "highlights", label: "Highlights", description: "Photos and videos from past events", icon: ImageIcon, default: false },
    { id: "faq", label: "FAQs", description: "Common questions and answers", icon: HelpCircle, default: true },
    { id: "contact", label: "Contact/Support", description: "Get in touch with organizers", icon: Mail, default: false },
];

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
    const loaderIntervalRef = useRef(null);

    const [firstname, setFirstname] = useState("");
    const [races, setRaces] = useState([]);
    const [showRaceList, setShowRaceList] = useState(false);
    const [selectedRace, setSelectedRace] = useState(null); // ✅ Store selected race
    const [showSectionSelection, setShowSectionSelection] = useState(false);
    const [selectedSections, setSelectedSections] = useState(
        AVAILABLE_SECTIONS.filter((s) => s.default).map((s) => s.id)
    );
    const [showImageUpload, setShowImageUpload] = useState(false);
    const [uploadedImages, setUploadedImages] = useState({
        logo: null,
        banner: null,
        gallery: [],
    });
    const [uploadingField, setUploadingField] = useState(null);

    const [isEnhancing, setIsEnhancing] = useState(false);
    const [loaderText, setLoaderText] = useState("Analyzing...");
    const [errorMsg, setErrorMsg] = useState(null);

    const [initialLoading, setInitialLoading] = useState(true);
    const [waitingForResponse, setWaitingForResponse] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showGenerateButton, setShowGenerateButton] = useState(false);

    const chatEndRef = useRef(null);

    const AUTH_TOKEN =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3N2Y2ZjliNDIyNWY3NDBmMDJhOTY4MyIsImZpcnN0X25hbWUiOiJRTCIsImxhc3RfbmFtZSI6IlJEIiwicHJvZmlsZV9pbWFnZSI6bnVsbCwiZW1haWwiOiJwYWxpLmp1Z3JhbkBxdW9ra2FsYWJzLmNvbSIsInBob25lX2NvZGUiOiIrMSIsInBob25lX2NvdW50cnkiOiJVUyIsInBob25lIjoiNTMzNDUzNTM0NTMiLCJzaWdudXBfbWV0aG9kIjoiRU1BSUwiLCJyb2xlIjoiUkFDRV9ESVJFQ1RPUiIsImlzX29uYm9hcmRlZCI6dHJ1ZSwibG9naW5fdHlwZSI6Im5vcm1hbCIsImlzX2RlbGV0ZWQiOmZhbHNlLCJsb2dpbl9wbGF0Zm9ybSI6IldFQiIsImVtZXJnZW5jeV9jb250YWN0X2luZm8iOnsibmFtZSI6IlJpYWEiLCJwaG9uZSI6IjQ1MzQ1MzQ1MzU0IiwicGhvbmVfY29kZSI6IisxIiwicGhvbmVfY291bnRyeSI6IlVTIn0sImlhdCI6MTc2NDMxMzQ2MywiZXhwIjoxNzY2OTA1NDYzfQ.XppXCxfmpTm5M00wKjAGGgO8e_e-LahDBRJshwRN9po";

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages, waitingForResponse]);

    // FETCH USER + RACES ON LOAD
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

    const formatRaceDetails = (race) => {
        return `
Race Details:
- Title: ${race.title}
- Date: ${race.local_date_time}
- Timezone: ${race.time_zone}
- Status: ${race.status}
- Race URL: ${race.race_url}
- Events: ${race.events.map((e) => e.name).join(", ")}
- Virtual Race: ${race.is_virtual_race ? "Yes" : "No"}
- Logo: ${race.logo || "No logo"}
`.trim();
    };

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

    const selectRace = async (race) => {
        if (waitingForResponse || isSending) return;

        setSelectedRace(race);
        setShowRaceList(false);
        setShowSectionSelection(true);
    };

    const handleSectionToggle = (sectionId) => {
        setSelectedSections((prev) =>
            prev.includes(sectionId)
                ? prev.filter((id) => id !== sectionId)
                : [...prev, sectionId]
        );
    };

    const handleContinueFromSections = () => {
        setShowSectionSelection(false);
        setShowImageUpload(true);
    };

    const handleImageUpload = async (field, e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        setUploadingField(field);

        try {
            for (const file of files) {
                const base64 = await readFileAsBase64(file);
                const res = await axios.post("/api/upload-image", { base64 });
                const url = res.data?.url;

                if (url) {
                    setUploadedImages((prev) => {
                        if (field === "gallery") {
                            return { ...prev, gallery: [...prev.gallery, url] };
                        } else {
                            return { ...prev, [field]: url };
                        }
                    });
                }
            }
        } catch (err) {
            console.error("Upload failed", err);
            setErrorMsg("Failed to upload image. Please try again.");
        } finally {
            setUploadingField(null);
        }
    };

    const removeImage = (field, index = null) => {
        setUploadedImages((prev) => {
            if (field === "gallery") {
                return { ...prev, gallery: prev.gallery.filter((_, i) => i !== index) };
            } else {
                return { ...prev, [field]: null };
            }
        });
    };

    const handleFinishSetup = async () => {
        setShowImageUpload(false);
        setShowGenerateButton(true);

        const race = selectedRace;
        const raceDetails = formatRaceDetails(race);

        const selectedLabels = AVAILABLE_SECTIONS
            .filter((s) => selectedSections.includes(s.id))
            .map((s) => s.label)
            .join(", ");

        const visibleMessage = `I want to create a website for "${race.title}" with the following sections: ${selectedLabels}.`;

        let hiddenContext = "";
        if (uploadedImages.logo) hiddenContext += `\nLogo URL: ${uploadedImages.logo}`;
        if (uploadedImages.banner) hiddenContext += `\nBanner URL: ${uploadedImages.banner}`;
        if (uploadedImages.gallery.length > 0)
            hiddenContext += `\nGallery URLs: ${uploadedImages.gallery.join(", ")}`;

        setChatMessages((prev) => [...prev, { role: "user", text: visibleMessage }]);

        await askClarifyingQuestion(visibleMessage + hiddenContext, raceDetails);
    };

    const askClarifyingQuestion = async (text, raceContext = "") => {
        setWaitingForResponse(true);
        setLoadingQuestion(true);

        try {
            const contextPrompt = raceContext
                ? `${raceContext}\n\nUser message: ${text}\n\nAsk questions about website design, components, colors, sections, and features the user wants. Don't ask about race details since we already have them.`
                : text;

            const allUrls = [
                uploadedImages.logo,
                uploadedImages.banner,
                ...uploadedImages.gallery,
            ].filter(Boolean);

            const payload = {
                prompt: contextPrompt,
                history: chatMessages.map((m) => ({
                    role: m.role,
                    content: m.text,
                })),
                images: allUrls,
            };

            const res = await axios.post("/api/clarify-question", payload);
            const data = res.data;

            if (data?.question) {
                setChatMessages((prev) => [...prev, { role: "ai", text: data.question }]);
                setLastQuestion(data.question);
            } else if (data?.enough) {
                setChatMessages((prev) => [
                    ...prev,
                    {
                        role: "ai",
                        text: "Great! I have all the details. Ready to generate your website!",
                    },
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

    const startLoaderSequence = () => {
        setIsEnhancing(true);
        const messages = [
            "Analyzing race details...",
            "Designing layout structure...",
            "Selecting color palette...",
            "Generating navigation and hero section...",
            "Drafting about and registration content...",
            "Creating course maps and schedule...",
            "Optimizing images and assets...",
            "Refining responsive design...",
            "Finalizing component assembly...",
            "Generating...",
        ];

        setLoaderText(messages[0]);
        let index = 1;

        if (loaderIntervalRef.current) clearInterval(loaderIntervalRef.current);

        loaderIntervalRef.current = setInterval(() => {
            if (index < messages.length) {
                setLoaderText(messages[index]);
                index++;
            } else {
                clearInterval(loaderIntervalRef.current);
            }
        }, 15000); // 15 seconds per message * 10 messages ≈ 2.5 mins
    };

    const generateWebsite = async () => {
        if (!selectedRace) {
            setErrorMsg("No race selected. Please select a race first.");
            return;
        }

        const raceDetails = formatRaceDetails(selectedRace);

        let imageContext = "";
        if (uploadedImages.logo) imageContext += `\nLogo URL: ${uploadedImages.logo}`;
        if (uploadedImages.banner) imageContext += `\nBanner URL: ${uploadedImages.banner}`;
        if (uploadedImages.gallery.length > 0)
            imageContext += `\nGallery URLs: ${uploadedImages.gallery.join(", ")}`;

        const fullPrompt = `
${raceDetails}

User Conversation:
${chatMessages
                .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.text}`)
                .join("\n")}

Image Assets:
${imageContext}

Based on the race details and user preferences above, generate a professional race website.
`.trim();

        try {
            startLoaderSequence();

            const allUrls = [
                uploadedImages.logo,
                uploadedImages.banner,
                ...uploadedImages.gallery,
            ].filter(Boolean);

            const res = await axios.post("/api/gen-ai-code", {
                prompt: fullPrompt,
                images: allUrls,
                raceDetails: selectedRace,
                uploadedImages: uploadedImages,
            });

            const data = res.data;

            const rawMessages = chatMessages.map((m) => ({
                role: m.role,
                content: m.text,
            }));

            setMessages(rawMessages);
            setUrls(allUrls);

            const workspaceId = await CreateWorkspace({
                messages: rawMessages,
                urls: allUrls,
                files: data.files,
                chatId: data.chatId,
                demoUrl: data.demoUrl,
                projectId: data.projectId,
                latestVersionId: data.latestVersionId,
                raceName: data.raceName,
            });

            router.push("/workspace/" + workspaceId);
        } catch (err) {
            console.error("Website generation error:", err);
            setErrorMsg("Failed to generate website. Please try again.");
        } finally {
            setIsEnhancing(false);
            if (loaderIntervalRef.current) clearInterval(loaderIntervalRef.current);
        }
    };

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
                    {/* Selected Race Info Bar */}
                    {selectedRace && (
                        <div className="mb-4 p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-blue-300 font-semibold">
                                        {selectedRace.title}
                                    </h3>
                                    <p className="text-blue-400 text-sm">
                                        {selectedRace.local_date_time}
                                    </p>
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
                                        className={`mb-3 ${m.role === "user" ? "text-right" : "text-left"
                                            }`}
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
                                    <div className="mt-4 space-y-3">
                                        {races.map((race) => {
                                            const isPdf = race.logo
                                                ?.toLowerCase()
                                                .endsWith(".pdf");
                                            const logoUrl =
                                                !isPdf && race.logo ? race.logo : null;

                                            return (
                                                <button
                                                    key={race.id}
                                                    onClick={() => selectRace(race)}
                                                    disabled={waitingForResponse}
                                                    className="group w-full flex items-center gap-4 p-4 bg-gray-900/50 hover:bg-gray-800 border border-gray-800 hover:border-blue-500/50 rounded-xl transition-all duration-200 text-left"
                                                >
                                                    <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden border border-gray-700">
                                                        {logoUrl ? (
                                                            <img
                                                                src={logoUrl}
                                                                alt={race.title}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="text-2xl">🏃</span>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-white font-semibold text-lg truncate group-hover:text-blue-400 transition-colors">
                                                            {race.title}
                                                        </h3>

                                                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                                                            <div className="flex items-center gap-1.5">
                                                                <Calendar
                                                                    size={14}
                                                                    className="text-gray-500"
                                                                />
                                                                <span>
                                                                    {race.date_time
                                                                        ? new Date(
                                                                            race.date_time
                                                                        ).toLocaleDateString("en-US", {
                                                                            month: "short",
                                                                            day: "numeric",
                                                                            year: "numeric",
                                                                        })
                                                                        : "Date TBD"}
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center gap-1.5">
                                                                <MapPin
                                                                    size={14}
                                                                    className="text-gray-500"
                                                                />
                                                                <span className="truncate">
                                                                    {race.is_virtual_race
                                                                        ? "Virtual Race"
                                                                        : race.time_zone?.replace(
                                                                            /_/g,
                                                                            " "
                                                                        ) || "Location TBD"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <ChevronRight
                                                        className="text-gray-600 group-hover:text-blue-400 transition-colors"
                                                        size={20}
                                                    />
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {showSectionSelection && selectedRace && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="mb-6">
                                            <h2 className="text-xl text-white font-semibold mb-2">
                                                Great choice! Let's build a website for{" "}
                                                <span className="text-blue-400">
                                                    {selectedRace.title}
                                                </span>
                                                .
                                            </h2>
                                            <div className="flex items-center gap-4 text-gray-400 text-sm">
                                                <div className="flex items-center gap-1.5">
                                                    <MapPin size={14} />
                                                    <span>
                                                        {selectedRace.is_virtual_race
                                                            ? "Virtual Race"
                                                            : selectedRace.time_zone?.replace(
                                                                /_/g,
                                                                " "
                                                            ) || "Location TBD"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar size={14} />
                                                    <span>
                                                        {selectedRace.date_time
                                                            ? new Date(
                                                                selectedRace.date_time
                                                            ).toLocaleDateString("en-US", {
                                                                month: "short",
                                                                day: "numeric",
                                                                year: "numeric",
                                                            })
                                                            : "Date TBD"}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-gray-300 mt-4">
                                                Which sections should I include in your website?
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                            {AVAILABLE_SECTIONS.map((section) => {
                                                const isSelected = selectedSections.includes(
                                                    section.id
                                                );
                                                const Icon = section.icon;
                                                return (
                                                    <button
                                                        key={section.id}
                                                        onClick={() =>
                                                            handleSectionToggle(section.id)
                                                        }
                                                        className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all duration-200 ${isSelected
                                                            ? "bg-blue-900/20 border-blue-500/50"
                                                            : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                                                            }`}
                                                    >
                                                        <div
                                                            className={`p-2 rounded-lg ${isSelected
                                                                ? "bg-blue-500/20 text-blue-400"
                                                                : "bg-gray-700 text-gray-400"
                                                                }`}
                                                        >
                                                            <Icon size={20} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between">
                                                                <h3
                                                                    className={`font-semibold ${isSelected
                                                                        ? "text-blue-300"
                                                                        : "text-gray-200"
                                                                        }`}
                                                                >
                                                                    {section.label}
                                                                </h3>
                                                                {isSelected && (
                                                                    <CheckCircle
                                                                        size={18}
                                                                        className="text-blue-400"
                                                                    />
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-gray-400 mt-1">
                                                                {section.description}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <button
                                            onClick={handleContinueFromSections}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                                        >
                                            Continue <ChevronRight size={18} />
                                        </button>
                                    </div>
                                )}

                                {showImageUpload && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="mb-6">
                                            <h2 className="text-xl text-white font-semibold mb-2">
                                                Upload Your Assets
                                            </h2>
                                            <p className="text-gray-400 text-sm">
                                                Personalize your website with your race's branding.
                                            </p>
                                        </div>

                                        <div className="space-y-6 mb-8">
                                            {/* Logo Upload */}
                                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h3 className="text-white font-medium flex items-center gap-2">
                                                            <div className="p-1.5 bg-blue-500/20 rounded text-blue-400">
                                                                <ImageIcon size={16} />
                                                            </div>
                                                            Race Logo
                                                        </h3>
                                                        <p className="text-xs text-gray-400 mt-1">
                                                            Appears in the navigation bar and footer
                                                        </p>
                                                    </div>
                                                    {uploadedImages.logo && (
                                                        <button
                                                            onClick={() => removeImage("logo")}
                                                            className="text-gray-500 hover:text-red-400 transition"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    )}
                                                </div>

                                                {uploadedImages.logo ? (
                                                    <div className="relative h-32 bg-gray-900 rounded-lg border border-gray-700 flex items-center justify-center overflow-hidden">
                                                        <img
                                                            src={uploadedImages.logo}
                                                            alt="Logo"
                                                            className="h-full object-contain"
                                                        />
                                                    </div>
                                                ) : (
                                                    <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-700 hover:border-blue-500/50 rounded-lg cursor-pointer bg-gray-900/50 hover:bg-gray-800/50 transition group">
                                                        <div className="p-3 rounded-full bg-gray-800 group-hover:bg-blue-500/20 transition mb-2">
                                                            {uploadingField === "logo" ? (
                                                                <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                                                            ) : (
                                                                <Upload className="h-5 w-5 text-gray-400 group-hover:text-blue-400" />
                                                            )}
                                                        </div>
                                                        <span className="text-sm text-gray-400 group-hover:text-blue-300">
                                                            Click to upload logo
                                                        </span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => handleImageUpload("logo", e)}
                                                            disabled={!!uploadingField}
                                                        />
                                                    </label>
                                                )}
                                            </div>

                                            {/* Banner Upload */}
                                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h3 className="text-white font-medium flex items-center gap-2">
                                                            <div className="p-1.5 bg-purple-500/20 rounded text-purple-400">
                                                                <Layout size={16} />
                                                            </div>
                                                            Hero Banner
                                                        </h3>
                                                        <p className="text-xs text-gray-400 mt-1">
                                                            Main background image for the hero section
                                                        </p>
                                                    </div>
                                                    {uploadedImages.banner && (
                                                        <button
                                                            onClick={() => removeImage("banner")}
                                                            className="text-gray-500 hover:text-red-400 transition"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    )}
                                                </div>

                                                {uploadedImages.banner ? (
                                                    <div className="relative h-48 bg-gray-900 rounded-lg border border-gray-700 flex items-center justify-center overflow-hidden">
                                                        <img
                                                            src={uploadedImages.banner}
                                                            alt="Banner"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                ) : (
                                                    <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-700 hover:border-purple-500/50 rounded-lg cursor-pointer bg-gray-900/50 hover:bg-gray-800/50 transition group">
                                                        <div className="p-3 rounded-full bg-gray-800 group-hover:bg-purple-500/20 transition mb-2">
                                                            {uploadingField === "banner" ? (
                                                                <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
                                                            ) : (
                                                                <Upload className="h-5 w-5 text-gray-400 group-hover:text-purple-400" />
                                                            )}
                                                        </div>
                                                        <span className="text-sm text-gray-400 group-hover:text-purple-300">
                                                            Click to upload banner
                                                        </span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => handleImageUpload("banner", e)}
                                                            disabled={!!uploadingField}
                                                        />
                                                    </label>
                                                )}
                                            </div>

                                            {/* Gallery Upload */}
                                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                                                <div className="mb-4">
                                                    <h3 className="text-white font-medium flex items-center gap-2">
                                                        <div className="p-1.5 bg-green-500/20 rounded text-green-400">
                                                            <ImageIcon size={16} />
                                                        </div>
                                                        Gallery Images
                                                    </h3>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        Add photos for the highlights section
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-3 gap-3">
                                                    {uploadedImages.gallery.map((url, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="relative aspect-square bg-gray-900 rounded-lg border border-gray-700 overflow-hidden group"
                                                        >
                                                            <img
                                                                src={url}
                                                                alt={`Gallery ${idx}`}
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <button
                                                                onClick={() => removeImage("gallery", idx)}
                                                                className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <label className="aspect-square border-2 border-dashed border-gray-700 hover:border-green-500/50 rounded-lg cursor-pointer bg-gray-900/50 hover:bg-gray-800/50 transition flex flex-col items-center justify-center group">
                                                        <div className="p-2 rounded-full bg-gray-800 group-hover:bg-green-500/20 transition mb-1">
                                                            {uploadingField === "gallery" ? (
                                                                <Loader2 className="h-4 w-4 text-green-400 animate-spin" />
                                                            ) : (
                                                                <Plus className="h-4 w-4 text-gray-400 group-hover:text-green-400" />
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-gray-400 group-hover:text-green-300">
                                                            Add Photo
                                                        </span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            multiple
                                                            className="hidden"
                                                            onChange={(e) => handleImageUpload("gallery", e)}
                                                            disabled={!!uploadingField}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleFinishSetup}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                                        >
                                            Finish Setup <CheckCircle size={18} />
                                        </button>
                                    </div>
                                )}

                                {!initialLoading &&
                                    selectedRace &&
                                    !showSectionSelection &&
                                    !showImageUpload && (
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
                                                    onChange={(e) =>
                                                        setCurrentAnswer(e.target.value)
                                                    }
                                                    onKeyDown={(e) =>
                                                        e.key === "Enter" && handleSendClick()
                                                    }
                                                    disabled={waitingForResponse || isSending}
                                                    placeholder={
                                                        lastQuestion ||
                                                        "Describe your website preferences..."
                                                    }
                                                    className="flex-1 bg-gray-800 text-white p-3 rounded border border-gray-700 focus:border-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                                />
                                                <button
                                                    onClick={handleSendClick}
                                                    disabled={
                                                        !currentAnswer.trim() ||
                                                        waitingForResponse ||
                                                        isSending
                                                    }
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
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
