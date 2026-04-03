'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

// Environment variables se securely fetch kar rahe hain
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '';
const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || '';

const config = getDefaultConfig({
  appName: 'RST Reputation Protocol',
  projectId: projectId,
  chains: [sepolia],
  transports: {
    // Custom RPC URL yahan inject ho raha hai
    [sepolia.id]: http(rpcUrl), 
  },
  ssr: true, 
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          theme={darkTheme({
            accentColor: '#3b82f6', 
            accentColorForeground: 'white',
            borderRadius: 'medium',
          })}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}