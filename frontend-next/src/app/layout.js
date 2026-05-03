import { Suspense } from "react";
import "../index.css";
import { ThemeProvider } from "../ThemeContext";
import { AuthProvider } from "../AuthContext";

export const metadata = {
  title: "CPNS & UTBK 2026",
  description: "Platform Tryout CPNS & UTBK 2026",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <ThemeProvider>
          <AuthProvider>
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Memuat...</div>}>
              {children}
            </Suspense>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
