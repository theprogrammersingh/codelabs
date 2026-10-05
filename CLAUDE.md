# Codelabs

This repo holds hands-on codelabs for developer workshops. Every codelab is written in Markdown and built with [claat](https://github.com/googlecodelabs/tools/tree/main/claat).

Hard limit: each codelab must be completable in 30 to 40 minutes by an attendee who has the prerequisites. If it doesn't fit, cut scope or split it into two codelabs.

## Repo layout

One folder per codelab, named after the codelab id:

    <codelab-id>/
      <codelab-id>.md      # source, the only file you edit by hand
      img/                 # screenshots and diagrams referenced from the md
      starter/             # starting code attendees clone or download (if any)
      solution/            # finished code for each checkpoint (if any)

- The codelab id is lowercase kebab-case and matches the folder name and the `id:` field.
- Generated output from `claat export` is never edited by hand. Regenerate it.

## claat commands

    claat export -o dist <codelab-id>/<codelab-id>.md    # build HTML into dist/<codelab-id>/
    cd dist && claat serve                               # preview at localhost:9090
    claat export -f md -o - <file>                       # print the parsed output to stdout

Always pass `-o dist`. Without it claat writes into `./<codelab-id>/` and mixes generated files with the source folder.

Always run `claat export` after editing and fix any warnings before calling a codelab done.

## Source format

Metadata header at the top, no blank lines inside it:

    author: Simar Preet Singh
    summary: One line on what attendees build
    id: codelab-id
    categories: web,firebase
    environments: Web
    status: Draft
    feedback link: https://github.com/<org>/<repo>/issues
    analytics account:

    # Codelab title

    ## Step title
    Duration: 0:05:00

Rules:
- `#` is the codelab title, used once. Each `##` is a step. Don't use `##` for anything else.
- Every step has a `Duration:` line right under its heading. Durations must add up to 30 to 40 minutes total.
- Info boxes use `<aside class="positive">` for tips and `<aside class="negative">` for warnings. Max one per step, and only when it's actually useful.
- All JS, HTML and CSS (files and code blocks in the md) use Prettier defaults (`.prettierrc` at the root): double quotes, semicolons, trailing commas, 80 columns. Run `npx prettier@3 --write "<codelab-id>/**/*.{js,html,css}"` before committing, and keep the code blocks in the md identical to the files.
- Code blocks always get a language tag (`bash`, `js`, `python`, etc.) so claat highlights them.
- Download links use `<button>[Download starter code](url)</button>`.
- Images go in `img/` with descriptive filenames and alt text: `![Firebase console with the Rules tab open](img/rules-tab.png)`.

## Structure of a 30 to 40 minute codelab

Aim for 6 to 9 steps. Typical split:

| Step | Time |
|------|------|
| Overview: what you'll build, what you'll learn, what you need | 2 min |
| Setup: clone, install, configure keys | 5 min max |
| Core steps (3 to 5), each building on the last | 4 to 7 min each |
| Run and verify the finished thing | 3 min |
| Wrap up: what you built, where to go next | 2 min |

Guidelines:
- One clear outcome. Attendees should leave with something running, not a pile of half-done features.
- Setup is where workshops die. Pin versions, provide a starter repo, avoid long installs, avoid anything that needs account approval or billing at the venue. Assume flaky conference wifi.
- Every step ends with a visible checkpoint: a command output, a screenshot, a passing test, a page that loads. Show what "it works" looks like so people can self-check.
- Each step introduces one concept. If a step needs two new ideas, split it.
- Give the full code to paste when the code isn't the point of the lesson. Have people type it when it is.
- Show the diff or the complete file, never "add this somewhere in your file". Name the file and where the code goes.
- Explain the why in one or two sentences after the code, not a paragraph before it.
- Put a solution checkpoint (branch, folder or download) after the core steps so someone who fell behind can catch up.
- Mention common errors and their fix inline where they happen, not in a troubleshooting section at the end.
- Overview lists prerequisites honestly: tool versions, accounts, prior knowledge.
- Wrap up has 2 to 4 next steps with real links. No recap essay.
- Dry run every codelab end to end on a clean machine with a timer before the event. If it took you 25 minutes, attendees need 40.

## Writing style (important)

The text must read like a senior dev wrote it for other devs. It must not look AI generated.

Punctuation and characters:
- No em dashes (—) or en dashes (–). Use a period, comma, colon or parentheses. A plain hyphen only inside compound words.
- No curly quotes or apostrophes. Straight `'` and `"` only.
- No ellipsis character (…). No `...` at the end of sentences either.
- No semicolons in prose. Split the sentence.
- No emoji anywhere. No decorative unicode like arrows (→), checkmarks or bullets.
- No exclamation marks, except in a code string if the code needs it.

Words and phrases to avoid:
- "delve", "dive in", "let's dive", "embark", "journey", "unlock", "unleash", "harness", "leverage", "seamless", "seamlessly", "robust", "powerful", "cutting-edge", "game-changer", "elevate", "supercharge", "effortlessly", "in today's fast-paced world", "it's worth noting", "it's important to note", "crucial", "comprehensive", "furthermore", "moreover", "in conclusion", "whether you're a beginner or".
- Don't open steps with "In this step, we will..." every time. Just say what to do.
- Don't praise the reader ("Great job!", "Awesome!", "You did it!"). One short "You now have X running" in the wrap up is enough.

Tone and formatting:
- Second person, imperative: "Run the server.", "Open `app.js`."
- Short sentences. Plain words. Contractions are fine (don't, it's, you'll).
- Headings in sentence case, short and concrete: "Add the auth middleware", not "Implementing Robust Authentication: A Deep Dive".
- Bold sparingly, only for UI labels people need to click ("click **Deploy**"). Never bold random phrases for emphasis.
- Use `inline code` for file names, commands, env vars, function names.
- Don't overuse bullet lists. Write a short paragraph when the content is a sequence of thought, a list when it's actually a list.
- No intro fluff, no summary of what you just said at the end of each step.
- It's fine to be opinionated: "Use X here, Y is overkill for this." Senior devs say that.
- Before finishing, scan the whole file for banned characters. `grep -n '[—–…“”‘’→]' <file>.md` should return nothing.

## Git, commits and PRs

- Never mention Claude, Anthropic or AI in commit messages, PR titles or PR descriptions.
- No `Co-Authored-By` trailers, no "Generated with" lines, no AI collaborator credit of any kind.
- Commit messages are short and plain, in the imperative: "Add WebMCP expense tracker codelab".

## Checklist before a codelab is done

- [ ] Durations add up to 30 to 40 minutes
- [ ] `claat export` runs with no warnings
- [ ] Every step has a checkpoint attendees can verify
- [ ] Starter and solution code run on a clean machine with pinned versions
- [ ] No banned punctuation, emoji or phrases (grep above)
- [ ] Previewed with `claat serve` and read top to bottom once
