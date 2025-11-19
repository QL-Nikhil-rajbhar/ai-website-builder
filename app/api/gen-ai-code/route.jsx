import { NextResponse } from "next/server";
import { GenAiCode, sendMessageWithImages } from '@/configs/AiModel';
import Prompt from '@/data/Prompt';

export async function POST(req) {
    const { prompt, urls, conversationHistory, shouldGenerate, skipQuestions } = await req.json();

    console.log("urls are", urls);
    console.log("shouldGenerate:", shouldGenerate);
    console.log("skipQuestions:", skipQuestions);

    try {
        // Mode 1: Ask clarification questions (unless user skips)
        if (!shouldGenerate && !skipQuestions) {
            const clarificationPrompt = `
                The user wants to build a website with this request: "${prompt}"
                ${urls?.length > 0 ? `They also provided ${urls.length} reference image(s).` : ''}
                
                Ask exactly 5 specific clarifying questions to understand their needs better.
                Focus on: theme preference (dark/light), color scheme, layout style, target audience, specific features, animations/interactions.
                
                Return ONLY valid JSON format (no markdown, no backticks):
                {
                    "needsClarification": true,
                    "questions": [
                        "What color scheme would you prefer? (e.g., blue/professional, vibrant/colorful, minimal/monochrome)",
                        "Should this be a dark theme or light theme?",
                        "What's the primary action you want visitors to take?",
                        "Do you want any animations or interactive elements?",
                        "What type of layout do you prefer? (single page, multi-section, grid-based)"
                    ],
                    "message": "I'd like to understand your vision better before creating the website. Please answer these questions:"
                }
            `;

            const result = await GenAiCode.sendMessage(clarificationPrompt);
            const resp = await result.response.text();
            return NextResponse.json(JSON.parse(resp));
        }

        // Mode 2: Generate actual code (either after clarifications or if user skipped)
        else {
            let enhancedPrompt = "";

            if (conversationHistory && conversationHistory.length > 0) {
                // User provided clarifications
                const clarifications = conversationHistory
                    .filter(msg => msg.role === 'user')
                    .map(msg => msg.content)
                    .join("\n");

                enhancedPrompt = `
                    Original request: "${prompt}"
                    
                    User clarifications:
                    ${clarifications}
                    
                    ${urls?.length > 0 ? `Reference images provided: ${urls.length} images` : ''}
                    
                    ${Prompt.CODE_GEN_PROMPT}
                `;
            } else {
                // User skipped clarifications
                enhancedPrompt = `
                    ${prompt}
                    ${urls?.length > 0 ? `Reference images provided: ${urls.length} images` : ''}
                    
                    ${Prompt.CODE_GEN_PROMPT}
                `;
            }

            let result;
            if (urls && urls.length > 0) {
                console.log("inside the if condition");
                result = await sendMessageWithImages([{ role: "user", text: enhancedPrompt }], urls);
            } else {
                result = await GenAiCode.sendMessage(enhancedPrompt);
            }

            const resp = await result.response.text();
            console.log("inside the gen ai function");
            return NextResponse.json(JSON.parse(resp));
        }

    } catch (e) {
        console.error("API Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
