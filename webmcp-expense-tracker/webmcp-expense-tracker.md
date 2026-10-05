author: Simar Preet Singh
summary: Build a small expense tracker that AI agents can use through WebMCP, embed a currency converter with its own tools, and ship it on GitHub Pages.
id: webmcp-expense-tracker
categories: web,ai
environments: Web
status: Draft
feedback link: https://github.com/theprogrammersingh/codelabs/issues
analytics account:

# Make your web app agent ready with WebMCP

## Overview
Duration: 0:02:00

AI agents can already use websites by reading the DOM and clicking buttons. That works, but it's slow and it breaks every time you change your markup. WebMCP lets a page hand the agent a list of tools instead: named JavaScript functions with a description and a JSON schema. The agent calls `add-expense` directly instead of guessing which input is the amount field.

### What you'll build

A personal expense tracker in plain HTML, CSS and JS. It stores expenses in `localStorage` and exposes them to agents as WebMCP tools. It also embeds a separate currency converter page in an iframe. The converter has its own tools, and the tracker calls them to log expenses paid in other currencies.

You'll deploy it to GitHub Pages and drive it from the ChatGPT desktop app.

### What you'll learn

- How to register WebMCP tools with `document.modelContext.registerTool()`
- How to write descriptions, schemas and annotations an agent can use without guessing
- How a page finds and calls tools from an iframe with `getTools()` and `executeTool()`
- How to deploy a static site to GitHub Pages

### What you need

- A GitHub account, and `git` on your machine
- Python 3 or Node.js, only to run a local web server
- A code editor
- The ChatGPT desktop app, for the last step
- Optional: Chrome 149 or later, to test the tools locally

No frameworks, no build step, no npm install.

## Get the starter code
Duration: 0:03:00

Download the starter and unzip it.

