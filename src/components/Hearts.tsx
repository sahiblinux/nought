import { Heart } from 'lucide-react';

export default function Hearts({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <span className="flex items-center gap-[3px]" title={`${count} of ${max} hearts`}>
      {Array.from({ length: max }).map((_, i) => (
        <Heart
          key={i}
          size={12}
          className={i < count ? 'text-clay' : 'text-line'}
          fill={i < count ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  );
}
