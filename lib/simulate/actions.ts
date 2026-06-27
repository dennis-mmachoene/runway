'use server';

import { createClient } from '@/lib/supabase/server';
import { buildEngineInput } from '@/lib/engine/snapshot';
import { simulate, type Shocks, type SimResult } from './simulate';

/** Run a what-if against the live engine input. Null when there's no open cycle. */
export async function runSimulation(shocks: Shocks): Promise<SimResult | null> {
  const supabase = await createClient();
  const input = await buildEngineInput(supabase);
  if (!input) return null;
  return simulate(input, shocks);
}
