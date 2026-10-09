"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { login as authLogin } from "@/services/auth/auth";
import { PrestadoresService, type TipoServico } from "@/services/prestadores/prestadores";
import { handleApiError, type ErrorState } from "@/utils/errorHandler";
import { useAuth } from "@/contexts/AuthContext";
import { Alerta, Campo, Entrada, botaoPrimario } from "@/components/Prestador/ui";

const VAZIO = { email: "", password: "", nome: "", sobrenome: "", celular: "", documento: "" };

export default function PrestadorSignup() {
  const router = useRouter();
  const { login } = useAuth();
  const [tipos, setTipos] = useState<TipoServico[]>([]);
  const [tipo, setTipo] = useState("");
  const [form, setForm] = useState(VAZIO);
  const [verSenha, setVerSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErrorState | null>(null);

  useEffect(() => {
    PrestadoresService.tiposServico()
      .then(setTipos)
      .catch(() => setErro({ message: "Não foi possível carregar os tipos de serviço." }));
  }, []);

  const alterar = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((atual) => ({ ...atual, [e.target.name]: e.target.value }));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo) return setErro({ message: "Escolha o tipo de serviço que você oferece." });
    setEnviando(true);
    setErro(null);
    const digitos = form.documento.replace(/\D/g, "");
    try {
      await PrestadoresService.registrar({
        tipo_servico: tipo,
        email: form.email,
        password: form.password,
        nome: form.nome,
        sobrenome: form.sobrenome,
        celular: form.celular.replace(/\D/g, ""),
        ...(digitos.length === 14 ? { cnpj: digitos } : digitos ? { cpf: digitos } : {}),
      });
      const resposta = await authLogin({ email: form.email, password: form.password });
      login({ ...resposta.user, userType: "prestador" });
      router.push("/onboarding/prestador");
    } catch (err) {
      setErro(handleApiError(err));
    } finally {
      setEnviando(false);
    }
  };

  const campoErro = (nome: string) => erro?.fieldErrors?.[nome];

  return (
    <main className="flex min-h-screen justify-center bg-slate-50 px-4 py-12">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Cadastro de profissional pet</h1>
          <p className="mt-2 text-sm text-slate-500">
            Escolha o seu serviço, crie a conta e, em seguida, monte seu perfil com preços e horários.
          </p>
        </header>

        <form onSubmit={enviar} className="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          {erro ? <Alerta>{erro.message}</Alerta> : null}

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold text-slate-700">Qual serviço você oferece?</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {tipos.map((t) => (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => setTipo(t.slug)}
                  aria-pressed={tipo === t.slug}
                  className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition ${
                    tipo === t.slug
                      ? "border-orange-400 bg-orange-50 ring-2 ring-orange-100"
                      : "border-slate-200 hover:border-orange-200"
                  }`}
                >
                  <span className="text-sm font-bold text-slate-800">{t.nome}</span>
                  {t.descricao ? <span className="text-xs text-slate-500">{t.descricao}</span> : null}
                  <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-orange-600">
                    {t.modalidade === "periodo" ? "Por diária" : "Por sessão"}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Nome" erro={campoErro("nome")}>
              <Entrada name="nome" value={form.nome} onChange={alterar} required invalido={!!campoErro("nome")} />
            </Campo>
            <Campo label="Sobrenome" erro={campoErro("sobrenome")}>
              <Entrada
                name="sobrenome"
                value={form.sobrenome}
                onChange={alterar}
                required
                invalido={!!campoErro("sobrenome")}
              />
            </Campo>
          </div>

          <Campo label="E-mail" erro={campoErro("email")}>
            <Entrada
              type="email"
              name="email"
              value={form.email}
              onChange={alterar}
              placeholder="seu@email.com"
              required
              invalido={!!campoErro("email")}
            />
          </Campo>

          <Campo label="Senha" erro={campoErro("password")} dica="Mínimo de 6 caracteres">
            <div className="relative">
              <Entrada
                type={verSenha ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={alterar}
                minLength={6}
                required
                invalido={!!campoErro("password")}
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setVerSenha((v) => !v)}
                aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {verSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Campo>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Celular (WhatsApp)" erro={campoErro("celular")}>
              <Entrada
                name="celular"
                value={form.celular}
                onChange={alterar}
                placeholder="(11) 91234-5678"
                inputMode="tel"
                required
                invalido={!!campoErro("celular")}
              />
            </Campo>
            <Campo label="CPF ou CNPJ (opcional)" erro={campoErro("cpf") || campoErro("cnpj")}>
              <Entrada name="documento" value={form.documento} onChange={alterar} inputMode="numeric" />
            </Campo>
          </div>

          <button type="submit" className={botaoPrimario} disabled={enviando}>
            {enviando ? "Criando conta..." : "Criar conta e montar perfil"}
          </button>

          <p className="text-center text-sm text-slate-500">
            Já tem uma conta?{" "}
            <Link href="/login" className="font-semibold text-orange-600 hover:underline">
              Entrar
            </Link>
          </p>
        </form>

        <p className="text-center text-xs text-slate-400">
          Ao continuar, você concorda com os{" "}
          <Link href="/termos-de-uso" className="underline">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link href="/politica-de-privacidade" className="underline">
            Política de Privacidade
          </Link>{" "}
          do Lince Pet.
        </p>
      </div>
    </main>
  );
}
