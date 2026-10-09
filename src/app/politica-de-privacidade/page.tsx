import React from "react";
import styles from "./privacy.module.css";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade | Lince Pet",
  description: "Política de privacidade e termos de uso do Lince Pet.",
};

export default function PrivacyPolicy() {
  const currentDate = new Date().toLocaleDateString("pt-BR");

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Política de Privacidade</h1>
      <p className={styles.lastUpdated}>Última atualização: {currentDate}</p>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Introdução</h2>
        <p className={styles.paragraph}>
          Bem-vindo ao Lince Pet. Sua privacidade é muito importante para nós. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais ao utilizar nossa plataforma e serviços.
        </p>
        <p className={styles.paragraph}>
          Ao acessar ou utilizar nossos serviços, você concorda com as práticas descritas nesta política.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Informações que Coletamos</h2>
        <p className={styles.paragraph}>
          Coletamos informações para fornecer melhores serviços a todos os nossos usuários. As informações coletadas incluem:
        </p>
        <ul className={styles.list}>
          <li className={styles.listItem}>
            <strong>Informações de Cadastro:</strong> Nome, endereço de e-mail, número de telefone e senha para criação de conta.
          </li>
          <li className={styles.listItem}>
            <strong>Dados de Uso:</strong> Informações sobre como você interage com nossos serviços, horários de acesso e funcionalidades utilizadas.
          </li>
          <li className={styles.listItem}>
            <strong>Dados de Agendamento:</strong> Detalhes sobre consultas, horários e preferências de serviços veterinários.
          </li>
        </ul>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Uso das Informações</h2>
        <p className={styles.paragraph}>
          Utilizamos as informações coletadas para:
        </p>
        <ul className={styles.list}>
          <li className={styles.listItem}>Fornecer, operar e manter nossos serviços;</li>
          <li className={styles.listItem}>Melhorar, personalizar e expandir nossa plataforma;</li>
          <li className={styles.listItem}>Entender e analisar como você utiliza nossos serviços;</li>
          <li className={styles.listItem}>Desenvolver novos produtos, serviços, recursos e funcionalidades;</li>
          <li className={styles.listItem}>Comunicar com você, diretamente ou através de um dos nossos parceiros, para atendimento ao cliente e atualizações;</li>
          <li className={styles.listItem}>Processar agendamentos e transações relacionadas.</li>
        </ul>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>4. Integração com API do WhatsApp</h2>
        <p className={styles.paragraph}>
          O Lince Pet utiliza a API Oficial do WhatsApp Business (fornecida pela Meta) para facilitar a comunicação e agendamentos. Ao utilizar nossos serviços, você concorda que:
        </p>
        <ul className={styles.list}>
          <li className={styles.listItem}>
            Podemos enviar notificações sobre seus agendamentos, lembretes e atualizações de serviço via WhatsApp.
          </li>
          <li className={styles.listItem}>
            Seu número de telefone será processado em conformidade com as políticas de dados da Meta e do WhatsApp.
          </li>
          <li className={styles.listItem}>
            Você pode optar por não receber estas mensagens a qualquer momento, respondendo às mensagens ou ajustando suas configurações de notificação.
          </li>
        </ul>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>5. Compartilhamento de Dados</h2>
        <p className={styles.paragraph}>
          Não vendemos suas informações pessoais. Podemos compartilhar suas informações apenas nas seguintes circunstâncias:
        </p>
        <ul className={styles.list}>
          <li className={styles.listItem}>
            <strong>Com Prestadores de Serviço:</strong> Veterinários e clínicas parceiras com os quais você escolher agendar consultas.
          </li>
          <li className={styles.listItem}>
            <strong>Obrigação Legal:</strong> Quando exigido por lei ou para proteger nossos direitos legais.
          </li>
        </ul>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>6. Segurança dos Dados</h2>
        <p className={styles.paragraph}>
          Empregamos medidas de segurança robustas para proteger suas informações contra acesso não autorizado, alteração, divulgação ou destruição. No entanto, nenhum método de transmissão pela Internet ou armazenamento eletrônico é 100% seguro.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>7. Seus Direitos (LGPD)</h2>
        <p className={styles.paragraph}>
          Você tem o direito de acessar, corrigir, atualizar ou solicitar a exclusão de suas informações pessoais a qualquer momento. Para exercer esses direitos, entre em contato conosco.
        </p>
      </div>

      <div className={styles.contactBox}>
        <h2 className={styles.sectionTitle} style={{marginTop: 0}}>Contato</h2>
        <p className={styles.paragraph}>
          Se você tiver alguma dúvida sobre esta Política de Privacidade, entre em contato conosco:
        </p>
        <p className={styles.paragraph}>
          <strong>Email:</strong> contato@lincepet.com.br<br />
        </p>
      </div>
    </div>
  );
}
