"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

interface OnboardingRedirectProps {
  children: React.ReactNode;
}

export default function OnboardingRedirect({
  children,
}: OnboardingRedirectProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && user) {
      // Don't redirect if already on onboarding page to avoid infinite loops
      if (pathname === "/onboarding") return;

      // Check if user is logged in but hasn't completed onboarding
      if (user.onboardingComplete === 0) {
        // Only redirect veterinarios to onboarding - other user types might not need onboarding
        if (user.userType === "veterinario") {
          router.replace("/onboarding");
        }
      }
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "50vh",
        }}
      >
      </div>
    );
  }

  // If user is logged in but needs onboarding, show loading state while redirecting
  if (
    user &&
    user.onboardingComplete === 0 &&
    user.userType === "veterinario" &&
    pathname !== "/onboarding"
  ) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "50vh",
        }}
      >
        <div>Redirecionando para configuração do perfil...</div>
      </div>
    );
  }

  return <>{children}</>;
}
