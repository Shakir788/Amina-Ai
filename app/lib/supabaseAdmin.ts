// app/lib/supabaseAdmin.ts
//
// SERVER-ONLY. Never import this in a "use client" component — the service
// role key must never reach the browser. Use this inside API routes
// (app/api/**/route.ts) where we've already verified the Clerk user
// ourselves, so bypassing RLS here is safe.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});