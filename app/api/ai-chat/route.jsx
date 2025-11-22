import { chatSession } from "@/configs/AiModel";
import { NextResponse } from "next/server";

export async function POST(req) {
    const { prompt } = await req.json();
    console.log('request reached here')

    try {
        const result = await chatSession.sendMessage(prompt);
        const AIResp = result.response.text();
        console.log
        return NextResponse.json({ result: AIResp })
    } catch (e) {
        return NextResponse.json({ error: e })
    }
}