"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { tutorSignup, login as authLogin } from "@/services/auth/auth";
import { handleApiError, type ErrorState } from "@/utils/errorHandler";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateToISO } from "@/utils/formatters";
import CustomSelect from "@/components/ui/CustomSelect/CustomSelect";
import MiniCalendar from "@/components/MiniCalendar/MiniCalendar";
import styles from "./tutor-signup.module.css";

export default function TutorSignup() {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    nome: "",
    sobrenome: "",
    dataNascimento: "",
    sexo: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!validateAge(formData.dataNascimento)) {
      setError({
        message: "Você deve ter pelo menos 18 anos para se cadastrar.",
        fieldErrors: {
          dataNascimento: "Você deve ter pelo menos 18 anos.",
        },
      });
      setIsLoading(false);
      return;
    }

    try {
      await tutorSignup(formData);
      const loginResponse = await authLogin({
        email: formData.email,
        password: formData.password,
      });
      login({ ...loginResponse.user, userType: "tutor" });
      router.push("/");
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // TODO: Implementar login/cadastro com Google
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const validateAge = (birthDate: string): boolean => {
    if (!birthDate) return false;

    const today = new Date();
    const birth = new Date(birthDate);
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      return age - 1 >= 18;
    }

    return age >= 18;
  };

  const getMaxDate = (): string => {
    const today = new Date();
    return formatDateToISO(today);
  };

  return (
    <div className={styles.container}>
      <div className={styles.contentWrapper}>
        <div className={styles.formWrapper}>
          <h1 className={styles.title}>Crie uma conta</h1>

          {error && (
            <div className={styles.errorContainer}>
              <p className={styles.errorMessage}>{error.message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={handleInputChange}
                className={`${styles.input} ${error?.fieldErrors?.email ? styles.inputError : ""
                  }`}
                required
              />
              {error?.fieldErrors?.email && (
                <span className={styles.fieldError}>
                  {error.fieldErrors!.email}
                </span>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password" className={styles.label}>
                Senha
              </label>
              <div className={styles.passwordContainer}>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`${styles.input} ${error?.fieldErrors?.password ? styles.inputError : ""
                    }`}
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
              {error?.fieldErrors?.password && (
                <span className={styles.fieldError}>
                  {error.fieldErrors!.password}
                </span>
              )}
            </div>

            <div className={styles.inputRow}>
              <div className={styles.inputGroup}>
                <label htmlFor="nome" className={styles.label}>
                  Nome
                </label>
                <input
                  type="text"
                  id="nome"
                  name="nome"
                  placeholder="Insira seu nome"
                  value={formData.nome}
                  onChange={handleInputChange}
                  className={`${styles.input} ${error?.fieldErrors?.nome ? styles.inputError : ""
                    }`}
                  required
                />
                {error?.fieldErrors?.nome && (
                  <span className={styles.fieldError}>
                    {error.fieldErrors!.nome}
                  </span>
                )}
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="sobrenome" className={styles.label}>
                  Sobrenome
                </label>
                <input
                  type="text"
                  id="sobrenome"
                  name="sobrenome"
                  placeholder="Insira seu sobrenome"
                  value={formData.sobrenome}
                  onChange={handleInputChange}
                  className={`${styles.input} ${error?.fieldErrors?.sobrenome ? styles.inputError : ""
                    }`}
                  required
                />
                {error?.fieldErrors?.sobrenome && (
                  <span className={styles.fieldError}>
                    {error.fieldErrors!.sobrenome}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="dataNascimento" className={styles.label}>
                Data de Nascimento
              </label>
              <div className={styles.datePickerContainer}>
                <input
                  type="text"
                  id="dataNascimento"
                  name="dataNascimento"
                  value={formData.dataNascimento ? formData.dataNascimento.split("-").reverse().join("/") : ""}
                  onClick={() => setShowDatePicker(true)}
                  readOnly
                  placeholder="dd/mm/aaaa"
                  className={`${styles.input} ${error?.fieldErrors?.dataNascimento ? styles.inputError : ""
                    }`}
                  style={{ cursor: "pointer", caretColor: "transparent" }}
                />
                {showDatePicker && (
                  <div className={styles.datePickerPopover}>
                    <MiniCalendar
                      selectedDate={formData.dataNascimento ? new Date(formData.dataNascimento + "T12:00:00") : null}
                      onSelect={(isoDate) => {
                        setFormData((prev) => ({ ...prev, dataNascimento: isoDate }));
                        setShowDatePicker(false);
                      }}
                      onClose={() => setShowDatePicker(false)}
                      maxDate={getMaxDate()}
                      showYearPicker={true}
                    />
                  </div>
                )}
              </div>
              {error?.fieldErrors?.dataNascimento && (
                <span className={styles.fieldError}>
                  {error.fieldErrors!.dataNascimento}
                </span>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="sexo" className={styles.label}>
                Sexo
              </label>
              <CustomSelect
                options={[
                  { value: "masculino", label: "Masculino" },
                  { value: "feminino", label: "Feminino" },
                  { value: "outro", label: "Outro" }
                ]}
                value={formData.sexo || null}
                onChange={(val) => {
                  setFormData((prev) => ({ ...prev, sexo: val }));
                }}
                placeholder="Selecione"
              />
              {error?.fieldErrors?.sexo && (
                <span className={styles.fieldError}>
                  {error.fieldErrors!.sexo}
                </span>
              )}
            </div>

            <button
              type="submit"
              className={styles.continueButton}
              disabled={isLoading}
            >
              {isLoading ? "Criando conta..." : "Continuar"}
            </button>
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
