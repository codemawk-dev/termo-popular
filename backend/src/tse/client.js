import { FIXED_CANDIDATES } from "./fixed-candidates.js";
import { normalizeTseCandidate } from "./normalize.js";

const BASE_URL = "https://divulgacandcontas.tse.jus.br/divulga/rest/v1";

const OFFICE_CODES = {
  prefeito: "11",
  "vice-prefeito": "12",
  vereador: "13"
};

const TSE_HEADERS = {
  accept: "application/json, text/plain, */*",
  "user-agent": "Mozilla/5.0 (compatible; TermoPolitico/0.1; +https://divulgacandcontas.tse.jus.br/divulga/)",
  referer: "https://divulgacandcontas.tse.jus.br/divulga/"
};

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: TSE_HEADERS });

  if (!response.ok) {
    throw new Error(`TSE request failed with status ${response.status} for ${url}`);
  }

  return response.json();
}

export async function fetchTseCandidate({ year, ue, electionId, candidateId, fetchImpl = fetch }) {
  const url = `${BASE_URL}/candidatura/buscar/${year}/${ue}/${electionId}/candidato/${candidateId}`;
  const payload = await fetchJson(url, fetchImpl);
  return normalizeTseCandidate(payload);
}

export async function fetchConfiguredCandidates({ fetchImpl = fetch } = {}) {
  const candidates = [];

  for (const config of FIXED_CANDIDATES) {
    try {
      const candidate = await fetchTseCandidate({
        year: config.year,
        ue: config.ue,
        electionId: config.electionId,
        candidateId: config.candidateId,
        fetchImpl
      });

      candidates.push({ ...config.fallback, ...candidate, office: config.office });
    } catch (error) {
      candidates.push(config.fallback);
    }
  }

  return candidates;
}

export async function fetchTseCandidates({
  year,
  cityCode,
  electionId,
  office = "prefeito",
  fetchImpl = fetch
}) {
  const officeCode = OFFICE_CODES[office];

  if (!officeCode) {
    throw new Error(`unsupported office: ${office}`);
  }

  const url = `${BASE_URL}/candidatura/listar/${year}/${cityCode}/${electionId}/${officeCode}/candidatos`;
  const payload = await fetchJson(url, fetchImpl);
  const rawCandidates = Array.isArray(payload.candidatos) ? payload.candidatos : [];

  return rawCandidates.map(normalizeTseCandidate);
}
