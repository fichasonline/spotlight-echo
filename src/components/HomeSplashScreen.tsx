import { AnimatePresence, motion } from "motion/react";

interface HomeSplashScreenProps {
  visible: boolean;
}

export function HomeSplashScreen({ visible }: HomeSplashScreenProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="home-splash"
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
          style={{ background: "#09060f" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Ambient glow orbs */}
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[480px] w-[720px] rounded-full blur-[140px]"
              style={{ background: "rgba(86,49,116,0.42)" }}
            />
            <div
              className="absolute left-[12%] top-[22%] h-[280px] w-[280px] rounded-full blur-[120px]"
              style={{ background: "rgba(143,60,249,0.14)" }}
            />
            <div
              className="absolute right-[12%] bottom-[22%] h-[280px] w-[280px] rounded-full blur-[120px]"
              style={{ background: "rgba(143,60,249,0.14)" }}
            />
          </div>

          {/* Brand */}
          <div className="relative z-10 flex flex-col items-center gap-7">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center"
            >
              <h1
                className="font-display font-black uppercase leading-none tracking-[-0.05em] text-[#8f3cf9]"
                style={{ fontSize: "clamp(3rem, 10vw, 5.5rem)" }}
              >
                FICHASNEWS
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.5 }}
                className="mt-3 text-[0.62rem] font-bold uppercase tracking-[0.3em] text-white/30"
              >
                Comunidad · Noticias · Eventos
              </motion.p>
            </motion.div>

            {/* Shimmer progress bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="h-[2px] w-44 overflow-hidden rounded-full"
              style={{ background: "rgba(143,60,249,0.18)" }}
            >
              <motion.div
                className="h-full w-[55%] rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, #8f3cf9 50%, transparent 100%)",
                }}
                animate={{ x: ["-90%", "210%"] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatDelay: 0.15,
                }}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
