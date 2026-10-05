// Expense data and UI. Everything lives in localStorage, amounts are in USD.

const STORAGE_KEY = 'expenses';
const CATEGORIES = ['food', 'transport', 'shopping', 'bills', 'other'];

function round2(n) {
  return Math.round(n * 100) / 100;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadExpenses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveExpenses(expenses) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function addExpense({ title, amount, category, date }) {
  const expense = {
    id: crypto.randomUUID(),
    title: String(title ?? '').trim(),
    amount: round2(Number(amount)),
    category: CATEGORIES.includes(category) ? category : 'other',
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today(),
  };
  if (!expense.title) throw new Error('title is required');
  if (!(expense.amount > 0)) throw new Error('amount must be a positive number');

  const expenses = loadExpenses();
  expenses.push(expense);
  saveExpenses(expenses);
  render();
  return expense;
}

function deleteExpense(id) {
  const expenses = loadExpenses();
  const remaining = expenses.filter((e) => e.id !== id);
  if (remaining.length === expenses.length) return false;
  saveExpenses(remaining);
  render();
  return true;
}

function summarize(expenses = loadExpenses()) {
  const byCategory = {};
  let total = 0;
  for (const e of expenses) {
    byCategory[e.category] = round2((byCategory[e.category] || 0) + e.amount);
    total += e.amount;
  }
  return { currency: 'USD', total: round2(total), count: expenses.length, byCategory };
}

function render() {
  const expenses = loadExpenses().sort((a, b) => b.date.localeCompare(a.date));
  const list = document.getElementById('expense-list');
  list.replaceChildren();

  if (expenses.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No expenses yet.';
    list.append(li);
  }

  // textContent only. Titles can come from an agent, so never inject them as HTML.
  for (const e of expenses) {
    const li = document.createElement('li');

    const title = document.createElement('span');
    title.className = 'expense-title';
    title.textContent = e.title;
    const meta = document.createElement('span');
    meta.className = 'expense-meta';
    meta.textContent = `${e.category}, ${e.date}`;
    title.append(meta);

    const amount = document.createElement('span');
    amount.className = 'expense-amount';
    amount.textContent = e.amount.toFixed(2);

    const del = document.createElement('button');
    del.className = 'delete';
    del.textContent = 'Delete';
    del.addEventListener('click', () => deleteExpense(e.id));

    li.append(title, amount, del);
    list.append(li);
  }

  document.getElementById('total').textContent = summarize().total.toFixed(2);
}

const form = document.getElementById('expense-form');
form.date.value = today();
form.addEventListener('submit', (event) => {
  event.preventDefault();
  addExpense(Object.fromEntries(new FormData(form)));
  form.reset();
  form.date.value = today();
});

render();
