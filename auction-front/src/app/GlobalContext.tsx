
"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ----------------------------
// TIPADO PHANTOM
// ----------------------------
type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString: () => string };
  isConnected?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey: { toString: () => string };
  }>;
  disconnect: () => Promise<void>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
};

// Hacer Phantom visible en window
declare global {
  interface Window {
    solana?: PhantomProvider;
  }
}

// ----------------------------
// CONTEXTO
// ----------------------------
interface GlobalContextProps {
  walletAddress: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const GlobalContext = createContext<GlobalContextProps>({
  walletAddress: null,
  login: async () => {},
  logout: async () => {},
});

// Hook
export const useGlobalContext = () => useContext(GlobalContext);

// ----------------------------
// PROVIDER
// ----------------------------
export const GlobalProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const router = useRouter();

  // ----------------------------
  // AUTO-CONEXIÓN (si ya fue autorizado antes)
  // ----------------------------
  useEffect(() => {
    const tryAutoConnect = async () => {
      if (typeof window === "undefined") return;

      const provider = window.solana;

      if (provider?.isPhantom) {
        try {
          const resp = await provider.connect({ onlyIfTrusted: true });
          setWalletAddress(resp.publicKey.toString());
        } catch {
          // Usuario no autorizó previamente, ignoramos
        }
      }
    };

    tryAutoConnect();
  }, []);

  // ----------------------------
  // LISTENER CAMBIO DE CUENTA
  // ----------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const provider = window.solana;

    if (provider && typeof provider.on === "function") {
      const handler = (publicKey: any) => {
        if (publicKey) {
          setWalletAddress(publicKey.toString());
          router.push("/dashboard");
        } else {
          setWalletAddress(null);
          router.push("/");
        }
      };

      provider.on("accountChanged", handler);

      return () => {
        // cleanup simple (Phantom no siempre expone off)
      };
    }
  }, [router]);

  // ----------------------------
  // LOGIN
  // ----------------------------
  const login = async () => {
    if (typeof window === "undefined") return;

    const provider = window.solana;

    if (!provider || !provider.isPhantom) {
      alert("Phantom wallet no detectado. Instálalo.");
      return;
    }

    try {
      const resp = await provider.connect();
      const publicKey = resp.publicKey.toString();

      setWalletAddress(publicKey);

      console.log("Wallet conectada:", publicKey);

      router.push("/dashboard");
    } catch (err) {
      console.error("Error al conectar Phantom:", err);
    }
  };

  // ----------------------------
  // LOGOUT
  // ----------------------------
  const logout = async () => {
    if (typeof window === "undefined") return;

    const provider = window.solana;

    try {
      if (provider && provider.disconnect) {
        await provider.disconnect();
      }
    } catch (err) {
      console.warn("No se pudo desconectar correctamente:", err);
    }

    setWalletAddress(null);
    router.push("/");
  };

  // ----------------------------
  // PROVIDER
  // ----------------------------
  return (
    <GlobalContext.Provider
      value={{
        walletAddress,
        login,
        logout,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};
