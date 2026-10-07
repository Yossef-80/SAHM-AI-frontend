"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import type { AuthSession } from "@/types";

interface SupabaseAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName?: string, workspaceName?: string) => Promise<{ error: AuthError | null }>;
  signInWithOAuth: (provider: "google" | "github", next?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>;
  completeSignIn: (session: Session | null) => Promise<string | null>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | null>(null);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [supabase] = useState(() => createClient());
  const exchangesInFlight = useRef(new Map<string, Promise<string | null>>());
  const exchangedTokens = useRef(new Set<string>());

  const applySupabaseSession = async (session: Session | null): Promise<string | null> => {
    if (!session) {
      setUser(null);
      setSession(null);
      exchangedTokens.current.clear();
      useAuthStore.getState().clear();
      return null;
    }

    setUser(session.user);
    setSession(session);

    if (exchangedTokens.current.has(session.access_token)) return null;
    const existingExchange = exchangesInFlight.current.get(session.access_token);
    if (existingExchange) return existingExchange;

    // Exchange Supabase access token for backend session
    const exchange = (async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/auth/supabase-exchange", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const message = await response.text();
        return message || `Unable to create an application session (${response.status}).`;
      }
      {
        const data = await response.json();
        // Map backend response to AuthSession format
        const authSession: AuthSession = {
          accessToken: session.access_token,
          tokenType: "Bearer",
          expiresIn: session.expires_in || 3600,
          user: {
            id: session.user.id,
            email: session.user.email || "",
            fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || null,
            isActive: true,
            lastLoginAt: null,
            createdAt: session.user.created_at || null,
          },
          workspaces: data.workspaces || [],
          activeWorkspaceId: data.activeWorkspaceId || null,
        };
        useAuthStore.getState().applySession(authSession);
        exchangedTokens.current.add(session.access_token);
      }
    } catch (error) {
      console.error("Failed to exchange Supabase token:", error);
      return "Unable to connect to the application server. Please try again.";
    }
    return null;
    })();
    exchangesInFlight.current.set(session.access_token, exchange);
    try {
      return await exchange;
    } finally {
      exchangesInFlight.current.delete(session.access_token);
    }
  };

  useEffect(() => {
    let active = true;
    let exchangeQueue = Promise.resolve();

    // Resolve the saved session first. Queue auth events so token refreshes do
    // not race one another or clear a newer session.
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) console.error("Unable to read Supabase session:", error.message);
      exchangeQueue = exchangeQueue.then(async () => {
        if (active) await applySupabaseSession(session);
      });
      await exchangeQueue;
    }).catch((error) => {
      console.error("Unable to initialize Supabase session:", error);
    }).finally(() => {
      if (active) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      exchangeQueue = exchangeQueue.then(async () => {
        if (!active) return;
        const message = await applySupabaseSession(session);
        if (message) console.error(message);
      }).catch((error) => {
          console.error("Unable to apply Supabase auth state:", error);
        });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    let result;
    try {
      result = await supabase.auth.signInWithPassword({ email, password });
    } catch (error) {
      console.error("Supabase password sign-in request failed:", error);
      return { error: new AuthError("Unable to reach Supabase Auth.", 0, "network_error") };
    }
    const { data, error } = result;
    if (error) return { error };
    const exchangeError = await applySupabaseSession(data.session);
    return { error: exchangeError ? new AuthError(exchangeError, 0, "session_exchange_failed") : null };
  };

  const signUp = async (email: string, password: string, fullName?: string, workspaceName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          workspace_name: workspaceName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error };
  };

  const completeSignIn = async (session: Session | null) => applySupabaseSession(session);

  const signInWithOAuth = async (provider: "google" | "github", next?: string) => {
    const redirectTo = next
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      : `${window.location.origin}/auth/callback`;
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      return { error };
    } catch (error) {
      console.error("Supabase OAuth request failed:", error);
      return { error: new AuthError("Unable to reach Supabase Auth.", 0, "network_error") };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPasswordForEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  };

  return (
    <SupabaseAuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithPassword,
        signUp,
        signInWithOAuth,
        signOut,
        resetPasswordForEmail,
        updatePassword,
        completeSignIn,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error("useSupabaseAuth must be used within a SupabaseAuthProvider");
  }
  return context;
}
