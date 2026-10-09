import type { Metadata } from "next";
import { Lista, LinkTexto, PaginaInstitucional, Paragrafo, Secao } from "@/components/Institucional/PaginaInstitucional";

export const metadata: Metadata = {
  title: "Segurança | Lince Pet",
  description: "Como a Lince Pet protege seus dados, pagamentos e verifica profissionais.",
};

export default function SegurancaPage() {
  return (
    <PaginaInstitucional titulo="Segurança" subtitulo="Cuidamos dos seus dados com a mesma atenção que você dá ao seu pet.">
      <Secao titulo="Proteção de dados">
        <Lista
          itens={[
            "Tratamos dados pessoais conforme a LGPD, apenas para operar a plataforma.",
            "Senhas são armazenadas com criptografia e a sessão usa cookie protegido (httpOnly).",
            "Anotações privadas do veterinário são visíveis só para ele; o prontuário é visível ao tutor e aos profissionais que atendem o pet.",
          ]}
        />
        <Paragrafo>
          Detalhes na <LinkTexto href="/politica-de-privacidade">Política de Privacidade</LinkTexto>.
        </Paragrafo>
      </Secao>

      <Secao titulo="Pagamentos">
        <Paragrafo>
          As assinaturas são processadas por um parceiro de pagamentos certificado (Asaas). A Lince Pet não armazena os dados do
          seu cartão.
        </Paragrafo>
      </Secao>

      <Secao titulo="Verificação de profissionais">
        <Paragrafo>
          Todo veterinário informa o CRMV no cadastro e o número fica visível no perfil público. Desconfie de pedidos de pagamento
          fora da plataforma e, em caso de suspeita, <LinkTexto href="/contato">fale com a gente</LinkTexto>.
        </Paragrafo>
      </Secao>
    </PaginaInstitucional>
  );
}
