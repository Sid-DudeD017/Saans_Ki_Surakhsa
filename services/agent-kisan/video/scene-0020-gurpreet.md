# Scene 0:20–0:55 · Gurpreet's voice note (P1)

**What judges must take away:** a farmer speaks Punjabi, hears his details read back, and in under
half a minute knows how much stubble he can clear without fire, gets a CHC machine booked for a
dry day, and has the rest filed as a request for help — before anyone talks about a fine.

Everything on screen comes from the live app on the deployed URL. Only the cuts are edited.

> **Open before recording:** the demo district. P4's officer scene (1:55) is set in Patiala; this
> script and `data/seed/chc_demo.json` use Bhawanigarh, Sangrur. Both scenes must name the same one.

## Shot list (35 s)

| Time | Picture | Sound | Subtitle (English) |
|---|---|---|---|
| 0:20–0:23 | Field at dusk, stubble rows. Gurpreet holds his phone, presses and holds the record button. | Wind, then his voice begins | — |
| 0:23–0:31 | Close-up of the phone: the recording waveform, then the transcript appearing under it. | **Line 1** (his voice note) | "I'm Gurpreet, Bhawanigarh, Sangrur. 18 killa of paddy. Harvest on 20 October, wheat by 9 November. One tractor, a Super Seeder for two days." |
| 0:31–0:38 | The read-back card fills in: field 18 · harvest 20 Oct · wheat by 9 Nov · tractor 1 · Super Seeder 2 days. | The app reads it back aloud (first two sentences of the spoken read-back) | "Your details: paddy 18 killa. Harvest 20 October, wheat sowing by 9 November…" |
| 0:38–0:40 | He nods, taps ✓ / says yes. | **Line 2** | "Yes, all correct." |
| 0:40–0:47 | Coverage dial at **61%**, then a booking card slides in: *CHC Super Seeder · 2 November · ₹5,500 after subsidy*; dial climbs to **92%**. | Soft tick as the dial moves | "Your machines: 61%. A CHC Super Seeder on a dry day: 92%." |
| 0:47–0:52 | Card: *Still short 1.5 killa → help request sent to the Agriculture Department*. Status page shows **Filed**. The phone buzzes; the SMS is visible. | SMS buzz | "The last 1.5 acres go to the department as a request for a Happy Seeder." |
| 0:52–0:55 | Pull back to Gurpreet looking at the field. Caption card. | — | **Help before penalty.** |

## Lines

**Line 1 — Gurpreet's voice note (Punjabi).** Say it naturally; the numbers matter most.

> ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਜੀ। ਮੈਂ ਗੁਰਪ੍ਰੀਤ, ਪਿੰਡ ਭਵਾਨੀਗੜ੍ਹ, ਜ਼ਿਲ੍ਹਾ ਸੰਗਰੂਰ। ਅਠਾਰਾਂ ਕਿੱਲੇ ਝੋਨਾ ਹੈ।
> ਵਾਢੀ ਵੀਹ ਅਕਤੂਬਰ ਨੂੰ, ਕਣਕ ਨੌਂ ਨਵੰਬਰ ਤੱਕ ਬੀਜਣੀ ਹੈ। ਇੱਕ ਟਰੈਕਟਰ ਹੈ, ਸੁਪਰ ਸੀਡਰ ਦੋ ਦਿਨ ਲਈ ਮਿਲੂਗਾ।

*(Sat sri akal ji. Main Gurpreet, pind Bhawanigarh, zila Sangrur. Athaaraan kille jhona hai. Vaadhi
veeh October nu, kanak nau November tak beejni hai. Ikk tractor hai, super seeder do din layi milu-ga.)*

**Line 2 — confirming the read-back.**

> ਹਾਂ ਜੀ, ਸਭ ਠੀਕ ਹੈ।  *(Haan ji, sabh theek hai.)*

**The app's read-back** (spoken by the app; it comes from `readback.py`, not from this script):

