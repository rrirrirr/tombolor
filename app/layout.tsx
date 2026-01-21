import type { Metadata } from "next";
import { Playfair_Display, Crimson_Text } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const crimson = Crimson_Text({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Tombola | Dra Din Lott",
  description: "Två tombolor, en dragning - låt ödet bestämma!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body className={`${playfair.variable} ${crimson.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
