import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
    users: defineTable({
        name: v.string(),
        email: v.string(),
        picture: v.string(),
        uid: v.string()
    }),
    workspace: defineTable({
        messages: v.any(),
        urls: v.optional(v.any()),
        fileData: v.optional(v.any()), // ✅ add this line

    })
});