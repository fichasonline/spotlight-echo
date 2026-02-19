import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAnonymous: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  isStaff: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isAnonymous: false,
  isAdmin: false,
  isModerator: false,
  isStaff: false,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function firstNonEmpty(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = toNonEmptyString(value);
    if (normalized) return normalized;
  }
  return null;
}

function getEmailHandle(email: string | null | undefined): string | null {
  if (!email) return null;
  const [handle] = email.split("@");
  return toNonEmptyString(handle);
}

function buildFallbackProfile(user: User): Profile {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;

  return {
    id: user.id,
    username: firstNonEmpty(metadata.username, getEmailHandle(user.email)),
    display_name: firstNonEmpty(
      metadata.display_name,
      metadata.full_name,
      metadata.name,
      metadata.username,
      getEmailHandle(user.email),
      "Usuario"
    ),
    avatar_url: firstNonEmpty(metadata.avatar_url, metadata.picture, metadata.image),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);
  const authHydrationVersion = useRef(0);

  useEffect(() => {
    const hydrateAuthState = async (nextSession: Session | null) => {
      const requestId = ++authHydrationVersion.current;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setProfile(null);
        setIsAnonymous(false);
        setIsAdmin(false);
        setIsModerator(false);
        setLoading(false);
        return;
      }

      const userIsAnonymous =
        (nextSession.user as unknown as { is_anonymous?: boolean }).is_anonymous === true ||
        nextSession.user.app_metadata?.provider === "anonymous";

      setIsAnonymous(userIsAnonymous);

      if (userIsAnonymous) {
        setProfile(null);
        setIsAdmin(false);
        setIsModerator(false);
        setLoading(false);
        return;
      }

      const fallbackProfile = buildFallbackProfile(nextSession.user);
      setProfile((current) => (current?.id === nextSession.user.id ? current : fallbackProfile));

      try {
        const [profileResult, adminRoleResult, moderatorRoleResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .eq("id", nextSession.user.id)
            .maybeSingle(),
          supabase.rpc("has_role", {
            _user_id: nextSession.user.id,
            _role: "admin",
          }),
          supabase.rpc("has_role", {
            _user_id: nextSession.user.id,
            _role: "moderator",
          }),
        ]);

        if (requestId !== authHydrationVersion.current) return;

        if (profileResult.error) {
          console.error("[AuthContext] profile load error:", profileResult.error);
        }

        if (adminRoleResult.error) {
          console.error("[AuthContext] admin role check error:", adminRoleResult.error);
        }

        if (moderatorRoleResult.error) {
          console.error("[AuthContext] moderator role check error:", moderatorRoleResult.error);
        }

        setProfile(profileResult.data ?? fallbackProfile);
        setIsAdmin(adminRoleResult.data === true);
        setIsModerator(moderatorRoleResult.data === true);
      } catch (error) {
        if (requestId !== authHydrationVersion.current) return;
        console.error("[AuthContext] auth hydration error:", error);
        setProfile(fallbackProfile);
        setIsAdmin(false);
        setIsModerator(false);
      } finally {
        if (requestId === authHydrationVersion.current) {
          setLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        void hydrateAuthState(nextSession);
      }
    );

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      void hydrateAuthState(initialSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAnonymous,
        isAdmin,
        isModerator,
        isStaff: isAdmin || isModerator,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
