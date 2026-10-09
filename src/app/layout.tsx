import type { Metadata, Viewport } from "next";
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import { AuthProvider } from "../contexts/AuthContext";
import "./globals.css";
import { Fredoka, Inter } from "next/font/google";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-fredoka",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Lince Pet - Agende uma consulta para o seu pet",
  description:
    "Encontre especialistas para seu melhor amigo. Plataforma para conectar pets com veterinários e hospitais especializados.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br" className={`${fredoka.variable} ${inter.variable}`}>
      <body>
        <AuthProvider>
          <Header />
          <main className="main-content" style={{ minHeight: "100vh" }}>
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
