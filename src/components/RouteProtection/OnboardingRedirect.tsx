"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { onboardingDoTipo } from "@/utils/tipoConta";

interface OnboardingRedirectProps {
  children: React.ReactNode;
}

export default function OnboardingRedirect({
  children,
}: OnboardingRedirectProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Só veterinário e prestador têm onboarding obrigatório.
  const destino =
    user && user.onboardingComplete === 0 ? onboardingDoTipo(user.userType) : null;
  const precisaRedirecionar = Boolean(destino && pathname !== destino);

  useEffect(() => {
    if (!loading && destino && precisaRedirecionar) {
      router.replace(destino);
    }
  }, [loading, destino, precisaRedirecionar, router]);

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

  if (precisaRedirecionar) {
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
