// app/api/deploy-aws/route.js
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { CodeBuildClient, StartBuildCommand } from "@aws-sdk/client-codebuild";

export const runtime = "nodejs";

// ---------- CONFIG ----------
const SOURCE_BUCKET = process.env.NEXT_PUBLIC_AWS_SOURCE_BUCKET; // Where we upload source code
const BUILD_PROJECT = process.env.NEXT_PUBLIC_AWS_CODEBUILD_PROJECT; // CodeBuild project name
const AWS_REGION = "us-east-2";

const s3 = new S3Client({
    region: AWS_REGION,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
    },
});

const codebuild = new CodeBuildClient({
    region: AWS_REGION,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
    },
});

// ---------- Route ----------
export async function POST(req) {
    try {
        const form = await req.formData();
        const zipFile = form.get("zipFile");

        if (!zipFile) {
            return NextResponse.json({ error: "Missing zipFile" }, { status: 400 });
        }

        // Generate unique project path
        const timestamp = Date.now();
        const projectKey = `source-code/${timestamp}/project.zip`;

        console.log("📤 Uploading source code to S3...");

        // Upload ZIP to S3 (source bucket)
        const zipBuffer = Buffer.from(await zipFile.arrayBuffer());
        await s3.send(
            new PutObjectCommand({
                Bucket: SOURCE_BUCKET,
                Key: projectKey,
                Body: zipBuffer,
                ContentType: "application/zip",
            })
        );

        console.log("✅ Source code uploaded:", projectKey);

        // Trigger CodeBuild
        console.log("🚀 Triggering CodeBuild...");
        const buildResult = await codebuild.send(
            new StartBuildCommand({
                projectName: BUILD_PROJECT,
                environmentVariablesOverride: [
                    {
                        name: "SOURCE_KEY",
                        value: projectKey,
                        type: "PLAINTEXT",
                    },
                    {
                        name: "TIMESTAMP",
                        value: String(timestamp),
                        type: "PLAINTEXT",
                    },
                    {
                        name: "SOURCE_BUCKET",
                        value: process.env.NEXT_PUBLIC_AWS_SOURCE_BUCKET,
                        type: "PLAINTEXT",
                    },
                    {
                        name: "DEPLOY_BUCKET",
                        value: process.env.NEXT_PUBLIC_AWS_SOURCE_BUCKET,
                        type: "PLAINTEXT",
                    },
                    {
                        name: "CLOUDFRONT_DISTRIBUTION_ID",
                        value: process.env.NEXT_PUBLIC_CLOUDFRONT_DISTRIBUTION_ID,
                        type: "PLAINTEXT",
                    },
                    {
                        name: "CLOUDFRONT_DOMAIN",
                        value: process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN,
                        type: "PLAINTEXT",
                    },
                ],
            })
        );


        const buildId = buildResult.build.id;
        console.log("✅ CodeBuild started:", buildId);

        return NextResponse.json({
            success: true,
            buildId: buildId,
            message: "Build started. Check CodeBuild console for progress.",
            sourceKey: projectKey,
        });
    } catch (err) {
        console.error("DEPLOY ERROR:", err);
        return NextResponse.json(
            { error: err.message || String(err) },
            { status: 500 }
        );
    }
}
