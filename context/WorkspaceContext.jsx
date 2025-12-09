"use client";

import React, { createContext, useState, useContext } from "react";

export const WorkspaceContext = createContext();

export const WorkspaceProvider = ({ children }) => {
    const [isDeploying, setIsDeploying] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const triggerRefresh = () => {
        setRefreshTrigger((prev) => prev + 1);
    };

    return (
        <WorkspaceContext.Provider
            value={{
                isDeploying,
                setIsDeploying,
                refreshTrigger,
                triggerRefresh,
            }}
        >
            {children}
        </WorkspaceContext.Provider>
    );
};
