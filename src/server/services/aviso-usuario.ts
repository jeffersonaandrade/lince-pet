import 'server-only'
import type { Prisma } from '@/generated/prisma/client'
import type { Usuario } from '../db'
import { podeEnviarEmail } from './canais-notificacao'
import { inAppNotifications } from './in-app-notifications'
import { notifications } from './notifications'

export type Aviso = {
  tipo: string
  titulo: string
  mensagem: string
  actionData?: Prisma.InputJsonObject | null
  /** Linhas "rótulo: valor" do e-mail; valores vazios somem. */
  detalhes?: [string, string | null][]
}

/** Sino + navegador (sempre) e e-mail (respeita o opt-out). Nunca lança. */
export async function avisarUsuario(user: Pick<Usuario, 'id' | 'email' | 'nome' | 'notificarEmail'>, aviso: Aviso) {
  try {
    await inAppNotifications.createGenericNotification({
      userId: user.id,
      type: aviso.tipo,
      title: aviso.titulo,
      message: aviso.mensagem,
      actionData: aviso.actionData ?? null,
    })
    if (podeEnviarEmail(user)) {
      await notifications.sendPedidoServico(user.email, aviso.titulo, {
        titulo: aviso.titulo,
        saudacao: `Olá, ${user.nome}!`,
        paragrafos: [aviso.mensagem],
        detalhes: aviso.detalhes ?? [],
      })
    }
  } catch (error) {
    console.error(`❌ [Aviso] Falha ao avisar ${aviso.tipo} (User ID: ${user.id}):`, error)
  }
}
