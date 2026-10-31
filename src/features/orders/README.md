# Orders

Scoped reads, waiter/owner seating and append commands, kitchen/owner preparation, waiter/owner per-item delivery and explicit table release are implemented through transactional RPCs. Serving records trusted actor/time and an immutable item_served event; the item leaves the kitchen queue. Guests keep the table occupied until departure, and may order another round. Closing a service preserves its history and lets a new party create a different order on that physical table.

Prices are server snapshots in integer IRR. Commands use resource locks, expected versions and actor/target/payload-bound idempotent replay. Direct item/order/event writes remain denied. Authenticated polling pauses when hidden. There is no payment, arbitrary cancellation, durable offline queue or physical-coordinate editor. See HANDOVER.md for actual verification and limits.
