import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { StoreProvider } from '@/lib/store';
import { Sidebar } from '@/components/Sidebar';
import { Toast } from '@/components/ui';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hub Pulse',
  description: 'Tasks, hours and attendance for a Global Shapers hub.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@500;700;800&family=Funnel+Sans:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        <StoreProvider>
          <div className="shell">
            <Sidebar />
            <main className="main">
              <div className="container">{children}</div>
            </main>
          </div>
          <Toast />
        </StoreProvider>
      </body>
    </html>
  );
}
