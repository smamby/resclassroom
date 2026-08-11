const { computeVoteResult, VOTE_OPTIONS } = require('../voting');

// voters: ids de los miembros SUBCO actuales (roles con subco en DB).
const SUBCO = ['u1', 'u2', 'u3', 'u4'];

function vote(userId, v) { return { userId, vote: v, comment: '', votedAt: new Date() }; }

describe('computeVoteResult', () => {
  test('sigue abierta si nadie votó y no venció el plazo', () => {
    const r = computeVoteResult({ votes: [], voters: SUBCO, deadline: Date.now() + 100000 });
    expect(r.resolved).toBe(false);
  });

  test('aprueba con 3 a favor y 1 ausente al vencer el plazo (3/3 >= 0.75)', () => {
    const r = computeVoteResult({
      votes: [vote('u1', 'positive'), vote('u2', 'positive'), vote('u3', 'positive')],
      voters: SUBCO,
      deadline: Date.now() - 1,
      approvalRatio: 0.75
    });
    expect(r.resolved).toBe(true);
    expect(r.approved).toBe(true);
    expect(r.abstentions).toBe(1);
  });

  test('rechaza con 2 a favor y 1 en contra al cerrar (2/3 < 0.75)', () => {
    const r = computeVoteResult({
      votes: [vote('u1', 'positive'), vote('u2', 'positive'), vote('u3', 'negative')],
      voters: SUBCO,
      deadline: Date.now() - 1
    });
    expect(r.resolved).toBe(true);
    expect(r.approved).toBe(false);
  });

  test('cierre temprano cuando votan todos', () => {
    const r = computeVoteResult({
      votes: [vote('u1', 'positive'), vote('u2', 'positive'), vote('u3', 'positive'), vote('u4', 'abstain')],
      voters: SUBCO,
      deadline: Date.now() + 100000
    });
    expect(r.resolved).toBe(true);
    expect(r.approved).toBe(true); // 3/3
  });

  test('sin votos explícitos nunca aprueba', () => {
    const r = computeVoteResult({
      votes: [vote('u1', 'abstain'), vote('u2', 'abstain')],
      voters: SUBCO,
      deadline: Date.now() - 1
    });
    expect(r.approved).toBe(false);
  });

  test('respeta umbral configurable', () => {
    // 3/4 = 0.75 aprueba con umbral 0.75 pero no con 0.8
    const votes = [vote('u1', 'positive'), vote('u2', 'positive'), vote('u3', 'positive'), vote('u4', 'negative')];
    expect(computeVoteResult({ votes, voters: SUBCO, deadline: Date.now() - 1, approvalRatio: 0.75 }).approved).toBe(true);
    expect(computeVoteResult({ votes, voters: SUBCO, deadline: Date.now() - 1, approvalRatio: 0.8 }).approved).toBe(false);
  });

  test('expone opciones de voto válidas', () => {
    expect(VOTE_OPTIONS).toEqual(['positive', 'negative', 'abstain']);
  });
});
