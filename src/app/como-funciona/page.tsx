import type { Metadata } from "next";
import { BotaoCta, PaginaInstitucional, Secao } from "@/components/Institucional/PaginaInstitucional";

export const metadata: Metadata = {
  title: "Como funciona | Lince Pet",
  description: "Passo a passo da Lince Pet para tutores, veterinários e clínicas.",
};

const PERFIS = [
  {
    id: "tutor",
    titulo: "Para tutores",
    passos: [
      "Busque veterinários e clínicas por cidade, especialidade ou atendimento online.",
      "Escolha o local, o dia e o horário disponível e cadastre seu pet.",
      "Receba a confirmação e os lembretes da consulta.",
      "Depois do atendimento, consulte o prontuário do pet e avalie o profissional.",
    ],
  },
  {
    id: "veterinario",
    titulo: "Para veterinários",
    passos: [
      "Crie sua conta e informe seu CRMV.",
      "Cadastre seus locais de atendimento, horários e valores (presencial, domicílio ou online).",
      "Receba agendamentos, bloqueie horários quando precisar e registre cada atendimento.",
      "Escolha um plano para ganhar destaque na busca e recursos extras.",
    ],
  },
  {
    id: "clinica",
    titulo: "Para clínicas",
    passos: [
      "Cadastre a clínica com endereço, fotos e especialidades.",
      "Convide veterinários para a sua equipe.",
      "Acompanhe a agenda e as consultas da equipe em um só painel.",
      "Escolha o plano conforme o tamanho da equipe.",
    ],
  },
];

export default function ComoFuncionaPage() {
  return (
    <PaginaInstitucional titulo="Como funciona" subtitulo="Do primeiro clique à consulta, em poucos passos.">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {PERFIS.map((perfil) => (
          <Secao key={perfil.id} id={perfil.id} titulo={perfil.titulo}>
            <ol className="m-0 flex list-none flex-col gap-4 p-0">
              {perfil.passos.map((passo, i) => (
                <li key={i} className="flex gap-3 text-slate-600">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] font-semibold text-[var(--primary)]">
                    {i + 1}
                  </span>
                  <span className="leading-7">{passo}</span>
                </li>
              ))}
            </ol>
          </Secao>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <BotaoCta href="/explorar">Encontrar veterinário</BotaoCta>
        <BotaoCta href="/signup">Criar conta</BotaoCta>
      </div>
    </PaginaInstitucional>
  );
}
