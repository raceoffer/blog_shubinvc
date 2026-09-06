---
title: "How AI Rewrites Unit Economics, With Actual Numbers"
description: "AI changes not just products but the cost structure of startups. With real numbers: what happens to COGS, gross margin and the break-even point."
topic: ai
tags: [unit-economics, ai, metrics]
pubDate: 2026-07-14
updatedDate: 2026-08-02
tldr:
  - "AI shifts the cost structure: variable costs of support and ops fall, but a new COGS line appears — inference."
  - "In a typical B2B SaaS with AI features, gross margin drops from 80% to 65–70% if you don't manage query costs."
  - "The survival rule: inference cost per active user must fall faster than usage grows — otherwise scale eats the margin."
  - "Inference prices fall roughly 10x per year — that works for you if you priced it into the model, and against you if your competitor did and you didn't."
faq:
  - q: "How should inference be accounted for in unit economics?"
    a: "As variable costs (COGS) tied to user activity. Calculate query cost per active user per month and bake in a deflator: inference prices have historically fallen roughly 10x per year."
attachments:
  - title: "AI product unit economics template (CSV)"
    url: "/attachments/ai-unit-economics-template.csv"
---

When I show founders my AI product unit economics spreadsheet, the reaction is
usually the same: "wait, why is the margin 68% and not 85%?" Because a SaaS with
AI inside has a cost line that didn't exist before — and most teams pretend it
isn't there.

## The new COGS line

Classic SaaS ran at 75–85% gross margin: servers, support, some third-party
services. An AI product adds **inference** — the cost of every call to the
model. And it's not pocket change:

| Scenario | Inference per active user/mo | Share of a $99 avg price |
|---|---|---|
| Light (classification, summaries) | $2–5 | 2–5% |
| Medium (RAG, assistants) | $8–15 | 8–15% |
| Heavy (agents, generation) | $25–60 | 25–60% |

In the heavy scenario gross margin easily slides to 50–60% — a level that used
to be a catastrophe for SaaS. That doesn't mean the business is bad. It means
it has to be measured differently.

## The only chart that matters

Take two series for the last 12 months: inference cost per active user and
usage (queries per user). A healthy picture looks like this: usage grows while
cost stays flat or falls. That happens thanks to three levers:

1. **Model price deflation.** The same class of query gets roughly an order of
   magnitude cheaper per year. It's a tailwind — but it blows for everyone,
   including your competitors.
2. **Routing.** 80% of queries can usually be served by a model 10x cheaper
   with no quality loss. Teams that built routing early live with a margin
   10–15 p.p. higher.
3. **Caching and distillation.** Repeat queries shouldn't hit the big model at
   all.

If your dynamics are the opposite — usage growing faster than cost falls — you
are scaling a loss. I've seen a company where 3x revenue growth came with 7x
inference cost growth. That's not growth, it's a deferred problem.

## What this changes for a founder

Three practical implications. First, **pricing must be tied to consumption**, at
least partially: flat fees in an agentic scenario are a way to hand your margin
to your most active users. Second, the "inference cost / revenue" metric belongs
on the same dashboard as MRR — I wrote about this in the post on
[retention and metrics that matter more than growth](/blog/retention-over-growth).
Third, in investor conversations the "so what about margins?" question is now an
architecture question, not an Excel question. Answer with routing, not promises.

*Update: August 2, 2026 — inference cost ranges updated after price cuts at the
two largest providers.*
