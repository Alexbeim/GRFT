# Reddit thread hunt — Sep 14, 2026

## Blocker repeated: still no Reddit access

Same wall as Aug 31. All four routes failed:

- **WebSearch** — four fresh query variations ("brand activation ideas reddit r/experientialmarketing", "trade show booth ideas to attract visitors reddit", a literal `"reddit.com/r/experientialmarketing/comments"` string search, and a thread-title-style phrasing). Zero Reddit URLs returned across all four. Reddit is filtered out of this search index entirely — not a domain-filter problem, the content simply isn't there.
- **In-app browser** — reddit.com blocked by policy.
- **In-app browser → Google / DuckDuckGo** (to read Reddit links off a SERP without opening Reddit) — both need site approval, and the request was declined since nobody was at the machine.
- **Claude in Chrome** — extension not connected; `list_connected_browsers` returned empty.

**Fix for next run:** the only viable route is Claude in Chrome. Leave Chrome running with the extension signed in to the same account, and pre-approve google.com in the browser pane. Worth doing once — it unblocks this task permanently.

So again: **no verified thread URLs.** Three fresh drafts below, angles deliberately rotated off the Aug 31 set (that batch was throughput, participation-vs-spectacle, staffing) so the comment history doesn't read as templated.

---

## Draft 1 — angle: tech craft / what actually breaks
**For:** r/EventProduction, r/experientialmarketing — "has anyone run [X] interactive thing, did it work" threads

> Whatever you're renting, ask the vendor two questions: what happens when the venue wifi dies, and what happens in direct sunlight. That's most of the failures I've seen. Half the interactive stuff on the market is a laptop and a projector in a nice box, and both of those assumptions break the moment you're outdoors or in a convention hall with 4,000 phones fighting for the same band.
>
> Related: ask how long the reset is between users. Anything with a calibration step is going to eat your afternoon. A good sign is if the crew can pack it, move it 50 feet, and have it live again in under fifteen minutes — that flexibility is worth more than any feature list, because the floor plan always changes.
>
> The low-tech comparison point I'd throw out: a sand-pouring or wet-clay station has none of these failure modes and people will stand at it for twenty minutes. Sometimes that's the right answer.
>
> (I build interactive walls for events, so this is mostly scar tissue from my own gear failing.)

---

## Draft 2 — angle: story / one activation that went sideways
**For:** r/marketing, r/experientialmarketing — "best/worst activation you've worked on" threads

> Worst one I ever did, we built a beautiful piece and put it against the back wall of the space. Perfect sightline from the entrance. Nobody touched it for two hours. Turned out people wouldn't cross the open floor to be the first person using it in front of a room full of strangers — the social cost was higher than the curiosity.
>
> Moved it to a corner with a partial wall so the first users weren't on display, and it ran full for the rest of the night. Nothing about the piece changed. Just where the awkwardness lived.
>
> Ever since, I place things where someone can try it semi-privately and then be seen succeeding. Same reason the popular booth at a conference is never the one directly facing the entrance. Best version of this I've seen from someone else was a record-your-own-voice booth with an actual door — total privacy to make the thing, then the output played publicly. Line all day.
>
> I run Graffiti+, for context, so a lot of what I know is about walls specifically — but the placement thing seems to hold across formats.

---

## Draft 3 — angle: branding integration / where the logo goes
**For:** r/b2bmarketing, r/marketing, r/smallbusiness — "how do we get ROI from an activation" threads

> The mistake I see most from the client side is treating the branding and the activity as two separate line items. Logo on the backdrop, fun thing in front of it. That gets you photos where the crop cuts the logo off, every time.
>
> What works better is making the brand part of what the person produces. If the guest makes something and the brand is inside the thing they made — on the artwork, in the audio, on the object they carry out — you get distribution for free, because they're the one posting it. A candle-blending bar does this well: they pick the scent, the brand name is on the tin, and it sits on their shelf for six months.
>
> Also worth measuring something other than footfall. Number of people who *made* something is a far better predictor of what you'll see online afterward than number of people who walked past. Foot traffic counts the hallway; output counts the campaign.
>
> Disclosure, I run an interactive wall company, so I'm biased toward the make-something format — but the point holds even if you go a completely different direction.

---

Reply with which ones to post and I'll post them from your account.
