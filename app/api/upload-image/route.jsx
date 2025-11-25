import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        const body = await req.json();
        const { base64 } = body;

        if (!base64) throw new Error("Missing base64 image");

        const formData = new FormData();
        formData.append("image", base64.replace(/^data:image\/\w+;base64,/, ""));

        const res = await fetch(
            `https://api.imgbb.com/1/upload?key=${process.env.NEXT_PUBLIC_IMGBB_API_KEY}`,
            { method: "POST", body: formData }
        );

        const data = await res.json();

        if (!data?.data?.url) {
            return NextResponse.json({ error: "Upload failed", raw: data }, { status: 500 });
        }

        return NextResponse.json({
            url: data.data.url
        });

    } catch (e) {
        return NextResponse.json({ error: e.message });
    }
}
