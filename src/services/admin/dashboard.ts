import { api } from '@/hook/api'
import type { PainelAdmin } from '@/lib/admin-dashboard'

export async function buscarPainel() {
  return (await api.get<PainelAdmin>('/admin/dashboard')).data
}
