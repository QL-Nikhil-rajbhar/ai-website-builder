import { NextResponse } from "next/server";
import { GenAiCode, sendMessageWithImages } from '@/configs/AiModel';

export async function POST(req) {
    const { prompt, urls } = await req.json();
    console.log('urls are', urls)
    try {
        let result;
        // if (urls.length > 0) {
        //     console.log('inside the if condition');
        //     result = await sendMessageWithImages([{ role: "user", text: prompt }], urls);
        // } else {
        // Fallback to existing call for backward compatibility
        result = await GenAiCode.sendMessage(prompt);
        // }

        const resp = await result.response.text(); // await for response text\
        console.log('insdie the gen ai function')
        return NextResponse.json(JSON.parse(resp));
    } catch (e) {
        return NextResponse.json({ error: e.message });
    }
}
