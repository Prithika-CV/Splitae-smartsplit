/*
 * SmartSplit — pure calculation functions.
 * No DOM access. All money is handled as integer cents internally.
 */
(function (root) {
  'use strict';

  /** Rupees (number) -> integer cents. */
  function toCents(value) {
    var n = Number(value);
    if (!isFinite(n)) return 0;
    return Math.round(Number((n * 100).toPrecision(12)));
  }

  /** Integer cents -> rupees (number). Display only. */
  function fromCents(cents) {
    return cents / 100;
  }

  /** Percent (e.g. 12.5) -> hundredths of a percent (1250). */
  function percentToBasis(percent) {
    var n = Number(percent);
    if (!isFinite(n) || n < 0) return 0;
    return Math.round(n * 100);
  }

  /** Subtotal of every item, in cents. */
  function calculateSubtotal(items) {
    return items.reduce(function (sum, item) {
      return sum + toCents(item.price);
    }, 0);
  }

  /**
   * Split one item between its assigned people (people order is the tie-break).
   * Leftover cents go one-by-one to the first people, so shares always add up
   * to exactly the item price. Returns { personId: cents }.
   */
  function getItemShares(item, people) {
    var ids = people
      .filter(function (p) { return item.assignedPersonIds.indexOf(p.id) !== -1; })
      .map(function (p) { return p.id; });
    var shares = {};
    if (ids.length === 0) return shares;
    var cents = toCents(item.price);
    var base = Math.floor(cents / ids.length);
    var remainder = cents - base * ids.length;
    ids.forEach(function (id, index) {
      shares[id] = base + (index < remainder ? 1 : 0);
    });
    return shares;
  }

  /** Each person's item subtotal in cents. Unassigned items are skipped. */
  function calculatePersonSubtotals(items, people) {
    var totals = {};
    people.forEach(function (p) { totals[p.id] = 0; });
    items.forEach(function (item) {
      var shares = getItemShares(item, people);
      Object.keys(shares).forEach(function (id) {
        totals[id] += shares[id];
      });
    });
    return totals;
  }

  /** Total tax in cents. */
  function calculateTax(subtotalCents, taxPercent) {
    return Math.round((subtotalCents * percentToBasis(taxPercent)) / 10000);
  }

  /** Total tip in cents. */
  function calculateTip(subtotalCents, tipPercent) {
    return Math.round((subtotalCents * percentToBasis(tipPercent)) / 10000);
  }

  /** Subtotal + tax + tip, in cents. */
  function calculateBillTotal(subtotalCents, taxCents, tipCents) {
    return subtotalCents + taxCents + tipCents;
  }

  /**
   * Spread totalCents across people in proportion to their subtotals.
   * After rounding, any difference goes to the person with the largest subtotal
   * so the parts always sum to exactly totalCents.
   */
  function allocateProportionally(totalCents, subtotals, people) {
    var result = {};
    people.forEach(function (p) { result[p.id] = 0; });
    var sum = people.reduce(function (s, p) { return s + subtotals[p.id]; }, 0);
    if (sum === 0 || totalCents === 0) return result;

    var allocated = 0;
    var largestId = people[0].id;
    people.forEach(function (p) {
      var part = Math.round((totalCents * subtotals[p.id]) / sum);
      result[p.id] = part;
      allocated += part;
      if (subtotals[p.id] > subtotals[largestId]) largestId = p.id;
    });
    result[largestId] += totalCents - allocated;
    return result;
  }

  /**
   * Full calculation.
   * Returns {
   *   subtotal, tax, tip, total   (cents, for the whole bill)
   *   rows: [{ personId, subtotal, tax, tip, total }]
   *   unassignedCount, complete   (complete = every item has someone)
   * }
   * When complete, SUM(rows.total) === total exactly.
   */
  function calculatePersonTotals(items, people, taxPercent, tipPercent) {
    var subtotal = calculateSubtotal(items);
    var tax = calculateTax(subtotal, taxPercent);
    var tip = calculateTip(subtotal, tipPercent);
    var total = calculateBillTotal(subtotal, tax, tip);

    var unassignedCount = items.filter(function (item) {
      return Object.keys(getItemShares(item, people)).length === 0;
    }).length;

    var subs = calculatePersonSubtotals(items, people);
    var taxes = allocateProportionally(tax, subs, people);
    var tips = allocateProportionally(tip, subs, people);

    var rows = people.map(function (p) {
      return {
        personId: p.id,
        subtotal: subs[p.id],
        tax: taxes[p.id],
        tip: tips[p.id],
        total: subs[p.id] + taxes[p.id] + tips[p.id]
      };
    });

    return {
      subtotal: subtotal,
      tax: tax,
      tip: tip,
      total: total,
      rows: rows,
      unassignedCount: unassignedCount,
      complete: unassignedCount === 0
    };
  }

  /**
   * Net balances + minimal transfers.
   * paidByPersonId: { personId: cents they already paid toward the bill }
   * rows: from calculatePersonTotals (each has .total = their fair share)
   * Returns {
   *   balances: [{ personId, share, paid, net }]  // net > 0 = owed money, < 0 = owes
   *   transfers: [{ fromId, toId, amount }]       // from pays amount to to
   *   paidTotal, shareTotal
   * }
   */
  function calculateSettlements(rows, paidByPersonId) {
    var balances = rows.map(function (row) {
      var paid = paidByPersonId[row.personId] || 0;
      if (paid < 0) paid = 0;
      return {
        personId: row.personId,
        share: row.total,
        paid: paid,
        net: paid - row.total
      };
    });
    var paidTotal = balances.reduce(function (s, b) { return s + b.paid; }, 0);
    var shareTotal = balances.reduce(function (s, b) { return s + b.share; }, 0);

    var creditors = balances
      .filter(function (b) { return b.net > 0; })
      .map(function (b) { return { id: b.personId, amount: b.net }; })
      .sort(function (a, b) { return b.amount - a.amount; });
    var debtors = balances
      .filter(function (b) { return b.net < 0; })
      .map(function (b) { return { id: b.personId, amount: -b.net }; })
      .sort(function (a, b) { return b.amount - a.amount; });

    var transfers = [];
    var i = 0;
    var j = 0;
    while (i < debtors.length && j < creditors.length) {
      var pay = Math.min(debtors[i].amount, creditors[j].amount);
      if (pay > 0) {
        transfers.push({ fromId: debtors[i].id, toId: creditors[j].id, amount: pay });
        debtors[i].amount -= pay;
        creditors[j].amount -= pay;
      }
      if (debtors[i].amount === 0) i += 1;
      if (creditors[j].amount === 0) j += 1;
    }

    return {
      balances: balances,
      transfers: transfers,
      paidTotal: paidTotal,
      shareTotal: shareTotal
    };
  }

  var api = {
    toCents: toCents,
    fromCents: fromCents,
    calculateSubtotal: calculateSubtotal,
    getItemShares: getItemShares,
    calculatePersonSubtotals: calculatePersonSubtotals,
    calculateTax: calculateTax,
    calculateTip: calculateTip,
    calculateBillTotal: calculateBillTotal,
    calculatePersonTotals: calculatePersonTotals,
    calculateSettlements: calculateSettlements
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.SmartSplitCalc = api;
  }
})(typeof window !== 'undefined' ? window : this);
