import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import BackgroundGrid from "@/lib/background/backgroundGrid";
import "./globals.css";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "THVO",
  description: "The Hidden Village",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased relative min-h-screen overflow-x-hidden`}
        style={{ backgroundColor: "#FFD84D" }}
      >
        <AuthProvider>
          {/* Bottom Grid */}
          <BackgroundGrid />
          {/* Foreground Content */}
          <div className="relative z-10 min-h-screen overflow-auto">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
