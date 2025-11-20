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
        fileData: v.optional(v.any()),
        messages: v.any(),
        urls: v.optional(v.any()),

        createdAt: v.optional(v.string()),
        updatedAt: v.optional(v.string()),
        status: v.optional(v.string()),
    })

});