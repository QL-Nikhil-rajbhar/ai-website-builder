import { NextResponse } from "next/server";
import crypto from 'crypto';

export async function POST(req) {
    const { files, projectName } = await req.json();

    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const TEAM_ID = process.env.VERCEL_TEAM_ID;

    if (!VERCEL_TOKEN) {
        return NextResponse.json({
            error: "Vercel token not configured"
        }, { status: 500 });
    }

    try {
        console.log(`Starting deployment for project: ${projectName}`);
        console.log(`Files to deploy: ${Object.keys(files).length}`);

        // Step 1: Upload all files
        const uploadPromises = Object.entries(files).map(async ([path, content]) => {
            const sha = crypto.createHash('sha1').update(content).digest('hex');

            const uploadUrl = TEAM_ID
                ? `https://api.vercel.com/v2/now/files?teamId=${TEAM_ID}`
                : 'https://api.vercel.com/v2/now/files';

            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${VERCEL_TOKEN}`,
                    'Content-Type': 'application/octet-stream',
                    'x-vercel-digest': sha
                },
                body: content
            });

            if (!uploadResponse.ok) {
                const error = await uploadResponse.text();
                console.error(`Failed to upload ${path}:`, error);
                throw new Error(`Failed to upload ${path}`);
            }

            return { file: path, sha, size: Buffer.byteLength(content, 'utf8') };
        });

        const fileObjects = await Promise.all(uploadPromises);
        console.log(`Successfully uploaded ${fileObjects.length} files`);

        // Step 2: Create deployment
        const deploymentPayload = {
            name: projectName,
            files: fileObjects,
            target: "production"
        };

        if (TEAM_ID) {
            deploymentPayload.teamId = TEAM_ID;
        }

        const deployUrl = TEAM_ID
            ? `https://api.vercel.com/v13/deployments?teamId=${TEAM_ID}&skipAutoDetectionConfirmation=1`
            : 'https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1';

        console.log("Creating deployment...");

        const deployResponse = await fetch(deployUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VERCEL_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(deploymentPayload)
        });

        const deployData = await deployResponse.json();

        if (!deployResponse.ok) {
            console.error("Deployment failed:", deployData);
            return NextResponse.json({
                error: "Deployment failed",
                details: deployData,
                message: deployData.error?.message || "Unknown deployment error"
            }, { status: deployResponse.status });
        }

        console.log("Deployment successful!");
        console.log(`URL: https://${deployData.url}`);

        // Step 3: Disable deployment protection automatically
        const projectId = deployData.projectId || deployData.project?.id;

        if (projectId) {
            console.log('🔓 Disabling Vercel Authentication...');

            try {
                const protectionUrl = TEAM_ID
                    ? `https://api.vercel.com/v9/projects/${projectId}?teamId=${TEAM_ID}`
                    : `https://api.vercel.com/v9/projects/${projectId}`;

                const projectResponse = await fetch(protectionUrl, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${VERCEL_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ssoProtection: null,  // Disable Vercel Authentication
                        passwordProtection: null  // Disable Password Protection
                    })
                });

                if (projectResponse.ok) {
                    console.log('✅ Project protection disabled - URL is now PUBLIC!');
                } else {
                    const error = await projectResponse.json();
                    console.warn('⚠️ Could not disable protection:', error.error?.message);
                }
            } catch (error) {
                console.warn('⚠️ Protection update failed:', error.message);
            }
        }

        return NextResponse.json({
            success: true,
            url: `https://${deployData.url}`,
            deploymentId: deployData.id,
            inspectorUrl: deployData.inspectorUrl,
            readyState: deployData.readyState,
            projectId: projectId
        });

    } catch (error) {
        console.error("Deployment error:", error);
        return NextResponse.json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
