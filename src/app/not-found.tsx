import Link from "next/link";
import { MoveLeft } from "lucide-react";
import styles from "./NotFound.module.css";

export default function NotFound() {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>
        Página não encontrada
      </h2>
      <p className={styles.description}>
        O link pode estar errado ou a página foi removida. Confira o endereço ou siga por um dos caminhos abaixo.
      </p>
      <Link href="/" className={styles.button}>
        <MoveLeft size={16} />
        Voltar para o Início
      </Link>
      <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
        <Link href="/explorar" className="font-medium text-[var(--primary)] hover:underline">
          Encontrar veterinário
        </Link>
        <Link href="/ajuda" className="font-medium text-[var(--primary)] hover:underline">
          Central de Ajuda
        </Link>
      </div>
    </div>
  );
}
