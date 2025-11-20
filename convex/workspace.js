import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const CreateWorkspace = mutation({
    args: {
        messages: v.any(),
        urls: v.optional(v.any()),
        files: v.optional(v.any())
    },
    handler: async (ctx, args) => {
        const toInsert = {
            messages: args.messages,
            urls: args.urls,
            createdAt: new Date().toISOString(),
            status: "CREATED",
        };

        if (args.files) {
            toInsert.fileData = args.files;
        }

        return await ctx.db.insert("workspace", toInsert);
    },
});

export const UpdateWorkspace = mutation({
    args: {
        workspaceId: v.id("workspace"),
        messages: v.optional(v.any()),
        urls: v.optional(v.any()),
        status: v.optional(v.string()),
        fileData: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const update = {
            updatedAt: new Date().toISOString()
        };

        if (args.messages) update.messages = args.messages;
        if (args.urls) update.urls = args.urls;
        if (args.status) update.status = args.status;
        if (args.fileData) update.fileData = args.fileData;

        return await ctx.db.patch(args.workspaceId, update);
    }
});

export const UpdateFiles = mutation({
    args: {
        workspaceId: v.id("workspace"),
        files: v.any()
    },
    handler: async (ctx, args) => {
        return await ctx.db.patch(args.workspaceId, {
            fileData: args.files,
            updatedAt: new Date().toISOString()
        });
    },
});

export const GetWorkspace = query({
    args: { workspaceId: v.id("workspace") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.workspaceId);
    }
});
