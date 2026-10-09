"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Zap, ShieldCheck, Crown, Info, CreditCard, QrCode } from "lucide-react";
import { handleApiError, type ErrorState } from "@/utils/errorHandler";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./alterar-plano.module.css";
import { AssinaturasService } from "@/services/assinaturas/assinaturas";
import { PLANOS_VETERINARIO } from "@/config/planos";
const plansMetadata = PLANOS_VETERINARIO;

function AlterarPlanoContent() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const assinaturas = AssinaturasService();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [initialPlan, setInitialPlan] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [cycle, setCycle] = useState<"MONTHLY" | "QUARTERLY" | "SEMIANNUALLY">("MONTHLY");
  const [billingType, setBillingType] = useState<"CREDIT_CARD" | "PIX">("CREDIT_CARD");

  const [availablePlans, setAvailablePlans] = useState<
    Array<{
      code: string;
      name: string;
      priceCents: number;
      features?: string;
      trialDays: number;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.userType !== "veterinario") {
      router.push("/");
      return;
    }

    (async () => {
      try {
        const list = await assinaturas.listarPlanos();
        setAvailablePlans(list);
      } catch (e) {
        console.error("Falha ao carregar planos", e);
      }
      try {
        const statusData = await assinaturas.obterStatus();
        if (statusData?.plan?.code) {
          setSelectedPlan(statusData.plan.code);
          setInitialPlan(statusData.plan.code);
        }
        if (statusData?.subscription?.id) {
          setSubscriptionId(statusData.subscription.id);
        }
      } catch (e) {
        // silencioso
      } finally {
        setIsDataLoaded(true);
      }
    })();
  }, [user, loading, router]);

  if (loading || !isDataLoaded) {
    return (
      <div className={styles.loadingContainer}>
        <p>Carregando...</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    setIsLoading(true);
    setError(null);

    try {
      let responseData: any;

      if (subscriptionId) {
        // Update existing subscription
        responseData = await assinaturas.upgrade(subscriptionId, {
          planCode: selectedPlan,
          cycle,
          billingType, // Passando o billingType no upgrade
        });
      } else {
        // Create new subscription
        responseData = await assinaturas.criarAssinatura({
          planCode: selectedPlan,
          billingType,
          cycle,
        });
      }

      try {
        window.localStorage.setItem("vetSelectedPlan", selectedPlan);
      } catch { }

      if (responseData?.checkoutUrl) {
        const openedWindow = window.open(responseData.checkoutUrl, '_blank');
        if (!openedWindow) {
          // Bloqueador de pop-ups ativo (comum no iPhone/Safari). Redireciona na mesma aba.
          window.location.href = responseData.checkoutUrl;
          return;
        }
        alert("A página de pagamento foi aberta em uma nova aba. Após concluir, feche a aba e aguarde alguns instantes para que seu plano seja atualizado!");
        router.push("/dashboard/veterinario");
      } else {
        router.push("/dashboard/veterinario");
      }
    } catch (err) {
      const errorState = handleApiError(err);
      setError(errorState);
    } finally {
      setIsLoading(false);
    }
  };

  const getCycleMultiplier = (c: string) => {
    if (c === "QUARTERLY") return 3;
    if (c === "SEMIANNUALLY") return 6;
    return 1;
  };

  const getCycleDiscount = (c: string) => {
    if (c === "QUARTERLY") return 0.10; // 10% discount
    if (c === "SEMIANNUALLY") return 0.20; // 20% discount
    return 0;
  };

  return (
    <div className={styles.container}>
      <div className={styles.rightSection}>
        <div className={`${styles.formWrapper} ${styles.wide}`}>
          {error && (
            <div className={styles.errorContainer}>
              <p className={styles.errorMessage}>{error.message}</p>
            </div>
          )}

          <div className={styles.plansStepHeader}>
            <h2 className={styles.plansStepTitle}>Escolha o plano ideal para você</h2>
            <p className={styles.plansStepDescription}>
              Selecione o plano que melhor se adapta às suas necessidades e comece a transformar seus agendamentos.
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.plansGrid}>
              {plansMetadata.map((plan) => {
                const planFromBackend = availablePlans.find((ap) => ap.code === plan.code);
                
                let finalPriceStr = plan.defaultPrice;
                
                if (planFromBackend) {
                  const basePrice = planFromBackend.priceCents / 100;
                  const multiplier = getCycleMultiplier(cycle);
                  const discount = getCycleDiscount(cycle);
                  const finalPrice = (basePrice * multiplier * (1 - discount)).toFixed(2);
                  finalPriceStr = basePrice === 0 ? "Grátis" : `R$ ${finalPrice.replace(".", ",")}`;
                }

                const isSelected = selectedPlan === plan.code;
                const isCurrent = initialPlan === plan.code;
                const isPro = plan.code === "pro";
                
                return (
                  <div
                    key={plan.code}
                    className={`${styles.cardPlan} ${isSelected ? styles.cardSelected : ""} ${isPro ? styles.highlight : ""}`}
                    onClick={() => setSelectedPlan(plan.code)}
                  >
                   
                    {isCurrent && (
                      <span className={styles.currentPlanBadge}>Plano Atual</span>
                    )}

                    <div className={styles.iconContainer}>
                      <img src={plan.iconPath} alt={plan.name} className={styles.planIcon} />
                    </div>

                    <div className={styles.containerFirst}>
                      <span className={styles.namePlan}>{plan.name}</span>
                      <span className={styles.descriptionPlan}>{plan.description}</span>
                    </div>

                    <span className={styles.valuePlan}>
                      {finalPriceStr}
                      <span style={{ fontSize: "1rem", color: "#64748b", fontWeight: 400 }}>/mês</span>
                    </span>

                    <button
                      type="button"
                      className={`${styles.planButton} ${isCurrent ? styles.planButtonCurrent : isSelected ? styles.planButtonActive : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlan(plan.code);
                      }}
                      disabled={isCurrent}
                    >
                      {isCurrent ? "Seu Plano Atual" : isSelected ? "Selecionado" : plan.buttonText}
                    </button>

                    <div className={styles.downInfoPlan}>
                      {plan.benefits.map((benefit, idx) => (
                        <div key={idx} className={styles.containerCheck}>
                          <div className={styles.iconCheck}>
                            <Check size={13} strokeWidth={3} />
                          </div>
                          <span className={styles.textCheck}>{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedPlan && selectedPlan !== initialPlan && (
              <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#f8fafc' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>Forma de Pagamento</h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setBillingType("CREDIT_CARD")}
                    style={{ flex: 1, minWidth: '200px', padding: '1rem', borderRadius: '8px', border: billingType === "CREDIT_CARD" ? '2px solid #e67e22' : '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: billingType === "CREDIT_CARD" ? '#fff7ed' : '#fff', cursor: 'pointer', transition: 'all 0.2s ease' }}
                  >
                    <CreditCard size={20} color={billingType === "CREDIT_CARD" ? '#e67e22' : '#64748b'} />
                    <span style={{ fontWeight: 600, color: billingType === "CREDIT_CARD" ? '#c2410c' : '#475569' }}>Cartão de Crédito </span>
                  </button>
                  <button
                    type="button"
                    disabled
                    style={{ flex: 1, minWidth: '200px', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#f1f5f9', cursor: 'not-allowed', opacity: 0.6 }}
                  >
                    <QrCode size={20} color="#94a3b8" />
                    <span style={{ fontWeight: 600, color: '#94a3b8' }}>PIX (em breve)</span>
                  </button>
                </div>
              </div>
            )}

            <div className={styles.buttonContainer}>
              <button
                type="button"
                onClick={() => router.push("/dashboard/veterinario")}
                className={styles.backButton}
              >
                Voltar
              </button>
              <button
                type="submit"
                className={styles.continueButton}
                disabled={!selectedPlan || isLoading || selectedPlan === initialPlan}
              >
                {isLoading ? "Processando..." : "Confirmar Assinatura"}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
}

export default function AlterarPlanoPage() {
  return (
    <Suspense fallback={<div />}>
      <AlterarPlanoContent />
    </Suspense>
  );
}
