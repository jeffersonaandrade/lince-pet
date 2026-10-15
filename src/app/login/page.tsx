"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import styles from "./login.module.css";
import { login } from "@/services/auth/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { login: setUser, checkAuth, user } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const result = await login({ email, password });
      if (result && result.user) {
        setUser(result.user);
        setSuccess("Login realizado com sucesso");
        // Buscar dados completos do usuário (incluindo foto) antes de redirecionar
        try {
          await checkAuth();
        } catch (e) {
          // Se falhar, não bloqueia o fluxo de login — apenas logamos para diagnóstico
          console.warn("checkAuth falhou após login:", e);
        }
        router.replace("/");
      }
    } catch (error) {
      setError("Credenciais inválidas. Tente novamente.");
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Se já estiver logado, redireciona para a home
  if (user) {
    // render vazio pois o replace já será feito no handleLogin ou no AuthProvider
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <h1 className={styles.title}>Entrar no Lince Pet</h1>
          <p className={styles.subtitle}>Faça login na sua conta</p>
        </div>

        <form onSubmit={handleLogin} className={styles.form}>
          {error && <div className={styles.errorMessage}>{error}</div>}
          {success && <div className={styles.successMessage}>{success}</div>}
          <div className={styles.inputRow}>
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

            <div className={styles.inputGroup}>
              <label htmlFor="password" className={styles.label}>
                Senha
              </label>
              <div className={styles.passwordContainer}>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <div className={styles.forgotPassword}>
                <Link href="/forgot-password" className={styles.forgotLink}>
                  Esqueceu sua senha?
                </Link>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className={styles.loginButton}
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className={styles.signupSection}>
          <p className={styles.signupText}>
            Não tem uma conta?{" "}
            <Link href="/signup" className={styles.signupLink}>
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
