'use client';

import * as React from 'react';
import { runSimulation } from '@/lib/simulate/actions';
import type { ScenarioView, SimResult } from '@/lib/simulate/simulate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatZAR, formatDate } from '@/lib/format';

function runway(v: ScenarioView): string {
  if (v.status === 'learning_pace' || v.runwayDate == null) return 'learning pace';
  return `${v.runwayDays} days · ${formatDate(v.runwayDate)}`;
}

export function SimulateClient() {
  const [purchase, setPurchase] = React.useState('');
  const [incomeDelta, setIncomeDelta] = React.useState('');
  const [extraCommitment, setExtraCommitment] = React.useState('');
  const [fasterPct, setFasterPct] = React.useState('0');
  const [result, setResult] = React.useState<SimResult | null>(null);
  const [noCycle, setNoCycle] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function run() {
    startTransition(async () => {
      const r = await runSimulation({
        oneOffPurchase: Number(purchase) || 0,
        incomeDelta: Number(incomeDelta) || 0,
        extraMonthlyCommitment: Number(extraCommitment) || 0,
        flowRateMultiplier: 1 + (Number(fasterPct) || 0) / 100,
      });
      if (r === null) setNoCycle(true);
      else {
        setNoCycle(false);
        setResult(r);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Stack the pain</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="text-xs text-muted-foreground">
            One-off purchase (R)
            <Input type="number" min="0" step="0.01" value={purchase} onChange={(e) => setPurchase(e.target.value)} placeholder="e.g. 8000 for a PS5" />
          </label>
          <label className="text-xs text-muted-foreground">
            Income change (R, negative to lose income)
            <Input type="number" step="0.01" value={incomeDelta} onChange={(e) => setIncomeDelta(e.target.value)} placeholder="e.g. -5000 lose a client" />
          </label>
          <label className="text-xs text-muted-foreground">
            Extra monthly commitment (R, e.g. rent rises)
            <Input type="number" min="0" step="0.01" value={extraCommitment} onChange={(e) => setExtraCommitment(e.target.value)} placeholder="e.g. 1000" />
          </label>
          <label className="text-xs text-muted-foreground">
            Spend faster (%)
            <Input type="number" step="1" value={fasterPct} onChange={(e) => setFasterPct(e.target.value)} placeholder="e.g. 20" />
          </label>
          <Button onClick={run} disabled={pending}>
            {pending ? 'Running…' : 'See both futures'}
          </Button>
        </CardContent>
      </Card>

      {noCycle && (
        <p className="text-sm text-muted-foreground">
          Add a confirmed income first — there&apos;s no open cycle to simulate against.
        </p>
      )}

      {result && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">As you are</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <p className="text-2xl font-semibold">{formatZAR(result.baseline.spendablePool)}</p>
              <p className="text-xs text-muted-foreground">{runway(result.baseline)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">If you do this</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <p className="text-2xl font-semibold">{formatZAR(result.scenario.spendablePool)}</p>
              <p className="text-xs text-muted-foreground">{runway(result.scenario)}</p>
            </CardContent>
          </Card>
          <p className="col-span-2 text-sm">
            That&apos;s {formatZAR(result.poolDelta)} to safe-to-spend
            {result.runwayDaysDelta != null && (
              <>, and {Math.round(result.runwayDaysDelta)} days of runway</>
            )}
            . What does it cost your future self?
          </p>
        </div>
      )}
    </div>
  );
}
