"use client";
import React, { useRef, useEffect } from "react";
import {
  Calendar,
  MapPin,
  Users,
  Heart,
  Shield,
  CreditCard,
  ArrowRight,
  Zap,
} from "lucide-react";
import styles from "./PlatformFeatures.module.css";

export default function PlatformFeatures() {
  const sectionsRef = useRef<(HTMLDivElement | null)[]>([]);

  const features = [
    {
      icon: <MapPin />,
      title: "Busca Inteligente",
      description:
        "Encontre veterinários por localização, especialidade e modalidade de atendimento",
      highlight: "Localização precisa"
    },
    {
      icon: <Calendar />,
      title: "Agendamento Automatizado",
      description:
        "Sistema integrado de agenda com confirmações automáticas via WhatsApp e email",
      highlight: "WhatsApp integrado"
    },
    {
      icon: <Users />,
      title: "Rede de Profissionais",
      description:
        "Conecte-se com veterinários qualificados e estabelecimentos especializados",
      highlight: "Profissionais verificados"
    },
    {
      icon: <Heart />,
      title: "Histórico do Pet",
      description:
        "Mantenha o registro completo da saúde e cuidados do seu animal",
      highlight: "Histórico completo"
    },
    {
      icon: <Shield />,
      title: "Avaliações Verificadas",
      description:
        "Sistema de feedback transparente com avaliações reais de tutores",
      highlight: "Avaliações reais"
    },
    {
      icon: <CreditCard />,
      title: "Gestão Financeira",
      description:
        "Controle completo de pagamentos e finanças para profissionais",
      highlight: "Pagamentos seguros"
    },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = sectionsRef.current.indexOf(entry.target as HTMLDivElement);
            setTimeout(() => {
              entry.target.classList.add(styles.animate);
            }, index * 150);
          }
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -100px 0px" }
    );

    sectionsRef.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <section className={styles.platformFeatures}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerText}>
              <div className={styles.badge}>
                <Zap size={16} />
                <span>Plataforma Completa</span>
              </div>
              <h2 className={styles.title}>
                Revolucionando o Cuidado Pet no Brasil
              </h2>
              <p className={styles.subtitle}>
                Conectamos tutores, veterinários e estabelecimentos em um
                ecossistema integrado que facilita o acesso aos melhores
                cuidados para seu pet
              </p>
            </div>
            <div className={styles.headerImage}>
              <img
                src="/img/dog banner.jpg"
                alt="Cachorro sendo cuidado por veterinário"
                className={styles.dogImage}
              />
              <div className={styles.imageMask}></div>
            </div>
          </div>
        </div>

        <div className={styles.featuresGrid}>
          {features.map((feature, index) => (
            <div 
              key={index} 
              ref={(el) => { sectionsRef.current[index] = el; }}
              className={styles.featureCard}
            >
              <div className={styles.featureIcon}>
                {feature.icon}
                <div className={styles.iconGlow}></div>
              </div>
              <div className={styles.featureContent}>
                <div className={styles.featureHeader}>
                  <h3 className={styles.featureTitle}>{feature.title}</h3>
                  <div className={styles.featureHighlight}>
                    {feature.highlight}
                  </div>
                </div>
                <p className={styles.featureDescription}>{feature.description}</p>
                <div className={styles.featureAction}>
                  <span>Saiba mais</span>
                  <ArrowRight size={16} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
