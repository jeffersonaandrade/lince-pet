"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { urlDeLogin } from "@/lib/destino-login";
import Image from "next/image";
import { Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { handleApiError, type ErrorState } from "@/utils/errorHandler";
import { cartaoDePlano, type PlanoMetadata } from "@/config/planos";
import { AssinaturasService, type StatusAssinatura } from "@/services/assinaturas/assinaturas";
import { ResumoContratacao, precoMensal } from "./ResumoContratacao";
import { GerenciarAssinatura } from "./GerenciarAssinatura";
import styles from "./alterar-plano.module.css";

type Props = {
  tipo: "veterinario" | "clinica";
  destaque: string;
  painel: string;
  titulo: string;
  descricao: string;
};

const formatarPreco = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatarData = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");

/** Escolha e contratação de plano (vet e clínica). Pagamento sempre na fatura do Asaas. */
export function AlterarPlano({ tipo, destaque, painel, titulo, descricao }: Props) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<StatusAssinatura | null>(null);
  const [planos, setPlanos] = useState<Array<PlanoMetadata & { priceCents: number; trialDays: number }>>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [aceito, setAceito] = useState(false);
  const atualizar = useCallback(async () => { setStatus(await AssinaturasService().obterStatus({ incluirFatura: false })); }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push(urlDeLogin());
      return;
    }
    if (user.userType !== tipo) {
      router.push("/");
      return;
    }
    const servico = AssinaturasService();
    Promise.all([servico.listarPlanos(tipo).catch(() => []), servico.obterStatus().catch(() => null)])
      .then(([lista, st]) => {
        const cards = lista.map(cartaoDePlano);
        setPlanos(cards);
        setStatus(st);
        const atual = st?.plan?.code;
        if (atual && cards.some((p) => p.code === atual)) setSelecionado(atual);
      })
      .finally(() => setCarregado(true));
  }, [user, loading, router, tipo]);

  if (loading || !carregado) {
    return (
      <div className={styles.loadingContainer}>
        <p>Carregando...</p>
      </div>
    );
  }

  const planoAtual = status?.plan?.code ?? null;
  const ehAtual = (code: string) => code === planoAtual && (code === "free" || status?.statusLabel === "ativa");
  const escolha = planos.find(p => p.code === selecionado);
  const aguardandoPagamento = Boolean(status?.checkoutUrl || status?.pendingPlanId || status?.subscription?.status === 'pending');
  const testeNaContratacao = Boolean(status?.testeDisponivel && !status.subscription && escolha?.priceCents && escolha.trialDays > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selecionado || !escolha || !status || aguardandoPagamento || (escolha.priceCents > 0 && !aceito)) return;
    setEnviando(true);
    setError(null);
    setSucesso(null);
    try {
      const servico = AssinaturasService();
      const resposta = status?.subscription
        ? await servico.upgrade(status.subscription.id, { planCode: selecionado, valorConfirmadoCentavos: escolha.priceCents, aceite: aceito })
        : await servico.criarAssinatura({ planCode: selecionado, valorConfirmadoCentavos: escolha.priceCents, aceite: aceito });

      if (resposta?.checkoutUrl) {
        setStatus(atual => atual ? { ...atual, checkoutUrl: resposta.checkoutUrl } : atual);
        setSucesso('Sua cobrança está pronta. Abra o pagamento em outra aba; você pode continuar na LincePet.');
        await atualizar().catch(() => {});
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

          {status ? <GerenciarAssinatura status={status} atualizar={atualizar} /> : null}

          <div className={styles.plansStepHeader}>
            <h2 className={styles.plansStepTitle}>{titulo}</h2>
            <p className={styles.plansStepDescription}>{descricao}</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.plansGrid}>
              {planos.map((plan) => {
                const preco = plan.priceCents <= 0 ? "Grátis" : formatarPreco(plan.priceCents);
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
                      <Image src={plan.iconPath} alt={plan.name} width={85} height={85} className={styles.planIcon} />
                    </div>

                    <div className={styles.containerFirst}>
                      <span className={styles.namePlan}>{plan.name}</span>
                      <span className={styles.descriptionPlan}>{plan.description}</span>
                    </div>

                    <span className={styles.valuePlan}>
                      {preco}
                      {plan.priceCents > 0 ? <span className="text-base font-normal text-slate-500">/mês</span> : null}
                    </span>

                    <button
                      type="button"
                      className={`${styles.planButton} ${isCurrent ? styles.planButtonCurrent : isSelected ? styles.planButtonActive : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelecionado(plan.code); setAceito(false);
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

            {escolha && !ehAtual(escolha.code) ? (
              <ResumoContratacao key={escolha.code} plano={escolha} testeDisponivel={testeNaContratacao} aceito={aceito} onAceite={setAceito} disabled={enviando} />
            ) : null}

            <div className={styles.buttonContainer}>
              <button type="button" onClick={() => router.push(painel)} className={styles.backButton}>
                Voltar
              </button>
              <button
                type="submit"
                className={styles.continueButton}
                disabled={aguardandoPagamento || !escolha || !status || (escolha.priceCents > 0 && !aceito) || !selecionado || enviando || ehAtual(selecionado) || status?.cancelamentoPendente}
              >
                {enviando ? "Processando..." : escolha?.priceCents === 0 ? "Usar plano gratuito" : testeNaContratacao ? `Confirmar teste — depois ${precoMensal(escolha?.priceCents ?? 0)}/mês` : `Confirmar ${escolha?.name ?? "plano"} — ${precoMensal(escolha?.priceCents ?? 0)}/mês`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
