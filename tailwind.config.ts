import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // Una sola familia en todo el sistema, como pide el manual.
        // `display` se mantiene como alias para no tocar los cientos de
        // `font-display` que ya hay repartidos por el código.
        sans: ['"Clash Grotesk"', 'system-ui', 'sans-serif'],
        display: ['"Clash Grotesk"', 'system-ui', 'sans-serif'],
      },
      lineHeight: {
        display: 'var(--lh-display)',
        h1: 'var(--lh-h1)',
        h2: 'var(--lh-h2)',
        h3: 'var(--lh-h3)',
        body: 'var(--lh-prose)',
        ui: 'var(--lh-ui)',
        caption: 'var(--lh-caption)',
      },
      letterSpacing: {
        display: 'var(--tr-display)',
        h1: 'var(--tr-h1)',
        h2: 'var(--tr-h2)',
        caption: 'var(--tr-caption)',
      },
      colors: {
        /*
         * Colores de marca crudos, para los casos en que hace falta el color
         * exacto del manual y no el token semántico — sobre todo texto sobre
         * fotos. `brand-light` (#C5C5C5) es el reemplazo de `white`: el manual
         * prohíbe el blanco pleno.
         */
        brand: {
          violet: "hsl(var(--brand-violet))",
          "violet-deep": "hsl(var(--brand-violet-deep))",
          "violet-bright": "hsl(var(--brand-violet-bright))",
          light: "hsl(var(--brand-gray-light))",
          mid: "hsl(var(--brand-gray-mid))",
          black: "hsl(var(--brand-black-deep))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "slide-up": {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "slide-up": "slide-up 0.3s ease-out",
        ticker: "ticker 35s linear infinite",
      },
      /*
       * El plugin `typography` trae su propio interlineado (1.75 en `prose`,
       * 1.71 en `prose-sm`) y lo aplica sobre el `<p>` directamente, así que
       * le gana a cualquier `leading-*` puesto en el contenedor: por eso el
       * `leading-8` del editor no hacía nada. Se ata acá a la escala del
       * manual, una sola vez, y valen lo mismo el editor y la nota publicada.
       */
      typography: {
        DEFAULT: {
          css: {
            lineHeight: "var(--lh-prose)",
            p: { lineHeight: "var(--lh-prose)" },
            li: { lineHeight: "var(--lh-prose)" },
            blockquote: { lineHeight: "var(--lh-prose)" },
            h1: { lineHeight: "var(--lh-h1)" },
            h2: { lineHeight: "var(--lh-h2)" },
            h3: { lineHeight: "var(--lh-h3)" },
            h4: { lineHeight: "var(--lh-h3)" },
          },
        },
        /*
         * Los modificadores de tamaño (`prose-sm`, `prose-base`…) redefinen el
         * interlineado por su cuenta y pisarían el DEFAULT, así que hay que
         * repetirlo en cada uno que el proyecto usa.
         */
        sm: { css: { lineHeight: "var(--lh-prose)", p: { lineHeight: "var(--lh-prose)" }, li: { lineHeight: "var(--lh-prose)" } } },
        base: { css: { lineHeight: "var(--lh-prose)", p: { lineHeight: "var(--lh-prose)" }, li: { lineHeight: "var(--lh-prose)" } } },
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
} satisfies Config;
