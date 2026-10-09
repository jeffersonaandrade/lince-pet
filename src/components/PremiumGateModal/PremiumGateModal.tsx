import React from 'react';
import { useRouter } from 'next/navigation';
import { Crown } from 'lucide-react';
import styles from './PremiumGateModal.module.css';

interface PremiumGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  requiredPlan?: 'Pro' | 'Pro+';
}

export default function PremiumGateModal({ isOpen, onClose, featureName = 'Esta funcionalidade', requiredPlan = 'Pro' }: PremiumGateModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={onClose}>
          &times;
        </button>
        <div className={styles.content}>
          <div className={styles.iconWrapper}>
            <span className={styles.icon}><Crown size={32} /></span>
          </div>
          <h2 className={styles.title}>Funcionalidade Premium</h2>
          <p className={styles.description}>
            <strong>{featureName}</strong> é exclusiva para assinantes do plano <strong>{requiredPlan}</strong> ou superior.
          </p>
          <p className={styles.benefits}>
            Faça o upgrade agora e libere acesso completo a ferramentas essenciais para sua clínica ou consultório!
          </p>
          <button 
            className={styles.upgradeBtn}
            onClick={() => {
              onClose();
              router.push('/dashboard/veterinario/alterar-plano');
            }}
          >
            Conhecer Planos
          </button>
        </div>
      </div>
    </div>
  );
}
