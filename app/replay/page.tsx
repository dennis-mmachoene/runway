import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getReplay } from '@/lib/replay/snapshot';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/format';

export default async function ReplayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const replay = await getReplay(supabase);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/today">← Back</Link>
        </Button>
        <h1 className="text-sm font-medium text-muted-foreground">Replay</h1>
      </header>

      {!replay ? (
        <Card>
          <CardHeader>
            <CardTitle>No closed cycle to replay yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            When your current cycle closes (your next confirmed income), its story lands here.
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {formatDate(replay.cycleStart)} – {formatDate(replay.cycleEnd)}
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg leading-snug">{replay.story.headline}</CardTitle>
            </CardHeader>
            {replay.story.verdict && (
              <CardContent className="text-sm text-muted-foreground">{replay.story.verdict}</CardContent>
            )}
          </Card>

          {replay.story.beats.length > 0 && (
            <div className="flex flex-col gap-2">
              {replay.story.beats.map((b, i) => (
                <Card key={i}>
                  <CardContent className="flex items-start gap-2 p-4 text-sm">
                    <span aria-hidden>{b.direction === 'up' ? '▲' : '▼'}</span>
                    <span>{b.text}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1 text-sm">
            {replay.story.trend && <p>{replay.story.trend}</p>}
            <p className="text-muted-foreground">{replay.story.uncanny}</p>
            <p className="mt-2 font-medium">{replay.story.forward}</p>
          </div>
        </>
      )}
    </main>
  );
}
