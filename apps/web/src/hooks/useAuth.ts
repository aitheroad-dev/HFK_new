import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthProvider(): AuthContextValue {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      console.log("[Auth] initAuth called, hash:", window.location.hash);

      // Check if we have tokens in the URL hash (OAuth callback)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      console.log("[Auth] accessToken present:", !!accessToken, "refreshToken present:", !!refreshToken);

      if (accessToken && refreshToken) {
        // We have tokens from OAuth callback - set the session explicitly
        console.log("[Auth] Setting session from OAuth tokens...");
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error("[Auth] Error setting session from OAuth callback:", error);
        } else {
          console.log("[Auth] Session set successfully, user:", data.session?.user?.email);
          // Clear the hash from URL for cleaner UX
          window.history.replaceState(null, "", window.location.pathname);
          setState({
            user: data.session?.user ?? null,
            session: data.session,
            isLoading: false,
            isAuthenticated: !!data.session?.user,
          });
          return;
        }
      }

      // No tokens in hash, check for existing session
      console.log("[Auth] Checking existing session...");
      const { data: { session } } = await supabase.auth.getSession();
      console.log("[Auth] Existing session:", session?.user?.email ?? "none");
      setState({
        user: session?.user ?? null,
        session,
        isLoading: false,
        isAuthenticated: !!session?.user,
      });
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState({
          user: session?.user ?? null,
          session,
          isLoading: false,
          isAuthenticated: !!session?.user,
        });
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${window.location.search}`,
      },
    });
    if (error) {
      console.error("Google sign-in error:", error);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign-out error:", error);
      throw error;
    }
  }, []);

  return {
    ...state,
    signInWithGoogle,
    signOut,
  };
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { AuthContext };
