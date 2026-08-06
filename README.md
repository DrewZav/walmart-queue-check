# BLACK BOX · Walmart Queue Check

Paste a `walmart.com/qp?qpdata=...` link to see estimated wait time.

**Live:** https://drewzav.github.io/walmart-queue-check/

## What it does
- Reads `expectedTurnTimeUnixTimestamp` from the link (client-side only)
- Remembers each ticket in your browser
- Shows your **best/earliest** ETA vs what Walmart is advertising **now**
- Warns when Walmart **pushes you back** (same ticket, later turn time)

Hitting 0 on Walmart’s countdown does **not** mean you’re in — they often extend the ETA instead of admitting you.

Built for BLACK BOX.
