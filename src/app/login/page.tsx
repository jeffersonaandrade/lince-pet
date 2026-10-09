"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import styles from "./login.module.css";
import { login } from "@/services/auth/auth";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/hook/api";
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

          {/* <div className={styles.divider}>
            <span>ou</span>
          </div>

          <button
            type="button"
            className={styles.googleButton}
            onClick={() => {
              window.location.href = `${API_BASE_URL}/auth/google/redirect`;
            }}
          >
            <svg className={styles.googleIcon} viewBox="0 0 24 24">
              <path
                fill="#4285f4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34a853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#fbbc05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#ea4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar com Google
          </button> */}
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