> ਤੁਹਾਡੀ ਜਾਣਕਾਰੀ ਇਹ ਹੈ। ਝੋਨਾ ਅਠਾਰਾਂ ਕਿੱਲੇ। ਵਾਢੀ ਵੀਹ ਅਕਤੂਬਰ, ਕਣਕ ਦੀ ਬਿਜਾਈ ਨੌਂ ਨਵੰਬਰ ਤੱਕ। ਇੱਕ ਟਰੈਕਟਰ।
> ਸੁਪਰ ਸੀਡਰ ਦੋ ਦਿਨ। ਤੁਹਾਡੀਆਂ ਮਸ਼ੀਨਾਂ ਨਾਲ ਲਗਭਗ ਸੱਠ ਪ੍ਰਤੀਸ਼ਤ। ਸੀ ਐਚ ਸੀ ਤੋਂ ਬੁਕਿੰਗ: ਸੁਪਰ ਸੀਡਰ, ਦੋ ਨਵੰਬਰ।
> ਬੁਕਿੰਗ ਨਾਲ ਲਗਭਗ ਨੱਬੇ ਪ੍ਰਤੀਸ਼ਤ। ਹਾਲੇ ਵੀ ਬਾਕੀ ਡੇਢ ਕਿੱਲੇ। ਇਸ ਲਈ ਮਦਦ ਦੀ ਬੇਨਤੀ ਭੇਜੀ ਜਾਵੇਗੀ। ਕੀ ਇਹ ਸਭ ਠੀਕ ਹੈ?

The video uses only its first two sentences (0:31–0:38); the full read-back is ~27 s.

**The SMS** (from `notify.py`):

> ਸਾਂਸ: ਤੁਹਾਡੀ ਮਦਦ ਦੀ ਬੇਨਤੀ ਖੇਤੀਬਾੜੀ ਵਿਭਾਗ ਕੋਲ ਪਹੁੰਚ ਗਈ ਹੈ। ਬਾਕੀ 1.5 ਏਕੜ।

## Numbers on screen (all must match the live app)

| | Value | Where it comes from |
|---|---|---|
| Paddy | 18 killa | farmer |
| Coverage with his own machines | 61 % | coverage engine: 2 days × 5.5 acres/day = 11 of 18 |
| CHC booking | Super Seeder, 2 Nov, ₹5,500 after 50 % subsidy | zero-burn planner, **demo CHC data** |
| Coverage after booking | 92 % | 16.5 of 18 |
| Still short | 1.5 killa → Happy Seeder, 1 day, by 9 Nov | planner `unmet` |

Say "demo data" somewhere in the video (end card or voiceover) while the CHC list, rates and
subsidy are made up.

## Recording checklist

- [ ] Deployed URL works end to end from the phone (golden path), not localhost.
- [ ] Fresh conversation (new session) for each take; the demo dates must still be in the future
      (record before 20 Oct, or move every date in this script and the seed together).
- [ ] Phone on Do Not Disturb except SMS; screen recording at 60 fps; mic close to his mouth.
- [ ] Read-back audio has played once already (it is cached after the first time, so the take
      doesn't wait for the voice).
- [ ] A native Punjabi speaker has listened to the read-back and approved the phrasing.
- [ ] SMS: either a real buzz (SNS working, DLT template registered) or the plan's fallback: an
      in-app notification, shown honestly as such.

## If something goes wrong on camera

- **Speech recognition mishears a number** (it heard 80, he said 18): keep the take. The app shows
  "80 ਕਿੱਲੇ?" as a button, he says the number again, it turns to 18. That is the number guard
  working — cut it in as a 2-second beat if it fits.
- **The agent is slow** (more than a few seconds): cut on the waveform and resume on the card.
  Don't speed up footage of the app.
- **Bedrock is still blocked by recording day:** the scene cannot be shot from the live app.
  Decide with the team on Saturday morning whether to record a screen capture of the local build
  and say so in the video.