<button>[Download starter code](https://github.com/theprogrammersingh/codelabs/archive/refs/heads/main.zip)</button>

Copy the starter folder somewhere you'll work and `cd` into it:

```bash
cp -r codelabs-main/webmcp-expense-tracker/starter ~/expense-tracker
cd ~/expense-tracker
```

You should have:

```text
index.html    page markup
style.css     styles, you won't touch this
app.js        expense storage and rendering, already done
webmcp.js     empty, you'll write this
```

Start a local server:

```bash
python3 -m http.server 8080
# or: npx serve -l 8080
```

Open http://localhost:8080 and add an expense or two with the form. They should show up in the list and the total should update. Reload the page and they're still there.

<aside class="negative">
Don't open <code>index.html</code> straight from disk. On <code>file://</code> the page and the iframe don't share an origin, so the tracker can't see the converter's tools in step 6.
</aside>

## How WebMCP works
Duration: 0:04:00

Open `app.js` and skim it. The parts that matter are four functions:

- `addExpense({ title, amount, category, date })` saves an expense and re-renders
- `loadExpenses()` returns all expenses
- `summarize()` returns totals per category
- `deleteExpense(id)` removes one

The form calls these. In the next step agents will call the same functions, through WebMCP.

A WebMCP tool looks like this:

```js
await document.modelContext.registerTool({
  name: 'add-expense',                 // what the agent calls
  description: 'Add an expense',       // how the agent decides when to call it
  inputSchema: { /* JSON Schema */ },  // what arguments it sends
  annotations: { readOnlyHint: false }, // hints about side effects
  async execute(input) {               // your code, runs in the page
    return { added: true };            // any JSON value
  },
});
```

When an agent visits the page, the browser gives it the list of registered tools. The agent picks one, sends arguments that match the schema, and your `execute` runs with the user's session, cookies and `localStorage`. Whatever you return goes back to the model as JSON.

Things the docs are specific about:

- `registerTool()` returns a promise. It rejects with `NotAllowedError` if the page isn't allowed to use WebMCP, so await it and catch errors.
- Names can use letters, digits, `_`, `-` and `.`. The official examples use kebab-case, so this codelab does too.
- Chrome caps a tool description at 500 characters, a parameter description at 150, names at 30 and tool output at 1.5K. Long outputs get cut off.
- If `execute` throws, the agent gets an `UnknownError` with your message stripped. Return the error as data instead, so the model can read it and retry.
- Tool input is untrusted, like any form input. `app.js` already validates it and renders with `textContent`, never `innerHTML`.

<aside class="positive">
WebMCP is a draft from the W3C Web Machine Learning community group and still changing. The <a href="https://webmachinelearning.github.io/webmcp/">spec</a> and the <a href="https://github.com/webmachinelearning/webmcp">explainer</a> are the source of truth if anything here stops working.
</aside>

## Register the expense tools
Duration: 0:07:00

Replace the contents of `webmcp.js` with this:

```js
// WebMCP tools for the expense tracker.
// Spec: https://webmachinelearning.github.io/webmcp/

// A thrown error reaches the agent as an opaque UnknownError, so return the
// message instead. The model can read it and retry with better input.
function safe(fn) {
  return async (input = {}) => {
    try {
      return await fn(input);
    } catch (err) {
      return { error: err.message };
    }
  };
}

async function registerExpenseTools(mc) {
  await mc.registerTool({
    name: 'add-expense',
    description: 'Add an expense to the tracker. The amount must be in USD.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short label, e.g. "Lunch"' },
        amount: { type: 'number', description: 'Amount in USD, greater than 0' },
        category: { type: 'string', enum: CATEGORIES },
        date: { type: 'string', description: 'YYYY-MM-DD, defaults to today' },
      },
      required: ['title', 'amount'],
    },
    execute: safe((input) => ({ added: addExpense(input) })),
  });

  await mc.registerTool({
    name: 'list-expenses',
    description: 'List the most recent expenses with their ids, newest first. ' +
      'Returns up to 10. Filter by category to find older ones.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: CATEGORIES },
        limit: { type: 'number', description: 'How many to return, 1 to 10. Defaults to 10.' },
      },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: safe(({ category, limit = 10 }) => {
      const n = Math.min(Math.max(Math.floor(Number(limit)) || 10, 1), 10);
      const expenses = loadExpenses()
        .filter((e) => !category || e.category === category)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, n);
      return { expenses };
    }),
  });

  await mc.registerTool({
    name: 'get-spending-summary',
    description: 'Get total spend in USD, the number of expenses and totals per category.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: safe(() => summarize()),
  });

  await mc.registerTool({
    name: 'delete-expense',
    description: 'Delete one expense by id. Get the id from list-expenses.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Expense id from list-expenses' },
      },
      required: ['id'],
    },
    annotations: { consequentialHint: true },
    execute: safe(({ id }) => {
      if (!deleteExpense(id)) throw new Error(`No expense with id ${id}`);
      return { deleted: id };
    }),
  });
}

async function registerTools() {
  const mc = document.modelContext;
  if (!mc) return console.info('WebMCP is not available in this browser. Tools not registered.');
  await registerExpenseTools(mc);
  console.info('WebMCP tools registered.');
}

registerTools().catch((err) => console.error('WebMCP registration failed:', err));
```

A few choices worth pointing out:

- `safe()` wraps every `execute`. A bad call returns `{ error: 'title is required' }` and the agent can fix its input and try again.
- `category` uses the `CATEGORIES` array from `app.js` as an `enum`. The agent gets the exact allowed values instead of inventing "groceries".
- `list-expenses` returns at most 10 items. Ten expenses come to about 1.3K characters, just under Chrome's 1.5K output cap. The description tells the agent how to find older ones.
- The annotations tell the agent what each tool does to your data:
  - `readOnlyHint` marks tools that are safe to call freely.
  - `untrustedContentHint` on `list-expenses` warns that titles are user written, so the model should treat them as data, not instructions.
  - `consequentialHint` on `delete-expense` asks the agent to confirm with the user first.
- The `!mc` check keeps the page working in browsers without WebMCP. The tools are an extra on top of the UI, not a replacement.

Reload http://localhost:8080 and open DevTools. You'll see one of the two log lines, depending on your browser. The form still works the same either way.

<aside class="positive">
To see real tools locally, use Chrome 149 or later and turn on <code>about:flags#enable-webmcp-testing</code>, then relaunch. The console should print "WebMCP tools registered."
</aside>

## Build the currency converter
Duration: 0:06:00

The converter is a separate page that knows nothing about expenses. You could host it on another domain and embed it in any site. For this codelab it lives in a `converter/` folder in the same repo.

Create `converter/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Currency Converter</title>
  <style>
    body {
      margin: 0;
      padding: 16px;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #1d2330;
      background: #fafbfc;
    }
    form { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    input, select { font: inherit; padding: 8px 10px; border: 1px solid #e3e6eb; border-radius: 6px; min-width: 0; }
    output { display: block; margin-top: 12px; font-size: 1.5rem; font-variant-numeric: tabular-nums; }
    small { color: #6b7280; }
  </style>
</head>
<body>
  <form id="convert-form">
    <input name="amount" type="number" step="0.01" min="0" value="10" aria-label="Amount">
    <select name="from" aria-label="From"></select>
    <select name="to" aria-label="To"></select>
  </form>
  <output id="result"></output>
  <small>Sample rates, not live market data.</small>

  <script src="converter.js"></script>
</body>
</html>
```

Create `converter/converter.js`:

```js
// A small standalone currency converter. People use the form, agents and
// host pages use its WebMCP tools.

// Units per 1 USD. Hardcoded so the codelab works without network access.
const RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.5,
  JPY: 150,
  CAD: 1.36,
  AUD: 1.52,
  SGD: 1.35,
};

function convert(amount, from, to) {
  const value = Number(amount);
  const src = String(from).toUpperCase();
  const dst = String(to).toUpperCase();
  if (!(value >= 0)) throw new Error("amount must be a non-negative number");
  if (!RATES[src]) throw new Error(`Unsupported currency: ${src}`);
  if (!RATES[dst]) throw new Error(`Unsupported currency: ${dst}`);
  return Math.round((value / RATES[src]) * RATES[dst] * 100) / 100;
}

// UI
const form = document.getElementById("convert-form");
const { amount, from, to } = form.elements;
const output = document.getElementById("result");

for (const code of Object.keys(RATES)) {
  from.add(new Option(code, code));
  to.add(new Option(code, code));
}
from.value = "EUR";
to.value = "USD";

function update() {
  try {
    output.textContent = `${convert(amount.value || 0, from.value, to.value).toFixed(2)} ${to.value}`;
  } catch (err) {
    output.textContent = err.message;
  }
}
form.addEventListener("input", update);
update();

// WebMCP tools
function safe(fn) {
  return async (input = {}) => {
    try {
      return await fn(input);
    } catch (err) {
      return { error: err.message };
    }
  };
}

async function registerTools() {
  const mc = document.modelContext;
  if (!mc) return;

  await mc.registerTool({
    name: "convert-currency",
    description:
      "Convert an amount between two currencies using the converter sample rates.",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Amount to convert" },
        from: {
          type: "string",
          description: "ISO 4217 code to convert from, e.g. EUR",
        },
        to: {
          type: "string",
          description: "ISO 4217 code to convert to, e.g. USD",
        },
      },
      required: ["amount", "from", "to"],
    },
    annotations: { readOnlyHint: true },
    execute: safe(({ amount, from, to }) => ({
      amount,
      from,
      to,
      result: convert(amount, from, to),
    })),
  });

  await mc.registerTool({
    name: "list-currencies",
    description: "List the currency codes the converter supports.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: safe(() => ({ currencies: Object.keys(RATES) })),
  });
}

registerTools().catch((err) =>
  console.error("WebMCP registration failed:", err),
);
```

The same `convert()` function sits behind two interfaces: the form for people, and WebMCP tools for agents and for any page that embeds the converter. That's the pattern to copy for real embeddable widgets.

The rates are hardcoded on purpose. Conference wifi is not something to depend on in a live demo. In a real app you'd fetch them from a rates API and cache them.

Open http://localhost:8080/converter/ and change the amount. 10 EUR should show 10.87 USD.

## Embed the converter in the tracker
Duration: 0:05:00

In `index.html`, replace the comment inside the "Currency converter" section with an iframe:

```html
<section class="card">
  <h2>Currency converter</h2>
  <iframe id="converter" src="converter/" title="Currency converter" allow="tools"></iframe>
</section>
```

Here's how WebMCP treats iframes. It's on by default in the top-level page and in same-origin iframes. A tool is visible to its own page, to same-origin documents in the same tab, and to the browser's built-in agent. The converter is same-origin here, so the agent already sees `convert-currency` and `list-currencies` next to your expense tools.

A cross-origin iframe needs two extra things. The embedding page grants access with `allow="tools"`, which is already on the iframe above. The converter has to opt in too, by registering its tools with `{ exposedTo: ['https://YOUR_USERNAME.github.io'] }` as the second argument.

The agent could convert first and then call `add-expense`, but that's two calls and some arithmetic for the model to get wrong. Chrome's best practices say to accept raw input instead. So the tracker gets one more tool, `add-foreign-expense`, which calls the converter's tool itself.

In `webmcp.js`, add this above `async function registerTools()`:

```js
// Calls the convert-currency tool registered by the converter iframe.
const converterFrame = document.getElementById('converter');

async function convertViaFrame(amount, from, to) {
  const tools = await document.modelContext.getTools();
  const tool = tools.find((t) => t.name === 'convert-currency' && t.window === converterFrame.contentWindow);
  if (!tool) throw new Error('Currency converter tools not found');

  // Chrome takes the input as a JSON string and returns the result as one.
  const out = await document.modelContext.executeTool(tool, JSON.stringify({ amount, from, to }));
  const data = typeof out === 'string' ? JSON.parse(out) : out;
  if (data.error) throw new Error(data.error);
  return data.result;
}

async function registerConverterTools(mc) {
  await mc.registerTool({
    name: 'add-foreign-expense',
    description: 'Add an expense paid in a currency other than USD. ' +
      'Converts it to USD with the embedded currency converter, then saves it.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short label, e.g. "Taxi"' },
        amount: { type: 'number', description: 'Amount in the original currency' },
        currency: { type: 'string', description: 'ISO 4217 code, e.g. EUR, GBP, INR' },
        category: { type: 'string', enum: CATEGORIES },
        date: { type: 'string', description: 'YYYY-MM-DD, defaults to today' },
      },
      required: ['title', 'amount', 'currency'],
    },
    execute: safe(async ({ title, amount, currency, category, date }) => {
      const code = String(currency).toUpperCase();
      const usd = await convertViaFrame(amount, code, 'USD');
      return { added: addExpense({ title: `${title} (${amount} ${code})`, amount: usd, category, date }) };
    }),
  });
}
```

Then register it in `registerTools()`:

```js
async function registerTools() {
  const mc = document.modelContext;
  if (!mc) return console.info('WebMCP is not available in this browser. Tools not registered.');
  await registerExpenseTools(mc);
  await registerConverterTools(mc);
  console.info('WebMCP tools registered.');
}

registerTools().catch((err) => console.error('WebMCP registration failed:', err));
```

How the bridge works:

- `getTools()` returns every tool the page can see, including the iframe's. Each entry has a `window` and an `origin`. Matching on `converterFrame.contentWindow` means a tool with the same name from some other frame can't answer instead.
- `executeTool()` runs that tool in the iframe and resolves with its result. Chrome takes the input as a JSON string and returns the output as a JSON string, so the code stringifies and parses.
- The converter's `safe()` returns `{ error }` for an unknown currency, and `convertViaFrame` turns it back into an exception. Then the tracker's own `safe()` hands the message to the agent.

Reload the tracker. The converter shows up under the expense list. If you turned on the Chrome flag, test the bridge in the DevTools console:

```js
await convertViaFrame(20, 'EUR', 'USD')
```

You should get `21.74`.

<aside class="positive">
Fell behind? The finished code is in the <code>solution/</code> folder of the download. Copy it over your working folder and carry on.
</aside>

## Deploy to GitHub Pages
Duration: 0:05:00

Stop the local server and commit your work:

```bash
git init
git add .
git commit -m "Expense tracker with WebMCP tools"
git branch -M main
```

Create an empty public repo called `expense-tracker` on GitHub and push to it. With the GitHub CLI it's one command:

```bash
gh repo create expense-tracker --public --source . --push
```

Without it, create the repo at https://github.com/new (don't add a README) and run:

```bash
git remote add origin https://github.com/YOUR_USERNAME/expense-tracker.git
git push -u origin main
```

Turn on Pages:

1. Open the repo on GitHub and go to **Settings**, then **Pages**.
2. Under **Source**, pick **Deploy from a branch**.
3. Pick `main` and `/ (root)`, then click **Save**.

The first deploy takes a minute or so. Your site will be at:

```text
https://YOUR_USERNAME.github.io/expense-tracker/
```

Open it and check that the form, the list and the converter all work. Expenses don't carry over from localhost because `localStorage` is per origin.

<aside class="negative">
Pages serves the site under <code>/expense-tracker/</code>, not the domain root. All the paths in this project are relative (<code>style.css</code>, <code>converter/</code>), so they work. A path like <code>/style.css</code> would 404.
</aside>

## Test with ChatGPT
Duration: 0:04:00

Open your GitHub Pages URL in the ChatGPT desktop app's browser and ask the assistant to work with the page. Try these one at a time:

```text
Add a 4.50 coffee expense under food.
```

```text
I paid 20 euros for a taxi today. Log it.
```

```text
What am I spending the most on?
```

```text
Delete the coffee expense.
```

After each prompt, look at the page. The list and the total update as soon as a tool runs, because every tool goes through the same `addExpense` and `deleteExpense` functions as the form.

The taxi prompt is the one to watch. If it worked, the list shows `Taxi (20 EUR)` with an amount of 21.74. That title format only comes from `add-foreign-expense`, so you know the agent called your tool and the conversion ran through the iframe's tool, rather than the agent typing into the form.

The delete prompt should make the agent ask you to confirm first. That's `consequentialHint` doing its job.

If the agent ignores your tools and starts clicking around the UI instead, check two things. First, that the Pages URL is serving your latest commit. Second, your descriptions. Vague descriptions are the most common reason an agent doesn't pick a tool.

## Wrap up
Duration: 0:02:00

You now have a static site that agents use through real tools instead of screen scraping, plus an embedded widget whose tools both the agent and the page can call. No backend, no build step.

The pattern scales to bigger apps: keep the business logic in plain functions, then put a UI and WebMCP tools in front of the same functions.

Where to go next:

- Read the [WebMCP spec](https://webmachinelearning.github.io/webmcp/) and the [explainer](https://github.com/webmachinelearning/webmcp)
- Turn a plain HTML form into a tool with no JS using the [declarative API](https://github.com/webmachinelearning/webmcp/blob/main/declarative-api-explainer.md)
- Go through Chrome's [WebMCP best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices) and [secure tools guide](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- Host the converter on its own origin, using `allow="tools"` on the iframe and `exposedTo` on its tools
- Swap the hardcoded rates for a live rates API and cache the response
