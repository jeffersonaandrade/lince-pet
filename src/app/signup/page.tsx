import styles from "./page.module.css";
import Link from "next/link";
import Image from "next/image";
import { PawPrint } from "lucide-react";

const FeatureIcon = () => (
  <svg className={styles.featureIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function CadastroPage() {
  return (
    <div className={styles.mainContainer}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          Como você quer usar o LincePet?
        </h1>
        <p className={styles.subtitle}>
          Escolha o perfil que melhor se adapta às suas necessidades e comece a transformar o cuidado animal agora mesmo.
        </p>
      </header>

      <div className={styles.choicesContainer}>

        {/* Card Tutor */}
        <Link href="/signup/tutor" className="no-underline">
          <div className={styles.card}>
            <div className={styles.accent}></div>
            <div className={styles.imageContainer}>
              <Image
                src="/Tutor.png"
                alt="Tutor"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </div>
            <div className={styles.cardContent}>
              <span className={styles.cardTag}>Para seu melhor amigo</span>
              <h2 className={styles.cardTitle}>Tutor</h2>
              <p className={styles.cardDescription}>
                Acompanhe a saúde do seu pet e agende consultas com facilidade.
              </p>

              <ul className={styles.featureList}>
                <li className={styles.featureItem}><FeatureIcon /> Agendamentos presenciais e em domicílio</li>
                <li className={styles.featureItem}><FeatureIcon /> Perfil completo com raça, idade e porte</li>
                <li className={styles.featureItem}><FeatureIcon /> Histórico de atendimentos próximos</li>
                <li className={styles.featureItem}><FeatureIcon /> Favoritar clínicas e veterinários</li>
              </ul>

              <button className={styles.ctaButton}>
                Criar perfil
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </Link>

        {/* Card Veterinários */}
        <Link href="/signup/veterinario" className="no-underline">
          <div className={styles.card}>
            <div className={styles.accent}></div>
            <div className={styles.imageContainer}>
              <Image
                src="/Veterinario.png"
                alt="Veterinário"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </div>
            <div className={styles.cardContent}>
              <span className={styles.cardTag}>Autonomia profissional</span>
              <h2 className={styles.cardTitle}>Veterinário</h2>
              <p className={styles.cardDescription}>
                Gerencie sua carreira, horários e atendimentos em um só lugar.
              </p>

              <ul className={styles.featureList}>
                <li className={styles.featureItem}><FeatureIcon /> Validação profissional via CRMV</li>
                <li className={styles.featureItem}><FeatureIcon /> Gestão de especialidades e convênios</li>
                <li className={styles.featureItem}><FeatureIcon /> Múltiplos locais e preços de atendimento</li>
                <li className={styles.featureItem}><FeatureIcon /> Agenda inteligente presencial e online</li>
              </ul>

              <button className={styles.ctaButton}>
                Criar perfil
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </Link>

        {/* Card Clínica */}
        <Link href="/signup/clinica" className="no-underline">
          <div className={styles.card}>
            <div className={styles.accent}></div>
            <div className={styles.imageContainer}>
              <Image
                src="/Clinica.png"
                alt="Clínica"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </div>
            <div className={styles.cardContent}>
              <span className={styles.cardTag}>Gestão Empresarial</span>
              <h2 className={styles.cardTitle}>Clínica</h2>
              <p className={styles.cardDescription}>
                Soluções completas para gestão de clínica e corpo clínico.
              </p>

              <ul className={styles.featureList}>
                <li className={styles.featureItem}><FeatureIcon /> Gestão centralizada de veterinários</li>
                <li className={styles.featureItem}><FeatureIcon /> Cadastro de infraestrutura e serviços</li>
                <li className={styles.featureItem}><FeatureIcon /> Disponibilidade por salas e horários</li>
                <li className={styles.featureItem}><FeatureIcon /> Perfil institucional para busca regional</li>
              </ul>

              <button className={styles.ctaButton}>
                Criar perfil
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </Link>

        {/* Card Profissional pet (tosador, passeador, adestrador, pet sitter...) */}
        <Link href="/signup/prestador" className="no-underline">
          <div className={styles.card}>
            <div className={styles.accent}></div>
            <div className={`${styles.imageContainer} flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100`}>
              <PawPrint className="h-20 w-20 text-orange-400" aria-hidden />
            </div>
            <div className={styles.cardContent}>
              <span className={styles.cardTag}>Serviços para pets</span>
              <h2 className={styles.cardTitle}>Profissional pet</h2>
              <p className={styles.cardDescription}>
                Banho e tosa, passeio, adestramento ou pet sitter: receba pedidos de tutores da sua região.
              </p>

              <ul className={styles.featureList}>
                <li className={styles.featureItem}><FeatureIcon /> Perfil público com serviços e preços</li>
                <li className={styles.featureItem}><FeatureIcon /> Pedidos com data, horário ou hospedagem</li>
                <li className={styles.featureItem}><FeatureIcon /> Aceite, recuse e organize sua agenda</li>
                <li className={styles.featureItem}><FeatureIcon /> Avisos por e-mail, WhatsApp e Google Agenda</li>
              </ul>

              <button className={styles.ctaButton}>
                Criar perfil
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </Link>

      </div>
    </div>
  );
}

