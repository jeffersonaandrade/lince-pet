import type { Metadata } from "next";
import { LinkTexto, PaginaInstitucional, Paragrafo, Secao } from "@/components/Institucional/PaginaInstitucional";

export const metadata: Metadata = {
  title: "Central de Ajuda | Lince Pet",
  description: "Perguntas frequentes para tutores, veterinários e clínicas.",
};

const FAQ = [
  {
    id: "tutor",
    titulo: "Tutores",
    perguntas: [
      ["Preciso pagar para usar a Lince Pet?", "Não. Para tutores, buscar profissionais e agendar consultas é gratuito. O valor da consulta é combinado com o profissional e aparece antes de confirmar."],
      ["Como cancelo ou remarco uma consulta?", "No seu painel, abra a consulta e escolha cancelar ou reagendar. O profissional é avisado automaticamente."],
      ["Onde vejo o histórico do meu pet?", "Em Meus Pets, clique em Prontuário para ver os registros de todas as consultas."],
      ["Como deixo de receber avisos por WhatsApp?", "Em Perfil > Notificações, desmarque a opção de WhatsApp. O e-mail continua ativo."],
    ],
  },
  {
    id: "veterinario",
    titulo: "Veterinários",
    perguntas: [
      ["Como meu perfil aparece na busca?", "Depois de concluir o cadastro (CRMV, locais, horários e valores), seu perfil fica disponível em Explorar."],
      ["Posso bloquear horários?", "Sim. Na agenda, use o bloqueio de horários para um dia, um período ou toda semana."],
      ["Quem vê minhas anotações?", "As anotações privadas são só suas. O registro clínico fica no prontuário, visível ao tutor e aos profissionais que atendem o pet."],
      ["Como mudo de plano?", "No painel, acesse Alterar plano. Veja os valores em Preços."],
    ],
  },
  {
    id: "clinica",
    titulo: "Clínicas",
    perguntas: [
      ["Como adiciono veterinários à equipe?", "No painel da clínica, busque o profissional e envie o convite. Ele aparece na equipe depois de aceitar."],
      ["Remover um veterinário apaga a conta dele?", "Não. Só desfaz o vínculo com a clínica; a conta e o histórico do profissional continuam."],
      ["Quantos veterinários posso ter?", "Depende do plano. Veja os limites em Preços."],
    ],
  },
] as const;

export default function AjudaPage() {
  return (
    <PaginaInstitucional titulo="Central de Ajuda" subtitulo="Perguntas frequentes por perfil.">
      {FAQ.map((grupo) => (
        <Secao key={grupo.id} id={grupo.id} titulo={grupo.titulo}>
          <div className="flex flex-col gap-3">
            {grupo.perguntas.map(([pergunta, resposta]) => (
              <details key={pergunta} className="group rounded-xl border border-solid border-gray-200 bg-white px-5 py-4">
                <summary className="cursor-pointer list-none font-semibold text-slate-700 marker:hidden">
                  <span className="mr-2 inline-block text-[var(--primary)] transition-transform group-open:rotate-90">›</span>
                  {pergunta}
                </summary>
                <p className="m-0 mt-3 leading-7 text-slate-600">{resposta}</p>
              </details>
            ))}
          </div>
        </Secao>
      ))}
      <Paragrafo>
        Não encontrou sua resposta? <LinkTexto href="/contato">Fale com a gente</LinkTexto>.
      </Paragrafo>
    </PaginaInstitucional>
  );
}
