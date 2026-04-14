import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type UserRole = "admin" | "student";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.error("fetchRole error:", error);
      }
      setRole((data?.role as UserRole) ?? "student");
    } catch (err) {
      console.error("fetchRole exception:", err);
      setRole("student");
    }
  }, []);

  const checkActive = useCallback(async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("user_id", userId)
      .maybeSingle();
    // If no profile found, allow access (admin might not have profile)
    if (!data) return true;
    return data.is_active !== false;
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      if (!mounted) return;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        const active = await checkActive(sess.user.id);
        if (!active) {
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setRole(null);
          if (mounted) setLoading(false);
          return;
        }
        await fetchRole(sess.user.id);
      }
      if (mounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        if (!mounted) return;
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          setTimeout(async () => {
            if (!mounted) return;
            const active = await checkActive(sess.user.id);
            if (!active) {
              await supabase.auth.signOut();
              setUser(null);
              setSession(null);
              setRole(null);
              if (mounted) setLoading(false);
              return;
            }
            await fetchRole(sess.user.id);
            if (mounted) setLoading(false);
          }, 0);
        } else {
          setRole(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchRole, checkActive]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      throw error;
    }
    // Check if student is disabled
    if (data.user) {
      const active = await checkActive(data.user.id);
      if (!active) {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setRole(null);
        setLoading(false);
        throw new Error("تم تعطيل حسابك. تواصل مع الإدارة.");
      }
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
