"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api, API_BASE_URL } from "@/hook/api";
import styles from "./social.module.css";

function SocialSignupContent() {
  const searchParams = useSearchParams();
  

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("outro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const emailParam = searchParams.get("email");
    const nameParam = searchParams.get("name");
    
    if (emailParam) setEmail(emailParam);
    if (nameParam) setName(nameParam);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Generate a random secure password for social users
      // This is a workaround since our backend requires a password
      const password = Math.random().toString(36).slice(-8) + "LincePt1$";

      await api.post("/tutor/register", {
        email,
        nome: name,
        password,
        dataNascimento: birthDate,
        genero: gender,
      });

      // Redirect to Google Auth to login automatically with the new account
      window.location.href = `${API_BASE_URL}/auth/google/redirect`;

    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.message || 
        (err.response?.data?.errors ? JSON.stringify(err.response?.data?.errors) : "Erro ao criar conta.")
      );
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <h1 className={styles.title}>Finalizar Cadastro</h1>
          <p className={styles.subtitle}>
            Complete suas informações para acessar o Lince Pet
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.errorMessage}>{error}</div>}
          
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              readOnly
              className={styles.input}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="name" className={styles.label}>
              Nome
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="birthDate" className={styles.label}>
              Data de Nascimento
            </label>
            <input
              type="date"
              id="birthDate"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="gender" className={styles.label}>
              Gênero
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={styles.select}
              required
            >
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? "Criando conta..." : "Criar Conta e Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SocialSignupPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <SocialSignupContent />
    </Suspense>
  );
}
