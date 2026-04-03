# Contributing to Mañana Seguro

Thanks for your interest in contributing! This guide covers how to participate, which areas are open, and how to get your PR accepted.

> This repository participates in the **[Stellar Wave Program](https://www.drips.network/wave/stellar)**. During active Wave cycles (7 days per month), issues labeled `wave` have review priority.

---

## Before you start

1. Read the [README](./README.md) to understand the project
2. Browse the [open issues](../../issues) — especially those labeled `good first issue` or `wave`
3. If you want to propose something new, open an issue first before writing code — this avoids duplicate work and keeps everyone aligned

---

## Open areas for contribution

### Frontend (`CreditRoot/`)

Stack: **React 19 + Vite + Bootstrap 5**

- Mobile responsiveness and UX improvements across screens
- Accessibility (aria attributes, keyboard navigation, color contrast)
- Unit and integration tests with Vitest
- UX improvements for loading states and error handling
- Internationalization (i18n) — extracting hardcoded strings to translation files

### Telegram bot (`manana-seguro-bot/`)

Stack: **Python 3 + python-telegram-bot 21 + Anthropic Claude Haiku**

- UX improvements to conversational flows
- Unit tests for the `calcular_proyeccion` logic
- Session persistence across bot restarts
- Improvements to the CETES rate notification system

### Documentation

- Per-folder READMEs (`CreditRoot/`, `manana-seguro-bot/`)
- Architecture and user flow diagrams
- More detailed setup guides

---

## Contribution process

### 1. Fork and clone

```bash
git clone https://github.com/your-username/MananaSeguro.git
cd MananaSeguro
```

### 2. Create a branch

Use the format: `type/short-description`

```bash
git checkout -b feat/mobile-responsive-dashboard
git checkout -b fix/etherfuse-loading-state
git checkout -b docs/creditroot-readme
git checkout -b test/vitest-useretirementprojection
```

Valid types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`

### 3. Set up your local environment

**Frontend:**
```bash
cd CreditRoot
npm install
npm run dev
```

**Bot:**
```bash
cd manana-seguro-bot
pip install -r requirements.txt
cp .env.example .env
# Fill in your development credentials
```

### 4. Make your changes

- Keep changes focused on the issue you're solving
- Don't mix multiple issues in one PR
- Test your change locally before pushing

### 5. Commits

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add aria-labels to dashboard buttons
fix: handle Etherfuse API timeout gracefully
docs: add setup guide for bot local development
test: add unit tests for calcular_proyeccion
```

### 6. Open your Pull Request

- Write a clear title describing what changed
- Reference the issue it resolves: `Closes #42`
- Include screenshots or a GIF if your change affects the UI
- Make sure lint passes: `npm run lint` (frontend)

---

## What we won't accept

To protect the integrity of the project, **we will not merge PRs** that:

- Modify Freighter authentication flow or wallet connection logic without prior discussion
- Change the Etherfuse integration without a related issue
- Introduce new dependencies without clear justification
- Hardcode API keys, tokens, or secrets anywhere in the codebase
- Break existing functionality without a clear migration path

If you're unsure whether your change falls into any of these, open an issue first and we'll discuss it there.

---

## Code style

**Frontend (JavaScript/JSX):**
- ESLint is configured — run `npm run lint` before committing
- Components in PascalCase, functions and variables in camelCase
- Prefer functional components with hooks

**Bot (Python):**
- Follow PEP 8
- Telegram handlers must be `async` functions
- Document new functions with docstrings

---

## Reporting a bug

Open an issue with the `bug` label and include:

- Description of the unexpected behavior
- Steps to reproduce it
- Expected behavior
- Screenshots if applicable
- Environment (browser, OS, Node/Python version)

---

## Questions

If you have questions, open an issue with the `question` label. No question is too basic.
