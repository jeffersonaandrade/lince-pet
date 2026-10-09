"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./forgot.module.css";
import { forgotPassword } from "@/services/auth/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const result = await forgotPassword(email);
      setSuccess(result.message || "um link de recuperação foi enviado para sua caixa de Email.");
    } catch (err: any) {
      setError(err.response?.data?.message || "Ocorreu um erro. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <h1 className={styles.title}>Esqueci minha senha</h1>
          <p className={styles.subtitle}>
            Digite seu e-mail para receber um link de recuperação.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.errorMessage}>{error}</div>}
          {success && <div className={styles.successMessage}>{success}</div>}

          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="seu@email.com"
              required
            />
          </div>

          <button
            type="submit"
            className={styles.loginButton}
            disabled={loading || !!success}
          >
            {loading ? "Enviando..." : "Enviar link de recuperação"}
          </button>
        </form>

        <div className={styles.signupSection}>
          <p className={styles.signupText}>
            Lembrou a senha?{" "}
            <Link href="/login" className={styles.signupLink}>
              Voltar ao login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
