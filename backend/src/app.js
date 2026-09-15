import Fastify from "fastify";
import { z } from "zod";

import { computePollResults } from "./polls/results.js";

const voteSchema = z.object({
  candidateId: z.string().min(1),
  office: z.enum(["presidente", "governador", "prefeito", "vice-prefeito", "vereador"]).default("governador")
});

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

function parseAllowedOrigins(value) {
  if (!value) return DEFAULT_ALLOWED_ORIGINS;
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}

function registerCors(app, allowedOrigins) {
  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    reply.header("vary", "origin");
    reply.header("access-control-allow-origin", allowOrigin);
    reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
    reply.header("access-control-allow-headers", "content-type,x-voter-fingerprint");

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });
}

export function buildApp({ candidateRepository, pollRepository, campaignAdRepository, allowedOrigins = parseAllowedOrigins(process.env.FRONTEND_ORIGINS) } = {}) {
  const app = Fastify({ logger: false });

  registerCors(app, allowedOrigins);

  app.get("/health", async () => ({
    ok: true,
    service: "termo-politico-backend"
  }));

  app.get("/api/candidates", async (request) => {
    const office = typeof request.query.office === "string" ? request.query.office : "governador";
    const data = await candidateRepository.list({ office });

    return {
      data,
      meta: {
        city: "Uruçuca",
        state: "BA",
        source: "TSE cache"
      }
    };
  });

  app.post("/api/polls/votes", async (request, reply) => {
    const body = voteSchema.parse(request.body);
    const fingerprintHash = request.headers["x-voter-fingerprint"];

    if (!fingerprintHash) {
      return reply.code(400).send({ error: "missing voter fingerprint" });
    }

    try {
      const vote = await pollRepository.recordVote({
        candidateId: body.candidateId,
        office: body.office,
        fingerprintHash,
        userAgent: request.headers["user-agent"] ?? null
      });

      return reply.code(201).send({ data: { createdAt: vote.createdAt } });
    } catch (error) {
      if (error.message.includes("already recorded")) {
        return reply.code(409).send({ error: "vote already recorded" });
      }

      throw error;
    }
  });

  app.get("/api/polls/results", async (request) => {
    const office = typeof request.query.office === "string" ? request.query.office : "governador";
    const candidates = await candidateRepository.list({ office });
    const votes = await pollRepository.listVotes({ office });

    return {
      data: computePollResults({ candidates, votes }),
      meta: {
        notice:
          "Enquete informal, sem amostragem estatística, sem validação de eleitor e sem valor de pesquisa eleitoral registrada."
      }
    };
  });

  app.get("/api/campaign-ads", async () => ({
    data: campaignAdRepository ? await campaignAdRepository.listActive() : [],
    meta: {
      notice: "Publicidade identificada e separada dos resultados da enquete."
    }
  }));

  return app;
}



