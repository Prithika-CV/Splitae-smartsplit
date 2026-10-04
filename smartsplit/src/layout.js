/*
 * SmartSplit layout — builds the page shell (header, ticker, cards, dialogs)
 * and mounts it into <div id="root">. app.js then attaches behaviour to these ids.
 */
(function () {
  'use strict';

  var Art = window.SmartSplitArt;
  var Icons = window.SmartSplitIcons;
  var icon = Icons.icon;

  var TICKER = ['Split fair', 'No awkward math', 'Everyone pays their share', 'Tip like a legend', 'Settle up in seconds'];

  function ticker() {
    var one = TICKER.map(function (t) { return '<span>' + t + '</span><span class="tick-star">★</span>'; }).join('');
    // Duplicated so the loop is seamless.
    return '<div class="ticker" aria-hidden="true"><div class="ticker-track">' + one + one + one + one + '</div></div>';
  }

    function header(actions) {
    return '<header class="header">' +
      '<a class="brand" href="#/" aria-label="Splitae home">' +
      '<div class="logo">' + Art.svg('coin', 40) + '</div>' +
      '<div><h1>Split<span class="h1-hl">ae</span></h1>' +
      '<p class="tagline">Split bills without the headache.</p></div></a>' +
      '<div class="header-actions">' + actions + '</div>' +
      '</header>';
  }

  function intro() {
    var steps = ['Add people', 'Add items', 'Assign items', 'Watch totals update', 'Adjust tip', 'Settle up'];
    return '<section class="intro" aria-label="How it works">' +
      '<span class="deco deco-sparkle">' + Art.svg('sparkle', 46) + '</span>' +
      '<ol class="steps">' + steps.map(function (s, i) {
        return '<li><span class="step-num">' + (i + 1) + '</span>' + s + '</li>';
      }).join('') + '</ol>' +
      '</section>';
  }

  function bar(color, id, title, artName, withCount) {
    return '<div class="card-bar bar-' + color + '">' +
      '<h2 id="' + id + '">' + title + '</h2>' +
      '<div class="bar-right">' + (withCount ? '<span class="count" id="' + withCount + '"></span>' : '') +
      '<span class="card-art">' + Art.svg(artName, 58) + '</span></div></div>';
  }

  function peopleCard() {
    return '<section class="card" aria-labelledby="people-title">' +
      bar('yellow', 'people-title', 'Who’s splitting?', 'people', 'people-count') +
      '<div class="card-body">' +
      '<ul class="people-list" id="people-list"></ul>' +
      '<p class="error" id="people-error" role="alert" hidden></p>' +
      '<form class="inline-form" id="person-form" hidden novalidate>' +
      '<label class="sr-only" for="person-name">Person name</label>' +
      '<input id="person-name" type="text" maxlength="24" placeholder="Name, e.g. Sam" autocomplete="off">' +
      '<button type="submit" class="btn btn-primary">Add</button>' +
      '<button type="button" class="btn btn-ghost" data-action="cancel-person-form">Done</button>' +
      '</form>' +
      '<p class="error" id="person-error" role="alert" hidden></p>' +
      '<button type="button" class="btn btn-soft" id="btn-add-person" data-action="open-person-form">' +
      icon('plus', 17) + '<span>Add person</span></button>' +
      '</div></section>';
  }

  function itemsCard() {
    return '<section class="card" aria-labelledby="items-title">' +
      bar('pink', 'items-title', 'Bill items', 'receipt', 'items-count') +
      '<div class="card-body">' +
      '<div class="status" id="items-status" aria-live="polite"></div>' +
      '<div class="items" id="items-list"></div>' +
      '<form class="item-form" id="item-form" hidden novalidate>' +
      '<div class="item-form-row">' +
      '<div class="field grow"><label for="item-name">Item name</label>' +
      '<input id="item-name" type="text" maxlength="40" placeholder="e.g. Pizza" autocomplete="off"></div>' +
      '<div class="field price-field"><label for="item-price">Price</label>' +
      '<div class="input-prefix"><span>₹</span>' +
      '<input id="item-price" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00"></div></div>' +
      '</div>' +
      '<p class="error" id="item-error" role="alert" hidden></p>' +
      '<div class="form-actions">' +
      '<button type="submit" class="btn btn-primary">Add item</button>' +
      '<button type="button" class="btn btn-ghost" data-action="cancel-item-form">Cancel</button>' +
      '</div></form>' +
      '<button type="button" class="btn btn-soft" id="btn-add-item" data-action="open-item-form">' +
      icon('plus', 17) + '<span>Add item</span></button>' +
      '</div></section>';
  }

  function summaryCard() {
    return '<section class="card" id="summary-card" aria-labelledby="summary-title">' +
      bar('mint', 'summary-title', 'Bill summary', 'moneybag') +
      '<div class="card-body">' +
      '<div id="summary-totals"></div>' +
      '<div class="controls">' +
      '<div class="field"><label for="tax-input">Tax</label>' +
      '<div class="input-suffix"><input id="tax-input" type="number" inputmode="decimal" min="0" max="100" step="0.1"><span>%</span></div>' +
      '<p class="error" id="tax-error" role="alert" hidden></p></div>' +
      '<div class="field"><span class="label" id="tip-label">Tip</span>' +
      '<div class="tip-presets" id="tip-presets" role="group" aria-labelledby="tip-label"></div>' +
      '<div class="input-suffix tip-custom"><input id="tip-input" type="number" inputmode="decimal" min="0" max="100" step="0.5" placeholder="Custom" aria-label="Custom tip percent"><span>%</span></div>' +
      '<p class="error" id="tip-error" role="alert" hidden></p></div>' +
      '</div></div></section>';
  }

  function owesCard() {
    return '<section class="card" aria-labelledby="owes-title">' +
      bar('blue', 'owes-title', 'What everyone owes', 'coin') +
      '<div class="card-body">' +
      '<ul class="owes-list" id="owes-list"></ul>' +
      '<div id="breakdown" aria-live="polite"></div>' +
      '</div></section>';
  }

  function settlementCard() {
    return '<section class="card settlement" id="settlement-card" aria-labelledby="settle-title">' +
      '<span class="burst" aria-hidden="true">' + Art.svg('burst', 92) + '<b>Fair!</b></span>' +
      bar('orange', 'settle-title', 'Settlement', 'cake') +
      '<div class="card-body">' +
      '<label class="field bill-name"><span class="label">Bill name</span>' +
      '<input id="bill-title" type="text" maxlength="40" placeholder="Dinner" autocomplete="off"></label>' +
      '<div class="field payer-field">' +
      '<span class="label">Who paid what?</span>' +
      '<p class="hint">Enter how much each person already paid toward the bill. Choose None if they paid ₹0. Anyone who paid can add their UPI for QR.</p>' +
      '<div id="paid-list" class="paid-list"></div></div>' +
      '<div id="settlement-body"></div>' +
      '<div class="copy-fallback" id="copy-fallback" hidden>' +
      '<p>Couldn’t access the clipboard. Select the text below and copy it manually:</p>' +
      '<textarea id="copy-fallback-text" rows="8" readonly></textarea></div>' +
      '</div></section>';
  }

  function backgroundArt() {
    return '<div class="bg-art" aria-hidden="true">' +
      Art.svg('pizza', 120, 'bg bg-1 art-line') +
      Art.svg('coin', 104, 'bg bg-2 art-line') +
      Art.svg('receipt', 100, 'bg bg-3 art-line') +
      Art.svg('burger', 118, 'bg bg-4 art-line') +
      Art.svg('sparkle', 50, 'bg bg-5 art-line') +
      Art.svg('star', 54, 'bg bg-6 art-line') +
      Art.svg('drink', 96, 'bg bg-7 art-line') +
      Art.svg('cake', 96, 'bg bg-8 art-line') +
      '</div>';
  }

    function homeView() {
    return '<div class="app view home" id="view-home" hidden>' +
      '<div class="home-card">' +
      '<span class="home-art ha-1">' + Art.svg('pizza', 84) + '</span>' +
      '<span class="home-art ha-2">' + Art.svg('burger', 80) + '</span>' +
      '<span class="home-art ha-3">' + Art.svg('drink', 70) + '</span>' +
      '<span class="home-art ha-4">' + Art.svg('sparkle', 54) + '</span>' +
      '<div class="home-logo">' + Art.svg('coin', 96) + '</div>' +
      '<h1 class="home-title">Split<span class="h1-hl">ae</span></h1>' +
      '<p class="home-tag">Split bills without the headache.</p>' +
      '<a class="btn btn-pink btn-lg home-start" href="#/bills"><span>Start</span>' + icon('arrow', 20) + '</a>' +
      '</div></div>';
  }

  function billsView() {
    return '<div class="app view" id="view-bills" hidden>' +
      header('<a class="btn btn-primary" href="#/bill/new">' + icon('plus', 17) + '<span>New bill</span></a>') +
      '<section class="card" aria-labelledby="bills-title">' +
      bar('yellow', 'bills-title', 'Your bills', 'receipt', 'bills-count') +
      '<div class="card-body"><ul class="bills-list" id="bills-list"></ul></div></section>' +
      '</div>';
  }

  function billView() {
    var actions =
      '<a class="btn btn-outline" href="#/bills">' + icon('list', 17) + '<span>All bills</span></a>' +
      '<button type="button" class="btn btn-outline" data-action="share-bill">' +
      icon('share', 17) + '<span>Share</span></button>' +
      '<button type="button" class="btn btn-outline" id="btn-reset" data-action="reset">' +
      icon('reset', 17) + '<span>Reset</span></button>';
    return '<div class="app view" id="view-bill" hidden>' +
      header(actions) + intro() +
      '<main class="layout">' +
      '<div class="col">' + peopleCard() + itemsCard() +
      '<div class="friends-deco" aria-hidden="true">' + Art.svg('friends', 280) + '</div></div>' +
      '<div class="col" id="summary">' + summaryCard() + owesCard() + settlementCard() + '</div>' +
      '</main>' +
      '<footer class="footer">' + Art.svg('squiggle', 200) +
      '<p>Splitae - Split bills the aesthetic way </p></footer>' +
      '</div>';
  }

  function build() {
    return backgroundArt() + ticker() +
      homeView() + billsView() + billView() +
      '<div class="mobile-bar" id="mobile-bar"><div><span class="mobile-label">Bill total</span>' +
      '<strong id="mobile-total">₹0.00</strong></div>' +
      '<button type="button" class="btn btn-primary" data-action="scroll-summary">View summary</button></div>' +
      '<dialog class="dialog" id="confirm-dialog" aria-labelledby="confirm-title"><form method="dialog">' +
      '<h3 id="confirm-title"></h3><p id="confirm-text"></p>' +
      '<div class="dialog-actions"><button type="submit" value="cancel" class="btn btn-outline">Cancel</button>' +
      '<button type="submit" value="ok" class="btn btn-danger" id="confirm-ok">Confirm</button></div>' +
      '</form></dialog>' +
      '<dialog class="dialog pay-dialog" id="pay-dialog" aria-labelledby="pay-title">' +
      '<button type="button" class="icon-btn pay-close" data-action="close-pay" aria-label="Close">' + icon('x', 18) + '</button>' +
      '<h3 id="pay-title">Pay your share</h3>' +
      '<p id="pay-subtitle" class="pay-sub"></p>' +
      '<div class="pay-qr-wrap"><canvas id="pay-qr" width="200" height="200"></canvas></div>' +
      '<p id="pay-upi-hint" class="pay-hint"></p>' +
      '<p id="pay-amount" class="pay-amount"></p>' +
      '<div class="pay-actions">' +
      '<button type="button" class="btn btn-outline" data-action="close-pay">Cancel</button>' +
      '<button type="button" class="btn btn-primary" data-action="mark-paid">' +
      icon('check', 16) + ' Mark as paid</button></div>' +
      '</dialog>' +
      '<div class="toast" id="toast" role="status" aria-live="polite"></div>';
  }

  var root = document.getElementById('root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'root';
    document.body.insertBefore(root, document.body.firstChild);
  }
  root.innerHTML = build();
})();
