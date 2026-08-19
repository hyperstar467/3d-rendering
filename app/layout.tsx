import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hustle 3D Studio — 범용 DIY 3D 비주얼 플래닝",
  description: "Part를 만들고 조립하고 디자인하여 실제 크기의 공간에 배치하는 범용 3D 스튜디오",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
