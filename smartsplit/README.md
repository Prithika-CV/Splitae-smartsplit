# SmartSplit — Smart Bill Splitter

A neo-brutalist bill splitter: add people, add items, assign who shared what, set tax and tip,
and get a clear settlement. Plain HTML, CSS and JavaScript, served by a tiny Node server
with zero dependencies.

## Run it

```bash
node server.js        # or: npm start
```

Then open **http://localhost:5173**. To use another port: `PORT=3000 node server.js`
(on Windows PowerShell: `$env:PORT=3000; node server.js`).
You need Node 16+. No `npm install` is required.

You can also use the VS Code **Live Server** extension on `index.html`.

## Project structure

```
server.js             Node static file server (no dependencies)
index.html            minimal shell: fonts, #root, script tags
package.json          npm scripts (start, dev, test)
src/
  layout.js           builds the page layout (header, ticker, cards, dialog)
  app.js              state, rendering, events
  calculations.js     pure money math in integer cents (no DOM)
  clipart.js          hand-drawn SVG clip art + line art
  icons.js            inline Lucide-style UI icons
  styles.css          neo-brutalist theme
tests/
  calculations.test.js   run with: npm test
```

Script order in `index.html` matters: calculations, icons, clipart, layout, then app.

## How the math works

- All money is stored as integer cents, so there are no floating point errors.
- An item is split equally between its assigned people; leftover cents go one by one to the
  first people so shares add up exactly to the item price.
- Tax and tip are spread in proportion to each person's item subtotal.
- Any rounding difference goes to the person with the largest subtotal, so everyone's totals
  always add up exactly to the bill total.
- Totals stay locked until every item has someone assigned.

## Customising the look

Colours, borders and shadows are CSS variables at the top of `src/styles.css`
(`--yellow`, `--pink`, `--shadow`, `--bw`, ...). Clip art lives in `src/clipart.js`;
item names like "pizza", "burger" or "coffee" automatically pick matching art.
