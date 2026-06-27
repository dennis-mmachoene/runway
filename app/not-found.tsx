import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-medium">Nothing here.</p>
      <Button asChild>
        <Link href="/today">Back to today</Link>
      </Button>
    </main>
  );
}
