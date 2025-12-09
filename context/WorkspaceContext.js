"use client";

import React, { createContext, useState } from "react";

export const WorkspaceContext = createContext();

export const WorkspaceProvider = ({ children }) => {
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isDeploying, setIsDeploying] = useState(false);

    const triggerRefresh = () => {
        setRefreshTrigger((prev) => prev + 1);
    };

    return (
        <WorkspaceContext.Provider
            value={{
                refreshTrigger,
                triggerRefresh,
                isDeploying,
                setIsDeploying,
            }}
        >
            {children}
        </WorkspaceContext.Provider>
    );
};
