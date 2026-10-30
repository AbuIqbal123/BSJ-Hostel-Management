# Notifications

The resident inbox on the phone. Each row is one sentence from this table, then one quieter line. No icons. No full stop.

`{name}` is a person's display name.

- The provost decides a permission or a guest stay. A warden or the provost marks a guest paid.
- Gate staff record an exit, a return, a guest's arrival, or a guest's departure.
- The provost reissues a hall pass or suspends the account.

The quieter line is the short place, then the leave and return. Home going and a guest stay use the dates. Late-night and an ordinary outing use the time, then the date. A guest line uses the guest's name instead of a place.

Written into the inbox today: the four permission decisions, the two guest-stay decisions, and "She has not returned by the time she was due" (once per outing). Each of these also goes to her phone as a push whose body is the sentence. The others are the sentences for when that notice is added. Her own submit, edit, plan, and cancel do not notify her. A request that is still waiting, and a trip she is still on, do not notify her.

The phone also keeps its own return reminder, 15 minutes before she is due back. The hall does not send that one. While she is out, only that outing is reminded. Otherwise each ordinary plan and each approved late-night permission has its own reminder, from the moment the permission is approved. An ordinary plan that overlaps an approved permission is dropped, because the gate uses the permission. Home-going has no return reminder. The hall clock is fixed at UTC+5:30, so there is no daylight-saving change. One known limit: a reminder still fires if she returns early or does not use the outing. The phone drops it on the next Home load. Settings shows "Notifications are off" and "Turn on in Settings" when a resident, warden, or provost has denied notification permission. Gate accounts are not asked. Android hides that row while push is switched off, so a phone without Firebase never sees it.

| When | Sentence | Quieter line |
|---|---|---|
| A late-night request is approved | Your late-night request has been approved by {name} | Place, then leave and return |
| A late-night request is rejected | Your late-night request has been rejected by {name} | Place, then leave and return |
| A late-night request expires unused | Your late-night request has expired | Place, then leave and return |
| A home-going request is approved | Your home-going request has been approved by {name} | Place, then the dates |
| A home-going request is rejected | Your home-going request has been rejected by {name} | Place, then the dates |
| A home-going request expires unused | Your home-going request has expired | Place, then the dates |
| The gate records her exit | Your exit has been recorded by {name} | Place, then the time |
| The gate records her return | Your return has been recorded by {name} | Place, then the time |
| She has not returned by the time she was due | You have not returned by the time you were due | Place, then the time she was due |
| A guest stay is approved | Your guest stay has been approved by {name} | Guest name, then the dates |
| A guest stay is rejected | Your guest stay has been rejected by {name} | Guest name, then the dates |
| A guest is marked paid | Your guest stay has been marked paid by {name} | Guest name, then the dates |
| The gate records a guest's arrival | Your guest has arrived, recorded by {name} | Guest name, then the time |
| The gate records a guest's departure | Your guest has left, recorded by {name} | Guest name, then the time |
| The provost reissues her hall pass | Your hall pass has been reissued by {name} | Her name and room |
| The provost suspends her account | Your account has been suspended by {name} | Her name and room |

Guardian text messages are not this inbox. They go to the guardian's phone, from the hall's two templates: she is late, and she has returned.
