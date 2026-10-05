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
    name: "add-expense",
    description: "Add an expense to the tracker. The amount must be in USD.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: 'Short label, e.g. "Lunch"' },
        amount: {
          type: "number",
          description: "Amount in USD, greater than 0",
        },
        category: { type: "string", enum: CATEGORIES },
        date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
      },
      required: ["title", "amount"],
    },
    execute: safe((input) => ({ added: addExpense(input) })),
  });

  await mc.registerTool({
    name: "list-expenses",
    description:
      "List the most recent expenses with their ids, newest first. " +
      "Returns up to 10. Filter by category to find older ones.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", enum: CATEGORIES },
        limit: {
          type: "number",
          description: "How many to return, 1 to 10. Defaults to 10.",
        },
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
    name: "get-spending-summary",
    description:
      "Get total spend in USD, the number of expenses and totals per category.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: safe(() => summarize()),
  });

  await mc.registerTool({
    name: "delete-expense",
    description: "Delete one expense by id. Get the id from list-expenses.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Expense id from list-expenses" },
      },
      required: ["id"],
    },
    annotations: { consequentialHint: true },
    execute: safe(({ id }) => {
      if (!deleteExpense(id)) throw new Error(`No expense with id ${id}`);
      return { deleted: id };
    }),
  });
}

// Calls the convert-currency tool registered by the converter iframe.
const converterFrame = document.getElementById("converter");

async function convertViaFrame(amount, from, to) {
  const tools = await document.modelContext.getTools();
  const tool = tools.find(
    (t) =>
      t.name === "convert-currency" &&
      t.window === converterFrame.contentWindow,
  );
  if (!tool) throw new Error("Currency converter tools not found");

  // Chrome takes the input as a JSON string and returns the result as one.
  const out = await document.modelContext.executeTool(
    tool,
    JSON.stringify({ amount, from, to }),
  );
  const data = typeof out === "string" ? JSON.parse(out) : out;
  if (data.error) throw new Error(data.error);
  return data.result;
}

async function registerConverterTools(mc) {
  await mc.registerTool({
    name: "add-foreign-expense",
    description:
      "Add an expense paid in a currency other than USD. " +
      "Converts it to USD with the embedded currency converter, then saves it.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: 'Short label, e.g. "Taxi"' },
        amount: {
          type: "number",
          description: "Amount in the original currency",
        },
        currency: {
          type: "string",
          description: "ISO 4217 code, e.g. EUR, GBP, INR",
        },
        category: { type: "string", enum: CATEGORIES },
        date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
      },
      required: ["title", "amount", "currency"],
    },
    execute: safe(async ({ title, amount, currency, category, date }) => {
      const code = String(currency).toUpperCase();
      const usd = await convertViaFrame(amount, code, "USD");
      return {
        added: addExpense({
          title: `${title} (${amount} ${code})`,
          amount: usd,
          category,
          date,
        }),
      };
    }),
  });
}

async function registerTools() {
  const mc = document.modelContext;
  if (!mc)
    return console.info(
      "WebMCP is not available in this browser. Tools not registered.",
    );
  await registerExpenseTools(mc);
  await registerConverterTools(mc);
  console.info("WebMCP tools registered.");
}

registerTools().catch((err) =>
  console.error("WebMCP registration failed:", err),
);
