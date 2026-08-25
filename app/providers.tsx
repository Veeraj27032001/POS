"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

import { Toaster } from "@/components/ui/sonner";
import { ToastPositionProvider, useToastPosition } from "@/lib/toast/toast-position";

function AppToaster() {
  const { position } = useToastPosition();
  return <Toaster position={position} richColors closeButton />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <ToastPositionProvider>
            {children}
            <AppToaster />
            {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
          </ToastPositionProvider>
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
