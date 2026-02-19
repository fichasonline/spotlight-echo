import { useState, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, ShieldCheck } from "lucide-react";

function isAgeVerified(): boolean {
  const stored = localStorage.getItem("age_ok");
  if (!stored) return false;
  try {
    const { value, expiry } = JSON.parse(stored);
    if (Date.now() > expiry) {
      localStorage.removeItem("age_ok");
      return false;
    }
    return value === true;
  } catch {
    return false;
  }
}

function setAgeVerified() {
  const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  localStorage.setItem("age_ok", JSON.stringify({ value: true, expiry }));
}

export function AgeGate({ children }: { children: ReactNode }) {
  const [verified, setVerified] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setVerified(isAgeVerified());
  }, []);

  if (verified === null) return null;

  if (blocked) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-6">
          <ShieldAlert className="mx-auto h-16 w-16 text-destructive mb-6" />
          <h1 className="text-3xl font-display font-bold text-foreground mb-4">Acceso restringido</h1>
          <p className="text-muted-foreground text-lg">
            Debes ser mayor de 18 años para acceder a este sitio.
          </p>
        </div>
      </div>
    );
  }

  if (!verified) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-lg p-8 max-w-md w-full mx-4 text-center shadow-2xl"
          >
            <ShieldCheck className="mx-auto h-14 w-14 text-primary mb-6" />
            <h2 className="text-2xl font-display font-bold text-foreground mb-3">
              Verificación de edad
            </h2>
            <p className="text-muted-foreground mb-8">
              ¿Sos mayor de 18 años?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setAgeVerified();
                  setVerified(true);
                }}
                className="flex-1 bg-primary text-primary-foreground font-semibold py-3 rounded-md hover:opacity-90 transition-opacity"
              >
                Sí, soy mayor
              </button>
              <button
                onClick={() => setBlocked(true)}
                className="flex-1 bg-secondary text-secondary-foreground font-semibold py-3 rounded-md hover:opacity-90 transition-opacity"
              >
                No
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return <>{children}</>;
}
