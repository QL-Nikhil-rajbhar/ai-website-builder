import { NextResponse } from "next/server";
import { createClient } from "v0-sdk";

const v0 = createClient({
    apiKey: process.env.NEXT_PUBLIC_V0_API_KEY,
});

export async function POST(req) {
    try {
        const { projectId, chatId, versionId } = await req.json();

        if (!projectId || !chatId || !versionId) {
            return NextResponse.json(
                { error: "projectId, chatId, versionId are required" },
                { status: 400 }
            );
        }
        console.log(`project id is ${projectId} chat id is ${chatId} version id is ${versionId}`)

        console.log("🚀 Deploying via V0 Platform...");
        console.log({ projectId, chatId, versionId });

        const deployment = await v0.deployments.create({
            projectId,
            chatId,
            versionId,
        });

        console.log("✅ Deployment complete:", deployment);

        return NextResponse.json({
            success: true,
            deployment,
            url: deployment?.url || null,
            inspectorUrl: deployment?.inspectorUrl || null,
            readyState: deployment?.readyState || null,
        });
    } catch (err) {
        console.error("❌ Deployment error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
