const OFFICE_NAMES = {
  prefeito: "prefeito",
  prefeita: "prefeito",
  viceprefeito: "vice-prefeito",
  "vice-prefeito": "vice-prefeito",
  "vice-prefeita": "vice-prefeito",
  vereador: "vereador",
  vereadora: "vereador",
  governador: "governador",
  governadora: "governador",
  presidente: "presidente"
};

function normalizeOffice(value) {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, "-");

  return OFFICE_NAMES[normalized] ?? normalized;
}

export function normalizeTseCandidate(payload) {
  return {
    tseId: String(payload.id ?? payload.sq_CANDIDATO),
    ballotName: payload.nomeUrna ?? payload.nm_URNA,
    ballotNumber: String(payload.numero ?? payload.nr_CANDIDATO),
    partyName: payload.nomePartido ?? payload.nm_PARTIDO ?? payload.partido?.nome,
    partyInitials: payload.siglaPartido ?? payload.sg_PARTIDO ?? payload.partido?.sigla,
    office: normalizeOffice(payload.cargo?.nome ?? payload.ds_CARGO),
    status: payload.situacaoCandidatura ?? payload.situacaoCandidato ?? payload.descricaoSituacaoCandidato ?? null,
    photoUrl: payload.urlFoto ?? payload.fotoUrl ?? null
  };
}

