import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create a new workspace
 */
export const CreateWorkspace = mutation({
    args: {
        messages: v.any(),
        urls: v.optional(v.any()),
        files: v.optional(v.any()),
        chatId: v.optional(v.string()),
        latestVersionId: v.optional(v.string()),
        projectId: v.optional(v.string()),
        demoUrl: v.optional(v.string()),   // ⭐ ADD THIS
        raceName: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const workspaceId = await ctx.db.insert("workspace", {
            messages: args.messages,
            urls: args.urls,
            fileData: args.files,
            chatId: args.chatId,
            projectId: args.projectId,
            latestVersionId: args.latestVersionId,
            demoUrl: args.demoUrl || null,   // ⭐ STORE IT
            raceName: args.raceName
            // convex auto manages createdAt / updatedAt
        });
        return workspaceId;
    },
});

/**
 * Patch files only
 */
export const UpdateFiles = mutation({
    args: {
        workspaceId: v.id("workspace"),
        files: v.any(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.patch(args.workspaceId, {
            fileData: args.files,
        });
    },
});

/**
 * ⭐ NEW: Update demoUrl alone
 */
export const UpdateDemoUrl = mutation({
    args: {
        workspaceId: v.id("workspace"),
        demoUrl: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.patch(args.workspaceId, {
            demoUrl: args.demoUrl,
        });
    },
});

/**
 * Update entire workspace (messages, urls, fileData, chatId, demoUrl)
 */
export const UpdateWorkspace = mutation({
    args: {
        workspaceId: v.id("workspace"),
        messages: v.any(),
        urls: v.optional(v.any()),
        fileData: v.optional(v.any()),
        chatId: v.optional(v.string()),
        projectId: v.optional(v.string()),
        latestVersionId: v.optional(v.string()),
        demoUrl: v.optional(v.string()),   // ⭐ ADD HERE
        raceName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const patch = {
            messages: args.messages,
        };
        if (args.urls !== undefined) patch.urls = args.urls;
        if (args.fileData !== undefined) patch.fileData = args.fileData;
        if (args.chatId !== undefined) patch.chatId = args.chatId;
        if (args.projectId !== undefined) patch.projectId = args.projectId;
        if (args.latestVersionId !== undefined) patch.latestVersionId = args.latestVersionId;
        if (args.demoUrl !== undefined) patch.demoUrl = args.demoUrl;
        if (args.raceName !== undefined && args.raceName !== null) patch.raceName = args.raceName;

        return await ctx.db.patch(args.workspaceId, patch);
    },
});

/**
 * Read workspace
 */
export const GetWorkspace = query({
    args: {
        workspaceId: v.id("workspace"),
    },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.workspaceId);
    },
});
