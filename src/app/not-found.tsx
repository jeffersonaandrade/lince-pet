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
        Parece que a página que você está procurando não existe ou ainda está em desenvolvimento...
        Volte para a página inicial ou tente novamente mais tarde.
      </p>
      <Link href="/" className={styles.button}>
        <MoveLeft size={16} />
        Voltar para o Início
      </Link>
    </div>
  );
}
