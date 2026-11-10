# Notifications

The resident inbox on the phone. Each row is one sentence from this table, then one quieter line. No icons. No full stop.

`{name}` is a person's display name.

- A warden or the provost decides a permission or a guest stay. A warden or the provost marks a guest paid.
- Gate staff record an exit, a return, a guest's arrival, or a guest's departure.
- A warden or the provost reissues a hall pass or suspends the account.

The quieter line is the short place, then the leave and return. Home going and a guest stay use the dates. Late-night and an ordinary outing use the time, then the date. A guest line uses the guest's name instead of a place.

Written into the inbox today: the four permission decisions, the two guest-stay decisions, a roommate's request to decide a guest stay, that roommate's own record of her yes or no, the host's notice of that yes or no, and "She has not returned by the time she was due" (once per outing). Each of these also goes to her phone as a push whose body is the sentence. A roommate request or decision may also send the quieter line as the push subtitle. Dates there are written like the inbox, for example 02 October 2026 to 04 October 2026. The others are the sentences for when that notice is added. Her own submit, edit, plan, and cancel do not notify her. A request that is still waiting, and a trip she is still on, do not notify her. The roommate's own decision and the host's notice of it also stay on History, with the same sentence and the same quieter line. The provost's approval and rejection lines use the table sentences on the inbox and on History.

The phone also keeps its own return reminder, 15 minutes before she is due back. The hall does not send that one. While she is out, only that outing is reminded. Otherwise each ordinary plan and each approved late-night permission has its own reminder, from the moment the permission is approved. An ordinary plan that overlaps an approved permission is dropped, because the gate uses the permission. Home-going has no return reminder. The hall clock is fixed at UTC+5:30, so there is no daylight-saving change. One known limit: a reminder still fires if she returns early or does not use the outing. The phone drops it on the next Home load. Settings shows "Notifications are off" and "Turn on in Settings" when a resident, warden, or provost has denied notification permission. Gate accounts are not asked. Android uses the same row once Firebase (`bsj-hall-dev`) is wired.

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
| A roommate is asked to decide a guest stay | Your roommate has requested a guest stay | Guest name, then the dates |
| A roommate approves the host's guest stay | Your roommate {name} approved the guest stay | Guest name, then the dates |
| A roommate declines the host's guest stay | Your roommate {name} declined the guest stay | Guest name, then the dates |
| She approves the host's guest stay | You approved {name}'s guest stay | Guest name, then the dates |
| She declines the host's guest stay | You declined {name}'s guest stay | Guest name, then the dates |
| A guest is marked paid | Your guest stay has been marked paid by {name} | Guest name, then the dates |
| The gate records a guest's arrival | Your guest has arrived, recorded by {name} | Guest name, then the time |
| The gate records a guest's departure | Your guest has left, recorded by {name} | Guest name, then the time |
| The provost reissues her hall pass | Your hall pass has been reissued by {name} | Her name and room |
| The provost suspends her account | Your account has been suspended by {name} | Her name and room |

Guardian text messages are not this inbox. They go to the guardian's phone, from the hall's two templates: she is late, and she has returned.
