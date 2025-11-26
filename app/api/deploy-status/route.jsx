// app/api/deploy-status/route.js
import { NextResponse } from "next/server";
import { CodeBuildClient, BatchGetBuildsCommand } from "@aws-sdk/client-codebuild";

const codebuild = new CodeBuildClient({
    region: "us-east-2",
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
    },
});

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const buildId = searchParams.get("buildId");
    const timestamp = searchParams.get("timestamp");
    const cloudfrontDomain = process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN;

    if (!buildId) {
        return NextResponse.json({ error: "Missing buildId" }, { status: 400 });
    }

    try {
        const result = await codebuild.send(
            new BatchGetBuildsCommand({
                ids: [buildId],
            })
        );

        const build = result.builds[0];
        const status = build.buildStatus; // IN_PROGRESS, SUCCEEDED, FAILED

        return NextResponse.json({
            status: status,
            phase: build.currentPhase,
            startTime: build.startTime,
            endTime: build.endTime,
            logs: build.logs?.deepLink,
            url: status === "SUCCEEDED"
                ? `https://${cloudfrontDomain}/projects/${timestamp}/`
                : null,
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
