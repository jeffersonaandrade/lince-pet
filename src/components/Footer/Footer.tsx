import Link from "next/link";
import { SITE } from "@/config/site";
import styles from "./footer.module.css";

const GRUPOS = [
  {
    titulo: "Plataforma",
    links: [
      { href: "/como-funciona", label: "Como Funciona" },
      { href: "/explorar", label: "Veterinários" },
      { href: "/servicos", label: "Serviços" },
      { href: "/precos", label: "Preços" },
    ],
  },
  {
    titulo: "Suporte",
    links: [
      { href: "/ajuda", label: "Central de Ajuda" },
      { href: "/contato", label: "Contato" },
      { href: "/seguranca", label: "Segurança" },
    ],
  },
  {
    titulo: "Legal",
    links: [
      { href: "/termos-de-uso", label: "Termos de Uso" },
      { href: "/politica-de-privacidade", label: "Política de Privacidade" },
      { href: "/cookies", label: "Cookies" },
    ],
  },
];

const REDES = [
  {
    nome: "Instagram",
    url: SITE.redes.instagram,
    path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  },
  {
    nome: "X",
    url: SITE.redes.x,
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
].filter((rede) => rede.url);

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContainer}>
        <div className={styles.footerContent}>
          <div className={styles.logoSection}>
            <h3 className={styles.logo}>Lince Pet</h3>
            <p className={styles.description}>
              Conectando pets a veterinários e clínicas em toda sua região.
            </p>
          </div>

          <div className={styles.linksSection}>
            {GRUPOS.map((grupo) => (
              <div key={grupo.titulo} className={styles.linkGroup}>
                <h4 className={styles.linkTitle}>{grupo.titulo}</h4>
                <ul className={styles.linkList}>
                  {grupo.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={styles.link}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} Lince Pet. Todos os direitos reservados.
          </p>
          {REDES.length > 0 && (
            <div className={styles.socialLinks}>
              {REDES.map((rede) => (
                <a
                  key={rede.nome}
                  href={rede.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Lince Pet no ${rede.nome}`}
                  className={styles.socialLink}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d={rede.path} />
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
