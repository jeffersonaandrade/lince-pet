import RecuperarClinica from '@/components/RecuperarClinica/RecuperarClinica'

export const metadata = { title: 'Recuperar clínica | Lince Pet', robots: { index: false, follow: false } }

export default async function RecuperarClinicaPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams
  return <RecuperarClinica token={typeof token === 'string' ? token : null} />
}
