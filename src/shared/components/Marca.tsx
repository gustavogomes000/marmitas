import { cn } from "@/shared/lib/cn";

/** Recortes da arte original: `simbolo.png` (panela + vapor), `lettering.png` ("D'a Márcia") e `logo.png` (tudo). */
export function Simbolo({ tamanho = 40, className }: { tamanho?: number; className?: string }) {
  return (
    <img
      src="/simbolo.png"
      alt=""
      width={tamanho}
      height={tamanho}
      aria-hidden="true"
      className={cn("shrink-0 object-contain", className)}
      style={{ width: tamanho, height: tamanho }}
    />
  );
}

export function Lettering({ altura = 26, className }: { altura?: number; className?: string }) {
  return (
    <img
      src="/lettering.png"
      alt="D'a Márcia"
      aria-hidden={false}
      className={cn("shrink-0 object-contain", className)}
      style={{ height: altura, width: "auto" }}
    />
  );
}

export function LogoCompleta({ className, alt = "D'a Márcia Marmitaria" }: { className?: string; alt?: string }) {
  return <img src="/logo.png" alt={alt} className={cn("w-full object-contain", className)} />;
}

export function Marca({ compacta = false }: { compacta?: boolean }) {
  if (compacta) {
    return (
      <span className="flex shrink-0 items-center gap-2.5">
        <img
          src="/marca-192.png"
          alt="Logo D'a Márcia"
          width={42}
          height={42}
          className="size-[42px] shrink-0 rounded-xl border border-gold/45 object-cover shadow-suave"
        />
        <span className="flex flex-col leading-none">
          <span className="font-display text-[19px] font-bold tracking-tight text-gold">
            D&apos;a Márcia
          </span>
          <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-crema/85">
            Marmitaria
          </span>
        </span>
      </span>
    );
  }
  return (
    <span className="flex flex-col items-center gap-1">
      <LogoCompleta className="max-w-[260px]" />
    </span>
  );
}
