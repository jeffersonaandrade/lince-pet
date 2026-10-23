// Service worker das notificações do navegador (Web Push). O servidor manda { title, body, url }.
self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { body: event.data ? event.data.text() : "" };
  }
  const titulo = dados.title || "Lince Pet";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || "",
      icon: "/img/IconSilver.png",
      badge: "/img/IconSilver.png",
      data: { url: dados.url || "/" },
      lang: "pt-BR",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let destino = self.location.origin + "/";
  try {
    const url = new URL(event.notification.data?.url || "/", self.location.origin);
    if (url.origin === self.location.origin) destino = url.href;
  } catch { /* Payload inválido abre a página inicial. */ }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
      const aberta = abas.find((aba) => new URL(aba.url).origin === self.location.origin);
      if (aberta) {
        return aberta.focus().then((aba) => (aba && "navigate" in aba ? aba.navigate(destino) : aba));
      }
      return self.clients.openWindow(destino);
    })
  );
});
