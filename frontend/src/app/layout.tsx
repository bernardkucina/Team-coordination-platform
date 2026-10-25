import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { StoreProvider } from '@/lib/store';
import { MeetingReminder } from '@/components/MeetingReminder';
import { Sidebar } from '@/components/Sidebar';
import { Toast } from '@/components/ui';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Hub Pulse',
  description: 'Tasks, hours and attendance for a Global Shapers hub.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <StoreProvider>
          <div className="shell">
            <Sidebar />
            <main className="main">
              <div className="container">
                <MeetingReminder />
                {children}
              </div>
            </main>
          </div>
          <Toast />
        </StoreProvider>
      </body>
    </html>
  );
}
