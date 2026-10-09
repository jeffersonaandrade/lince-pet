import type { Metadata } from "next";
import { Card, Grade, LinkTexto, PaginaInstitucional, Paragrafo } from "@/components/Institucional/PaginaInstitucional";
import { SITE, linkWhatsapp } from "@/config/site";

export const metadata: Metadata = {
  title: "Contato | Lince Pet",
  description: "Fale com o suporte da Lince Pet por e-mail ou WhatsApp.",
};

const linkExterno = "font-medium text-[var(--primary)] no-underline hover:underline break-all";

export default function ContatoPage() {
  const whatsapp = linkWhatsapp(SITE.whatsapp);

  return (
    <PaginaInstitucional titulo="Contato" subtitulo="Estamos aqui para ajudar tutores, veterinários e clínicas.">
      <Grade>
        <Card titulo="E-mail">
          <Paragrafo>
            {SITE.email ? (
              <a href={`mailto:${SITE.email}`} className={linkExterno}>
                {SITE.email}
              </a>
            ) : (
              "Em breve."
            )}
          </Paragrafo>
        </Card>
        <Card titulo="WhatsApp">
          <Paragrafo>
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={linkExterno}>
                Conversar pelo WhatsApp
              </a>
            ) : (
              "Em breve."
            )}
          </Paragrafo>
        </Card>
        <Card titulo="Horário de atendimento">
          <Paragrafo>{SITE.horarioAtendimento}</Paragrafo>
        </Card>
      </Grade>

      <Paragrafo>
        Antes de escrever, veja se sua dúvida já está respondida na <LinkTexto href="/ajuda">Central de Ajuda</LinkTexto>.
      </Paragrafo>
    </PaginaInstitucional>
  );
}
