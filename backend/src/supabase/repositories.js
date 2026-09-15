import { createClient } from "@supabase/supabase-js";

import { PollStore } from "../polls/poll-store.js";
import { FIXED_CANDIDATES } from "../tse/fixed-candidates.js";

const DEFAULT_CANDIDATES = FIXED_CANDIDATES.map((candidate) => candidate.fallback);

function mapCandidate(row) {
  return {
    id: row.id,
    tseId: row.tse_id,
    ballotName: row.ballot_name,
    ballotNumber: row.ballot_number,
    partyInitials: row.party_initials,
    partyName: row.party_name,
    office: row.office,
    status: row.status,
    photoUrl: row.photo_url
  };
}

export function createCandidateRepository(client) {
  return {
    async list({ office = "governador" } = {}) {
      const { data, error } = await client.from("candidates").select("*").eq("office", office).order("ballot_name");

      if (error) {
        throw error;
      }

      return data.map(mapCandidate);
    }
  };
}

export function createPollRepository(client) {
  return {
    async recordVote({ candidateId, office, fingerprintHash, userAgent }) {
      const { data, error } = await client
        .from("poll_votes")
        .insert({
          candidate_id: candidateId,
          office,
          fingerprint_hash: fingerprintHash,
          user_agent: userAgent
        })
        .select("created_at")
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("vote already recorded for this fingerprint");
        }

        throw error;
      }

      return { candidateId, office, fingerprintHash, userAgent, createdAt: data.created_at };
    },

    async listVotes({ office } = {}) {
      let query = client.from("poll_votes").select("candidate_id, office");

      if (office) {
        query = query.eq("office", office);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data.map((row) => ({ candidateId: row.candidate_id, office: row.office }));
    }
  };
}

export function createCampaignAdRepository(client) {
  return {
    async listActive() {
      const { data, error } = await client
        .from("campaign_ads")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data.map((row) => ({
        id: row.id,
        title: row.title,
        sponsorName: row.sponsor_name,
        sponsorDocument: row.sponsor_document,
        body: row.body,
        imageUrl: row.image_url,
        startsAt: row.starts_at,
        endsAt: row.ends_at
      }));
    }
  };
}

function createMemoryCandidateRepository() {
  return {
    async list({ office = "governador" } = {}) {
      return DEFAULT_CANDIDATES.filter((candidate) => candidate.office === office);
    }
  };
}

export function createRepositories(env = process.env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    const pollStore = new PollStore();

    return {
      candidateRepository: createMemoryCandidateRepository(),
      pollRepository: pollStore,
      campaignAdRepository: { listActive: async () => [] }
    };
  }

  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return {
    candidateRepository: createCandidateRepository(client),
    pollRepository: createPollRepository(client),
    campaignAdRepository: createCampaignAdRepository(client)
  };
}

