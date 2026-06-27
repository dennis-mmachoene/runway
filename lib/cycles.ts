import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cycle, Settings } from "@/lib/db/types";

const SETTINGS_DEFAULTS: Omit<Settings, "user_id"> = {
  floor_default: 0,
  lump_threshold: 1000,
  savings_mode: "automatic",
  leftover_mode: "sweep_emergency",
  emergency_fund: 0,
};

export async function getSettings(
  supabase: SupabaseClient,
): Promise<Omit<Settings, "user_id"> & Partial<Pick<Settings, "user_id">>> {
  const { data } = await supabase.from("settings").select("*").maybeSingle();
  return (data as Settings) ?? SETTINGS_DEFAULTS;
}

export async function getOpenCycle(
  supabase: SupabaseClient,
): Promise<Cycle | null> {
  const { data } = await supabase
    .from("cycles")
    .select("*")
    .eq("status", "open")
    .maybeSingle();
  return (data as Cycle) ?? null;
}

/**
 * Cycle lifecycle: a confirmed income event opens a new cycle and closes the
 * prior open one. Only one cycle is ever `open`. The new cycle inherits the
 * floor from settings at open time.
 *
 * NOTE: applying `leftover_mode` at close (sweep vs roll) is Phase 7 (reconcile);
 * here we only close the prior cycle — we never silently reset leftover.
 */
export async function openCycleForIncome(
  supabase: SupabaseClient,
  income: { id: string; event_at: string },
): Promise<void> {
  const open = await getOpenCycle(supabase);
  if (open) {
    await supabase
      .from("cycles")
      .update({
        status: "closed",
        end_event_id: income.id,
        end_at: income.event_at,
      })
      .eq("id", open.id);
  }
  const settings = await getSettings(supabase);
  await supabase.from("cycles").insert({
    start_event_id: income.id,
    start_at: income.event_at,
    status: "open",
    floor_amount: settings.floor_default ?? 0,
  });
}
