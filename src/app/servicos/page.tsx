import type { Metadata } from "next";
import { prisma } from "@/server/db";
import { BotaoCta, Card, Grade, PaginaInstitucional, Paragrafo, Secao } from "@/components/Institucional/PaginaInstitucional";

export const metadata: Metadata = {
  title: "Serviços | Lince Pet",
  description: "Especialidades e tipos de atendimento veterinário disponíveis na Lince Pet.",
};

export const revalidate = 3600;

async function especialidades(): Promise<string[]> {
  try {
    const rows = await prisma.especialidade.findMany({
      where: { OR: [{ ativo: 1 }, { ativo: null }] },
      select: { nome: true },
      orderBy: { nome: "asc" },
    });
    return rows.map((r) => r.nome);
  } catch (error) {
    console.error("[Serviços] Falha ao carregar especialidades:", (error as Error).message);
    return [];
  }
}

export default async function ServicosPage() {
  const lista = await especialidades();

  return (
    <PaginaInstitucional titulo="Serviços" subtitulo="Atendimento veterinário do jeito que funciona melhor para você e seu pet.">
      <Secao titulo="Tipos de atendimento">
        <Grade>
          <Card titulo="Presencial">
            <Paragrafo>Consulta no consultório ou na clínica do veterinário, com endereço e horários informados no perfil.</Paragrafo>
          </Card>
          <Card titulo="Domicílio">
            <Paragrafo>O veterinário vai até a sua casa, ideal para pets idosos, ansiosos ou com dificuldade de locomoção.</Paragrafo>
          </Card>
          <Card titulo="Online">
            <Paragrafo>Teleconsulta para orientações, retornos e acompanhamento, sem sair de casa.</Paragrafo>
          </Card>
        </Grade>
      </Secao>

      <Secao titulo="Especialidades">
        {lista.length ? (
          <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
            {lista.map((nome) => (
              <li key={nome} className="rounded-full bg-[var(--primary-light)] px-4 py-2 text-sm font-medium text-[var(--primary-dark)]">
                {nome}
              </li>
            ))}
          </ul>
        ) : (
          <Paragrafo>Clínica geral, dermatologia, cardiologia, ortopedia e muito mais. Veja os profissionais disponíveis na busca.</Paragrafo>
        )}
      </Secao>

      <div className="text-center">
        <BotaoCta href="/explorar">Encontrar profissionais</BotaoCta>
      </div>
    </PaginaInstitucional>
  );
}
