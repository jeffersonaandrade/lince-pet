"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { fetchCep } from "@/services/external/brazilapi";
import { handleApiError, type ErrorState } from "@/utils/errorHandler";
import { formatCep, formatPhone, removeMask } from "@/utils/formatters";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/hook/api";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import styles from "./clinica-signup.module.css";
import Image from "next/image";

function ClinicaSignup() {
    const router = useRouter();
    const { login } = useAuth();
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        nomeFantasia: "",
        razaoSocial: "",
        cnpj: "",
        telefone: "",
        email: "",
        senha: "",
        cep: "",
        rua: "",
        bairro: "",
        cidade: "",
        estado: "",
        numero: "",
    });

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

    const formatCNPJ = (value: string) => {
        const numbers = value.replace(/\D/g, "");
        return numbers
            .replace(/(\d{2})(\d)/, "$1.$2")
            .replace(/(\d{3})(\d)/, "$1.$2")
            .replace(/(\d{3})(\d)/, "$1/$2")
            .replace(/(\d{4})(\d)/, "$1-$2")
            .substr(0, 18);
    };

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;

        if (name === "cep") {
            return;
        }

        if (name === "telefone") {
            const formattedPhone = formatPhone(value);
            setFormData((prev) => ({
                ...prev,
                [name]: formattedPhone,
            }));
            return;
        }

        if (name === "cnpj") {
            const formattedCNPJ = formatCNPJ(value);
            setFormData((prev) => ({
                ...prev,
                [name]: formattedCNPJ,
            }));
            return;
        }

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const nextStep = () => {
        if (currentStep < 3) {
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
                return formData.nomeFantasia && formData.razaoSocial && formData.cnpj && formData.telefone;
            case 2:
                return (
                    formData.cep &&
                    formData.rua &&
                    formData.bairro &&
                    formData.cidade &&
                    formData.estado &&
                    formData.numero
                );
            case 3:
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
              telefone: removeMask(formData.telefone),
              cep: removeMask(formData.cep),
              cnpj: removeMask(formData.cnpj),
              email: formData.email,
              senha: formData.senha,
            };

            const response = await fetch(`${API_BASE_URL}/clinicas/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(submitData),
            });

            const data = await response.json();

            if (!response.ok) {
                throw { status: response.status, message: data.message || 'Erro ao realizar cadastro' };
            }

            // Login local e redirecionamento
            login({
              ...data.user,
              userType: "clinica",
            });
            
            // Redireciona para dashboard ou onboarding da clínica
            router.push("/onboarding/clinica");

        } catch (err) {
            const errorState = handleApiError(err, {
                422: "CNPJ ou e-mail já está em uso.",
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
                    alt="Clinic Signup"
                    className={styles.leftImage}
                    width={220}
                    height={220}
                />
                <h1
                    key={`title-${currentStep}`}
                    className={`${styles.leftTitle} ${styles.fadeText}`}
                >
                    {currentStep === 1
                        ? "Conte-nos sobre sua clínica"
                        : currentStep === 2
                            ? "Onde sua clínica está localizada?"
                            : "Finalize seu cadastro"}
                </h1>
                <p
                    key={`desc-${currentStep}`}
                    className={`${styles.leftDescription} ${styles.fadeText}`}
                >
                    {currentStep === 1
                        ? "Conecte sua clínica com tutores que procuram atendimento veterinário de qualidade. Receba novos pacientes e gerencie sua equipe em um só lugar."
                        : currentStep === 2
                            ? "Torne fácil para tutores encontrarem e agendarem com sua clínica online. Apareça nos resultados de busca e simplifique o processo de marcação."
                            : "Economize tempo coletando informações essenciais dos tutores. Receba documentos dos pets e formulários antes mesmo da consulta."}
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
                        <p className={styles.userTypeText}>Cadastrando como Clínica</p>
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
                        <div className={styles.stepLine}></div>
                        <div
                            className={`${styles.stepDot} ${currentStep >= 3 ? styles.active : ""
                                }`}
                        >
                            3
                        </div>
                    </div>

                    <form
                        key={`form-step-${currentStep}`}
                        onSubmit={
                            currentStep === 3
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
                                <div className={styles.inputGroup}>
                                    <label htmlFor="nomeFantasia" className={styles.label}>
                                        Nome da Clinica
                                    </label>
                                    <input
                                        type="text"
                                        id="nomeFantasia"
                                        name="nomeFantasia"
                                        value={formData.nomeFantasia}
                                        onChange={handleInputChange}
                                        className={styles.input}
                                        placeholder="Como sua clínica é conhecida"
                                        required
                                    />
                                </div>

                                <div className={styles.inputGroup}>
                                    <label htmlFor="razaoSocial" className={styles.label}>
                                        Razão Social
                                    </label>
                                    <input
                                        type="text"
                                        id="razaoSocial"
                                        name="razaoSocial"
                                        value={formData.razaoSocial}
                                        onChange={handleInputChange}
                                        className={styles.input}
                                        placeholder="Nome jurídico da empresa"
                                        required
                                    />
                                </div>

                                <div className={styles.inputRow}>
                                    <div className={styles.inputGroup}>
                                        <label htmlFor="cnpj" className={styles.label}>
                                            CNPJ
                                        </label>
                                        <input
                                            type="text"
                                            id="cnpj"
                                            name="cnpj"
                                            value={formData.cnpj}
                                            onChange={handleInputChange}
                                            placeholder="00.000.000/0000-00"
                                            maxLength={18}
                                            className={styles.input}
                                            required
                                        />
                                    </div>

                                    <div className={styles.inputGroup}>
                                        <label htmlFor="telefone" className={styles.label}>
                                            Telefone
                                            <Tooltip text="Telefone principal da clínica para contato." />
                                        </label>
                                        <input
                                            type="tel"
                                            id="telefone"
                                            name="telefone"
                                            value={formData.telefone}
                                            onChange={handleInputChange}
                                            placeholder="(11) 99999-9999"
                                            maxLength={15}
                                            className={styles.input}
                                            required
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {currentStep === 2 && (
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
                                        className={`${styles.input} ${isLoadingCep ? styles.loading : ""
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
                        )}

                        {currentStep === 3 && (
                            <>
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
                                        placeholder="contato@clinica.com"
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
                                            placeholder="Mínimo 6 caracteres"
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
                                disabled={!isStepValid() || (currentStep === 3 && isLoading)}
                            >
                                {currentStep === 3
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
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<div />}>
            <ClinicaSignup />
        </Suspense>
    );
}
