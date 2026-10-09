"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ClinicsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    // Se já estiver logado como clínica, vai para o dashboard
    if (user?.userType === 'clinica') {
      router.push('/dashboard/clinica');
      return;
    }

    // Se não estiver logado ou for outro tipo de usuário, vai para o signup
    router.push('/signup/clinica');
  }, [user, loading, router]);

  // Mostra loading enquanto verifica autenticação
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      fontSize: '1.2rem',
      color: '#666'
    }}>
      Carregando...
    </div>
  );
}
