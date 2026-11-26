# Landing-page stats and streaming

The homepage renders its shell and hero without awaiting Supabase. A server
`LandingStats` component loads the data inside a Suspense boundary passed into
`LandingHero` as a server-rendered slot. `HeroStatsBar` renders the same grid,
labels, and icons with skeleton values while loading, without displaying false
zero counts.

The live deal card has a separate `LandingHeroDeal` server component and Suspense
boundary. It initially shows the existing, explicitly labelled sample deal,
then replaces it with the selected live deal when available. Neither the live
deal query nor the stats aggregate blocks the hero copy or other page sections.

The aggregate uses Next.js Data Cache (`unstable_cache`) with a 60-second
revalidation interval and React request deduplication. Warm requests reuse the
aggregate; after the interval Next.js can serve the stale value while refreshing
it in the background. The funded-order count, open-deal count, month-over-month
calculation, and other existing metrics retain their calculations.

The cached operation uses an anonymous Supabase client with session persistence,
URL session detection, and token refresh disabled. It does not read cookies or
use a service-role key. Public table RLS still applies, and one visitor's session
cannot influence a shared cache entry. No database schema or policy changes are
required.

Supabase query errors are thrown out of the cached operation. The existing
zero-valued failure fallback is returned outside the persistent cache, so a
transient error is not stored as a successful aggregate for the cache window.
