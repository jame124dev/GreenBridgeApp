# Solutions — mobile config (`controller/mobileConfigController.js`)

Answers [`../Problem/mobile-config.md`](../Problem/mobile-config.md).

Mostly comment and documentation work. The module's behaviour is correct.

---

## 1 Correct the stale recycle guard — **do this first, today**

`:35-41` currently states that 101recycle must not be offered *"until the app's recycle category
tree (M-1) ships inside a store BINARY — integration constraint C2"*.

**C2 is satisfied**: that code is in the shipped iOS 1.0.4 build (EAS build 25, commit
`023715f7`), confirmed by `git cat-file` against the build's own commit.

So the comment gives a resolved reason for a live prohibition. Someone who checks C2, finds it
met, and widens the env is following this file's instructions — and would be wrong, because the
real reason has changed.

Replace the reason, keep the prohibition:

> ⚠️ DO NOT WIDEN THIS. 101recycle is withheld for a **product** reason, not a technical one.
> C2 (the app's recycle category tree) was satisfied by iOS 1.0.4 build 25, commit `023715f7`.
> The blocker now is category accuracy: measured **46%** fully correct, with 8 of 11 category
> errors having no reachable correct answer because the taxonomy itself is wrong — and the
> taxonomy fix was **not approved** (owner decision #7, 2026-08-18). Recycle also has the worst
> photos, and the "photo isn't clear enough" prompt concentrates on machines and recycle.
> Widening is a product call, not an engineering one.

**And date it.** The reason this comment went stale invisibly is that it carried no date, so
nothing suggested it should be re-checked. Every prohibition of this kind should say when it was
last verified.

---

## 2 Document the rollback lag where the operator will read it

The module promises that withdrawing a marketplace is one env edit — true, but two caches sit in
front of it:

- `Cache-Control: public, max-age=300` set by this controller — up to 5 minutes;
- the app's MMKV cache (`supportedMarketplacesCache.ts`), which holds the last good list and is
  returned whenever a fetch has not succeeded, and which `writeCachedSupported` deliberately
  never overwrites with an empty list.

So a seller who already fetched three keeps seeing three until a **successful** fetch returns
fewer.

Add that to this controller's header. An operator rolling a marketplace back reads this file, not
the app's cache module, and needs to know the withdrawal is fast but not atomic — and that a
device which is offline keeps the old list indefinitely.

No code change. A shorter `max-age` would narrow the HTTP half but not the MMKV half, and would
cost a request per launch for a value that changes a few times a year.

---

## 3 Note that order is a UI decision made here

`KNOWN_MARKETPLACES` (`:30`) sets the order the app renders the picker in, and reordering the env
var does nothing.

Keep the behaviour — deriving order from the env would make the picker order an operational
accident. Just say so more loudly, and point at the UI it controls, so a designer asking "why is
101IT third?" can be answered without reading a backend controller.

---

## 4 Pin the three-way list agreement

`:27-30` already names the two app files that must stay in lockstep. Nothing enforces it.

Add a unit test in **this** repo asserting that `TYPE_TO_SITE_ID` (`utlis/batchUtils.js`) and
`KNOWN_MARKETPLACES` cover the same marketplace set. That catches the intra-repo half with no
cross-repo machinery.

The cross-repo half is covered in
[`site-type-defaults.md`](site-type-defaults.md) §4 — a manual diff script, run at the one moment
it matters, which is the day a fourth marketplace is added.

---

## 5 Nothing to change

The route is public and unauthenticated by design, and must stay that way — the app prefetches it
before login.

The only point worth carrying to whoever owns launch timing: this endpoint is a public statement
of which marketplaces are live, so adding a key to `MOBILE_SUPPORTED_MARKETPLACES` announces a
marketplace to anyone who curls it, before any app UI does. If that timing is ever commercially
sensitive, the env flip is the announcement.
