"use client";
import { createContext } from "react";

export const UrlsContext = createContext({
    urls: [],
    setUrls: () => { }
});
