"use client";
import { useState, useEffect } from "react";
import styles from "./typewriter.module.css";

const sentences = [
  "Cuidar da saúde do seu pet\nnão precisa ser complicado",
  "Encontre veterinários qualificados\nperto de você rapidamente",
  "Consultas veterinárias online\na qualquer hora do dia",
  "Planos de saúde para pets\ncom cobertura completa",
  "Cuidados preventivos\npara uma vida mais longa",
];

export default function TypewriterTitle() {
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    setHasInitialized(true);

    const interval = setInterval(() => {
      setIsVisible(false);

      setTimeout(() => {
        setCurrentSentenceIndex((prev) => (prev + 1) % sentences.length);
        setIsVisible(true);
      }, 500);
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  const renderTextWithLineBreaks = (text: string) => {
    return text.split("\n").map((line, index) => (
      <span key={index}>
        {line}
        {index < text.split("\n").length - 1 && <br />}
      </span>
    ));
  };

  return (
    <h1 className={`${styles.heroTitle} ${!hasInitialized ? styles.animateFadeIn : ''} ${isVisible ? styles.visible : styles.hidden}`}>
      {renderTextWithLineBreaks(sentences[currentSentenceIndex])}
    </h1>
  );
}
