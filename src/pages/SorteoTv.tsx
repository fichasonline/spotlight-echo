import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Gift,
  Heart,
  Instagram,
  MessageCircle,
  Sparkles,
  Trophy,
  Tv,
  UserPlus,
} from "lucide-react";

const instagramPostUrl = "https://www.instagram.com/p/DY79btQCdT9/?img_index=1";

const steps = [
  {
    icon: UserPlus,
    title: "Seguí la cuenta",
    text: "Entrá a Instagram y seguí a @fichasonlineuy.",
  },
  {
    icon: Heart,
    title: "Dale Me Gusta",
    text: "Marcá el post oficial del sorteo con un Me Gusta.",
  },
  {
    icon: MessageCircle,
    title: "Comentá etiquetando",
    text: "Etiquetá a 1 amigo/a por comentario. Podés comentar todas las veces que quieras.",
  },
];

export default function SorteoTv() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="relative overflow-hidden border-b border-primary/20">
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center opacity-35"
          style={{ backgroundImage: "url('/fondo-1600.jpg')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_12%,hsl(273_66%_56%_/_0.32),transparent_38%),linear-gradient(180deg,hsl(0_0%_6%_/_0.66),hsl(0_0%_6%_/_0.98))]" />

        <div className="container mx-auto grid min-h-[calc(100vh-4rem)] items-center gap-10 px-4 py-12 md:grid-cols-[1fr_0.88fr] md:py-16">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-300/12 px-4 py-2 text-sm font-bold uppercase tracking-[0.12em] text-amber-100">
              <Trophy className="h-4 w-4" />
              Sorteo Uruguay
            </div>

            <h1 className="text-balance text-5xl font-black leading-[0.95] text-white sm:text-6xl lg:text-7xl">
              Sorteamos una TV 65&quot; 4K
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/82 sm:text-xl">
              Se viene el Mundial y vuelve la WSOP completa por ESPN. En Fichas Online
              lo festejamos a lo grande para que vivas cada gol y cada mano en pantalla gigante.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-white px-6 text-base font-black text-[#160b22] hover:bg-white/90"
              >
                <a href={instagramPostUrl} target="_blank" rel="noreferrer">
                  <Instagram className="mr-2 h-5 w-5" />
                  Participar en Instagram
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-white/35 bg-white/8 px-6 text-base font-bold text-white hover:bg-white/14 hover:text-white"
              >
                <a href="#como-participar">
                  Ver pasos
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-white/15 bg-black/28 p-4 backdrop-blur">
                <Tv className="mb-3 h-6 w-6 text-amber-200" />
                <p className="text-sm font-semibold text-white/58">Premio</p>
                <p className="mt-1 text-xl font-black text-white">1 TV 65&quot; 4K</p>
              </div>
              <div className="rounded-lg border border-white/15 bg-black/28 p-4 backdrop-blur">
                <Sparkles className="mb-3 h-6 w-6 text-amber-200" />
                <p className="text-sm font-semibold text-white/58">Participación</p>
                <p className="mt-1 text-xl font-black text-white">Gratis</p>
              </div>
              <div className="rounded-lg border border-white/15 bg-black/28 p-4 backdrop-blur">
                <CalendarClock className="mb-3 h-6 w-6 text-amber-200" />
                <p className="text-sm font-semibold text-white/58">Cierre</p>
                <p className="mt-1 text-xl font-black text-white">10/06/2026 · 18:00</p>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="rounded-[2rem] border border-white/18 bg-[#08050d]/82 p-5 shadow-[0_30px_90px_hsl(0_0%_0%_/_0.48)] backdrop-blur-xl">
              <div className="rounded-[1.35rem] border border-white/10 bg-gradient-to-b from-[#251131] to-[#09060d] p-5">
                <div className="flex items-center justify-between">
                  <img src="/logo_fichas.png" alt="Fichas Online" className="h-9 w-auto object-contain" />
                  <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-white">
                    Live
                  </span>
                </div>

                <div className="mt-8 aspect-video rounded-2xl border border-amber-200/35 bg-[linear-gradient(135deg,#1c0c2a,#101010_45%,#33290d)] p-4 shadow-[inset_0_0_45px_hsl(273_66%_66%_/_0.22)]">
                  <div className="flex h-full flex-col items-center justify-center rounded-xl border border-white/10 bg-black/30 text-center">
                    <Tv className="h-16 w-16 text-amber-200" />
                    <p className="mt-4 text-4xl font-black text-white">65&quot; 4K</p>
                    <p className="mt-1 text-sm font-bold uppercase tracking-[0.22em] text-white/56">
                      Mundial + WSOP
                    </p>
                  </div>
                </div>

                <p className="mt-6 text-xl font-black leading-tight text-white">
                  Imaginate la final del Mundial en una pantalla gigante 4K.
                </p>
                <p className="mt-3 text-white/65">¿Con quién te la bancarías?</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="como-participar" className="border-b border-border/70 bg-card/35">
        <div className="container mx-auto px-4 py-14">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">3 pasos</p>
            <h2 className="mt-3 text-3xl font-black text-foreground sm:text-4xl">
              Cómo participar
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="rounded-lg border border-border bg-background/68 p-6 shadow-card">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="mt-5 text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Paso {index + 1}
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-foreground">{step.title}</h3>
                  <p className="mt-3 leading-7 text-muted-foreground">{step.text}</p>
                </article>
              );
            })}
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-lg border border-amber-300/30 bg-amber-300/10 p-5 text-center">
            <p className="text-lg font-bold text-foreground">
              Cuantos más comentarios dejes, más chances tenés. Recordá: siempre 1 etiqueta por comentario.
            </p>
          </div>

          <div className="mt-8 text-center">
            <Button asChild size="lg" className="h-12 rounded-full px-7 text-base font-black">
              <a href={instagramPostUrl} target="_blank" rel="noreferrer">
                <Instagram className="mr-2 h-5 w-5" />
                Ir al post oficial
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="container mx-auto grid gap-6 px-4 py-12 md:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-primary/25 bg-primary/10 p-6">
            <Gift className="h-9 w-9 text-primary" />
            <h2 className="mt-4 text-3xl font-black">El sorteo</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              El cierre es el miércoles 10/06/2026 a las 18:00 hs. El sorteo se realiza ese mismo día.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-black">Bases</h2>
            <ul className="mt-5 space-y-3 text-muted-foreground">
              <li className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                Sorteo válido solo para Uruguay.
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                Participan mayores de 18 años.
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                El premio no es canjeable por dinero.
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                Instagram no patrocina, avala ni administra este sorteo.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
