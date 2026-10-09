import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";

export function companyInitials(name: string | null | undefined) {
  const words = (name ?? "").trim().split(/\s+/).filter((w) => w && !/^(de|del|la|las|los|y|el|s\.?a\.?)$/i.test(w));
  if (!words.length) return "IT";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

export function CompanyLogo({ name, src, size = 40 }: { name: string | null | undefined; src?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (src && !broken) {
    return <img src={src} alt={name ?? "Empresa"} style={style} onError={() => setBroken(true)}
      className="shrink-0 rounded-xl border border-border bg-card object-contain p-1" />;
  }
  return (
    <div style={{ ...style, fontSize: size * 0.38 }} aria-label={name ?? "Empresa"}
      className="flex shrink-0 select-none items-center justify-center rounded-xl bg-gradient-to-br from-navy to-primary font-semibold tracking-wide text-navy-foreground shadow-soft">
      {companyInitials(name)}
    </div>
  );
}

const MAX = 300 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/svg+xml"];

export function LogoUploader({ value, onChange, companyName }: { value: string | null; onChange: (v: string | null) => void; companyName: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const read = (file?: File) => {
    if (!file) return;
    if (!TYPES.includes(file.type)) return toast.error("Formato no válido. Usa JPG, PNG o SVG.");
    if (file.size > MAX) return toast.error("La imagen debe pesar menos de 300 KB.");
    const r = new FileReader();
    r.onload = () => onChange(String(r.result));
    r.readAsDataURL(file);
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); read(e.dataTransfer.files[0]); }}
      className={`flex items-center gap-4 rounded-2xl border-2 border-dashed p-4 transition-colors ${over ? "border-primary bg-accent" : "border-border"}`}>
      <CompanyLogo name={companyName} src={value} size={64} />
      <div className="flex-1 text-sm">
        <p className="font-medium">{value ? "Logo cargado" : "Arrastra aquí tu logo o imagen"}</p>
        <p className="text-xs text-muted-foreground">Opcional · JPG, PNG o SVG · máx. 300 KB. Si no subes nada, usamos las iniciales de la empresa.</p>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:border-primary">
            <ImagePlus className="h-3.5 w-3.5" />{value ? "Cambiar" : "Elegir archivo"}
          </button>
          {value && <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-destructive hover:border-destructive">
            <X className="h-3.5 w-3.5" />Quitar
          </button>}
        </div>
      </div>
      <input ref={input} type="file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" className="hidden"
        onChange={(e) => { read(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
