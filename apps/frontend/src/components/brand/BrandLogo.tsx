import Image from 'next/image';

export function BrandLogo({ size = 'default' }: { size?: 'default' | 'large' }) {
  const dimensions = size === 'large' ? 'h-14 w-14' : 'h-12 w-12';

  return (
    <span
      className={`relative inline-flex ${dimensions} shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F7F7F4] p-0.5 shadow-sm ring-1 ring-white/30`}
    >
      <Image
        src="/fatani-logo.png"
        alt="Fatani Fabrics"
        width={42}
        height={48}
        priority
        className="h-full w-full object-contain"
      />
    </span>
  );
}
