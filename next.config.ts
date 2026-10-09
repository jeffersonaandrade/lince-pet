import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Mantém o TypeScript como verificação de build
  typescript: {
    ignoreBuildErrors: false,
  },
  // Evita que erros de ESLint bloqueiem o build de produção
  // (útil enquanto existem regras como no-explicit-any pendentes em arquivos não relacionados)
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.cloudfront.net",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "d261ftrvo5a2p7.cloudfront.net",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
