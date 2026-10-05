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
