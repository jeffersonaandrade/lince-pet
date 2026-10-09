import type { Metadata } from "next";
import { Lista, LinkTexto, PaginaInstitucional, Paragrafo, Secao } from "@/components/Institucional/PaginaInstitucional";

export const metadata: Metadata = {
  title: "Cookies | Lince Pet",
  description: "Quais cookies a Lince Pet usa e como gerenciá-los.",
};

export default function CookiesPage() {
  return (
    <PaginaInstitucional titulo="Política de Cookies" subtitulo="Usamos apenas os cookies necessários para a plataforma funcionar.">
      <Secao titulo="O que são cookies">
        <Paragrafo>
          Cookies são pequenos arquivos guardados pelo navegador. Eles permitem, por exemplo, que você continue conectado entre
          uma página e outra.
        </Paragrafo>
      </Secao>

      <Secao titulo="Cookies que usamos">
        <Lista
          itens={[
            <>
              <strong>Sessão (auth_token):</strong> mantém você conectado. É protegido (httpOnly) e não pode ser lido por scripts.
            </>,
            <>
              <strong>Login com Google:</strong> cookie temporário de segurança usado só durante a autorização com o Google.
            </>,
          ]}
        />
        <Paragrafo>Não usamos cookies de publicidade nem de rastreamento de terceiros.</Paragrafo>
      </Secao>

      <Secao titulo="Como gerenciar">
        <Paragrafo>
          Você pode apagar ou bloquear cookies nas configurações do navegador. Sem o cookie de sessão, não é possível permanecer
          conectado à sua conta.
        </Paragrafo>
        <Paragrafo>
          Saiba mais na <LinkTexto href="/politica-de-privacidade">Política de Privacidade</LinkTexto>.
        </Paragrafo>
      </Secao>
    </PaginaInstitucional>
  );
}
