import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Check, X } from "lucide-react";
import "./styles.css";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3333").replace(
    /\/+$/,
    "",
  );
const officeOrder = ["presidente", "governador"];

const fallbackByOffice = {
  governador: [
    {
      id: "fixed-acm-neto",
      ballotName: "ACM Neto",
      ballotNumber: "44",
      partyInitials: "UNIÃO",
      percentage: 52,
      votes: 0,
      color: "blue",
    },
    {
      id: "fixed-jeronimo",
      ballotName: "Jerônimo Rodrigues",
      ballotNumber: "13",
      partyInitials: "PT",
      percentage: 48,
      votes: 0,
      color: "red",
    },
  ],
  presidente: [
    {
      id: "fixed-lula",
      ballotName: "Lula",
      ballotNumber: "13",
      partyInitials: "PT",
      percentage: 50,
      votes: 0,
      color: "red",
    },
    {
      id: "fixed-flavio",
      ballotName: "Flavio Bolsonaro",
      ballotNumber: "22",
      partyInitials: "PL",
      percentage: 50,
      votes: 0,
      color: "blue",
    },
  ],
};

const officeLabels = {
  governador: "Governador",
  presidente: "Presidente",
};

function normalizeName(name) {
  return name
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1))
    .join(" ");
}

function getFingerprint() {
  const key = "termo-politico-fingerprint";
  const existing = window.localStorage.getItem(key);

  if (existing) return existing;

  const value = crypto.randomUUID();
  window.localStorage.setItem(key, value);
  return value;
}

async function fetchJson(path, options) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Nao foi possivel concluir a operacao.");
  }

  return payload;
}

function usePollData(office) {
  const [state, setState] = useState({
    status: "loading",
    candidates: fallbackByOffice[office],
    totalVotes: 0,
    error: null,
  });

  async function load() {
    setState((current) => ({ ...current, status: "loading", error: null }));

    try {
      const [candidatePayload, resultPayload] = await Promise.all([
        fetchJson(`/api/candidates?office=${office}`),
        fetchJson(`/api/polls/results?office=${office}`),
      ]);

      const resultById = new Map(
        (resultPayload.data?.items || []).map((item) => [
          item.candidateId,
          item,
        ]),
      );
      const candidates = (candidatePayload.data || []).map(
        (candidate, index) => {
          const result = resultById.get(candidate.id);
          return {
            ...candidate,
            ballotName: normalizeName(candidate.ballotName),
            percentage: result?.percentage ?? 0,
            votes: result?.votes ?? 0,
            color: ["blue", "yellow", "black", "red"][index % 4],
          };
        },
      );

      setState({
        status: "ready",
        candidates: candidates.length ? candidates : fallbackByOffice[office],
        totalVotes: resultPayload.data?.totalVotes ?? 0,
        error: null,
      });
    } catch (error) {
      setState({
        status: "fallback",
        candidates: fallbackByOffice[office],
        totalVotes: 0,
        error: error.message,
      });
    }
  }

  useEffect(() => {
    load();
  }, [office]);

  return { ...state, reload: load };
}

function CandidateRow({ candidate, index }) {
  return (
    <div className="candidate-row">
      <div className="candidate-line">
        <div className="candidate-identity">
          <span className={`rank rank-${index + 1}`}>{index + 1}</span>
          <div>
            <strong>{candidate.ballotName}</strong>
            <span>
              {candidate.ballotNumber} · {candidate.partyInitials || "PARTIDO"}
            </span>
          </div>
        </div>
        <b>{candidate.percentage}%</b>
      </div>
      <div
        className="track"
        aria-label={`${candidate.ballotName}: ${candidate.percentage}%`}
      >
        <span
          className={`fill ${candidate.color}`}
          style={{ width: `${Math.max(3, candidate.percentage)}%` }}
        />
      </div>
    </div>
  );
}

