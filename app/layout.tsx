import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PawPlan — 펫페어 3D 공간 플래너",
  description: "실측 부스와 집기를 브라우저에서 설계하는 3D 공간 플래너",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
