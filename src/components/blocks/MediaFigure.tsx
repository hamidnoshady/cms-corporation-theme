import Image from 'next/image';
import type { Media } from '@/lib/cms/types';
import { mediaSrc } from '@/lib/cms/urls';
export function MediaFigure({
  media,
  priority = false,
  className = '',
}: {
  media?: Media | string | null;
  priority?: boolean;
  className?: string;
}) {
  const src = mediaSrc(media);
  if (!src || !media || typeof media === 'string') return null;
  return (
    <Image
      src={src}
      alt={media.alt ?? ''}
      width={media.width && media.width > 0 ? media.width : 1500}
      height={media.height && media.height > 0 ? media.height : 1000}
      sizes="(max-width: 640px) 100vw, (max-width: 1200px) 90vw, 1104px"
      priority={priority}
      unoptimized
      className={`w-full h-auto object-contain ${className}`}
    />
  );
}
