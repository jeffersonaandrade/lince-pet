import { api } from "@/hook/api";

/** Estado das notificações do navegador neste aparelho. */
export type EstadoNavegador = "carregando" | "nao_suportado" | "desligado_servidor" | "bloqueado" | "inativo" | "ativo";

export const navegadorSuportaPush = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/** VAPID em base64url -> bytes, formato que o PushManager aceita. */
function chaveEmBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(base64);
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

async function chavePublica(): Promise<string | null> {
  const res = await api.get("/push/chave-publica");
  return res.data?.chave ?? null;
}

const registrar = () => navigator.serviceWorker.register("/sw.js");

export const NavegadorService = {
  async estado(): Promise<EstadoNavegador> {
    if (!navegadorSuportaPush()) return "nao_suportado";
    if (Notification.permission === "denied") return "bloqueado";
    const registro = await navigator.serviceWorker.getRegistration("/sw.js");
    const inscricao = await registro?.pushManager.getSubscription();
    if (inscricao) return "ativo";
    return (await chavePublica()) ? "inativo" : "desligado_servidor";
  },

  /** Pede a permissão, registra o service worker e inscreve este aparelho. */
  async ativar(): Promise<EstadoNavegador> {
    if (!navegadorSuportaPush()) return "nao_suportado";
    const chave = await chavePublica();
    if (!chave) return "desligado_servidor";
    const permissao = await Notification.requestPermission();
    if (permissao !== "granted") return permissao === "denied" ? "bloqueado" : "inativo";

    const registro = await registrar();
    await navigator.serviceWorker.ready;
    const inscricao =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(chave) }));
    await api.post("/push/inscricao", inscricao.toJSON());
    return "ativo";
  },

  async desativar(): Promise<EstadoNavegador> {
    const registro = await navigator.serviceWorker.getRegistration("/sw.js");
    const inscricao = await registro?.pushManager.getSubscription();
    if (inscricao) {
      await api.delete("/push/inscricao", { data: { endpoint: inscricao.endpoint } });
      await inscricao.unsubscribe();
    }
    return "inativo";
  },
};
