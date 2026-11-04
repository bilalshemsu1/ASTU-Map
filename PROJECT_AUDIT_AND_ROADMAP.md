# ASTU Campus Navigator — Product, Quality, and Feature Log

**Status:** Baseline audit completed 2026-11-04  
**Purpose:** A single working log for making ASTU Campus Navigator dependable enough for demonstrations and genuinely useful on campus.

## Executive direction

The strongest product positioning is not simply “a labelled campus map.” It is an **ASTU arrival-to-destination guide**: a visitor can search a place, understand what it offers, select an accessible or fastest walking route, and be guided to the correct entrance in real time.

The best next investment is route trustworthiness. A beautiful map without trustworthy positioning and route progress will not be convincing in a live presentation. Build the navigation foundation first, then make the presentation features visible on top of it.

## Verified current baseline

| Area | Verified state |
| --- | --- |
| Live campus dataset | `lib/data/campus.json`: 25 buildings, 363 nodes, 419 edges |
| Graph integrity | No invalid edge endpoints or building entrances; all 363 nodes are in one connected component |
| Search | Searches building codes, names, aliases, rooms, and keywords |
| Routing | Local Dijkstra route with road snapping, walking-time estimate, path type penalties, and synthetic alternatives |
| AI guide | Groq-backed when configured; local campus-aware fallback otherwise |
| GPS | One-time browser location capture only |
| Navigation progression | Manual: Next/Previous buttons, swipe, or scroll; not driven by movement |
| Code health | `npm run lint` passed during this audit |

## Confirmed problems and technical debt

### P0 — fix before presenting navigation as live

| ID | Problem | Evidence / impact | Recommended fix | Status |
| --- | --- | --- | --- | --- |
| NAV-01 | Location tracking is not real time | Resolved in code on 2026-11-04: the map now uses a start/stop `watchPosition` lifecycle, updates the blue pin continuously, and renders an accuracy radius. Field testing is still required. | Add field-tested heading, speed, timestamp, and stale-fix indicators before presenting it as production-grade navigation. | Implemented — field test pending |
| NAV-02 | “Navigation” is a step viewer, not live guidance | Active route step changes only through manual controls. | Use the live location to map-match to the route, calculate remaining distance/time, advance steps automatically, and show “arrived.” | Open |
| NAV-03 | No off-route recovery | A walker can leave the route and the app does not detect or repair it. | Measure distance from the user to the route; after a sensible sustained threshold, reroute from the live position with debounce/cooldown. | Open |
| DATA-01 | Three copies of campus data can drift | The live app uses `lib/data/campus.json`; `campus.json` and `lib/campus.json` currently differ from it. The digitizer writes all three. | Make `lib/data/campus.json` the sole canonical data source. Update scripts and editor API to use it only, then delete or generate legacy copies. | Open |

### P1 — reliability, accuracy, and deployment risks

| ID | Problem | Evidence / impact | Recommended fix | Status |
| --- | --- | --- | --- | --- |
| ROUTE-01 | Route alternatives are synthetic | Alternatives arise from applying penalties to prior edges and may be near-duplicates or poor choices. | Offer alternatives only when materially distinct; calculate and label their distance/time/accessibility differences. | Open |
| ROUTE-02 | All 419 edges are `paved_walkway` | Existing data has no classified roads, stairs, or accessible segments, so routing preferences cannot yet be trustworthy. | Audit and classify paths in the digitizer; record stairs, slope, surface, lighting, restrictions, and verified accessibility. | Open |
| ROUTE-03 | No route-quality test suite | Existing verification script targets an older dataset shape. | Create tests for canonical-data integrity, key origin/destination routes, expected distance bounds, and no disconnected entrances. | Open |
| GPS-01 | GPS quality is not surfaced | A one-time accuracy message is shown, but no stale/poor-accuracy state exists. | Reject or visually qualify low-accuracy fixes; show last updated time, accuracy ring, and “GPS signal weak” state. | Open |
| GPS-02 | Browser GPS has environmental limits | Desktop, HTTPS restrictions, weak signal, and indoor multipath can make locations inaccurate. | Design a graceful fallback: manual start pin, “recenter,” and explicit accuracy messaging. Test on real Android/iOS devices outdoors. | Open |
| DEPLOY-01 | Digitizer save API is unsafe for a public deployment | It can write files with no visible authentication and only works on writable, stateful hosting. | Restrict `/digitize` and saving to authorized admins; migrate data writes to a database or controlled CMS before public deployment. | Open |
| MAP-01 | Satellite tiles and marker images depend on third-party URLs | Google tile endpoints and remote image URLs have availability/licensing/attribution risk. | Use a provider with an appropriate production agreement and attribution; bundle marker assets locally. | Open |

### P2 — product and implementation polish

