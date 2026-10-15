import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Mantém o TypeScript como verificação de build
  typescript: {
    ignoreBuildErrors: false,
  },
  // ESLint também bloqueia o build: o repositório está sem erros de lint.
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
      // Fotos antigas (AWS/CloudFront): remover quando o inventário não tiver mais URLs da AWS.
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
