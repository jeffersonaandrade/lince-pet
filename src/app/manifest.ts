import type { MetadataRoute } from "next";

/** Manifest mínimo: no iPhone, as notificações do navegador só funcionam com o site instalado na tela inicial. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lince Pet",
    short_name: "Lince Pet",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#e67e22",
    icons: [{ src: "/img/IconSilver.png", sizes: "any", type: "image/png" }],
  };
}
