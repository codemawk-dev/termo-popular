import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PollStore } from "../src/polls/poll-store.js";
import { computePollResults } from "../src/polls/results.js";
import { fetchConfiguredCandidates, fetchTseCandidate, fetchTseCandidates } from "../src/tse/client.js";
import { normalizeTseCandidate } from "../src/tse/normalize.js";

describe("normalizeTseCandidate", () => {
  it("maps a TSE list candidate payload to the public candidate shape", () => {
    const candidate = normalizeTseCandidate({
      id: 123,
      nomeUrna: "MARINA",
      numero: 45,
      nomePartido: "Partido Azul",
      siglaPartido: "PA",
      cargo: { nome: "Prefeito" },
      situacaoCandidatura: "APTO",
      urlFoto: "https://example.com/foto.jpg"
    });

    assert.deepEqual(candidate, {
      tseId: "123",
      ballotName: "MARINA",
      ballotNumber: "45",
      partyName: "Partido Azul",
      partyInitials: "PA",
      office: "prefeito",
      status: "APTO",
      photoUrl: "https://example.com/foto.jpg"
    });
  });

  it("maps a TSE detail candidate payload to the public candidate shape", () => {
    const candidate = normalizeTseCandidate({
      id: 50002533190,
      nomeUrna: "ACM NETO",
      numero: 44,
      partido: { nome: "União Brasil", sigla: "UNIÃO" },
      cargo: { nome: "Governador" },
      descricaoSituacaoCandidato: "Consta da urna",
      fotoUrl: "https://example.com/acm.jpg"
    });

    assert.deepEqual(candidate, {
      tseId: "50002533190",
      ballotName: "ACM NETO",
      ballotNumber: "44",
      partyName: "União Brasil",
      partyInitials: "UNIÃO",
      office: "governador",
      status: "Consta da urna",
      photoUrl: "https://example.com/acm.jpg"
    });
  });
});

describe("TSE client", () => {
  it("calls the TSE candidates endpoint with browser-like headers", async () => {
    let capturedUrl;
    let capturedOptions;

    await fetchTseCandidates({
      year: "2024",
      cityCode: "38490",
      electionId: "2045202024",
      office: "prefeito",
      fetchImpl: async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return { ok: true, json: async () => ({ candidatos: [] }) };
      }
    });

    assert.equal(
      capturedUrl,
      "https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/listar/2024/38490/2045202024/11/candidatos"
    );
    assert.equal(capturedOptions.headers.accept, "application/json, text/plain, */*");
    assert.match(capturedOptions.headers["user-agent"], /Mozilla/);
    assert.equal(capturedOptions.headers.referer, "https://divulgacandcontas.tse.jus.br/divulga/");
  });

  it("calls the TSE detail endpoint for an individual candidate", async () => {
    let capturedUrl;

    const candidate = await fetchTseCandidate({
      year: "2026",
      ue: "BA",
      electionId: "20322002026",
      candidateId: "50002533190",
      fetchImpl: async (url) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => ({
            sq_CANDIDATO: 50002533190,
            nm_URNA: "ACM NETO",
            nr_CANDIDATO: "44",
            nm_PARTIDO: "União Brasil",
            sg_PARTIDO: "UNIÃO",
            ds_CARGO: "Governador"
          })
        };
      }
    });

    assert.equal(
      capturedUrl,
      "https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/2026/BA/20322002026/candidato/50002533190"
    );
    assert.equal(candidate.ballotName, "ACM NETO");
    assert.equal(candidate.office, "governador");
  });

  it("fetches the configured 2026 governor and president candidates", async () => {
    const urls = [];

    const candidates = await fetchConfiguredCandidates({
      fetchImpl: async (url) => {
        urls.push(url);
        const candidateId = url.split("/").at(-1);
        return {
          ok: true,
          json: async () => ({
            sq_CANDIDATO: candidateId,
            nm_URNA: candidateId === "280002551544" ? "FLAVIO BOLSONARO" : "CANDIDATO",
            nr_CANDIDATO: candidateId === "280002551544" ? "22" : "13",
            nm_PARTIDO: "Partido",
            sg_PARTIDO: "P",
            ds_CARGO: url.includes("/BR/") ? "Presidente" : "Governador"
          })
        };
      }
    });

    assert.equal(candidates.length, 4);
    assert.ok(urls.some((url) => url.endsWith("/50002533190")));
    assert.ok(urls.some((url) => url.endsWith("/280002551544")));
    assert.deepEqual([...new Set(candidates.map((candidate) => candidate.office))], ["governador", "presidente"]);
  });
});

describe("PollStore", () => {
  it("stores one anonymous vote per office for the same technical fingerprint", async () => {
    const store = new PollStore();

    await store.recordVote({
      candidateId: "presidente-1",
      office: "presidente",
      fingerprintHash: "hash-1",
      userAgent: "test"
    });

    await store.recordVote({
      candidateId: "governador-1",
      office: "governador",
      fingerprintHash: "hash-1",
      userAgent: "test"
    });

    await assert.rejects(
      () =>
        store.recordVote({
          candidateId: "presidente-2",
          office: "presidente",
          fingerprintHash: "hash-1",
          userAgent: "test"
        }),
      /already recorded/
    );
  });
});

describe("computePollResults", () => {
  it("returns percentages and totals from candidates and votes", () => {
    const results = computePollResults({
      candidates: [
        { id: "cand-1", ballotName: "MARINA", ballotNumber: "45" },
        { id: "cand-2", ballotName: "RAFAEL", ballotNumber: "12" }
      ],
      votes: [
        { candidateId: "cand-1" },
        { candidateId: "cand-1" },
        { candidateId: "cand-2" }
      ]
    });

    assert.deepEqual(results, {
      totalVotes: 3,
      items: [
        {
          candidateId: "cand-1",
          ballotName: "MARINA",
          ballotNumber: "45",
          votes: 2,
          percentage: 66.67
        },
        {
          candidateId: "cand-2",
          ballotName: "RAFAEL",
          ballotNumber: "12",
          votes: 1,
          percentage: 33.33
        }
      ]
    });
  });
});


