// Lógica pura de votación SUBCO, aislada para poder testearla sin DB ni HTTP.
const VOTE_OPTIONS = ['positive', 'negative', 'abstain'];

// A partir de los votos registrados, los votantes actuales y el plazo, decide si
// la votación está resuelta y, si lo está, su resultado.
// - allVoted: todos los votantes emitieron un voto (explícito o abstención).
// - deadlinePassed: venció el plazo; los ausentes se computan como abstención.
// Aprobado si positivos/(positivos+negativos) >= approvalRatio (las abstenciones
// no cuentan en el denominador). Sin votos explícitos → rechazado.
function computeVoteResult({ votes, voters, deadline, now = Date.now(), approvalRatio = 0.75 }) {
  const voterIds = (voters || []).map(v => String(v));
  const recorded = new Set((votes || []).map(v => String(v.userId)));
  const positives = (votes || []).filter(v => v.vote === 'positive').length;
  const negatives = (votes || []).filter(v => v.vote === 'negative').length;
  const explicitAbstains = (votes || []).filter(v => v.vote === 'abstain').length;
  const allVoted = voterIds.length > 0 && voterIds.every(id => recorded.has(id));
  const deadlinePassed = !!deadline && now >= new Date(deadline).getTime();
  const resolved = allVoted || deadlinePassed;
  const abstentions = explicitAbstains + Math.max(0, voterIds.length - recorded.size);
  if (!resolved) {
    return {
      resolved: false, approved: null,
      positives, negatives, abstentions,
      voted: recorded.size, total: voterIds.length,
      allVoted, deadlinePassed
    };
  }
  const denominator = positives + negatives;
  const approved = denominator > 0 && (positives / denominator) >= approvalRatio;
  return {
    resolved: true, approved,
    positives, negatives, abstentions,
    voted: recorded.size, total: voterIds.length,
    allVoted, deadlinePassed
  };
}

module.exports = { VOTE_OPTIONS, computeVoteResult };
