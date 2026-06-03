type BrandMarkSize = "sm" | "lg";

const SIZE_CONFIG: Record<
  BrandMarkSize,
  { className: string; boxShadow: string }
> = {
  sm: {
    className: "w-10 h-10 text-sm",
    boxShadow: "0 4px 16px rgba(72,185,230,0.28)",
  },
  lg: {
    className: "w-28 h-28 mx-auto text-3xl",
    boxShadow: "0 6px 28px rgba(72,185,230,0.32)",
  },
};

type BrandMarkProps = {
  size?: BrandMarkSize;
  className?: string;
};

/** Marca TecnoOne — iniciales con gradiente de marca */
export default function BrandMark({ size = "sm", className = "" }: BrandMarkProps) {
  const config = SIZE_CONFIG[size];

  return (
    <div
      className={`rounded-xl flex items-center justify-center shrink-0 font-bold tracking-tight text-white ${config.className} ${className}`.trim()}
      style={{
        background: "linear-gradient(135deg, #2EA7D8 0%, #48B9E6 100%)",
        boxShadow: config.boxShadow,
      }}
      aria-hidden="true"
    >
      TO
    </div>
  );
}
