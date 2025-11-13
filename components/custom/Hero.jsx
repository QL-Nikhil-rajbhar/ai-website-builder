"use client"
import Lookup from '@/data/Lookup';
import { MessagesContext } from '@/context/MessagesContext';
import { ArrowRight, Link, Sparkles, Send, Wand2, Loader2 } from 'lucide-react';
import React, { useContext, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { UrlsContext } from '@/context/UrlsContext';

function Hero() {
    const [userInput, setUserInput] = useState('');
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [selectedImages, setSelectedImages] = useState([]);
    const [uploading, setUploading] = useState(false);
    const { messages, setMessages } = useContext(MessagesContext);
    const { urls, setUrls } = useContext(UrlsContext);

    const CreateWorkspace = useMutation(api.workspace.CreateWorkspace);
    const router = useRouter();

    const handleFileChange = (e) => {
        setSelectedImages(Array.from(e.target.files));
    };

    const IMGBB_API_KEY = 'aaa8c1e37a0fedd86ab07c15ec0e2052'; // Replace with your ImgBB key
    const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

    async function uploadImagesAndGetUrls(files) {
        const urls = [];
        for (const file of files) {
            const base64 = await readFileAsBase64(file);
            const base64Data = base64.split(',')[1]; // strip data url prefix

            const params = new URLSearchParams();
            params.append('image', base64Data);

            try {
                const response = await axios.post(
                    `${IMGBB_UPLOAD_URL}?key=${IMGBB_API_KEY}`,
                    params.toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    }
                );

                if (response.data && response.data.data && response.data.data.url) {
                    urls.push(response.data.data.url);
                }
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

    const onGenerate = async (input) => {
        // If images are selected, send both prompt and images to backend
        if (selectedImages.length > 0) {
            setUploading(true);
            const formData = new FormData();
            formData.append('prompt', input);
            selectedImages.forEach(file => formData.append('Images', file));

            try {
                // const response = await axios.post('/api/gen-ai-code', formData, {
                //     headers: { 'Content-Type': 'multipart/form-data' }
                // });

                const msg = {
                    role: 'user',
                    content: input
                };
                const urls = await uploadImagesAndGetUrls(selectedImages);

                setMessages(msg);
                setUrls(urls)
                const workspaceID = await CreateWorkspace({
                    messages: [msg],
                    urls: urls
                });
                router.push('/workspace/' + workspaceID);
            } catch (error) {
                console.error('Error:', error);
            }
            setUploading(false);
            setSelectedImages([]);
        } else {
            // No images, just send text prompt as before
            const msg = {
                role: 'user',
                content: input
            };
            setMessages(msg);
            const workspaceID = await CreateWorkspace({
                messages: [msg]
            });
            router.push('/workspace/' + workspaceID);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px]">
                <div className="absolute left-1/2 top-0 h-[500px] w-[1000px] -translate-x-1/2 bg-[radial-gradient(circle_400px_at_50%_300px,#3b82f625,transparent)]" />
            </div>

            <div className="container mx-auto px-4 py-16 relative z-10">
                <div className="flex flex-col items-center justify-center space-y-12">
                    {/* Hero Header */}
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
                            Transform your wildest ideas into production-ready code with Ai-powered assistance
                        </p>
                    </div>

                    {/* Modified Input Section */}
                    <div className="w-full max-w-3xl bg-gray-900/40 backdrop-blur-2xl rounded-xl border-2 border-electric-blue-500/40 shadow-[0_0_40px_5px_rgba(59,130,246,0.15)]">
                        <div className="p-2 bg-gradient-to-r from-electric-blue-500/10 to-purple-500/10">
                            <div className="bg-gray-900/80 p-6 rounded-lg">
                                <div className="flex gap-4">
                                    <textarea
                                        placeholder="DESCRIBE YOUR VISION..."
                                        value={userInput}
                                        onChange={(e) => setUserInput(e.target.value)}
                                        className="w-full bg-transparent border-2 border-electric-blue-500/30 rounded-lg p-5 text-gray-100 placeholder-electric-blue-500/60 focus:border-electric-blue-500 focus:ring-0 outline-none font-mono text-lg h-40 resize-none transition-all duration-300 hover:border-electric-blue-500/60"
                                        disabled={isEnhancing || uploading}
                                    />
                                    <div className="flex flex-col gap-2">
                                        {/* File input for images */}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleFileChange}
                                            disabled={uploading || isEnhancing}
                                            className="bg-gray-700 text-white rounded-xl px-2 py-2 border border-gray-600 cursor-pointer text-sm"
                                        />
                                        {selectedImages.length > 0 && (
                                            <div className="text-xs text-green-400">
                                                {selectedImages.length} image(s) selected
                                            </div>
                                        )}
                                        {uploading && (
                                            <div className="text-xs text-yellow-300">
                                                Uploading...
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {userInput && (
                                            <>
                                                <button
                                                    onClick={() => onGenerate(userInput)}
                                                    disabled={isEnhancing || uploading}
                                                    className={`flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl px-4 py-4 transition-all duration-200 ${isEnhancing || uploading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                >
                                                    <Send className="h-8 w-8" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-end mt-4">
                                    <Link className="h-6 w-6 text-electric-blue-400/80 hover:text-electric-blue-400 transition-colors duration-200" />
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
