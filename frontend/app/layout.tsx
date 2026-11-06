import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Web3Provider } from "@/providers/Web3Provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Parlay Markets — the first parlay on 1inch Aqua",
  description: "On-chain parlays on 1inch Aqua. Live LMSR prices, one ticket, LP money stays in the wallet. Settled by Chainlink CRE.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
