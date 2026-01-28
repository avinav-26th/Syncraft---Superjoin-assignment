"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // DATA FRESHNESS RULES:
            // Data is considered "fresh" for 30 seconds.
            // If you switch tabs and come back within 30s, NO NETWORK CALL happens.
            staleTime: 30 * 1000, 
            
            // If data is stale, we refetch in background, 
            // but we show the OLD data while fetching (No flickering!).
            refetchOnWindowFocus: false, 
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}