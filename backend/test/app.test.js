import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildApp } from "../src/app.js";

const candidates = [
  {
    id: "cand-1",
    tseId: "123",
    ballotName: "MARINA",
    ballotNumber: "45",
    partyInitials: "PA",
    partyName: "Partido Azul",
    office: "prefeito",
    status: "APTO",
    photoUrl: null
  }
];

describe("app", () => {
  it("returns health information", async () => {
    const app = buildApp({ candidateRepository: { list: async () => candidates } });

    const response = await app.inject({ method: "GET", url: "/health" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ok: true, service: "termo-politico-backend" });
  });

  it("lists candidates for the requested office", async () => {
    const app = buildApp({ candidateRepository: { list: async ({ office }) => candidates.filter((c) => c.office === office) } });

    const response = await app.inject({ method: "GET", url: "/api/candidates?office=prefeito" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      data: candidates,
      meta: {
        city: "Uruçuca",
        state: "BA",
        source: "TSE cache"
      }
    });
  });
  it("allows the local frontend origin through CORS preflight", async () => {
    const app = buildApp({ candidateRepository: { list: async () => candidates } });

    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/candidates?office=prefeito",
      headers: {
        origin: "http://127.0.0.1:5173",
        "access-control-request-method": "GET"
      }
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers["access-control-allow-origin"], "http://127.0.0.1:5173");
    assert.match(response.headers["access-control-allow-headers"], /x-voter-fingerprint/);
  });
  it("records separate anonymous votes for president and governor", async () => {
    const recorded = [];
    const app = buildApp({
      candidateRepository: { list: async () => candidates },
      pollRepository: {
        recordVote: async (vote) => {
          recorded.push(vote);
          return { ...vote, createdAt: "2026-09-15T00:00:00.000Z" };
        },
        listVotes: async () => []
      }
    });

    const headers = {
      "content-type": "application/json",
      "x-voter-fingerprint": "hash-1"
    };

    const president = await app.inject({
      method: "POST",
      url: "/api/polls/votes",
      headers,
      payload: { candidateId: "presidente-1", office: "presidente" }
    });
    const governor = await app.inject({
      method: "POST",
      url: "/api/polls/votes",
      headers,
      payload: { candidateId: "governador-1", office: "governador" }
    });

    assert.equal(president.statusCode, 201);
    assert.equal(governor.statusCode, 201);
    assert.deepEqual(recorded.map((vote) => vote.office), ["presidente", "governador"]);
  });
});

