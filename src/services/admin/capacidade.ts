import { api } from '@/hook/api'
import type { CapacidadeAdmin } from '@/lib/capacidade'

export async function buscarCapacidade() {
  return (await api.get<CapacidadeAdmin>('/admin/capacidade', { timeout: 15_000 })).data
}
