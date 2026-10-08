# ResumePlay: Dev Journal

---

## 2023-01-12

I'm annoyed that the browser keeps forgetting where I was in long YouTube audiobooks. Idea: a
tiny page that plays the video and keeps saving the position in localStorage, so a reload just
continues from there.

This time I want to try letting ChatGPT write most of it.

- I described the page (URL field, Go button, save URL and timestamp, resume on reload).
  The first answer embedded a plain iframe and tried to read `currentTime` from it, which
  doesn't work. When I asked why it didn't use the YouTube Player API, it rewrote everything
  around `YT.Player`. That's much better.
- I built a quick prototype ("Audio Book Helper") from that. ChatGPT only saved the position
  on play and pause, which loses everything if the tab dies, so I switched to saving every
  2 seconds. Works nicely.
- Second chat for the product side. I asked for a name and ChatGPT suggested **ResumePlay**.
  I'm keeping it, along with its very over-the-top marketing text.
- I also got a template and colour theme from it: dark background, Open Sans, blue buttons.
- I tried an Unsplash library photo as the background, but the text was unreadable on it.
  ChatGPT suggested a semi-transparent black box behind the content, which fixes it.
- **GDPR:** loading the YouTube player sends the visitor's IP to Google. I need a consent
  button before any Google code loads. ChatGPT drafted the button and the consent cookie.
  I asked for the button to be more "call to action", and it came back big and red.
- I swapped the Unsplash photo for my own background made with Stable Diffusion
  ("millions of books in a library, mystical, dramatic lighting…").

## 2023-01-13

I made a logo with Stable Diffusion too (headphones and books, flat vector style). Good
enough.

## 2023-01-16

I set up a GitHub repo for it.

I put the prototype logic and the ChatGPT template together into the real page:

- LOAD, play and pause buttons instead of a single Go button.
- The YouTube script is only injected after consent. ChatGPT's version only hid the player.
- It only saves while the video is actually playing, so pausing or buffering can't
  overwrite the position.
- The footer credits the AI images, says that ChatGPT wrote most of the code, and has a
  short data-protection note plus imprint and privacy links.

For local dev I set up Apache in Docker with `up.sh`, `down.sh` and `shell.sh`, plus an
`.env` for the port. I wrote the README with the backstory.

## 2023-01-18

My own Dockerfile was overkill, so I replaced it with a stock Apache image and just mount
`src/`. Much simpler.

## 2023-01-19

I made it installable: web manifest, a set of favicons, and a viewport tag for phones. Small
design tweaks: a brown background colour to match the library image, and a wider container.

I also asked ChatGPT for a rotating ASCII cube, just to see what it does. It doesn't rotate.
😄

It's live on resumeplay.lazerbahn.com. Done for now.

---

## 2025-01-31

I've been using it for two years and it just works. A few things bug me on the phone, though:

- I removed the background image. It looked busy, and the content is easier to read
  without it.
- The fonts were far too big, so I made them smaller, and the URL field is now full width.
- I fixed the privacy note, which said "no cookies", but the consent cookie is one.

## 2025-02-06

UX round:

- The stored time now shows as `HH:MM:SS` instead of a pile of seconds.
- URLs with extra parameters (`&t=…`, playlists) now work, because I cut everything after the
  video ID.
- Play and pause are only enabled once a video is loaded. The pause button got a proper
  pause icon, and all buttons have tooltips.
- **Skip protection:** I kept losing my place through accidental taps on the progress bar.
  Now, if the position suddenly jumps by more than a couple of seconds, the player goes back
  to the saved position. A toggle switches it off when I really want to skip.
- I toned the marketing text down from "revolutionary" to "useful".

I did this on a branch and merged it into master.

### Things to look at next time

- Skip protection will probably fight with playback speed above about 1.25×, because the
  player then moves further than the 2.5 s it allows between checks.
- Short links (`youtu.be/…`) and shorts don't work, and the page errors before the
  "could not extract video ID" alert can show.
- The disabled style on the LOAD button got lost when I renamed it.
- ~~There's no way to withdraw consent once it's given.~~ (done 2026-10-08)
- `up.sh --rebuild` still expects the old Dockerfile.
- It only remembers one video. Several videos would be nice.
- Clean up unused files: the old background image and its prompt, the prototype, the Apache
  config, and the cube.

---

## 2026-10-08

Back after a long break. I wrote this journal down from memory so I remember how the project
came about, and went through the open bugs.

I fixed the GDPR gap first. There's now a **"Withdraw Cookie Consent"** button in the footer next to
Imprint and Data Privacy. It only shows once consent has been given. The privacy note mentions the button.

The cookies Google set itself can't be deleted from my site, since they belong to Google's
domain. That belongs in the privacy policy on lazerbahn.com.

I tested it in headless Chrome: fresh visit, consent, reload, withdraw. All good.

New bug spotted on the way: when you give consent for the first time and a video is already
saved, it loads, but play and pause stay disabled until you hit LOAD again. LOAD then resets
the position to 0.

Then I did a privacy round, while I was at it:

- The privacy policy on lazerbahn.com now has a ResumePlay section: what's stored in the browser,
  YouTube and Google's cookies, data going to the USA (EU-US Data Privacy Framework), and how to
  withdraw consent. It also has a server log section that was missing entirely. Logs are deleted
  after 14 days at the latest.
- The consent text now says that data can go to Google in the USA, and links to the policy.
- The consent cookie now lasts one year instead of "until 9999". The value has a version, so
  when the text changes everyone gets asked again. That happened today, since the text changed.
- YouTube now runs in privacy-enhanced mode (`youtube-nocookie.com`). Playback and saving still
  work.
