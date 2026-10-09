import React from "react";
import styles from "../politica-de-privacidade/privacy.module.css";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso | Lince Pet",
  description: "Termos de Uso da plataforma Lince Pet.",
};

export default function TermosDeUso() {
  const currentDate = new Date().toLocaleDateString("pt-BR");

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Termos de Uso</h1>
      <p className={styles.lastUpdated}>Última atualização: {currentDate}</p>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Aceitação dos Termos</h2>
        <p className={styles.paragraph}>
          Ao acessar e utilizar a plataforma Lince Pet, você concorda em cumprir e ficar vinculado a estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Descrição do Serviço</h2>
        <p className={styles.paragraph}>
          O Lince Pet é uma plataforma que conecta tutores de animais de estimação a clínicas veterinárias e profissionais do setor, facilitando agendamentos e a comunicação através da nossa plataforma e integrações com o WhatsApp.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Responsabilidades do Usuário</h2>
        <p className={styles.paragraph}>
          Ao utilizar nossa plataforma, você se compromete a:
        </p>
        <ul className={styles.list}>
          <li className={styles.listItem}>Fornecer informações verdadeiras e exatas no momento do cadastro.</li>
          <li className={styles.listItem}>Manter a confidencialidade das credenciais de acesso à sua conta.</li>
          <li className={styles.listItem}>Não utilizar a plataforma para fins ilegais ou não autorizados.</li>
          <li className={styles.listItem}>Respeitar os horários agendados e as políticas de cancelamento das clínicas parceiras.</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>4. Integrações de Terceiros e APIs (Google e WhatsApp)</h2>
        <p className={styles.paragraph}>
          Nossos serviços utilizam integrações com plataformas de terceiros, como a API do Google (Google Calendário) e do WhatsApp (Meta):
        </p>
        <ul className={styles.list}>
          <li className={styles.listItem}>
            <strong>Google:</strong> A integração com o Google Calendário permite a sincronização de agendas. O uso e a transferência de informações recebidas das APIs do Google estão de acordo com a <a href="/politica-de-privacidade" className={styles.link}>Política de Privacidade</a> do Lince Pet e as políticas do próprio Google.
          </li>
          <li className={styles.listItem}>
            <strong>WhatsApp:</strong> Ao aceitar receber notificações, mensagens automáticas de lembretes poderão ser enviadas para o seu número cadastrado.
          </li>
        </ul>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>5. Modificações no Serviço e nos Termos</h2>
        <p className={styles.paragraph}>
          Reservamo-nos o direito de modificar ou descontinuar a plataforma, a qualquer momento, sem aviso prévio. Também podemos revisar estes Termos de Uso periodicamente; as mudanças entrarão em vigor assim que publicadas nesta página.
        </p>
      </div>

      <div className={styles.contactBox}>
        <h2 className={styles.sectionTitle} style={{marginTop: 0}}>Dúvidas?</h2>
        <p className={styles.paragraph}>
          Se você tiver alguma dúvida sobre estes Termos de Uso, entre em contato conosco através do email:
        </p>
        <p className={styles.paragraph}>
          <strong>Email:</strong> contato@lincepet.com.br
        </p>
      </div>
    </div>
  );
}
