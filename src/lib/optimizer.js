// Exact open-path optimization: fixed origin, free final destination, no return trip.
export function optimize(matrix) {
  const n = matrix.length - 1;
  if (n < 1 || n > 8 || matrix.some(row => row.length !== n + 1)) throw new Error('Informe de 1 a 8 destinos.');
  const memo = new Map();
  function visit(current, mask) {
    if (mask === (1 << n) - 1) return { seconds: 0, order: [] };
    const key = `${current}:${mask}`;
    if (memo.has(key)) return memo.get(key);
    let best = { seconds: Infinity, order: [] };
    for (let next = 1; next <= n; next++) {
      const bit = 1 << (next - 1);
      const cost = matrix[current][next];
      if ((mask & bit) || !Number.isFinite(cost) || cost < 0) continue;
      const rest = visit(next, mask | bit);
      if (cost + rest.seconds < best.seconds) best = { seconds: cost + rest.seconds, order: [next, ...rest.order] };
    }
    memo.set(key, best);
    return best;
  }
  const result = visit(0, 0);
  if (!Number.isFinite(result.seconds)) throw new Error('Não foi possível conectar todos os destinos. Confira os endereços.');
  return result;
}
