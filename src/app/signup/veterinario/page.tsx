"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Check, Zap, ShieldCheck, Crown, Rocket, Star, Info, Medal, CreditCard, QrCode } from "lucide-react";
import { fetchCep } from "@/services/external/brazilapi";
import { handleApiError, type ErrorState } from "@/utils/errorHandler";
import { formatCep, formatPhone, removeMask } from "@/utils/formatters";
import {
  veterinarioSignup,
  type VeterinarioSignupData,
  getOnboardingProgress,
} from "@/services/veterinarios/veterinarios";
import { login as authLogin } from "@/services/auth/auth";
import { useAuth } from "@/contexts/AuthContext";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import styles from "./veterinario-signup.module.css";
import Image from "next/image";
import { AssinaturasService } from "@/services/assinaturas/assinaturas";
import { PLANOS_VETERINARIO } from "@/config/planos";

const plansMetadata = PLANOS_VETERINARIO;

function VeterinarioSignup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user } = useAuth();
  const assinaturas = AssinaturasService();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    nome: "",
    sobrenome: "",
    cpf: "",
    celular: "",
    email: "",
    senha: "",
    cep: "",
    rua: "",
    bairro: "",
    cidade: "",
    estado: "",
    numero: "",
  });
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingType, setBillingType] = useState<"CREDIT_CARD" | "PIX">("CREDIT_CARD");
  const [pixDetails, setPixDetails] = useState<{ encodedImage: string; payload: string; paymentId: string } | null>(null);
  
  const [availablePlans, setAvailablePlans] = useState<
    Array<{ code: string; name: string; value: number; features?: string[] }>
  >([]);
  const changePlanMode = useMemo(() => {
    const step = searchParams?.get("step");
    const cp = searchParams?.get("changePlan");
    return (
      (step === "4" || cp === "1") && user && user.userType === "veterinario"
    );
  }, [searchParams, user]);

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const formattedCep = formatCep(value);

    setFormData((prev) => ({
      ...prev,
      cep: formattedCep,
    }));

    const unformattedCep = removeMask(value);
    if (unformattedCep.length === 8) {
      setIsLoadingCep(true);
      setError(null);
      try {
        const cepData = await fetchCep(unformattedCep);
        setFormData((prev) => ({
          ...prev,
          rua: cepData.rua || "",
          bairro: cepData.bairro || "",
          cidade: cepData.cidade || "",
          estado: cepData.estado || "",
        }));
      } catch (err: unknown) {
        const errorState = handleApiError(err, {
          404: "O CEP informado é inválido.",
          500: "Aconteceu um erro ao buscar o CEP.",
        });
        setError(errorState);

        setFormData((prev) => ({
          ...prev,
          rua: "",
          bairro: "",
          cidade: "",
          estado: "",
        }));
      } finally {
        setIsLoadingCep(false);
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        rua: "",
        bairro: "",
        cidade: "",
        estado: "",
      }));
      setError(null);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "cep") {
      return;
    }

    if (name === "celular") {
      const formattedPhone = formatPhone(value);
      setFormData((prev) => ({
        ...prev,
        [name]: formattedPhone,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const nextStep = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.nome && formData.sobrenome && formData.celular;
      case 2:
        // Validação de Login (Email e Senha)
        return formData.email && formData.senha;
      default:
        return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const submitData = {
        ...formData,
        celular: removeMask(formData.celular),
        cep: removeMask(formData.cep),
        password: formData.senha,
        cpf: formData.cpf ? removeMask(formData.cpf) : undefined,
        planCode: "none"
      };
      
      const { senha, ...submitDataForApi } = submitData;
      
      // 1. Criar o usuário
      await veterinarioSignup(submitDataForApi as VeterinarioSignupData);
      
      // 2. Fazer Login
      const loginResponse = await authLogin({
        email: formData.email,
        password: formData.senha,
      });
      
      login({
        ...loginResponse.user,
        userType: "veterinario",
      });

      router.push("/onboarding");
    } catch (err) {
      const errorState = handleApiError(err, {
        422: "E-mail já está em uso. Tente fazer login ou use outro e-mail.",
      });
      setError(errorState);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Modo troca de plano: força step 4, carrega planos do backend e pré-seleciona plano atual
  useEffect(() => {
    if (!changePlanMode) return;
    router.replace("/dashboard/veterinario/alterar-plano");
    setCurrentStep(3);
    (async () => {
      try {
        const list = await assinaturas.listarPlanos();
        setAvailablePlans(list);
      } catch (e) {
        console.error("Falha ao carregar planos", e);
      }
      try {
        const progress = await getOnboardingProgress();
        const maybeObj = progress as unknown;
        let vet: { planos?: Array<{ code?: string; name?: string }> } | null =
          null;
        if (maybeObj && typeof maybeObj === "object") {
          const withData = maybeObj as { data?: unknown };
          if (withData.data && typeof withData.data === "object") {
            const d = withData.data as { veterinario?: unknown };
            if (d.veterinario && typeof d.veterinario === "object") {
              vet = d.veterinario as {
                planos?: Array<{ code?: string; name?: string }>;
              };
            }
          } else {
            const direct = maybeObj as { veterinario?: unknown };
            if (direct.veterinario && typeof direct.veterinario === "object") {
              vet = direct.veterinario as {
                planos?: Array<{ code?: string; name?: string }>;
              };
            }
          }
        }
        const planObj =
          Array.isArray(vet?.planos) && vet!.planos!.length > 0
            ? vet!.planos![0]
            : null;
        const codeOrName = (planObj && (planObj.code || planObj.name)) || null;
        if (typeof codeOrName === "string") {
          setSelectedPlan(codeOrName);
        }
      } catch (e) {
        // silencioso
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changePlanMode]);

  return (
    <div className={styles.container}>
      {currentStep !== 3 && (
        <div className={styles.leftSection}>
          <Image
            src="/img/vetsignup.png"
            alt="Veterinary Signup"
            className={styles.leftImage}
            width={220}
            height={220}
          />
          <h1
            key={`title-${currentStep}`}
            className={`${styles.leftTitle} ${styles.fadeText}`}
          >
            {currentStep === 1
              ? "Conte-nos sobre você"
              : currentStep === 2
                ? "Finalize seu cadastro"
                : "Escolha seu plano"}
          </h1>
          <p
            key={`desc-${currentStep}`}
            className={`${styles.leftDescription} ${styles.fadeText}`}
          >
            {currentStep === 1
              ? "Conecte-se com tutores que procuram atendimento veterinário de qualidade. Receba novos pacientes que precisam dos seus cuidados especializados."
              : currentStep === 2
                ? "Torne fácil para tutores encontrarem e agendarem com você online. Apareça nos resultados de busca e simplifique o processo de marcação. Você pode adicionar outros endereços depois no seu perfil."
                : currentStep === 3
                  ? "Economize tempo coletando informações essenciais dos tutores. Receba documentos dos pets e formulários antes mesmo da consulta."
                  : "Selecione o plano que melhor combina com sua demanda. Você poderá alterar depois."}
          </p>
        </div>
      )}
      <div className={styles.rightSection}>
        <div className={`${styles.formWrapper} ${currentStep === 3 ? styles.wide : ""}`}>
          {error && (
            <div className={styles.errorContainer}>
              <p className={styles.errorMessage}>{error.message}</p>
            </div>
          )}

          <div className={styles.userTypeDisplay}>
            <p className={styles.userTypeText}>Cadastrando como Veterinário</p>
          </div>

          <div className={styles.stepIndicator}>
            <div
              className={`${styles.stepDot} ${currentStep >= 1 ? styles.active : ""
                }`}
            >
              1
            </div>
            <div className={styles.stepLine}></div>
            <div
              className={`${styles.stepDot} ${currentStep >= 2 ? styles.active : ""
                }`}
            >
              2
            </div>

          </div>

          <form
            key={`form-step-${currentStep}`}
            onSubmit={
              currentStep === 2
                ? handleSubmit
                : (e) => {
                  e.preventDefault();
                  nextStep();
                }
            }
            className={styles.form}
          >
            {currentStep === 1 && (
              <>
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="nome" className={styles.label}>
                      Nome
                    </label>
                    <input
                      type="text"
                      id="nome"
                      name="nome"
                      value={formData.nome}
                      onChange={handleInputChange}
                      className={styles.input}
                      required
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="sobrenome" className={styles.label}>
                      Sobrenome
                    </label>
                    <input
                      type="text"
                      id="sobrenome"
                      name="sobrenome"
                      value={formData.sobrenome}
                      onChange={handleInputChange}
                      className={styles.input}
                      required
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="celular" className={styles.label}>
                    Número de Celular
                    <Tooltip text="Seu número será usado apenas para contato interno e não será compartilhado publicamente com os tutores." />
                  </label>
                  <input
                    type="tel"
                    id="celular"
                    name="celular"
                    value={formData.celular}
                    onChange={handleInputChange}
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                    className={styles.input}
                    required
                  />
                </div>
              </>
            )}

            {/* {currentStep === 2 && (
              <>
                <div className={styles.inputGroup}>
                  <label htmlFor="cep" className={styles.label}>
                    CEP
                  </label>
                  <input
                    type="text"
                    id="cep"
                    name="cep"
                    value={formData.cep}
                    onChange={handleCepChange}
                    placeholder="00000-000"
                    maxLength={9}
                    className={`${styles.input} ${
                      isLoadingCep ? styles.loading : ""
                    }`}
                    required
                  />
                  {isLoadingCep && (
                    <span className={styles.loadingText}>
                      Buscando endereço...
                    </span>
                  )}
                </div>

                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="rua" className={styles.label}>
                      Rua
                    </label>
                    <input
                      type="text"
                      id="rua"
                      name="rua"
                      value={formData.rua}
                      onChange={handleInputChange}
                      className={styles.input}
                      required
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="numero" className={styles.label}>
                      Número
                    </label>
                    <input
                      type="text"
                      id="numero"
                      name="numero"
                      value={formData.numero}
                      onChange={handleInputChange}
                      className={styles.input}
                      required
                    />
                  </div>
                </div>

                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="bairro" className={styles.label}>
                      Bairro
                    </label>
                    <input
                      type="text"
                      id="bairro"
                      name="bairro"
                      value={formData.bairro}
                      onChange={handleInputChange}
                      className={styles.input}
                      required
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="cidade" className={styles.label}>
                      Cidade
                    </label>
                    <input
                      type="text"
                      id="cidade"
                      name="cidade"
                      value={formData.cidade}
                      onChange={handleInputChange}
                      className={styles.input}
                      required
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="estado" className={styles.label}>
                    Estado
                  </label>
                  <input
                    type="text"
                    id="estado"
                    name="estado"
                    value={formData.estado}
                    onChange={handleInputChange}
                    className={styles.input}
                    required
                  />
                </div>
              </>
            )} */}

            {currentStep === 2 && (
              <>
                <div className={styles.inputGroup}>
                  <label htmlFor="cpf" className={styles.label}>
                    CPF
                  </label>
                  <input
                    type="text"
                    id="cpf"
                    name="cpf"
                    value={formData.cpf}
                    onChange={handleInputChange}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={styles.input}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="email" className={styles.label}>
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={styles.input}
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="senha" className={styles.label}>
                    Senha
                  </label>
                  <div className={styles.passwordContainer}>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="senha"
                      name="senha"
                      value={formData.senha}
                      onChange={handleInputChange}
                      className={styles.input}
                      required
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className={styles.eyeButton}
                    >
                      {showPassword ? (
                        <EyeOff className={styles.eyeIcon} />
                      ) : (
                        <Eye className={styles.eyeIcon} />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {currentStep === 3 && (
              <>
                <div className={styles.plansStepHeader}>
                  <h2 className={styles.plansStepTitle}>Escolha seu plano</h2>
                  <p className={styles.plansStepDescription}>
                    Selecione o plano que melhor combina com sua demanda. Você poderá alterar depois.
                  </p>
                </div>
                <div className={styles.plansGrid}>
                  {plansMetadata.map((plan) => {
                    const planFromBackend = availablePlans.find((ap) => ap.code === plan.code);
                    let finalPriceStr = plan.defaultPrice;
                    
                    if (planFromBackend) {
                      const basePrice = (planFromBackend as any).priceCents ? (planFromBackend as any).priceCents / 100 : planFromBackend.value || 0;
                      finalPriceStr = basePrice === 0 ? "Grátis" : `R$ ${basePrice.toFixed(2).replace(".", ",")}`;
                    }

                    const isSelected = selectedPlan === plan.code;
                    const isPro = plan.code === "vet_starter";
                    
                    return (
                      <div
                        key={plan.code}
                        className={`${styles.cardPlan} ${isSelected ? styles.cardSelected : ""} ${isPro ? styles.highlight : ""}`}
                        onClick={() => setSelectedPlan(plan.code)}
                      >
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
                          className={`${styles.planButton} ${isSelected ? styles.planButtonActive : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPlan(plan.code);
                          }}
                        >
                          {isSelected ? "Selecionado" : plan.buttonText}
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
                {selectedPlan && (
                  <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#f8fafc', width: '100%' }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', textAlign: 'left' }}>Forma de Pagamento</h3>
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
                        onClick={() => setBillingType("PIX")}
                        style={{ flex: 1, minWidth: '200px', padding: '1rem', borderRadius: '8px', border: billingType === "PIX" ? '2px solid #e67e22' : '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: billingType === "PIX" ? '#fff7ed' : '#fff', cursor: 'pointer', transition: 'all 0.2s ease' }}
                      >
                        <QrCode size={20} color={billingType === "PIX" ? '#e67e22' : '#64748b'} />
                        <span style={{ fontWeight: 600, color: billingType === "PIX" ? '#c2410c' : '#475569' }}>PIX</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className={styles.buttonContainer}>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className={styles.backButton}
                >
                  Voltar
                </button>
              )}
              <button
                type="submit"
                className={styles.continueButton}
                disabled={!isStepValid() || (currentStep === 2 && isLoading)}
              >
                {currentStep === 2
                  ? isLoading
                    ? "Criando conta..."
                    : "Finalizar"
                  : "Continuar"}
              </button>
            </div>
          </form>

          <p className={styles.loginLink}>
            Já tem uma conta? <Link href="/login">Entrar</Link>
          </p>
        </div>

        <p className={styles.termsText}>
          Ao continuar, você concorda com os{" "}
          <Link href="/termos-de-uso" className={styles.termsLink}>
            Termos de Uso
          </Link>{" "}
          e{" "}
          <Link href="/politica-de-privacidade" className={styles.termsLink}>
            Política de Privacidade
          </Link>{" "}
          do Lince Pet.
        </p>
      </div>

      {pixDetails && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%", 
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
        }}>
          <div style={{
            backgroundColor: "white", padding: "2rem", borderRadius: "12px", 
            maxWidth: "400px", width: "90%", textAlign: "center", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
          }}>
            <h2 style={{ marginBottom: "1rem", color: "#1e293b", fontSize: "1.5rem", fontWeight: 700 }}>Pagamento via PIX</h2>
            <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>Escaneie o QR Code abaixo no app do seu banco para ativar sua assinatura.</p>
            
            <img 
              src={`data:image/png;base64,${pixDetails.encodedImage}`} 
              alt="QR Code PIX" 
              style={{ width: "200px", height: "200px", margin: "0 auto 1.5rem", display: "block" }} 
            />
            
            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "0.875rem", color: "#475569", marginBottom: "0.5rem", fontWeight: 600 }}>Ou copie o código (PIX Copia e Cola):</p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input 
                  type="text" 
                  value={pixDetails.payload} 
                  readOnly 
                  style={{ flex: 1, padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.875rem", backgroundColor: "#f8fafc", color: "#64748b" }}
                />
                <button 
                  onClick={() => navigator.clipboard.writeText(pixDetails.payload)}
                  style={{ padding: "0.5rem 1rem", backgroundColor: "#0ea5e9", color: "white", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 600 }}
                >
                  Copiar
                </button>
              </div>
            </div>

            <button 
              onClick={() => router.push(changePlanMode ? "/dashboard/veterinario" : "/onboarding")}
              style={{ width: "100%", padding: "0.75rem", backgroundColor: "#10b981", color: "white", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "1rem" }}
            >
              Já realizei o pagamento
            </button>
            <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#94a3b8" }}>
              Sua assinatura será ativada automaticamente assim que o pagamento for confirmado.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  // Envolve o uso de useSearchParams em um boundary de Suspense conforme exigido pelo Next.js
  return (
    <Suspense fallback={<div />}>
      <VeterinarioSignup />
    </Suspense>
  );
}
