import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

import { fetchConfiguredCandidates, fetchTseCandidates } from "../src/tse/client.js";

const mode = process.argv[2] ?? "fixed";

async function loadCandidates() {
  if (mode === "fixed") {
    return fetchConfiguredCandidates();
  }

  const envRequired = ["TSE_YEAR", "TSE_CITY_CODE", "TSE_ELECTION_ID"];
  const envMissing = envRequired.filter((key) => !process.env[key]);

  if (envMissing.length > 0) {
    throw new Error(`Missing environment variables: ${envMissing.join(", ")}`);
  }

  return fetchTseCandidates({
    year: process.env.TSE_YEAR,
    cityCode: process.env.TSE_CITY_CODE,
    electionId: process.env.TSE_ELECTION_ID,
    office: mode
  });
}

const candidates = await loadCandidates();
const rows = candidates.map((candidate) => ({
  tse_id: candidate.tseId,
  ballot_name: candidate.ballotName,
  ballot_number: candidate.ballotNumber,
  party_name: candidate.partyName,
  party_initials: candidate.partyInitials,
  office: candidate.office,
  status: candidate.status,
  photo_url: candidate.photoUrl
}));

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log(JSON.stringify({ synced: false, reason: "missing_supabase_service_role", rows }, null, 2));
  process.exit(0);
}

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const { error } = await client.from("candidates").upsert(rows, {
  onConflict: "tse_id,office"
});

if (error) {
  throw error;
}

const { error: logError } = await client.from("sync_logs").insert({
  source: "tse",
  office: mode,
  status: "success",
  message: `Synced ${rows.length} candidates`
});

if (logError) {
  throw logError;
}

console.log(`Synced ${rows.length} candidates using mode ${mode}.`);
