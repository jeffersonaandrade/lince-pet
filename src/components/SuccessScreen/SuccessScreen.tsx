"use client";

import Link from "next/link";
import styles from "./success.module.css";
import { useState, useEffect } from "react";
import SuccessAnimation from "../SucessAnimation/successAnimation.jsx";
import LoadingAnimation from "../LoadingAnimation/loadingAnimation.jsx";

type Props = {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  onButtonClick?: () => void;
  linkHref?: string;
};

export default function SuccessScreen({
  title = "Agendamento confirmado",
  subtitle = "Seu agendamento foi realizado com sucesso. Enviaremos uma confirmação para seu e-mail e entraremos em contato caso seja necessário reagendar.",
  buttonText = "Voltar para meus agendamentos",
  onButtonClick,
  linkHref = "/explorar",
}: Props) {
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsProcessing(false); // Muda o estado após 2 segundos
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        {isProcessing ? (
          // LADO DO LOADING
          <div>
            <div className={styles.iconWrap} aria-hidden>
              <LoadingAnimation />
            </div>
            <h2 className={styles.title}>Processando...</h2>
          </div>
        ) : (
          // LADO DO SUCESSO
          <div>
            <div className={styles.iconWrap} aria-hidden>
              <SuccessAnimation />
            </div>

            <h2 className={styles.title}>{title}</h2>
            <p className={styles.subtitle}>{subtitle}</p>

            <div className={styles.actions}>
              {onButtonClick ? (
                <button className={styles.primaryBtn} onClick={onButtonClick}>
                  {buttonText}
                </button>
              ) : (
                <Link href={linkHref} className={styles.primaryBtn}>
                  {buttonText}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
