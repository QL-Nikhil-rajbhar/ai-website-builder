"use client";
import React, { useState } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import Header from '@/components/custom/Header';
import { MessagesContext } from '@/context/MessagesContext';
import { UrlsContext } from '@/context/UrlsContext';  // ✅ import it

function Provider({ children }) {
  const [messages, setMessages] = useState([]);
  const [urls, setUrls] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  return (
    <div>
      <MessagesContext.Provider value={{ messages, setMessages, isGenerating, setIsGenerating }}>
        <UrlsContext.Provider value={{ urls, setUrls }}>  {/* ✅ new provider */}
          <NextThemesProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <Header />
            {children}
          </NextThemesProvider>
        </UrlsContext.Provider>
      </MessagesContext.Provider>
    </div>
  );
}

export default Provider;
