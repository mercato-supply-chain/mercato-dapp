# Contributing to MERCATO

Thank you for helping improve MERCATO. This guide is for everyone contributing through normal open-source channels and for contributors working via **[Drips Wave — Stellar](https://www.drips.network/wave/stellar)**.

---

## Contributing through Drips Wave

MERCATO may list work on the Stellar Wave program on Drips. If you are picking up an issue from there:

1. **Read the program** — [Stellar Wave on Drips](https://www.drips.network/wave/stellar) explains how Waves work, budgets, and timelines.
2. **Read the contributor workflow** — [Solving issues & earning rewards](https://docs.drips.network/wave/contributors/solving-issues-and-earning-rewards) covers sign-in, KYC (required to **receive** rewards), applying to issues, assignment, PRs, reviews, and points.
3. **Follow Drips rules** — Respect application limits, per-organization limits, and the program’s [terms and rules](https://docs.drips.network/wave/contributors/terms-and-rules) (linked from the docs). Do **not** start implementation until a maintainer has **assigned** you on the issue.

### Issue complexity (Drips Points)

Issues in Drips are labeled by complexity. Each label sets the **base Points** for that issue when it is resolved. For how Points translate into payouts across a Wave, see **Understanding Rewards** in [Solving issues & earning rewards](https://docs.drips.network/wave/contributors/solving-issues-and-earning-rewards):

- **Trivial:** Worth **100 Points** (base). Best for typos, small bug fixes, or minor copy changes.
- **Medium:** Worth **150 Points** (base + 50 complexity bonus). Standard features or involved bug fixes.
- **High:** Worth **200 Points** (base + 100 complexity bonus). Complex features, refactors, or new integrations.

**Linking your PR to the Wave issue** — In your pull request description, reference the GitHub issue (for example `Closes #123` or `Fixes #123` for the correct issue number). That keeps review and Drips tracking aligned. Drips may use linked PRs for automated checks; treat that as **experimental** and not a substitute for maintainer review.

---

## Local development

Prerequisites and setup match the main [README](README.md). Short version:

```bash
pnpm install
cp env.sample .env.local
# Fill in Supabase, Trustless Work, and Stellar-related variables (see README).
pnpm dev
```

Before opening a PR:

```bash
pnpm lint
pnpm build
```

Fix any **lint** and **build** errors unless the issue explicitly says otherwise (for example a tracked follow-up).

---

## How we like pull requests

### Scope and clarity

- **One PR per issue** when possible. If an issue truly needs multiple PRs, say so in the issue or PR and split work logically.
- **Match existing patterns** — Same naming, file layout, hooks, and component style as nearby code. Prefer extending existing helpers over duplicating logic.
- **Explain non-obvious choices** — A short PR description or comment on tricky lines is enough.

### Commits: small and purposeful

We prefer **atomic commits**: each commit should be a coherent unit (one fix, one refactor step, one feature slice) that could theoretically be reverted without unrelated fallout.

- Use **clear, imperative** subject lines (for example `Fix milestone approval guard for supplier role`).
- Avoid mixing unrelated changes (formatting sweeps + feature work) in the same commit unless the issue is explicitly about cleanup.

If you need to fixup during review, **squash or reorganize** commits before merge when asked, so the merged history stays readable.

### Pull request checklist

- [ ] Addresses the issue scope; no unrelated refactors.
- [ ] `pnpm lint` and `pnpm build` pass locally.
- [ ] No secrets or `.env` files committed — use `env.sample` for documenting new variables only.
- [ ] PR description states **what** changed and **why**, and links the issue (`Closes #…` / `Fixes #…` where appropriate).

---

## Communication

- **Questions** — Ask on the GitHub issue so answers help the next person.
- **Scope creep** — If you discover extra work, note it on the issue; do not expand the PR silently without maintainer agreement.

---

## Code of conduct

Be respectful and professional in issues and PRs. Maintainers may decline or request changes on contributions that do not meet these expectations or that conflict with product or security constraints.

---

## License

By opening a pull request, you agree your contribution can be merged under the same terms as the project: **Apache License 2.0** (see [`LICENSE`](LICENSE)). If you are unsure, ask before contributing.
