"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, Zap, ShieldCheck, Crown, Info, CreditCard, QrCode } from "lucide-react";
import { handleApiError, type ErrorState } from "@/utils/errorHandler";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./alterar-plano.module.css";
import { AssinaturasService } from "@/services/assinaturas/assinaturas";
import { PLANOS_CLINICA } from "@/config/planos";
const plansMetadata = PLANOS_CLINICA;

function AlterarPlanoContent() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const hasFetched = useRef(false);
  
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [initialPlan, setInitialPlan] = useState<string | null>(null);
  const [localSubscriptionId, setLocalSubscriptionId] = useState<string | null>(null);
  const [cycle, setCycle] = useState<"MONTHLY" | "QUARTERLY" | "SEMIANNUALLY">("MONTHLY");
  const [billingType, setBillingType] = useState<"CREDIT_CARD" | "PIX">("CREDIT_CARD");

  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.userType !== "clinica") {
      router.push("/");
      return;
    }

    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchStatus = async () => {
      try {
        const assinaturas = AssinaturasService();
        const data = await assinaturas.obterStatus();
        const code = data?.plan?.code || "starter";
        setInitialPlan(code);
        setSelectedPlan(code);
        if (data?.subscription?.id) {
          setLocalSubscriptionId(data.subscription.id);
        }
      } catch (err: any) {
        console.error("Erro ao buscar plano atual:", err);
        setError({ message: "Não foi possível carregar seu plano atual." });
      } finally {
        setIsDataLoaded(true);
      }
    };

    fetchStatus();

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
      const assinaturas = AssinaturasService();
      
      let res;
      if (!localSubscriptionId) {
        res = await assinaturas.criarAssinatura({
          planCode: selectedPlan,
          cycle: cycle,
          billingType: billingType,
        });
      } else {
        res = await assinaturas.upgrade(localSubscriptionId, {
          planCode: selectedPlan,
          cycle: cycle,
          billingType: billingType,
        });
      }

      if (res?.checkoutUrl) {
        const openedWindow = window.open(res.checkoutUrl, '_blank', 'noopener,noreferrer');
        if (!openedWindow) {
          // Bloqueador de pop-ups ativo (comum no iPhone/Safari). Redireciona na mesma aba.
          window.location.href = res.checkoutUrl;
          return;
        }
        alert("A página de pagamento foi aberta em uma nova aba. Após concluir, feche a aba e atualize a página Lince Pet para ver seu plano atualizado!");
        router.push("/dashboard/clinica");
      } else {
        router.push("/dashboard/clinica");
      }
    } catch (err: any) {
      console.error(err);
      setError(handleApiError(err));
    } finally {
      setIsLoading(false);
    }
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
            <h2 className={styles.plansStepTitle}>Escolha o plano ideal para a sua clínica</h2>
            <p className={styles.plansStepDescription}>
              Selecione o plano que melhor se adapta ao tamanho da sua equipe e comece a atrair mais clientes.
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.plansGrid}>
              {plansMetadata.map((plan) => {
                let finalPriceStr = plan.defaultPrice;
                
                const isSelected = selectedPlan === plan.code;
                const isCurrent = initialPlan === plan.code;
                const isPro = plan.code === "clinic";
                
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
                      {plan.code !== "starter" && (
                        <span style={{ fontSize: "1rem", color: "#64748b", fontWeight: 400 }}>/mês</span>
                      )}
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

            {selectedPlan && selectedPlan !== "starter" && selectedPlan !== initialPlan && (
              <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#f8fafc' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>Forma de Pagamento</h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setBillingType("CREDIT_CARD")}
                    style={{ flex: 1, minWidth: '200px', padding: '1rem', borderRadius: '8px', border: billingType === "CREDIT_CARD" ? '2px solid #e67e22' : '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: billingType === "CREDIT_CARD" ? '#fff7ed' : '#fff', cursor: 'pointer', transition: 'all 0.2s ease' }}
                  >
                    <CreditCard size={20} color={billingType === "CREDIT_CARD" ? '#e67e22' : '#64748b'} />
                    <span style={{ fontWeight: 600, color: billingType === "CREDIT_CARD" ? '#c2410c' : '#475569' }}>Cartão de Crédito</span>
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
                onClick={() => router.push("/dashboard/clinica")}
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
