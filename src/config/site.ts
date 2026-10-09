/** Contatos oficiais. Campo vazio = não exibido como link (mostra "em breve" ou some). */
export const SITE = {
  email: '',
  /** Só dígitos com DDI, ex.: 5581999990000 */
  whatsapp: '',
  horarioAtendimento: 'Segunda a sexta, das 9h às 18h',
  redes: {
    instagram: '',
    x: '',
  },
}

export const linkWhatsapp = (numero: string) => (numero ? `https://wa.me/${numero.replace(/\D/g, '')}` : '')
