"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin/dashboard", nome: "Painel" },
  { href: "/admin/aprovacoes", nome: "Aprovações" },
  { href: "/admin/especialidades", nome: "Especialidades" },
  { href: "/admin/profissoes", nome: "Profissões" },
  { href: "/admin/planos-saude", nome: "Planos de saúde pet" },
  { href: "/admin/uso", nome: "Uso de dados" },
  { href: "/admin/recuperacoes", nome: "Recuperação de CNPJ" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administração" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {links.map(({ href, nome }) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}
          className={`rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${pathname === href ? "bg-orange-100 text-orange-800" : "text-slate-600 hover:bg-slate-100"}`}>
          {nome}
        </Link>
      ))}
    </nav>
  );
}
