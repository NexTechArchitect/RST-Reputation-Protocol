import type { Metadata } from 'next';
import { Web3Provider } from '../src/components/providers/Web3Provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'RST Protocol — On-Chain Reputation',
  description: 'Soulbound identity. Immutable trust. ERC-5484.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}