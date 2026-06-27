'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-medium">Something went wrong.</p>
      <p className="text-sm text-muted-foreground">
        Your data is safe — nothing was changed. Try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
