// app/api/deploy-aws/route.js
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import mime from "mime-types";

export const runtime = "nodejs";

// ---------- CONFIG ----------
const DEPLOY_BUCKET = process.env.NEXT_PUBLIC_AWS_SOURCE_BUCKET;
const DISTRIBUTION_ID = process.env.NEXT_PUBLIC_CLOUDFRONT_DISTRIBUTION_ID;
const CLOUDFRONT_DOMAIN = process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN;
const CUSTOM_DOMAIN = "rtd-test.qkkalabs.com";
const AWS_REGION = "us-east-2";

const s3 = new S3Client({
    region: AWS_REGION,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
    },
});

const cf = new CloudFrontClient({
    region: AWS_REGION,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
    },
});

// Helper to get all files recursively
function getAllFiles(dir) {
    const results = [];
    (function walk(d) {
        const list = fs.readdirSync(d);
        for (const file of list) {
            const full = path.join(d, file);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) walk(full);
            else results.push(full);
        }
    })(dir);
    return results;
}

// ---------- Route ----------
export async function POST(req) {
    let tempDir = null;

    try {
        const form = await req.formData();
        const zipFile = form.get("zipFile");
        const raceName = form.get("raceName") || "Pali's-invititional-2025"; // ✅ Get race name

        if (!zipFile) {
            return NextResponse.json({ error: "Missing zipFile" }, { status: 400 });
        }

        const timestamp = Date.now();

        // ✅ Generate subdomain from raceName
        let subdomain = raceName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-")
            .replace(/--+/g, "-")
            .replace(/^-|-$/g, "")
            .substring(0, 50);

        if (!subdomain) {
            subdomain = `site-${timestamp}`;
        }

        console.log("🚀 Deploying subdomain:", subdomain);

        // 1) Create temp directory
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "deploy-"));
        console.log("📁 Created temp dir:", tempDir);

        // 2) Extract ZIP
        const JSZip = (await import("jszip")).default;
        const zipBuffer = Buffer.from(await zipFile.arrayBuffer());
        const zip = await JSZip.loadAsync(zipBuffer);

        for (const filename of Object.keys(zip.files)) {
            const file = zip.files[filename];
            if (file.dir) continue;
            const filePath = path.join(tempDir, filename);
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            const content = await file.async("nodebuffer");
            fs.writeFileSync(filePath, content);
        }

        console.log("📦 ZIP extracted");

        // Debug: Check extracted files
        console.log("📋 First 10 extracted files:");
        const extractedFiles = getAllFiles(tempDir);
        extractedFiles.slice(0, 10).forEach(f =>
            console.log("  -", path.relative(tempDir, f))
        );

        // Check for package.json
        const pkgPath = path.join(tempDir, "package.json");
        if (!fs.existsSync(pkgPath)) {
            throw new Error("❌ package.json not found in ZIP!");
        }
        console.log("✅ package.json exists");

        // 3) Install dependencies
        console.log("Node version:", process.version);
        console.log("📥 Installing dependencies...");

        // Remove package-lock if exists for clean install
        const lockPath = path.join(tempDir, "package-lock.json");
        if (fs.existsSync(lockPath)) {
            fs.unlinkSync(lockPath);
            console.log("🗑️ Removed package-lock.json");
        }

        execSync("npm install --legacy-peer-deps --force && npm install @tailwindcss/postcss postcss", {
            cwd: tempDir,
            stdio: "inherit",
            timeout: 5 * 60 * 1000, // 5 min timeout
        });

        console.log("✅ Dependencies installed");

        // 4) Build Next.js - KEEP YOUR WORKING BUILD LOGIC
        console.log("🔨 Building Next.js...");
        execSync("npm run build", {
            cwd: tempDir,
            stdio: "inherit",
            timeout: 10 * 60 * 1000,
            env: {
                ...process.env,
                NODE_ENV: "production",
                NEXT_PUBLIC_BASE_PATH: "", // ✅ Empty for subdomain (was `/projects/${timestamp}`)
            },
        });

        // 5) Check for out folder
        const outDir = path.join(tempDir, "out");
        if (!fs.existsSync(outDir)) {
            throw new Error("No 'out' folder found after build");
        }

        console.log("✅ Build complete");


        // 6) Upload to S3
        console.log("☁️ Uploading to S3...");
        const targetPrefix = `${subdomain}/`; // ✅ Use subdomain as folder (was `projects/${timestamp}/`)
        const files = getAllFiles(outDir);

        console.log(`📤 Uploading ${files.length} files...`);

        for (const filePath of files) {
            const fileContent = fs.readFileSync(filePath);
            const relative = path.relative(outDir, filePath).replace(/\\/g, "/");
            const contentType = mime.lookup(relative) || "application/octet-stream";

            await s3.send(
                new PutObjectCommand({
                    Bucket: DEPLOY_BUCKET,
                    Key: `${targetPrefix}${relative}`,
                    Body: fileContent,
                    ContentType: contentType,
                    // ACL: "public-read",
                })
            );
        }

        console.log("✅ Uploaded to S3");


        // // ✅ TEMP: Copy build to local folder for testing (REMOVE AFTER TESTING)
        // console.log("💾 Saving build locally for testing...");
        // const projectRoot = process.cwd();
        // const localBuildDir = path.join(projectRoot, 'local-builds', `build-${subdomain}-${timestamp}`);
        // fs.mkdirSync(localBuildDir, { recursive: true });
        // fs.cpSync(outDir, localBuildDir, { recursive: true });
        // console.log(`✅ Local build saved: ${localBuildDir}`);
        // console.log(`📂 Serve this folder with: cd ${localBuildDir} && npx serve .`);

        console.log("🔄 Creating CloudFront invalidation...");
        await cf.send(
            new CreateInvalidationCommand({
                DistributionId: DISTRIBUTION_ID,
                InvalidationBatch: {
                    CallerReference: String(timestamp),
                    Paths: {
                        Quantity: 1,
                        Items: [`/${subdomain}/*`],
                    },
                },
            })
        );
        console.log("✅ Cache invalidated");

        // ✅ Return subdomain URL
        const baseDomain = CUSTOM_DOMAIN || CLOUDFRONT_DOMAIN;
        const url = `https://${subdomain}.${baseDomain}/`;

        console.log("✅ Deployment complete:", url);

        return NextResponse.json({
            success: true,
            url: url,
            subdomain: subdomain,
            timestamp: timestamp,
        });
    } catch (err) {
        console.error("DEPLOY ERROR:", err);

        // Return detailed error
        return NextResponse.json(
            {
                error: err.message || String(err),
                stack: err.stack,
            },
            { status: 500 }
        );
    } finally {
        // // Cleanup temp directory
        // if (tempDir && fs.existsSync(tempDir)) {
        //     try {
        //         fs.rmSync(tempDir, { recursive: true, force: true });
        //         console.log("🧹 Cleaned up temp dir");
        //     } catch (cleanupErr) {
        //         console.error("⚠️ Cleanup error:", cleanupErr);
        //     }
        // }
    }
}