function VoteModal({
  candidatesByOffice,
  selections,
  currentOffice,
  onSelect,
  onNext,
  onBack,
  onClose,
  onSubmit,
  submitState,
}) {
  const candidates = candidatesByOffice[currentOffice] || [];
  const selectedId = selections[currentOffice] || "";
  const currentIndex = officeOrder.indexOf(currentOffice);
  const isLastStep = currentIndex === officeOrder.length - 1;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vote-title"
    >
      <section className="phone modal-phone">
        <div className="form-header">
          <div className="form-topline">
            <p>Participacao anonima</p>
            <button
              className="icon-button"
              type="button"
              onClick={onClose}
              aria-label="Fechar formulario"
            >
              <X size={20} strokeWidth={2.4} />
            </button>
          </div>
          <div
            className="step-indicator"
            aria-label={`Etapa ${currentIndex + 1} de ${officeOrder.length}`}
          >
            {officeOrder.map((office) => (
              <span
                key={office}
                className={
                  office === currentOffice
                    ? "active"
                    : selections[office]
                      ? "done"
                      : ""
                }
              />
            ))}
          </div>
          <h2 id="vote-title">Escolha para {officeLabels[currentOffice]}</h2>
          <p>
            Responda uma vez para Presidente e uma vez para Governador. O envio
            continua anonimo e informal.
          </p>
        </div>

        <div className="options-list">
          {candidates.map((candidate) => {
            const selected = candidate.id === selectedId;
            return (
              <button
                className={`option ${selected ? "selected" : ""}`}
                type="button"
                key={candidate.id}
                onClick={() => onSelect(currentOffice, candidate.id)}
              >
                <span className="option-left">
                  <span className="radio-dot">
                    {selected ? <span /> : null}
                  </span>
                  <strong>{candidate.ballotName}</strong>
                </span>
                <b>{candidate.percentage}%</b>
              </button>
            );
          })}
        </div>

        <div className="submit-block">
          <div className="step-actions">
            {currentIndex > 0 ? (
              <button
                className="secondary-button"
                type="button"
                onClick={onBack}
              >
                Voltar
              </button>
            ) : null}
            <button
              className="primary-button"
              type="button"
              disabled={!selectedId || submitState === "sending"}
              onClick={isLastStep ? onSubmit : onNext}
            >
              {submitState === "sending"
                ? "Registrando..."
                : isLastStep
                  ? "Registrar respostas"
                  : "Continuar"}
            </button>
          </div>
          <p>
            {submitState === "sent"
              ? "Respostas registradas."
              : "Sem CPF, sem login, sem identificacao publica."}
          </p>
        </div>
      </section>
    </div>
  );
}

