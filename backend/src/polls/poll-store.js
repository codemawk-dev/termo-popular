export class PollStore {
  #votes = [];
  #fingerprintsByOffice = new Set();

  async recordVote({ candidateId, office, fingerprintHash, userAgent }) {
    const fingerprintKey = `${office}:${fingerprintHash}`;

    if (this.#fingerprintsByOffice.has(fingerprintKey)) {
      throw new Error("vote already recorded for this fingerprint and office");
    }

    const vote = {
      candidateId,
      office,
      fingerprintHash,
      userAgent: userAgent ?? null,
      createdAt: new Date().toISOString()
    };

    this.#fingerprintsByOffice.add(fingerprintKey);
    this.#votes.push(vote);
    return vote;
  }

  async listVotes({ office } = {}) {
    if (!office) {
      return [...this.#votes];
    }

    return this.#votes.filter((vote) => vote.office === office);
  }
}
