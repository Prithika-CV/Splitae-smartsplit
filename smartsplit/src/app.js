/*
 * SmartSplit — UI logic (vanilla JS, no build step).
 * All arithmetic lives in calculations.js; this file only manages state and rendering.
 */
(function () {
  'use strict';

  var Calc = window.SmartSplitCalc;
  var icon = window.SmartSplitIcons.icon;
  var Art = window.SmartSplitArt;

  
  var DEFAULT_PEOPLE = ['Alex', 'Priya', 'Rahul'];
  var TIP_PRESETS = [0, 5, 10, 15, 20];
  var MAX_PRICE = 10000000;
  var BILLS_KEY = 'splitae_bills_v1';
  var CURRENT_KEY = 'splitae_current_v1';
  var LEGACY_KEY = 'smartsplit_bill';
  var REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // [background, text, bar] — bright flat neo-brutalist colours
  var COLORS = [
    ['#FFD93D', '#111', '#FFD93D'],
    ['#FF8FB8', '#111', '#FF8FB8'],
    ['#6CB4FF', '#111', '#6CB4FF'],
    ['#7BE0A8', '#111', '#7BE0A8'],
    ['#C9B1FF', '#111', '#C9B1FF'],
    ['#FFAA5C', '#111', '#FFAA5C'],
    ['#5EEAD4', '#111', '#5EEAD4'],
    ['#FF7B7B', '#111', '#FF7B7B']
  ];

  /* ---------- helpers ---------- */

  var idCounter = 0;
  function newId(prefix) {
    idCounter += 1;
    return prefix + '_' + Date.now().toString(36) + '_' + idCounter.toString(36);
  }

  function $(selector) { return document.querySelector(selector); }

  function esc(value) {
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var nf2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  function money(cents) { return '₹' + nf2.format(cents / 100); }
  function moneyTrim(cents) { return cents % 100 === 0 ? '₹' + nf0.format(cents / 100) : money(cents); }
  function pct(value) { return String(Number(value)); }

  function initials(name) {
    var parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function colorFor(id) {
    var hash = 0;
    for (var i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return COLORS[hash % COLORS.length];
  }

  function avatar(person, large) {
    var c = colorFor(person.id);
    return '<span class="avatar' + (large ? ' lg' : '') + '" style="background:' + c[0] + ';color:' + c[1] + '" aria-hidden="true">' +
      esc(initials(person.name)) + '</span>';
  }

    /* ---------- state & bill history ---------- */

  function defaultState() {
    return {
      id: newId('b'),
      createdAt: Date.now(),
      title: '',
      people: DEFAULT_PEOPLE.map(function (n) {
        return { id: newId('p'), name: n, paidCents: 0, upi: '' };
      }),
      items: [],
      taxPercent: 5,
      tipPercent: 10,
      settledTransferKeys: []
    };
  }

  // Keep the same bill id/date when Reset replaces the contents.
  function carryMeta(next, prev) {
    next.id = prev.id;
    next.createdAt = prev.createdAt;
    return next;
  }

  // Validates one stored bill. Returns a clean bill, or null if it is unusable.
  function sanitize(data) {
    try {
      if (!data || typeof data !== 'object') return null;
      var people = (Array.isArray(data.people) ? data.people : []).filter(function (p) {
        return p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim();
      }).map(function (p) {
        var paid = Number(p.paidCents);
        if (!isFinite(paid) || paid < 0) paid = 0;
        return {
          id: p.id,
          name: p.name.trim(),
          paidCents: Math.round(paid),
          upi: typeof p.upi === 'string' ? p.upi.trim().slice(0, 50) : ''
        };
      });
      if (people.length === 0) return null;
      var ids = people.map(function (p) { return p.id; });
      var items = (Array.isArray(data.items) ? data.items : []).filter(function (it) {
        return it && typeof it.id === 'string' && typeof it.name === 'string' &&
          typeof it.price === 'number' && isFinite(it.price) && it.price > 0;
      }).map(function (it) {
        return {
          id: it.id, name: it.name, price: it.price,
          assignedPersonIds: (Array.isArray(it.assignedPersonIds) ? it.assignedPersonIds : [])
            .filter(function (pid) { return ids.indexOf(pid) !== -1; })
        };
      });
      var tax = Number(data.taxPercent);
      var tip = Number(data.tipPercent);
      var created = Number(data.createdAt);
      var settledTransferKeys = Array.isArray(data.settledTransferKeys) ? data.settledTransferKeys.map(String) : [];
      return {
        id: typeof data.id === 'string' && data.id ? data.id : newId('b'),
        createdAt: isFinite(created) && created > 0 ? created : Date.now(),
        title: typeof data.title === 'string' ? data.title : '',
        people: people,
        items: items,
        taxPercent: isFinite(tax) && tax >= 0 && tax <= 100 ? tax : 5,
        tipPercent: isFinite(tip) && tip >= 0 && tip <= 100 ? tip : 10,
        settledTransferKeys: settledTransferKeys
      };
    } catch (e) {
      return null;
    }
  }

    var memBills = null; // in-memory copy, so the app still works if localStorage is blocked

  function writeBills(list) {
    memBills = list;
    try { localStorage.setItem(BILLS_KEY, JSON.stringify(list)); }
    catch (e) { console.warn('Splitae: could not save to localStorage', e); }
  }

  // One-time import of the single bill saved by the old SmartSplit version.
  function migrateLegacy() {
    try {
      var old = sanitize(JSON.parse(localStorage.getItem(LEGACY_KEY)));
      if (old && old.items.length > 0) { writeBills([old]); return [old]; }
    } catch (e) { /* nothing to migrate */ }
    return [];
  }

    function readBills() {
    if (memBills) return memBills.map(sanitize).filter(Boolean);
    try {
      var raw = localStorage.getItem(BILLS_KEY);
      if (raw) {
        var list = JSON.parse(raw);
        if (Array.isArray(list)) {
          memBills = list.map(sanitize).filter(Boolean);
          return memBills;
        }
      }
    } catch (e) { /* fall through */ }
    memBills = migrateLegacy();
    return memBills;
  }

  function createBill() {
    var bill = defaultState();
    var bills = readBills();
    bills.unshift(bill);
    writeBills(bills);
    return bill;
  }

  function removeBill(id) {
    writeBills(readBills().filter(function (b) { return b.id !== id; }));
    try { if (localStorage.getItem(CURRENT_KEY) === id) localStorage.removeItem(CURRENT_KEY); } catch (e) { /* ignore */ }
  }

  // Saves the bill that is currently open into the history list.
  function saveState() {
    if (!state) return;
    var bills = readBills();
    var idx = -1;
    bills.forEach(function (b, i) { if (b.id === state.id) idx = i; });
    if (idx === -1) bills.unshift(state); else bills[idx] = state;
    writeBills(bills);
    try { localStorage.setItem(CURRENT_KEY, state.id); } catch (e) { /* ignore */ }
  }

  var state = null; // the bill currently open (null on home / bills pages)
  var ui = {
    openAssignId: null,
    selectedPersonId: null,
    personFormOpen: false,
    itemFormOpen: false,
    enter: {},          // ids that should play the enter animation on next render
    breakdownFresh: false
  };
  var result = null;
  var prevText = {};    // data-bump key -> last text
  var prevBar = {};     // person id -> last bar width

  function hasData() {
    var d = defaultState();
    if (state.items.length > 0) return true;
    if (state.taxPercent !== d.taxPercent || state.tipPercent !== d.tipPercent) return true;
    if (state.title !== d.title) return true;
    if (state.people.length !== d.people.length) return true;
    return state.people.some(function (p, i) { return p.name !== DEFAULT_PEOPLE[i]; });
  }

  /* ---------- rendering ---------- */

  function render() {
    var active = document.activeElement;
    var focusKey = active && active.getAttribute ? active.getAttribute('data-fk') : null;

    result = Calc.calculatePersonTotals(state.items, state.people, state.taxPercent, state.tipPercent);

    renderPeople();
    renderItems();
    renderSummary();
    renderOwes();
    renderBreakdown();
    renderSettlement();
    renderMisc();

    ui.enter = {};
    ui.breakdownFresh = false;
    runEffects();
    saveState();

    if (focusKey) {
      var el = document.querySelector('[data-fk="' + focusKey + '"]');
      if (el) el.focus({ preventScroll: true });
    }
  }

  function renderPeople() {
    $('#people-count').textContent = String(state.people.length);
    $('#people-list').innerHTML = state.people.map(function (p) {
      var last = state.people.length <= 1;
      return '<li class="person-chip' + (ui.enter[p.id] ? ' enter' : '') + '" data-id="' + p.id + '">' +
        avatar(p) +
        '<span class="name">' + esc(p.name) + '</span>' +
        '<button type="button" class="icon-btn" data-action="remove-person" data-id="' + p.id + '" data-fk="rp:' + p.id + '"' +
        ' aria-label="Remove ' + esc(p.name) + '"' + (last ? ' aria-disabled="true" title="At least one person is required"' : '') + '>' +
        icon('x', 15) + '</button></li>';
    }).join('');
    $('#person-form').hidden = !ui.personFormOpen;
    $('#btn-add-person').hidden = ui.personFormOpen;
  }

  function itemArt(item) {
    var pick = Art.forItem(item.name);
    return '<span class="item-art" style="background:' + pick.bg + '">' + Art.svg(pick.art, 40) + '</span>';
  }

  function itemHTML(item) {
    var shares = Calc.getItemShares(item, state.people);
    var assigned = state.people.filter(function (p) { return shares[p.id] !== undefined; });
    var n = assigned.length;
    var open = ui.openAssignId === item.id;
    var cents = Calc.toCents(item.price);

    var meta;
    if (n === 0) {
      meta = '<span class="badge badge-warn">' + icon('alert', 13) + 'Needs assignment</span>';
    } else if (n === state.people.length && n > 1) {
      meta = 'Shared by everyone';
    } else {
      meta = 'Shared by ' + assigned.map(function (p) { return esc(p.name); }).join(', ');
    }

    var hint = '';
    if (n > 1) hint = '<span class="hint">' + icon('bulb', 14) + 'Split equally between ' + n + ' people</span>';
    else if (n === 0) hint = '<span class="hint warn">' + icon('alert', 14) + 'Who had this?</span>';
    else hint = '<span class="hint"></span>';

    var panel = '';
    if (open) {
      var vals = assigned.map(function (p) { return shares[p.id]; });
      var each = '';
      if (n > 0) {
        var min = Math.min.apply(null, vals);
        var max = Math.max.apply(null, vals);
        each = 'Each person gets <b>' + (min === max ? money(min) : '~' + money(min)) + '</b>' +
          (min === max ? '' : ' <small>(odd cents shared fairly)</small>');
      }
      var chips = state.people.map(function (p) {
        var on = shares[p.id] !== undefined;
        return '<button type="button" class="chip' + (on ? ' on' : '') + '" aria-pressed="' + on + '"' +
          ' data-action="toggle-person" data-item="' + item.id + '" data-person="' + p.id + '"' +
          ' data-fk="chip:' + item.id + ':' + p.id + '">' +
          (on ? icon('check', 14) : '') + esc(p.name) +
          (on ? '<span class="chip-share">' + money(shares[p.id]) + '</span>' : '') + '</button>';
      }).join('');
      panel = '<div class="assign-panel reveal">' +
        '<div class="assign-head"><strong>' + esc(item.name) + ' — ' + moneyTrim(cents) + '</strong>' +
        '<span class="assign-each">' + each + '</span></div>' +
        '<div class="chips" role="group" aria-label="Who had ' + esc(item.name) + '?">' + chips + '</div>' +
        '<div class="assign-foot">' +
        (n === 0 ? '<p class="error">Pick at least one person.</p>' : '<span class="spacer"></span>') +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="assign-all" data-item="' + item.id + '">Everyone</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="assign-none" data-item="' + item.id + '">Clear</button>' +
        '<button type="button" class="btn btn-primary btn-sm" data-action="close-assign" data-fk="done:' + item.id + '">Done</button>' +
        '</div></div>';
    }

    return '<article class="item' + (n === 0 ? ' needs' : '') + (ui.enter[item.id] ? ' enter' : '') + '" data-id="' + item.id + '">' +
      '<div class="item-top">' + itemArt(item) + '<div class="item-info"><div class="item-name">' + esc(item.name) + '</div>' +
      '<div class="item-meta">' + meta + '</div></div>' +
      '<div class="item-price">' + moneyTrim(cents) + '</div></div>' +
      '<div class="item-bottom">' + hint +
      '<div class="item-actions">' +
      '<button type="button" class="btn btn-outline btn-sm" data-action="toggle-assign" data-id="' + item.id + '" data-fk="ta:' + item.id + '" aria-expanded="' + open + '">' +
      icon('users', 15) + (open ? 'Close' : (n === 0 ? 'Assign' : 'Edit')) + '</button>' +
      '<button type="button" class="icon-btn" data-action="delete-item" data-id="' + item.id + '" data-fk="di:' + item.id + '" aria-label="Delete ' + esc(item.name) + '">' +
      icon('trash', 17) + '</button></div></div>' + panel + '</article>';
  }

  function renderItems() {
    var items = state.items;
    $('#items-count').textContent = items.length ? String(items.length) : '';

    var status = $('#items-status');
    if (items.length === 0) {
      status.className = 'status';
      status.innerHTML = '';
    } else if (result.complete) {
      status.className = 'status ok';
      status.innerHTML = icon('check', 16) + 'Everything is accounted for.';
    } else {
      status.className = 'status warn';
      status.innerHTML = icon('alert', 16) + result.unassignedCount + (result.unassignedCount === 1 ? ' item needs' : ' items need') + ' assignment';
    }

    if (items.length === 0) {
      $('#items-list').innerHTML = '<div class="empty">' +
        '<div class="empty-art">' + Art.svg('coin', 44, 'ea-coin') + Art.svg('pizza', 48, 'ea-pizza') +
        Art.svg('receipt', 76, 'ea-main') + Art.svg('sparkle', 30, 'ea-sparkle') + '</div>' +
        '<h3>Add your first item</h3>' +
        '<p>Add what was ordered, then pick who shared each item.</p>' +
        '<button type="button" class="btn btn-primary" data-action="open-item-form" data-fk="empty-add">' +
        icon('plus', 16) + 'Add Item</button>' +
        '</div>';
    } else {
      $('#items-list').innerHTML = items.map(itemHTML).join('');
    }

    $('#item-form').hidden = !ui.itemFormOpen;
    $('#btn-add-item').hidden = ui.itemFormOpen || items.length === 0;
    if (ui.itemFormOpen && items.length === 0) {
      var emptyAdd = $('#items-list .empty .btn-primary');
      if (emptyAdd) emptyAdd.hidden = true;
    }
  }

  function renderSummary() {
    $('#summary-totals').innerHTML = '<div class="totals">' +
      '<div class="total-row"><span>Subtotal</span><b data-bump="sub">' + money(result.subtotal) + '</b></div>' +
      '<div class="total-row"><span>Tax (' + pct(state.taxPercent) + '%)</span><b data-bump="tax">' + money(result.tax) + '</b></div>' +
      '<div class="total-row"><span>Tip (' + pct(state.tipPercent) + '%)</span><b data-bump="tip">' + money(result.tip) + '</b></div>' +
      '<div class="grand"><span>Total</span><strong data-bump="total">' + money(result.total) + '</strong></div></div>';

    $('#tip-presets').innerHTML = TIP_PRESETS.map(function (v) {
      return '<button type="button" class="tip-btn" data-action="tip-preset" data-value="' + v + '" data-fk="tip:' + v + '"' +
        ' aria-pressed="' + (state.tipPercent === v) + '">' + v + '%</button>';
    }).join('');
  }

  function renderOwes() {
    var list = $('#owes-list');
    if (state.items.length === 0) {
      list.innerHTML = '<li class="muted-note">Add items to see what everyone owes.</li>';
      return;
    }
    if (!result.complete) {
      list.innerHTML = '<li class="locked">' + icon('lock', 18) + 'Assign ' + result.unassignedCount +
        (result.unassignedCount === 1 ? ' item' : ' items') + ' to see each person’s total.</li>';
      return;
    }
    var max = Math.max.apply(null, result.rows.map(function (r) { return r.total; }).concat([1]));
    list.innerHTML = result.rows.map(function (row) {
      var person = personById(row.personId);
      var selected = ui.selectedPersonId === person.id;
      return '<li' + (ui.enter[person.id] ? ' class="enter"' : '') + '>' +
        '<button type="button" class="owe-card' + (selected ? ' selected' : '') + '" data-action="select-person" data-id="' + person.id + '"' +
        ' data-fk="owe:' + person.id + '" aria-expanded="' + selected + '">' +
        avatar(person, true) +
        '<span class="owe-main"><span class="owe-top"><span class="owe-name">' + esc(person.name) + '</span>' +
        '<span class="owe-amt" data-bump="owe:' + person.id + '">' + money(row.total) + '</span></span>' +
        '<span class="bar"><span class="bar-fill" data-bar="' + person.id + '" data-w="' + (row.total / max * 100).toFixed(2) + '"' +
        ' style="background-color:' + colorFor(person.id)[2] + ';width:' + (prevBar[person.id] || 0) + '%"></span></span></span>' +
        '<span class="chev">' + icon('chevron', 18) + '</span></button></li>';
    }).join('');
  }

  function renderBreakdown() {
    var box = $('#breakdown');
    var person = ui.selectedPersonId ? personById(ui.selectedPersonId) : null;
    if (!person || !result.complete || state.items.length === 0) {
      box.innerHTML = result.complete && state.items.length > 0
        ? '<p class="muted-note">Tap a person to see why they owe this.</p>' : '';
      return;
    }
    var row = result.rows.filter(function (r) { return r.personId === person.id; })[0];
    var lines = '';
    state.items.forEach(function (item) {
      var shares = Calc.getItemShares(item, state.people);
      if (shares[person.id] === undefined) return;
      var n = Object.keys(shares).length;
      lines += '<div class="bd-row"><dt>' + esc(item.name) +
        (n > 1 ? '<small>split ' + n + ' ways</small>' : '') + '</dt><dd>' + money(shares[person.id]) + '</dd></div>';
    });
    if (!lines) lines = '<div class="bd-row"><dt>No items assigned to ' + esc(person.name) + '</dt><dd>' + money(0) + '</dd></div>';

    box.innerHTML = '<div class="breakdown' + (ui.breakdownFresh ? ' reveal' : '') + '">' +
      '<div class="bd-head"><div><p class="bd-eyebrow">Why do I owe this?</p>' +
      '<h3>' + esc(person.name) + ' owes ' + money(row.total) + '</h3></div>' +
      '<button type="button" class="icon-btn" data-action="close-breakdown" data-fk="close-bd" aria-label="Close breakdown">' + icon('x', 17) + '</button></div>' +
      '<dl class="bd-lines">' + lines +
      '<div class="bd-row bd-sum"><dt>Subtotal</dt><dd>' + money(row.subtotal) + '</dd></div>' +
      '<div class="bd-row"><dt>Tax (' + pct(state.taxPercent) + '%)</dt><dd>' + money(row.tax) + '</dd></div>' +
      '<div class="bd-row"><dt>Tip (' + pct(state.tipPercent) + '%)</dt><dd>' + money(row.tip) + '</dd></div>' +
      '<div class="bd-row bd-total"><dt>Total</dt><dd>' + money(row.total) + '</dd></div></dl></div>';
  }

  function transferKey(t) {
    return t.fromId + '>' + t.toId + ':' + t.amount;
  }

  function renderPaidList() {
    var box = $('#paid-list');
    if (!box) return;
    if (state.people.length === 0) {
      box.innerHTML = '<p class="muted-note">Add people first.</p>';
      return;
    }
    box.innerHTML = state.people.map(function (p) {
      var paid = p.paidCents || 0;
      var rupees = paid / 100;
      var isNone = paid === 0;
      return '<div class="paid-row" data-person="' + p.id + '">' +
        '<div class="paid-row-top">' + avatar(p) +
        '<span class="paid-name">' + esc(p.name) + '</span>' +
        '<div class="paid-amount-wrap">' +
        '<button type="button" class="btn btn-ghost btn-sm none-btn' + (isNone ? ' selected' : '') +
        '" data-action="set-paid-none" data-id="' + p.id + '">None</button>' +
        '<div class="input-prefix paid-input"><span>₹</span>' +
        '<input type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" ' +
        'data-action="paid-amount" data-id="' + p.id + '" value="' +
        (isNone ? '' : (paid % 100 === 0 ? String(paid / 100) : rupees.toFixed(2))) + '"' +
        ' aria-label="Amount ' + esc(p.name) + ' paid"></div></div></div>' +
        '<div class="paid-upi-wrap' + (paid > 0 ? '' : ' hidden') + '">' +
        '<label class="sr-only" for="upi-' + p.id + '">UPI for ' + esc(p.name) + '</label>' +
        '<input id="upi-' + p.id + '" type="text" maxlength="50" placeholder="UPI ID (optional)" ' +
        'data-action="paid-upi" data-id="' + p.id + '" value="' + esc(p.upi || '') + '"></div></div>';
    }).join('');
  }

  function renderSettlement() {
    renderPaidList();
    var body = $('#settlement-body');
    if (state.items.length === 0) {
      body.innerHTML = '<p class="muted-note">Your settlement will appear here once you add items.</p>';
      return;
    }
    if (!result.complete) {
      body.innerHTML = '<div class="locked">' + icon('lock', 18) + 'Assign all items to see the final settlement.</div>';
      return;
    }

    var paidMap = {};
    state.people.forEach(function (p) { paidMap[p.id] = p.paidCents || 0; });
    var settle = Calc.calculateSettlements(result.rows, paidMap);
    var settledSet = {};
    (state.settledTransferKeys || []).forEach(function (k) { settledSet[k] = true; });

    var sum = result.rows.reduce(function (s, r) { return s + r.total; }, 0);
    var consistent = sum === result.total;
    var settleHtml = '<div class="total-bill"><span>Total bill</span><strong data-bump="bill">' +
      moneyTrim(result.total) + '</strong></div>';

    settleHtml += '<div class="balance-summary">';
    settle.balances.forEach(function (b) {
      var person = personById(b.personId);
      if (!person) return;
      var label = b.net === 0 ? 'settled' : (b.net > 0 ? 'is owed ' + money(b.net) : 'owes ' + money(-b.net));
      settleHtml += '<div class="balance-row">' + avatar(person) +
        '<span class="nm">' + esc(person.name) + '</span>' +
        '<span class="bal-detail"><small>share ' + money(b.share) + ' · paid ' + money(b.paid) + '</small></span>' +
        '<span class="bal-net' + (b.net > 0 ? ' credit' : b.net < 0 ? ' debit' : '') + '">' + label + '</span></div>';
    });
    settleHtml += '</div>';

    if (settle.transfers.length === 0) {
      settleHtml += '<div class="verify">' + icon('check', 16) + ' Everyone is already even — nothing left to pay.</div>';
    } else {
      settleHtml += '<h3 class="transfer-title">Who pays whom</h3><ul class="settle-list transfer-list">';
      settle.transfers.forEach(function (t) {
        var from = personById(t.fromId);
        var to = personById(t.toId);
        if (!from || !to) return;
        var key = transferKey(t);
        var done = !!settledSet[key];
        var payBtn = done
          ? '<span class="paid-badge">' + icon('check', 14) + ' Done</span>'
          : '<button type="button" class="btn btn-pink btn-sm pay-btn" data-action="pay-transfer" ' +
            'data-from="' + t.fromId + '" data-to="' + t.toId + '" data-amount="' + t.amount + '">' +
            icon('qr', 14) + ' Pay now</button>';
        settleHtml += '<li class="settle-row transfer-row' + (done ? ' is-paid' : '') + '">' +
          avatar(from) + '<span class="nm">' + esc(from.name) +
          ' <span class="transfer-arrow">→</span> ' + esc(to.name) + '</span>' +
          '<span class="amt">' + money(t.amount) + '</span>' + payBtn + '</li>';
      });
      settleHtml += '</ul>';
    }

    settleHtml += (consistent
      ? '<div class="verify">' + icon('shield', 16) + 'Everyone’s share adds up exactly to the bill.</div>'
      : '') +
      '<div class="settle-actions">' +
      '<button type="button" class="btn btn-primary copy-btn" id="btn-copy" data-action="copy-summary" data-fk="copy">' +
      icon('copy', 16) + '<span>Copy Summary</span></button>' +
      '<button type="button" class="btn btn-outline" data-action="share-bill">' +
      icon('share', 16) + '<span>Share bill link</span></button></div>';
    body.innerHTML = settleHtml;
  }

  function renderMisc() {
    $('#mobile-total').textContent = moneyTrim(result.total);
  }

  function personById(id) {
    return state.people.filter(function (p) { return p.id === id; })[0];
  }

  function setPaidNone(id) {
    var person = personById(id);
    if (!person) return;
    person.paidCents = 0;
    saveState();
    render();
  }

  function setPaidAmount(id, raw) {
    var person = personById(id);
    if (!person) return;
    var text = String(raw).trim();
    if (text === '') {
      person.paidCents = 0;
    } else {
      var n = Number(text);
      if (!isFinite(n) || n < 0) return;
      person.paidCents = Calc.toCents(n);
    }
    saveState();
    render();
  }

  function setPaidUpi(id, value) {
    var person = personById(id);
    if (!person) return;
    person.upi = String(value || '').trim().slice(0, 50);
    saveState();
  }

  function shareBill() {
    try {
      var payload = {
        title: state.title,
        people: state.people,
        items: state.items,
        taxPercent: state.taxPercent,
        tipPercent: state.tipPercent,
        settledTransferKeys: state.settledTransferKeys || []
      };
      var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      var url = location.origin + location.pathname + '#/share/' + encoded;
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(function () {
          toast('Share link copied! Send it to the group.');
        }).catch(function () {
          prompt('Copy this link to share the bill:', url);
        });
      } else {
        prompt('Copy this link to share the bill:', url);
      }
    } catch (e) {
      toast('Could not create share link');
    }
  }

  function loadSharedBill(encoded) {
    try {
      var raw = decodeURIComponent(escape(atob(encoded)));
      var data = JSON.parse(raw);
      var clean = sanitize(Object.assign({ id: newId('b'), createdAt: Date.now() }, data));
      if (!clean) {
        toast('Invalid shared bill');
        location.replace('#/bills');
        return;
      }
      state = clean;
      var bills = readBills();
      bills.unshift(state);
      writeBills(bills);
      resetUi();
      syncControls();
      location.replace('#/bill/' + state.id);
      toast('Shared bill loaded');
    } catch (e) {
      toast('Could not open shared bill');
      location.replace('#/bills');
    }
  }

  var activeTransfer = null;

  function showPayTransfer(fromId, toId, amount) {
    var from = personById(fromId);
    var to = personById(toId);
    if (!from || !to || !amount || amount <= 0) return;

    activeTransfer = { fromId: fromId, toId: toId, amount: amount };
    var amountRupees = (amount / 100).toFixed(2);
    var dialog = $('#pay-dialog');
    $('#pay-title').textContent = from.name + ' → ' + to.name;
    $('#pay-subtitle').textContent = 'Pay ' + money(amount) + ' to ' + to.name;
    $('#pay-amount').textContent = money(amount);

    var upi = (to.upi || '').trim();
    var qrData;
    if (upi) {
      qrData = 'upi://pay?pa=' + encodeURIComponent(upi) +
        '&pn=' + encodeURIComponent(to.name) +
        '&am=' + amountRupees +
        '&cu=INR&tn=' + encodeURIComponent((state.title || 'Bill') + ' settle');
      $('#pay-upi-hint').textContent = 'Scan with any UPI app → ' + upi;
    } else {
      qrData = 'Pay ' + money(amount) + ' to ' + to.name +
        (state.title ? ' for ' + state.title : '') +
        '. (Ask ' + to.name + ' to add their UPI above.)';
      $('#pay-upi-hint').textContent = 'No UPI for ' + to.name + '. Ask them to add it under “Who paid what?”.';
    }

    var canvas = $('#pay-qr');
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 200, 200);
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      ctx.drawImage(img, 0, 0, 200, 200);
    };
    img.onerror = function () {
      ctx.fillStyle = '#111';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('QR unavailable', 100, 100);
      ctx.fillText('Use UPI ID manually', 100, 120);
    };
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=' + encodeURIComponent(qrData);

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closePayDialog(markDone) {
    var dialog = $('#pay-dialog');
    if (markDone && activeTransfer) {
      var key = transferKey(activeTransfer);
      if (!state.settledTransferKeys) state.settledTransferKeys = [];
      if (state.settledTransferKeys.indexOf(key) === -1) {
        state.settledTransferKeys.push(key);
        saveState();
      }
      var from = personById(activeTransfer.fromId);
      var to = personById(activeTransfer.toId);
      toast((from ? from.name : 'Payment') + ' → ' + (to ? to.name : '') + ' marked done ✓');
      render();
    }
    activeTransfer = null;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  /* After-render effects: bar growth + value "bump" animation. */
  function runEffects() {
    var bars = document.querySelectorAll('[data-bar]');
    if (bars.length) {
      requestAnimationFrame(function () {
        bars.forEach(function (bar) {
          var w = Number(bar.getAttribute('data-w')) || 0;
          bar.style.width = w + '%';
          prevBar[bar.getAttribute('data-bar')] = w;
        });
      });
    }
    document.querySelectorAll('[data-bump]').forEach(function (el) {
      var key = el.getAttribute('data-bump');
      var text = el.textContent;
      if (prevText[key] !== undefined && prevText[key] !== text) {
        el.classList.add('bump');
        el.addEventListener('animationend', function () { el.classList.remove('bump'); }, { once: true });
      }
      prevText[key] = text;
    });
  }

  /* ---------- feedback helpers ---------- */

  function showError(el, message) {
    el.textContent = message;
    el.hidden = false;
  }
  function clearError(el) {
    el.textContent = '';
    el.hidden = true;
  }

  var toastTimer = null;
  function toast(message) {
    var el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function showConfirm(title, text, okLabel) {
    var dlg = $('#confirm-dialog');
    if (!dlg || typeof dlg.showModal !== 'function') {
      return Promise.resolve(window.confirm(title + '\n' + text));
    }
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    $('#confirm-ok').textContent = okLabel;
    dlg.returnValue = '';
    return new Promise(function (resolve) {
      dlg.addEventListener('close', function () { resolve(dlg.returnValue === 'ok'); }, { once: true });
      dlg.showModal();
    });
  }

  function animateRemove(selector, done) {
    var el = document.querySelector(selector);
    if (!el || REDUCED_MOTION) { done(); return; }
    el.classList.add('leaving');
    setTimeout(done, 180);
  }

  /* ---------- actions ---------- */

  function addPerson(rawName) {
    var errorEl = $('#person-error');
    var name = rawName.replace(/\s+/g, ' ').trim();
    if (!name) { showError(errorEl, 'Enter a name.'); return false; }
    var dup = state.people.some(function (p) { return p.name.toLowerCase() === name.toLowerCase(); });
    if (dup) { showError(errorEl, name + ' is already added.'); return false; }
    clearError(errorEl);
    var person = { id: newId('p'), name: name, paidCents: 0, upi: '' };
    state.people.push(person);
    ui.enter[person.id] = true;
    render();
    return true;
  }

  function removePerson(id) {
    var errorEl = $('#people-error');
    if (state.people.length <= 1) {
      showError(errorEl, 'At least one person is needed.');
      setTimeout(function () { clearError(errorEl); }, 2800);
      return;
    }
    clearError(errorEl);
    animateRemove('.person-chip[data-id="' + id + '"]', function () {
      state.people = state.people.filter(function (p) { return p.id !== id; });
      state.items.forEach(function (item) {
        item.assignedPersonIds = item.assignedPersonIds.filter(function (pid) { return pid !== id; });
      });
      if (ui.selectedPersonId === id) ui.selectedPersonId = null;
      if (state.settledTransferKeys) {
        state.settledTransferKeys = state.settledTransferKeys.filter(function (k) {
          return k.indexOf(id) === -1;
        });
      }
      render();
    });
  }

  function addItem(rawName, rawPrice) {
    var errorEl = $('#item-error');
    var nameInput = $('#item-name');
    var priceInput = $('#item-price');
    var name = rawName.replace(/\s+/g, ' ').trim();
    nameInput.removeAttribute('aria-invalid');
    priceInput.removeAttribute('aria-invalid');

    if (!name) {
      nameInput.setAttribute('aria-invalid', 'true');
      showError(errorEl, 'Enter an item name.');
      nameInput.focus();
      return false;
    }
    var priceText = String(rawPrice).trim();
    var price = Number(priceText);
    var message = null;
    if (priceText === '') message = 'Enter a price.';
    else if (!isFinite(price)) message = 'Enter a valid price.';
    else if (price <= 0) message = 'Price must be greater than 0.';
    else if (price > MAX_PRICE) message = 'That price is too large.';
    else if (Calc.toCents(price) <= 0) message = 'Price must be at least ₹0.01.';
    if (message) {
      priceInput.setAttribute('aria-invalid', 'true');
      showError(errorEl, message);
      priceInput.focus();
      return false;
    }

    clearError(errorEl);
    var item = { id: newId('i'), name: name, price: Calc.toCents(price) / 100, assignedPersonIds: [] };
    state.items.push(item);
    ui.enter[item.id] = true;
    ui.openAssignId = item.id;
    ui.itemFormOpen = false;
    nameInput.value = '';
    priceInput.value = '';
    render();
    var card = document.querySelector('.item[data-id="' + item.id + '"]');
    if (card && card.scrollIntoView) card.scrollIntoView({ block: 'nearest', behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
    return true;
  }

  function findItem(id) {
    return state.items.filter(function (i) { return i.id === id; })[0];
  }

  function deleteItem(id) {
    animateRemove('.item[data-id="' + id + '"]', function () {
      state.items = state.items.filter(function (i) { return i.id !== id; });
      if (ui.openAssignId === id) ui.openAssignId = null;
      render();
    });
  }

  function togglePersonOnItem(itemId, personId) {
    var item = findItem(itemId);
    if (!item) return;
    var idx = item.assignedPersonIds.indexOf(personId);
    if (idx === -1) item.assignedPersonIds.push(personId);
    else item.assignedPersonIds.splice(idx, 1);
    render();
  }

  function setAssignment(itemId, everyone) {
    var item = findItem(itemId);
    if (!item) return;
    item.assignedPersonIds = everyone ? state.people.map(function (p) { return p.id; }) : [];
    render();
  }

  function setTip(value) {
    state.tipPercent = value;
    $('#tip-input').value = '';
    clearError($('#tip-error'));
    render();
  }

  function onTaxInput() {
    var input = $('#tax-input');
    var errorEl = $('#tax-error');
    var raw = input.value.trim();
    var v = Number(raw);
    if (raw === '' || !isFinite(v) || v < 0 || v > 100) {
      input.setAttribute('aria-invalid', 'true');
      showError(errorEl, 'Enter a tax between 0 and 100%.');
      return;
    }
    input.removeAttribute('aria-invalid');
    clearError(errorEl);
    state.taxPercent = v;
    render();
  }

  function onTipInput() {
    var input = $('#tip-input');
    var errorEl = $('#tip-error');
    var raw = input.value.trim();
    if (raw === '') {
      input.removeAttribute('aria-invalid');
      clearError(errorEl);
      return;
    }
    var v = Number(raw);
    if (!isFinite(v) || v < 0 || v > 100) {
      input.setAttribute('aria-invalid', 'true');
      showError(errorEl, 'Enter a tip between 0 and 100%.');
      return;
    }
    input.removeAttribute('aria-invalid');
    clearError(errorEl);
    state.tipPercent = v;
    render();
  }

  function syncControls() {
    $('#tax-input').value = String(state.taxPercent);
    $('#tax-input').removeAttribute('aria-invalid');
    clearError($('#tax-error'));
    $('#tip-input').value = TIP_PRESETS.indexOf(state.tipPercent) === -1 ? String(state.tipPercent) : '';
    $('#tip-input').removeAttribute('aria-invalid');
    clearError($('#tip-error'));
    $('#bill-title').value = state.title;
  }

  function resetUi() {
    ui.openAssignId = null;
    ui.selectedPersonId = null;
    ui.personFormOpen = false;
    ui.itemFormOpen = false;
    ui.enter = {};
    prevBar = {};
    clearError($('#person-error'));
    clearError($('#people-error'));
    clearError($('#item-error'));
    $('#copy-fallback').hidden = true;
  }

  async function resetAll() {
    if (hasData()) {
      var ok = await showConfirm('Reset everything?', 'This clears your people, items, tax and tip. This can’t be undone.', 'Reset');
      if (!ok) return;
    }
    state = carryMeta(defaultState(), state);
    resetUi();
    syncControls();
    render();
    toast('Reset to a blank bill');
  }

  function buildSummaryText() {
    var title = state.title.trim() || 'Dinner';
    var lines = ['Splitae — ' + title, ''];
    result.rows.forEach(function (row) {
      var p = personById(row.personId);
      var paid = p ? (p.paidCents || 0) : 0;
      lines.push(p.name + ': share ' + money(row.total) + ' · paid ' + money(paid));
    });
    lines.push('');
    lines.push('Total: ' + moneyTrim(result.total));
    lines.push('(incl. ' + pct(state.taxPercent) + '% tax and ' + pct(state.tipPercent) + '% tip)');
    if (result.complete) {
      var paidMap = {};
      state.people.forEach(function (p) { paidMap[p.id] = p.paidCents || 0; });
      var settle = Calc.calculateSettlements(result.rows, paidMap);
      if (settle.transfers.length) {
        lines.push('', 'Settle up:');
        settle.transfers.forEach(function (t) {
          var from = personById(t.fromId);
          var to = personById(t.toId);
          lines.push(from.name + ' → ' + to.name + ': ' + money(t.amount));
        });
      } else {
        lines.push('', 'Everyone is even.');
      }
    }
    return lines.join('\n');
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* fall through to legacy path */ }
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand && document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) {
      return false;
    }
  }

  async function copySummary() {
    if (!result.complete || state.items.length === 0) return;
    var text = buildSummaryText();
    var ok = await copyText(text);
    var fallback = $('#copy-fallback');
    if (ok) {
      fallback.hidden = true;
      toast('Summary copied to clipboard');
      var btn = $('#btn-copy');
      if (btn) {
        btn.classList.add('done');
        btn.innerHTML = icon('check', 16) + '<span>Copied!</span>';
        setTimeout(function () {
          var b = $('#btn-copy');
          if (b) { b.classList.remove('done'); b.innerHTML = icon('copy', 16) + '<span>Copy Summary</span>'; }
        }, 1600);
      }
    } else {
      var area = $('#copy-fallback-text');
      area.value = text;
      fallback.hidden = false;
      area.focus();
      area.select();
    }
  }

  /* ---------- events ---------- */

  document.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.getAttribute('data-action');
    var id = target.getAttribute('data-id');

    switch (action) {
      case 'open-person-form':
        ui.personFormOpen = true;
        render();
        $('#person-name').focus();
        break;
      case 'cancel-person-form':
        ui.personFormOpen = false;
        $('#person-name').value = '';
        clearError($('#person-error'));
        render();
        break;
      case 'remove-person': removePerson(id); break;

      case 'open-item-form':
        ui.itemFormOpen = true;
        render();
        $('#item-name').focus();
        break;
      case 'cancel-item-form':
        ui.itemFormOpen = false;
        clearError($('#item-error'));
        render();
        break;

      case 'toggle-assign':
        ui.openAssignId = ui.openAssignId === id ? null : id;
        render();
        break;
      case 'close-assign':
        ui.openAssignId = null;
        render();
        break;
      case 'toggle-person':
        togglePersonOnItem(target.getAttribute('data-item'), target.getAttribute('data-person'));
        break;
      case 'assign-all': setAssignment(target.getAttribute('data-item'), true); break;
      case 'assign-none': setAssignment(target.getAttribute('data-item'), false); break;
      case 'delete-item': deleteItem(id); break;

      case 'tip-preset': setTip(Number(target.getAttribute('data-value'))); break;

      case 'select-person':
        if (ui.selectedPersonId === id) {
          ui.selectedPersonId = null;
        } else {
          ui.selectedPersonId = id;
          ui.breakdownFresh = true;
        }
        render();
        break;
      case 'close-breakdown':
        ui.selectedPersonId = null;
        render();
        break;

      case 'copy-summary': copySummary(); break;
      case 'reset': resetAll(); break;
      case 'share-bill': shareBill(); break;
      case 'set-paid-none': setPaidNone(id); break;
      case 'pay-transfer': {
        var fromId = target.getAttribute('data-from');
        var toId = target.getAttribute('data-to');
        var amt = Number(target.getAttribute('data-amount'));
        showPayTransfer(fromId, toId, amt);
        break;
      }
      case 'close-pay': closePayDialog(false); break;
      case 'mark-paid': closePayDialog(true); break;
      case 'delete-bill': deleteBill(id); break;
      case 'scroll-summary': {
        var card = $('#summary-card');
        if (card) card.scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'start' });
        break;
      }
    }
  });

  $('#person-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('#person-name');
    if (addPerson(input.value)) {
      input.value = '';
      input.focus();
    }
  });
  $('#person-name').addEventListener('input', function () { clearError($('#person-error')); });

  $('#item-form').addEventListener('submit', function (e) {
    e.preventDefault();
    addItem($('#item-name').value, $('#item-price').value);
  });
  $('#item-name').addEventListener('input', function () {
    this.removeAttribute('aria-invalid');
    clearError($('#item-error'));
  });
  $('#item-price').addEventListener('input', function () {
    this.removeAttribute('aria-invalid');
    clearError($('#item-error'));
  });

  $('#tax-input').addEventListener('input', onTaxInput);
  $('#tip-input').addEventListener('input', onTipInput);
  $('#bill-title').addEventListener('input', function () {
    state.title = this.value;
    saveState();
  });

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;
    var action = el.getAttribute('data-action');
    var id = el.getAttribute('data-id');
    if (action === 'paid-amount' && id) setPaidAmount(id, el.value);
  });
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;
    var action = el.getAttribute('data-action');
    var id = el.getAttribute('data-id');
    if (action === 'paid-upi' && id) setPaidUpi(id, el.value);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (ui.openAssignId) { ui.openAssignId = null; render(); }
    }
  });

  /* ---------- init ---------- */

   /* ---------- bills list + routing ---------- */

  function formatDate(ts) {
    return new Date(ts).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  }

  function billRowHTML(bill, isCurrent) {
    var r = Calc.calculatePersonTotals(bill.items, bill.people, bill.taxPercent, bill.tipPercent);
    var name = bill.title.trim() || 'Untitled bill';
    var n = bill.items.length;
    var note = n > 0 && !r.complete ? ' · needs assignment' : '';
    return '<li class="bill-row' + (isCurrent ? ' current' : '') + '">' +
      '<a class="bill-link" href="#/bill/' + encodeURIComponent(bill.id) + '">' +
      '<span class="bill-main"><span class="bill-name">' + esc(name) +
      (isCurrent ? '<span class="bill-badge">Current</span>' : '') + '</span>' +
      '<span class="bill-meta">' + icon('calendar', 14) + formatDate(bill.createdAt) +
      ' · ' + bill.people.length + ' people · ' + n + (n === 1 ? ' item' : ' items') + note + '</span></span>' +
      '<span class="bill-total">' + moneyTrim(r.total) + '</span>' + icon('chevron', 18) + '</a>' +
      '<button type="button" class="icon-btn" data-action="delete-bill" data-id="' + esc(bill.id) + '"' +
      ' aria-label="Delete ' + esc(name) + '">' + icon('trash', 17) + '</button></li>';
  }

 function renderBills() {
    var bills = readBills().sort(function (a, b) { return b.createdAt - a.createdAt; });
    var currentId = null;
    try { currentId = localStorage.getItem(CURRENT_KEY); } catch (e) { /* ignore */ }
    $('#bills-count').textContent = bills.length ? String(bills.length) : '';
    $('#bills-list').innerHTML = bills.length
      ? bills.map(function (b) { return billRowHTML(b, b.id === currentId); }).join('')
      : '<p class="muted-note">No saved bills yet.</p>';
  }

  async function deleteBill(id) {
    var ok = await showConfirm('Delete this bill?', 'It will be removed from your history. This can’t be undone.', 'Delete');
    if (!ok) return;
    removeBill(id);
    renderBills();
    toast('Bill deleted');
  }

  function showView(name) {
    ['home', 'bills', 'bill'].forEach(function (v) {
      var el = document.getElementById('view-' + v);
      if (el) el.hidden = v !== name;
    });
    document.body.setAttribute('data-view', name);
    window.scrollTo(0, 0);
  }

  function openBill(bill) {
    state = sanitize(bill) || carryMeta(defaultState(), bill);
    resetUi();
    prevText = {};
    syncControls();
    render();
  }

  function leaveBill() {
    if (!state) return;
    if (!hasData()) removeBill(state.id); // don't keep untouched blank bills
    state = null;
  }

  function route() {
    leaveBill();
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    if (parts[0] === 'share' && parts[1]) {
      loadSharedBill(parts.slice(1).join('/'));
      return;
    }
    if (parts[0] === 'bill' && parts[1]) {
      if (parts[1] === 'new') {
        location.replace('#/bill/' + createBill().id);
        return;
      }
      var id = decodeURIComponent(parts[1]);
      var found = readBills().filter(function (b) { return b.id === id; })[0];
      if (!found) { location.replace('#/bills'); return; }
      openBill(found);
      showView('bill');
    } else if (parts[0] === 'bills') {
      renderBills();
      showView('bills');
    } else {
      showView('home');
    }
  }

  window.SmartSplitIcons.hydrate(document);
  window.addEventListener('hashchange', route);
  route();
})();
