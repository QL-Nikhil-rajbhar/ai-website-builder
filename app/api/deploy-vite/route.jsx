import { NextResponse } from "next/server";
import crypto from 'crypto';

export async function POST(req) {
    const { files, projectName } = await req.json();

    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

    if (!VERCEL_TOKEN) {
        return NextResponse.json({ error: "No Vercel token" }, { status: 500 });
    }

    try {
        console.log(`🚀 Deploying ${projectName} with ${Object.keys(files).length} files`);

        // Upload all files
        const fileUploads = await Promise.all(
            Object.entries(files).map(async ([path, content]) => {
                const sha = crypto.createHash('sha1').update(content).digest('hex');

                const res = await fetch('https://api.vercel.com/v2/now/files', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${VERCEL_TOKEN}`,
                        'x-vercel-digest': sha
                    },
                    body: content
                });

                if (!res.ok) throw new Error(`Upload failed: ${path}`);

                return { file: path, sha, size: Buffer.byteLength(content) };
            })
        );

        console.log(`✅ Uploaded ${fileUploads.length} files`);

        // Deploy with EXPLICIT Vite framework
        const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VERCEL_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: projectName,
                files: fileUploads,
                target: "production",
                projectSettings: {
                    framework: "vite",
                    buildCommand: "vite build",
                    outputDirectory: "dist",
                    installCommand: "npm install"
                }
            })
        });

        const deployData = await deployRes.json();

        if (!deployRes.ok) {
            console.error('❌ Deploy failed:', deployData);
            return NextResponse.json({
                error: deployData.error?.message || 'Deploy failed',
                details: deployData
            }, { status: 500 });
        }

        const url = `https://${deployData.url}`;
        console.log(`🎉 SUCCESS: ${url}`);

        // Disable protection
        if (deployData.projectId) {
            try {
                await fetch(`https://api.vercel.com/v9/projects/${deployData.projectId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${VERCEL_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ssoProtection: null,
                        passwordProtection: null
                    })
                });
                console.log('🔓 Public access enabled');
            } catch (e) {
                console.warn('⚠️ Could not disable protection');
            }
        }

        return NextResponse.json({
            success: true,
            url: url,
            deploymentId: deployData.id
        });

    } catch (error) {
        console.error('💥 Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
