# BLACK BOX · Walmart Queue Check

**Live:** https://drewzav.github.io/walmart-queue-check/

## Easy use
1. **Paste** a `walmart.com/qp?qpdata=...` link, **or** paste the `validateTickets` JSON from DevTools
2. Or drag the **BB Queue Check** bookmark onto your bar, then click it while on Walmart (live waits)

## What it does
- Reads `expectedTurnTimeUnixTimestamp` (same field Walmart’s queue API uses)
- Remembers each ticket in your browser and flags when Walmart **stretches** the ETA
- Shows **what Walmart is advertising now** (not a stale tracked 0)

Hitting 0 on Walmart’s countdown does **not** mean you’re in — they often extend the ETA instead of admitting you.

Built for BLACK BOX.
