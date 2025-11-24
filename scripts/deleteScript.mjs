import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";
dotenv.config();

const client = new ConvexHttpClient('https://acoustic-cormorant-210.convex.cloud');

async function run() {
    try {
        const result = await client.mutation("admin:deleteAllWorkspace");
        console.log("Deleted rows:", result);
    } catch (err) {
        console.error("Error:", err);
    }
}

run();
