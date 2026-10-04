/*
 * SmartSplit clip art — original hand-drawn SVG doodles.
 * Thick black outlines + flat fills for the neo-brutalist look.
 * Usage: SmartSplitArt.svg('pizza', 48, 'my-class')
 */
window.SmartSplitArt = (function () {
  'use strict';

  var INK = '#111';

  // Drawings live in a 64x64 box unless listed in BOXES.
  var BOXES = {
    squiggle: [120, 16],
    friends: [220, 110]
  };

  var DRAW = {
    pizza:
      '<path d="M6 17 Q32 3 58 17 L55 25 Q32 12 9 25 Z" fill="#FFAA5C"/>' +
      '<path d="M9 25 Q32 12 55 25 L32 59 Z" fill="#FFD93D"/>' +
      '<circle cx="25" cy="31" r="4.5" fill="#FF5A5F"/>' +
      '<circle cx="39" cy="34" r="4.5" fill="#FF5A5F"/>' +
      '<circle cx="31" cy="45" r="3.5" fill="#FF5A5F"/>',

    burger:
      '<path d="M9 28 Q9 9 32 9 Q55 9 55 28 Z" fill="#FFAA5C"/>' +
      '<path d="M22 17 l3 2 M32 14 l3 2 M41 19 l3 2 M27 23 l3 1.5" stroke-width="2"/>' +
      '<path d="M7 30 Q13 38 20 31 T33 31 T46 31 T57 30 L57 34 L7 34 Z" fill="#7BE0A8"/>' +
      '<rect x="8" y="34" width="48" height="9" rx="4.5" fill="#8B5A2B"/>' +
      '<path d="M9 44 H55 Q55 55 44 55 H20 Q9 55 9 44 Z" fill="#FFAA5C"/>',

    pasta:
      '<path d="M14 30 Q14 12 24 20 Q30 8 38 20 Q48 12 50 30" stroke-width="7"/>' +
      '<path d="M14 30 Q14 12 24 20 Q30 8 38 20 Q48 12 50 30" stroke="#FFD93D" stroke-width="3"/>' +
      '<circle cx="32" cy="24" r="5" fill="#FF5A5F"/>' +
      '<path d="M8 31 H56 Q54 56 32 56 Q10 56 8 31 Z" fill="#6CB4FF"/>' +
      '<path d="M13 41 H51" stroke-width="2"/>',

    drink:
      '<path d="M34 14 L40 3 H50"/>' +
      '<path d="M16 14 H48 V21 H16 Z" fill="#fff"/>' +
      '<path d="M18 21 H46 L42 57 H22 Z" fill="#6CB4FF"/>' +
      '<path d="M20 33 H44" stroke-width="2"/>' +
      '<circle cx="30" cy="43" r="2.5" fill="#fff" stroke-width="2"/>' +
      '<circle cx="37" cy="48" r="2" fill="#fff" stroke-width="2"/>',

    cake:
      '<rect x="9" y="31" width="46" height="24" rx="3" fill="#FF8FB8"/>' +
      '<path d="M9 43 H55" stroke-width="2.5"/>' +
      '<path d="M9 31 Q9 24 15 26 Q20 31 26 26 T38 26 T50 26 Q55 24 55 31 Z" fill="#fff"/>' +
      '<circle cx="32" cy="17" r="5.5" fill="#FF5A5F"/>' +
      '<path d="M32 11.5 Q33 6 40 5"/>',

    coffee:
      '<path d="M19 22 Q15 17 19 11 M29 22 Q25 17 29 11" stroke-width="2.5"/>' +
      '<path d="M11 28 H45 V44 Q45 55 34 55 H22 Q11 55 11 44 Z" fill="#fff"/>' +
      '<path d="M45 32 H50 Q57 32 57 39 Q57 46 50 46 H44"/>' +
      '<path d="M11 35 H45" stroke-width="2.5" stroke="#8B5A2B"/>' +
      '<path d="M7 59 H49"/>',

    plate:
      '<circle cx="32" cy="32" r="17" fill="#fff"/>' +
      '<circle cx="32" cy="32" r="10" fill="#FFD93D" stroke-width="2.5"/>' +
      '<path d="M6 10 V24 Q6 29 10 29 Q14 29 14 24 V10 M10 29 V55 M10 10 V24"/>' +
      '<path d="M57 10 Q50 16 51 29 H57 V55 M57 10 V29"/>',

    receipt:
      '<path d="M14 5 H50 V59 L44.5 55 L39 59 L33.5 55 L28 59 L22.5 55 L17 59 L14 57 Z" fill="#fff"/>' +
      '<path d="M21 15 H43 M21 23 H43 M21 31 H35" stroke-width="2.5"/>' +
      '<path d="M21 43 H43" stroke-width="4" stroke="#FF5A5F"/>',

    coin:
      '<circle cx="32" cy="32" r="24" fill="#FFD93D"/>' +
      '<circle cx="32" cy="32" r="17" stroke-width="2.5"/>' +
      '<text x="32" y="40.5" text-anchor="middle" font-size="22" font-weight="800" ' +
      'font-family="Space Grotesk, Segoe UI, Arial, sans-serif" fill="' + INK + '" stroke="none">₹</text>' +
      '<path d="M16 17 Q19 13 24 11.5" stroke="#fff" stroke-width="3"/>',

    moneybag:
      '<path d="M24 6 L28 14 H36 L40 6 Q32 10 24 6 Z" fill="#FFD93D"/>' +
      '<path d="M28 14 Q10 26 12 44 Q14 59 32 59 Q50 59 52 44 Q54 26 36 14 Z" fill="#7BE0A8"/>' +
      '<path d="M26 19.5 H38" stroke-width="3"/>' +
      '<text x="32" y="48" text-anchor="middle" font-size="22" font-weight="800" ' +
      'font-family="Space Grotesk, Segoe UI, Arial, sans-serif" fill="' + INK + '" stroke="none">₹</text>',

    people:
      '<path d="M4 56 Q4 42 16 42 Q28 42 28 56 Z" fill="#FF8FB8"/>' +
      '<circle cx="16" cy="26" r="8.5" fill="#FF8FB8"/>' +
      '<circle cx="13" cy="25" r="1.2" fill="' + INK + '" stroke="none"/><circle cx="19" cy="25" r="1.2" fill="' + INK + '" stroke="none"/>' +
      '<path d="M12.5 29 Q16 32 19.5 29" stroke-width="2"/>' +
      '<path d="M36 56 Q36 42 48 42 Q60 42 60 56 Z" fill="#6CB4FF"/>' +
      '<circle cx="48" cy="26" r="8.5" fill="#6CB4FF"/>' +
      '<circle cx="45" cy="25" r="1.2" fill="' + INK + '" stroke="none"/><circle cx="51" cy="25" r="1.2" fill="' + INK + '" stroke="none"/>' +
      '<path d="M44.5 29 Q48 32 51.5 29" stroke-width="2"/>' +
      '<path d="M18 59 Q18 38 32 38 Q46 38 46 59 Z" fill="#FFD93D"/>' +
      '<circle cx="32" cy="20" r="10" fill="#FFD93D"/>' +
      '<circle cx="28.5" cy="19" r="1.4" fill="' + INK + '" stroke="none"/><circle cx="35.5" cy="19" r="1.4" fill="' + INK + '" stroke="none"/>' +
      '<path d="M27.5 24 Q32 28.5 36.5 24" stroke-width="2.2"/>',

    burst:
      '<polygon fill="#FF8FB8" points="32,3 37.95,9.78 46.5,6.89 48.26,15.74 57.11,17.5 54.22,26.05 61,32 54.22,37.95 57.11,46.5 48.26,48.26 46.5,57.11 37.95,54.22 32,61 26.05,54.22 17.5,57.11 15.74,48.26 6.89,46.5 9.78,37.95 3,32 9.78,26.05 6.89,17.5 15.74,15.74 17.5,6.89 26.05,9.78"/>',

    sparkle:
      '<path d="M32 4 Q35 29 60 32 Q35 35 32 60 Q29 35 4 32 Q29 29 32 4 Z" fill="#FFD93D"/>',

    arrow:
      '<path d="M6 46 Q10 10 50 18"/><path d="M40 7 L52 18 L40 29"/>',

    squiggle:
      '<path d="M2 8 Q12 0 22 8 T42 8 T62 8 T82 8 T102 8 T118 8" stroke-width="3.5"/>',

    star:
      '<path d="M32 5 L39.5 23 L59 24.5 L44 37 L48.8 56 L32 45.8 L15.2 56 L20 37 L5 24.5 L24.5 23 Z" fill="#C9B1FF"/>',

    /* Cute stick-figure friends with hearts (clean line art) */
    friends:
      /* person 1 — arm up */
      '<circle cx="30" cy="28" r="10" fill="none" stroke-width="3"/>' +
      '<path d="M30 38 L30 72" stroke-width="3"/>' +
      '<path d="M30 48 L14 36" stroke-width="3"/>' +
      '<path d="M30 48 L42 58" stroke-width="3"/>' +
      '<path d="M30 72 L20 94" stroke-width="3"/>' +
      '<path d="M30 72 L40 94" stroke-width="3"/>' +
      /* person 2 */
      '<circle cx="70" cy="30" r="10" fill="none" stroke-width="3"/>' +
      '<path d="M70 40 L70 74" stroke-width="3"/>' +
      '<path d="M70 50 L56 60" stroke-width="3"/>' +
      '<path d="M70 50 L84 58" stroke-width="3"/>' +
      '<path d="M70 74 L60 96" stroke-width="3"/>' +
      '<path d="M70 74 L80 96" stroke-width="3"/>' +
      /* person 3 — arm high */
      '<circle cx="110" cy="26" r="10" fill="none" stroke-width="3"/>' +
      '<path d="M110 36 L110 72" stroke-width="3"/>' +
      '<path d="M110 48 L96 56" stroke-width="3"/>' +
      '<path d="M110 42 L124 20" stroke-width="3"/>' +
      '<path d="M110 72 L100 96" stroke-width="3"/>' +
      '<path d="M110 72 L120 96" stroke-width="3"/>' +
      /* person 4 */
      '<circle cx="150" cy="30" r="10" fill="none" stroke-width="3"/>' +
      '<path d="M150 40 L150 74" stroke-width="3"/>' +
      '<path d="M150 50 L138 62" stroke-width="3"/>' +
      '<path d="M150 50 L164 58" stroke-width="3"/>' +
      '<path d="M150 74 L140 96" stroke-width="3"/>' +
      '<path d="M150 74 L160 96" stroke-width="3"/>' +
      /* person 5 — arm out */
      '<circle cx="190" cy="28" r="10" fill="none" stroke-width="3"/>' +
      '<path d="M190 38 L190 72" stroke-width="3"/>' +
      '<path d="M190 48 L176 56" stroke-width="3"/>' +
      '<path d="M190 46 L210 36" stroke-width="3"/>' +
      '<path d="M190 72 L180 94" stroke-width="3"/>' +
      '<path d="M190 72 L200 94" stroke-width="3"/>' +
      /* hearts */
      '<path d="M48 12 Q50 8 54 12 Q58 8 60 12 Q60 16 54 20 Q48 16 48 12 Z" fill="#FF8FB8" stroke-width="1.8"/>' +
      '<path d="M88 8 Q89.5 5.5 92 8 Q94.5 5.5 96 8 Q96 10.5 92 13 Q88 10.5 88 8 Z" fill="#FF8FB8" stroke-width="1.5"/>' +
      '<path d="M128 4 Q130 1 133 4 Q136 1 138 4 Q138 7 133 10 Q128 7 128 4 Z" fill="#FF8FB8" stroke-width="1.6"/>' +
      '<path d="M200 10 Q202 7 205 10 Q208 7 210 10 Q210 13 205 16 Q200 13 200 10 Z" fill="#FF8FB8" stroke-width="1.6"/>'

  };

  var NAMES = Object.keys(DRAW);

  function svg(name, size, cls) {
    var body = DRAW[name] || DRAW.plate;
    var box = BOXES[name] || [64, 64];
    var width = size || 48;
    var height = Math.round(width * box[1] / box[0]);
    return '<svg class="art ' + (cls || '') + '" xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
      '" viewBox="0 0 ' + box[0] + ' ' + box[1] + '" fill="none" stroke="' + INK + '" stroke-width="3" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  /* Pick a clip art + background colour for an item from its name. */
  var RULES = [
    [/pizza|margherita|calzone/i, 'pizza', '#FFF1B8'],
    [/burger|sandwich|fries|wrap|roll|taco|sub\b|hot ?dog/i, 'burger', '#FFD9B0'],
    [/pasta|noodle|spaghetti|ramen|maggi|macaroni|lasagna|biryani|rice|soup/i, 'pasta', '#CFE6FF'],
    [/drink|soda|cola|juice|beer|wine|cocktail|mocktail|water|shake|lassi|mojito|smoothie|whisky|vodka|coke|pepsi|sprite/i, 'drink', '#D6F5E3'],
    [/dessert|cake|ice ?cream|brownie|sweet|pastry|gulab|jalebi|donut|doughnut|cookie|pie\b|sundae/i, 'cake', '#FFD6E6'],
    [/coffee|tea\b|chai|latte|cappuccino|espresso/i, 'coffee', '#E6DBFF']
  ];

  function forItem(name) {
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][0].test(name)) return { art: RULES[i][1], bg: RULES[i][2] };
    }
    return { art: 'plate', bg: '#FFF1B8' };
  }

  return { svg: svg, forItem: forItem, names: NAMES };
})();
