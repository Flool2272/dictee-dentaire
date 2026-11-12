import type { Metadata } from "next";
import { DM_Sans, IBM_Plex_Mono, Sora } from "next/font/google";
import "./globals.css";

// Charte « Émail » : Sora pour les titres, DM Sans pour le texte, IBM Plex Mono pour les codes et montants.
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["600", "700", "800"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "Émail · Dictée et devis dentaires",
  description: "Compte rendu et devis dentaires générés pendant la consultation",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${sora.variable} ${dmSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#fafaf7] font-sans text-[#1b2340]">{children}</body>
    </html>
  );
}
