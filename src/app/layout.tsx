import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Providers } from "@/components/Providers";
import ToastContainer from "@/components/Toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Scrap",
  description: "Record your reading journey",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <Providers>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={true}>
            {children}
            <ToastContainer />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
