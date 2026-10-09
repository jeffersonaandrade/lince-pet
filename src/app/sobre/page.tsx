import type { Metadata } from "next";
import { BotaoCta, Card, Grade, PaginaInstitucional, Paragrafo, Secao } from "@/components/Institucional/PaginaInstitucional";

export const metadata: Metadata = {
  title: "Sobre | Lince Pet",
  description: "Quem somos, nossa missão e para quem é a plataforma Lince Pet.",
};

export default function SobrePage() {
  return (
    <PaginaInstitucional titulo="Sobre a Lince Pet" subtitulo="Conectamos tutores a veterinários e clínicas de confiança, do agendamento ao acompanhamento do pet.">
      <Secao titulo="Quem somos">
        <Paragrafo>
          A Lince Pet é uma plataforma brasileira que aproxima quem cuida de pets de quem precisa de cuidado. Em um só lugar, o
          tutor encontra profissionais, agenda consultas e acompanha o histórico do seu pet, enquanto veterinários e clínicas
          organizam a agenda e a relação com seus pacientes.
        </Paragrafo>
      </Secao>

      <Secao titulo="Nossa missão">
        <Paragrafo>
          Tornar o cuidado veterinário mais simples, acessível e transparente: menos ligações e planilhas, mais tempo para o que
          importa, que é a saúde dos animais.
        </Paragrafo>
      </Secao>

      <Secao titulo="Para quem é">
        <Grade>
          <Card titulo="Tutor">
            <Paragrafo>Encontre veterinários perto de você ou online, agende em poucos cliques e tenha o prontuário do pet sempre à mão.</Paragrafo>
          </Card>
          <Card titulo="Veterinário">
            <Paragrafo>Organize sua agenda em vários locais, receba agendamentos, registre atendimentos e seja encontrado por novos tutores.</Paragrafo>
          </Card>
          <Card titulo="Clínica">
            <Paragrafo>Gerencie sua equipe de veterinários, acompanhe a agenda da clínica e ganhe visibilidade na busca.</Paragrafo>
          </Card>
        </Grade>
      </Secao>

      <div className="text-center">
        <BotaoCta href="/signup">Criar minha conta</BotaoCta>
      </div>
    </PaginaInstitucional>
  );
}
