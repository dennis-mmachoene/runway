import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { lock } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <p className="text-lg">You&apos;re in.</p>
      <p className="text-sm text-muted-foreground">The gauge lands here in Phase 6.</p>
      <form action={lock}>
        <Button variant="outline" type="submit">
          Lock
        </Button>
      </form>
    </main>
  );
}