function App() {
  const [office, setOffice] = useState("governador");
  const governorData = usePollData("governador");
  const presidentData = usePollData("presidente");
  const [modalOpen, setModalOpen] = useState(false);
  const [currentVoteOffice, setCurrentVoteOffice] = useState("presidente");
  const [selections, setSelections] = useState({
    presidente: "",
    governador: "",
  });
  const [submitState, setSubmitState] = useState("idle");

  const pollDataByOffice = {
    governador: governorData,
    presidente: presidentData,
  };

  const activeData = pollDataByOffice[office];
  const candidatesByOffice = {
    governador: governorData.candidates,
    presidente: presidentData.candidates,
  };

  const sortedCandidates = useMemo(
    () =>
      [...activeData.candidates].sort(
        (a, b) => (b.percentage || 0) - (a.percentage || 0),
      ),
    [activeData.candidates],
  );

  const sortedCandidatesByOffice = useMemo(
    () => ({
      governador: [...governorData.candidates].sort(
        (a, b) => (b.percentage || 0) - (a.percentage || 0),
      ),
      presidente: [...presidentData.candidates].sort(
        (a, b) => (b.percentage || 0) - (a.percentage || 0),
      ),
    }),
    [governorData.candidates, presidentData.candidates],
  );

  function openVoteFlow() {
    setSelections({
      presidente: sortedCandidatesByOffice.presidente[0]?.id || "",
      governador: sortedCandidatesByOffice.governador[0]?.id || "",
    });
    setCurrentVoteOffice("presidente");
    setSubmitState("idle");
    setModalOpen(true);
  }

  function selectCandidate(selectedOffice, candidateId) {
    setSelections((current) => ({ ...current, [selectedOffice]: candidateId }));
  }

  async function submitVote() {
    if (!selections.presidente || !selections.governador) return;
    setSubmitState("sending");
    const fingerprint = getFingerprint();

    try {
      await Promise.all(
        officeOrder.map((selectedOffice) =>
          fetchJson("/api/polls/votes", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-voter-fingerprint": fingerprint,
            },
            body: JSON.stringify({
              candidateId: selections[selectedOffice],
              office: selectedOffice,
            }),
          }),
        ),
      );

      setSubmitState("sent");
      await Promise.all([governorData.reload(), presidentData.reload()]);
      window.setTimeout(() => {
        setModalOpen(false);
        setSubmitState("idle");
      }, 900);
    } catch (error) {
      setSubmitState(
        error.message.includes("recorded") ? "duplicate" : "error",
      );
    }
  }

  return (
    <main className="app-shell">
      <section
        className="phone main-phone"
        aria-label="Termometro Popular de Urucuca"
      >
        <header className="hero">
          <div className="meta-row">
            <div className="brand-lockup">
              <span /> Urucuca agora
            </div>
            <time>{new Date().toLocaleDateString("pt-BR")}</time>
          </div>
          <h1>Termometro Popular</h1>
          <p>
            Uma enquete informal para acompanhar o clima politico de 2026, sem
            cadastro e sem mostrar quem participou.
          </p>
        </header>

        <aside className="notice-box">
          <strong>Enquete informal</strong>
          <p>
            Nao e pesquisa registrada, nao e resultado oficial e nao valida
            eleitor. Sao respostas espontaneas de visitantes.
          </p>
        </aside>

        <section className="race-section">
          <div
            className="office-tabs"
            role="tablist"
            aria-label="Cargo da enquete"
          >
            {Object.entries(officeLabels).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={office === value ? "active" : ""}
                onClick={() => setOffice(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="section-head">
            <div>
              <p>Corrida de hoje</p>
              <h2>{officeLabels[office]}</h2>
            </div>
            <strong>{activeData.totalVotes.toLocaleString("pt-BR")}</strong>
          </div>

          <div className="race-list">
            {sortedCandidates.map((candidate, index) => (
              <CandidateRow
                key={candidate.id}
                candidate={candidate}
                index={index}
              />
            ))}
          </div>
        </section>

        <section className="cta-block">
          <button
            className="primary-button"
            type="button"
            onClick={openVoteFlow}
          >
            Participar da enquete
          </button>
          <div className="privacy-note">
            <span>
              <Check size={13} strokeWidth={3} />
            </span>
            <p>
              Sua resposta e anonima. O site limita abusos tecnicos, mas nao
              confirma identidade eleitoral.
            </p>
          </div>
          {activeData.status === "fallback" ? (
            <button
              className="inline-alert"
              type="button"
              onClick={activeData.reload}
            >
              {activeData.error}. Tentar novamente
            </button>
          ) : null}
        </section>

        <footer className="methodology">
          <div>
            <strong>Fonte dos nomes</strong>
            <p>DivulgaCandContas/TSE, com cache local.</p>
          </div>
          <div>
            <strong>Atualizacao</strong>
            <p>Dados recalculados em tempo quase real.</p>
          </div>
        </footer>
      </section>

      {modalOpen ? (
        <VoteModal
          candidatesByOffice={sortedCandidatesByOffice}
          selections={selections}
          currentOffice={currentVoteOffice}
          onSelect={selectCandidate}
          onNext={() => setCurrentVoteOffice("governador")}
          onBack={() => setCurrentVoteOffice("presidente")}
          onClose={() => setModalOpen(false)}
          onSubmit={submitVote}
          submitState={submitState}
        />
      ) : null}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
