## SuccessScreen

Componente simples de tela de sucesso para mostrar após ações como criar um agendamento.

Props:

- title?: string - título principal (padrão: "Agendamento confirmado").
- subtitle?: string - texto secundário (padrão: mensagem curta).
- buttonText?: string - texto do botão (padrão: "Voltar para meus agendamentos").
- onButtonClick?: () => void - callback para clique do botão; se fornecido, será usado em vez do link.
- linkHref?: string - link para onde o botão navega quando onButtonClick não é fornecido (padrão: "/dashboard/agendamentos").

Uso:
import SuccessScreen from "@/components/SuccessScreen/SuccessScreen";

<SuccessScreen />

ou com props:
<SuccessScreen
  title="Agendamento salvo"
  subtitle="Recebemos seu pedido."
  buttonText="Ver meus agendamentos"
  linkHref="/perfil/agendamentos"
 />
