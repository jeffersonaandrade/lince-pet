"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { handleApiError, type ErrorState } from "@/utils/errorHandler";
import { formatPhone, removeMask } from "@/utils/formatters";
import { veterinarioSignup } from "@/services/veterinarios/veterinarios";
import { login as authLogin } from "@/services/auth/auth";
import { useAuth } from "@/contexts/AuthContext";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import styles from "../veterinario-signup.module.css";
import Image from "next/image";
import { EscolhaPlanoCadastro, ConfirmarPlanoCadastro } from "@/components/Assinatura/PlanoCadastro";
import type { PlanoBackend } from "@/services/assinaturas/assinaturas";

export default function VeterinarioSignup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [plano, setPlano] = useState<PlanoBackend | null>(null);
  const [contaCriada, setContaCriada] = useState(false);
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

  // Links antigos de troca de plano (?step=4 / ?changePlan=1) vão para a tela de planos.
  const changePlanMode =
    (searchParams?.get("step") === "4" || searchParams?.get("changePlan") === "1") &&
    user?.userType === "veterinario";

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);

  useEffect(() => {
    if (changePlanMode) router.replace("/dashboard/veterinario/alterar-plano");
  }, [changePlanMode, router]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

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
        return formData.email && formData.senha && plano;
      default:
        return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plano || contaCriada) return;
    setIsLoading(true);
    setError(null);

    try {
      const { senha, ...dados } = formData;

      await veterinarioSignup({
        ...dados,
        celular: removeMask(formData.celular),
        cep: removeMask(formData.cep),
        password: senha,
        cpf: formData.cpf ? removeMask(formData.cpf) : undefined,
      });

      const loginResponse = await authLogin({
        email: formData.email,
        password: senha,
      });

      login({
        ...loginResponse.user,
        userType: "veterinario",
      });

      if (plano.priceCents > 0) setContaCriada(true);
      else router.push("/onboarding");
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

  return (
    <div className={styles.container}>
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
          {currentStep === 1 ? "Conte-nos sobre você" : "Finalize seu cadastro"}
        </h1>
        <p
          key={`desc-${currentStep}`}
          className={`${styles.leftDescription} ${styles.fadeText}`}
        >
          {currentStep === 1
            ? "Conecte-se com tutores que procuram atendimento veterinário de qualidade. Receba novos pacientes que precisam dos seus cuidados especializados."
            : "Torne fácil para tutores encontrarem e agendarem com você online. Apareça nos resultados de busca e simplifique o processo de marcação. Você pode adicionar outros endereços depois no seu perfil."}
        </p>
      </div>
      <div className={styles.rightSection}>
        <div className={styles.formWrapper}>
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

          {contaCriada && plano ? <ConfirmarPlanoCadastro plano={plano} onContinuar={() => router.push("/onboarding")} /> : <form
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

            {currentStep === 2 && (
              <>
                <EscolhaPlanoCadastro tipo="veterinario" selecionado={plano} onEscolha={setPlano} />
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
                    required={!!plano?.priceCents}
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
                    : plano?.priceCents ? "Criar conta e revisar Pro" : "Criar conta gratuita"
                  : "Continuar"}
              </button>
            </div>
          </form>}

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
    </div>
  );
}
