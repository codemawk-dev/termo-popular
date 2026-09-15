export function computePollResults({ candidates, votes }) {
  const counts = new Map(candidates.map((candidate) => [candidate.id, 0]));

  for (const vote of votes) {
    if (counts.has(vote.candidateId)) {
      counts.set(vote.candidateId, counts.get(vote.candidateId) + 1);
    }
  }

  const totalVotes = [...counts.values()].reduce((sum, count) => sum + count, 0);

  const items = candidates
    .map((candidate) => {
      const voteCount = counts.get(candidate.id) ?? 0;
      const percentage = totalVotes === 0 ? 0 : Number(((voteCount / totalVotes) * 100).toFixed(2));

      return {
        candidateId: candidate.id,
        ballotName: candidate.ballotName,
        ballotNumber: candidate.ballotNumber,
        votes: voteCount,
        percentage
      };
    })
    .sort((left, right) => right.votes - left.votes);

  return { totalVotes, items };
}
