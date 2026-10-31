# Kitchen

Authenticated branch-scoped item board. Kitchen staff and owners advance queued→preparing→ready through a versioned transactional RPC. Waiter delivery is a separate operation: served items leave this board and retain actor/time and event history. Ready does not mean served or a free table. Polling pauses when hidden and displays connection errors. The oldest 100 matching active items are shown with an explicit truncation warning. No payment or realtime subscription exists. See HANDOVER.md for verified evidence and limits.
