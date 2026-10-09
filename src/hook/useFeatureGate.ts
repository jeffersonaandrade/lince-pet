import { useAuth } from '@/contexts/AuthContext';

export type FeatureName = 
  | 'agendamentos_ilimitados' 
  | 'perfil_completo' 
  | 'suporte_prioritario' 
  | 'notificacoes_whatsapp' 
  | 'destaque_busca' 
  | 'dashboard_completo';

export function useFeatureGate() {
  const { user } = useAuth();

  const hasFeature = (feature: FeatureName): boolean => {
    if (!user) return false;
    
    // Default to free if no plan
    const planCode = user.subscriptionPlanCode || 'free';
    
    const isProPlus = planCode === 'vet_pro' || planCode === 'pro_plus';
    const isPro = planCode === 'vet_starter' || planCode === 'pro' || isProPlus;

    switch (feature) {
      case 'agendamentos_ilimitados':
      case 'perfil_completo':
      case 'suporte_prioritario':
      case 'notificacoes_whatsapp':
        return isPro || isProPlus;
      case 'destaque_busca':
      case 'dashboard_completo':
        return isProPlus;
      default:
        return false;
    }
  };

  return { hasFeature };
}