| ID | Problem | Recommended fix | Status |
| --- | --- | --- | --- |
| UX-01 | One large UI component owns most application behavior | Split map state, directions workflow, place details, and navigation controller into focused components/hooks. | Open |
| UX-02 | Building labels can become crowded | Add zoom-aware label visibility, collision avoidance, and category/feature filters. | Open |
| UX-03 | Building detail completeness is uneven | Establish a content checklist: verified name, code, entrance, hours, contacts, description, accessible entry, photos, and room/service list. | Open |
| QA-01 | No user-facing route feedback loop | Add “Was this route accurate?” and issue reporting with location, optional photo, and category. | Open |
| OBS-01 | No production error/usage monitoring is apparent | Add privacy-conscious error tracking and anonymous event analytics for search failures, route failures, and feature adoption. | Open |

## Recommended feature roadmap

### Phase 1 — Trustworthy live navigation (highest priority)

1. **Live GPS tracking**
   - Start/stop tracking control using `watchPosition`.
   - Animated blue-dot position with accuracy circle, heading, last-update time, and permission/signal state.
   - Battery-aware options: high accuracy while navigating, lower-frequency tracking otherwise.

2. **Map-matched route progress**
   - Snap noisy GPS fixes to nearby route segments rather than blindly drawing the raw point.
   - Automatically advance instructions when the user reaches a route waypoint/turn.
   - Show remaining distance and ETA, plus a clear arrival state.

3. **Off-route detection and rerouting**
   - Detect a sustained distance from the intended route; do not reroute on a single noisy fix.
   - Recompute safely from the live location, announce the update, and preserve destination context.

4. **Navigation safety and accessibility**
   - Add route modes: fastest walking, step-free, and avoid unlit/rough paths when data supports them.
   - Never claim step-free routing until path data has been surveyed.

### Phase 2 — Make each location genuinely useful

1. **Place cards that answer “why should I go here?”**
   - Service and department information, hours, contacts, photos, room/floor directory, entrance photo, and accessibility notes.
   - “Popular tasks” per place: print an ID, submit documents, find study space, eat, or use a lab.

2. **Indoor and entrance-aware guidance**
   - Route to the correct building entrance, not just the centroid.
   - Add floor directories and indoor wayfinding only for high-value buildings first: Administration, Central Library, key academic blocks, cafeteria.

3. **Campus life layer**
   - Events, shuttle/stops, parking, toilets, ATMs, clinics, prayer spaces, dining status, emergency points, and accessibility features.
   - Use filters so the map remains clear.

4. **Visitor mode**
   - A simple guided tour for main gate arrivals: admissions, registrar, library, dining, and help contacts.
   - QR code at campus gates that opens a destination-aware map.

### Phase 3 — Features that make a demonstration memorable

1. **“Find my class” journey**: paste/select building and room, choose current location, get live guidance and arrival confirmation.
2. **AI assistant with grounded actions**: every answer provides a verified place card and a route action; add multilingual Amharic/Oromo/English support after content review.
3. **Report a campus issue**: blocked path, construction, poor lighting, or incorrect location. Admins review before changing published routes.
4. **Saved places and shareable routes**: favourites, deep links, and QR sharing for a building or event.
5. **Operational dashboard (admin only)**: data completeness, unverified places, reported issues, common failed searches, and route feedback.

## Presentation plan: demonstrate confidence, not just features

Use a short real-world story rather than a feature tour:

1. A new student scans a QR code at the main gate.
2. They search “Registrar” or ask the AI where to get an ID card.
3. The map opens a rich verified place card and shows the correct entrance.
4. They select **Use my location** and start live guidance.
5. The map follows their movement, automatically advances a turn, and recalculates if they deviate.
6. Arrival shows hours, services, and the next useful action.

For a reliable live demo, prepare two routes, test the actual phone/browser/location permissions at the site, and have a pre-recorded screen capture available as backup. Do not demonstrate GPS indoors or claim real-time tracking until Phase 1 is implemented and field-tested.

## Acceptance criteria for real-time navigation

The feature is ready to present only when all are true:

- User can explicitly start and stop live tracking.
- Position updates continuously while moving, with visible timestamp and accuracy.
- The current instruction changes automatically based on location.
- Remaining route distance and ETA update after valid fixes.
- One noisy location fix does not trigger a reroute.
- Sustained off-route movement triggers one understandable reroute.
- GPS permission denied, weak signal, and stale readings all have clear recovery paths.
- The flow is field-tested on at least one Android and one iPhone on campus.

## Suggested work order

1. Consolidate campus data and repair the verification tooling.
2. Implement and test the live GPS tracking lifecycle.
3. Add route map matching, automatic progress, and off-route rerouting.
4. Survey/classify paths and entrances; then enable accessibility-aware routing.
5. Upgrade the highest-value place cards and build the presentation journey.
6. Secure the digitizer and introduce monitoring/feedback before public rollout.

## Decision log

| Decision | Rationale | Status |
| --- | --- | --- |
| Treat live guidance as the product foundation | It is the largest gap between the current interface and a trustworthy navigation promise. | Adopted |
| Retain local graph routing initially | Campus-specific paths can be more accurate than generic road routing once they are surveyed and maintained. | Adopted |
| Use `lib/data/campus.json` as the proposed canonical dataset | It is the dataset imported by the live home page and API chat route. | Proposed |
| Do not claim accessibility until path data is surveyed | The current dataset has no stairs/road/accessibility classifications in active use. | Adopted |
