import type { Metadata } from "next";
import { fontDisplay, fontEditorial, fontTechnical } from "@/lib/fonts";
import { GaussianBackground, VeilGrain } from "@/components/veil/background";
import "./globals.css";

export const metadata: Metadata = {
  title: "VEIL — Private Collective",
  description: "An independent collective for those who build, investigate and challenge the known.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontDisplay.variable} ${fontEditorial.variable} ${fontTechnical.variable}`}>
      <body>
        <GaussianBackground />
        <VeilGrain />
        {children}
      </body>
    </html>
  );
}
