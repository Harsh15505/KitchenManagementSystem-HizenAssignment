'use client';

import { UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * A dish photo from its image URL, or a quiet placeholder when there is none or it fails to load.
 * A plain <img>: admins can paste any host, and next/image needs every host listed up front.
 */
export function DishImage({
  src,
  alt,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={cn('flex items-center justify-center bg-muted text-muted-foreground', className)}
      >
        <UtensilsCrossed className="size-5" aria-hidden />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see the note above
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}
