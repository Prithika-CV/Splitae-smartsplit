// Run with: node tests/calculations.test.js
const assert = require('assert');
const C = require('../src/calculations.js');

const mk = (id) => ({ id, name: id });
const people = ['a', 'p', 'r', 's'].map(mk);
const item = (id, price, who) => ({ id, name: id, price, assignedPersonIds: who });

// --- PRD demo bill ---
const demo = [
  item('pizza', 800, ['a', 'p', 'r', 's']),
  item('pasta', 500, ['a', 'p']),
  item('burger', 350, ['r']),
  item('drinks', 400, ['a', 's']),
  item('dessert', 300, ['a', 'p', 'r', 's'])
];
let res = C.calculatePersonTotals(demo, people, 5, 10);
assert.strictEqual(res.subtotal, 235000);
assert.strictEqual(res.tax, 11750);
assert.strictEqual(res.tip, 23500);
assert.strictEqual(res.total, 270250);
assert.strictEqual(res.rows.reduce((s, r) => s + r.total, 0), res.total);
assert.ok(res.complete);

// --- PRD example: 1000 subtotal, Alex 400 -> tax 20, tip 40, total 460 ---
const ex = [item('x', 400, ['a']), item('y', 600, ['p'])];
res = C.calculatePersonTotals(ex, people.slice(0, 2), 5, 10);
const alex = res.rows[0];
assert.deepStrictEqual([alex.subtotal, alex.tax, alex.tip, alex.total], [40000, 2000, 4000, 46000]);

// --- uneven cents: 100 / 3 ---
const shares = C.getItemShares(item('t', 100, ['a', 'p', 'r']), people);
assert.deepStrictEqual([shares.a, shares.p, shares.r], [3334, 3333, 3333]);

// --- floating-point traps ---
assert.strictEqual(C.toCents(10.5), 1050);
assert.strictEqual(C.toCents(1.005), 101);
assert.strictEqual(C.toCents(0.1 + 0.2), 30);

// --- stress: sums always exact ---
for (let n = 0; n < 2000; n++) {
  const ppl = people.slice(0, 1 + Math.floor(Math.random() * 4));
  const items = [];
  const count = 1 + Math.floor(Math.random() * 6);
  for (let i = 0; i < count; i++) {
    const who = ppl.filter(() => Math.random() > 0.4).map((p) => p.id);
    if (!who.length) who.push(ppl[0].id);
    items.push(item('i' + i, Math.round(Math.random() * 100000) / 100 + 0.01, who));
  }
  const tax = Math.round(Math.random() * 280) / 10;
  const tip = Math.round(Math.random() * 400) / 10;
  const r = C.calculatePersonTotals(items, ppl, tax, tip);
  assert.strictEqual(r.rows.reduce((s, x) => s + x.total, 0), r.total, 'sum mismatch');
  assert.strictEqual(r.rows.reduce((s, x) => s + x.subtotal, 0), r.subtotal, 'subtotal mismatch');
  assert.ok(r.rows.every((x) => Number.isInteger(x.total) && x.total >= 0));
}

// --- unassigned item blocks completeness ---
res = C.calculatePersonTotals([item('z', 100, [])], people, 5, 10);
assert.strictEqual(res.complete, false);
assert.strictEqual(res.unassignedCount, 1);

// --- empty bill ---
res = C.calculatePersonTotals([], people, 5, 10);
assert.strictEqual(res.total, 0);

console.log('All calculation tests passed.');
