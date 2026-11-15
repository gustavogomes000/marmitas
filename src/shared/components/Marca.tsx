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
      <span className="flex shrink-0 items-center gap-2">
        <Simbolo tamanho={32} />
        <Lettering altura={22} />
      </span>
    );
  }
  return (
    <span className="flex flex-col items-center gap-1">
      <LogoCompleta className="max-w-[260px]" />
    </span>
  );
}
