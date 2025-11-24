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
        fileData: v.optional(v.any()),
        chatId: v.optional(v.string()),
        projectId: v.optional(v.string()),
        latestVersionId: v.optional(v.string()),
        demoUrl: v.optional(v.string()),
        createdAt: v.optional(v.string()),
        status: v.optional(v.string()),
        updatedAt: v.optional(v.string())
    })
});
