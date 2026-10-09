"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { handleApiError, type ErrorState } from "@/utils/errorHandler";
import { DIAS_TESTE_GRATIS, type PlanoMetadata } from "@/config/planos";
import {
  AssinaturasService,
  type PlanoBackend,
  type StatusAssinatura,
} from "@/services/assinaturas/assinaturas";
import { StatusAssinaturaAviso } from "./StatusAssinaturaAviso";
import styles from "./alterar-plano.module.css";

type Props = {
  tipo: "veterinario" | "clinica";
  planos: PlanoMetadata[];
  destaque: string;
  painel: string;
  titulo: string;
  descricao: string;
};

const formatarPreco = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatarData = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");

/** Escolha e contratação de plano (vet e clínica). Pagamento sempre na fatura do Asaas. */
export function AlterarPlano({ tipo, planos, destaque, painel, titulo, descricao }: Props) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<StatusAssinatura | null>(null);
  const [precos, setPrecos] = useState<PlanoBackend[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.userType !== tipo) {
      router.push("/");
      return;
    }
    const servico = AssinaturasService();
    Promise.all([servico.listarPlanos().catch(() => []), servico.obterStatus().catch(() => null)])
      .then(([lista, st]) => {
        setPrecos(lista);
        setStatus(st);
        const atual = st?.plan?.code;
        if (atual && planos.some((p) => p.code === atual)) setSelecionado(atual);
      })
      .finally(() => setCarregado(true));
  }, [user, loading, router, tipo, planos]);

  if (loading || !carregado) {
    return (
      <div className={styles.loadingContainer}>
        <p>Carregando...</p>
      </div>
    );
  }

  const planoAtual = status?.plan?.code ?? null;
  const ehAtual = (code: string) => code === planoAtual && status?.statusLabel === "ativa";
  const precoDe = (code: string) => precos.find((p) => p.code === code)?.priceCents;
  const testeNaContratacao = Boolean(status?.testeDisponivel);
  const vencimentoTeste = new Date(Date.now() + DIAS_TESTE_GRATIS * 86_400_000).toLocaleDateString("pt-BR");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selecionado) return;
    setEnviando(true);
    setError(null);
    setSucesso(null);
    try {
      const servico = AssinaturasService();
      const resposta = status?.subscription
        ? await servico.upgrade(status.subscription.id, { planCode: selecionado })
        : await servico.criarAssinatura({ planCode: selecionado });

      if (resposta?.checkoutUrl) {
        window.location.href = resposta.checkoutUrl;
        return;
      }
      setStatus(await servico.obterStatus());
      setSucesso(
        resposta?.emTeste && resposta.primeiraFatura
          ? `Plano ativado! Seu teste grátis vai até ${formatarData(resposta.primeiraFatura)}, quando vence a 1a fatura.`
          : resposta?.message || "Plano atualizado."
      );
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setEnviando(false);
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
          {sucesso && (
            <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {sucesso}
            </p>
          )}

          {status ? <StatusAssinaturaAviso status={status} /> : null}

          <div className={styles.plansStepHeader}>
            <h2 className={styles.plansStepTitle}>{titulo}</h2>
            <p className={styles.plansStepDescription}>{descricao}</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.plansGrid}>
              {planos.map((plan) => {
                const cents = precoDe(plan.code);
                const preco = cents !== undefined ? formatarPreco(cents) : plan.defaultPrice;
                const isSelected = selecionado === plan.code;
                const isCurrent = ehAtual(plan.code);
                return (
                  <div
                    key={plan.code}
                    className={`${styles.cardPlan} ${isSelected ? styles.cardSelected : ""} ${plan.code === destaque ? styles.highlight : ""}`}
                    onClick={() => setSelecionado(plan.code)}
                  >
                    {isCurrent && <span className={styles.currentPlanBadge}>Plano Atual</span>}

                    <div className={styles.iconContainer}>
                      <img src={plan.iconPath} alt={plan.name} className={styles.planIcon} />
                    </div>

                    <div className={styles.containerFirst}>
                      <span className={styles.namePlan}>{plan.name}</span>
                      <span className={styles.descriptionPlan}>{plan.description}</span>
                    </div>

                    <span className={styles.valuePlan}>
                      {preco}
                      <span className="text-base font-normal text-slate-500">/mês</span>
                    </span>

                    <button
                      type="button"
                      className={`${styles.planButton} ${isCurrent ? styles.planButtonCurrent : isSelected ? styles.planButtonActive : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelecionado(plan.code);
                      }}
                      disabled={isCurrent}
                    >
                      {isCurrent ? "Seu Plano Atual" : isSelected ? "Selecionado" : plan.buttonText}
                    </button>

                    <div className={styles.downInfoPlan}>
                      {plan.benefits.map((benefit) => (
                        <div key={benefit} className={styles.containerCheck}>
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

            {selecionado && !ehAtual(selecionado) && (
              <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 text-left">
                <h3 className="mb-2 text-lg font-semibold text-slate-800">Pagamento</h3>
                <p className="text-sm text-slate-600">
                  Você paga com Pix, boleto ou cartão de crédito na fatura segura do Asaas. A cobrança é mensal.
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {testeNaContratacao
                    ? `Primeira assinatura: ${DIAS_TESTE_GRATIS} dias grátis. O plano ativa agora e a 1a fatura vence em ${vencimentoTeste}.`
                    : "O novo plano é ativado assim que o pagamento for confirmado pelo Asaas. Até lá, seu plano atual continua valendo."}
                </p>
              </div>
            )}

            <div className={styles.buttonContainer}>
              <button type="button" onClick={() => router.push(painel)} className={styles.backButton}>
                Voltar
              </button>
              <button
                type="submit"
                className={styles.continueButton}
                disabled={!selecionado || enviando || ehAtual(selecionado)}
              >
                {enviando ? "Processando..." : testeNaContratacao ? "Começar teste grátis" : "Ir para o pagamento"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
