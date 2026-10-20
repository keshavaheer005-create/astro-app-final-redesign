# Astrovia AI chat foundation

This update builds the conversation-history and reading experience around the existing Acharya AI service. It deliberately reuses the current API, auth checks, chart grounding, streaming reply generator, IndexedDB cache, Capacitor plugins, Framer Motion, and glass design tokens.

## Conversation model

- A new in-memory conversation ID is created when Acharya first opens in a WebView session. Empty new chats render locally without an empty-history request.
- Conversation IDs are sent to `POST /api/ask-acharya` and used to scope AI history and `GET /api/ask-acharya?conversationId=...`.
- Conversation ID, stable title, and journal threading are stored in the existing `ChatMessage.meta` JSON string. **No Prisma schema or production database migration is required.** The legacy transcript is still available under the reserved `legacy` ID.
- `GET /api/ask-acharya?list=1` returns a bounded page of conversation summaries; `before` requests the next page with a timestamp + message-ID cursor so equal timestamps do not skip entries. Recent messages are grouped into conversations server-side. Long transcripts load the latest 40 messages first; **Load older messages** fetches preceding pages on demand and preserves the reader’s scroll position.

## Device cache and performance

- Existing IndexedDB storage remains scoped by account and chart. New chat keys also contain the conversation ID; the old key remains reserved for the legacy transcript.
- Only confirmed messages are cached, with the existing 40-message cap and a 12-conversation cap for new chat entries. Credentials and authorization tokens are not stored.
- The history drawer paints from existing cache entries first, then replaces the provisional list with the server response.
- Stream deltas are coalesced to one React update per animation frame. Message rows are memoized. Streaming scroll follows only when the reader is near the bottom.
- Chat-switch rendering is scope-gated so a previous account/chart transcript is never intentionally displayed during a context switch.
- Motion uses transform/opacity and supports the existing global reduced-motion rule. The orbit indicator is small and CSS-only.

## Voice and navigation

- Native speech recognition uses `popup: false` for inline recognition where supported by the installed Capacitor speech-recognition plugin. The composer shows its own listening/transcribing state; hardware Back closes the drawer first, then exits focus reading.
- Browser Escape provides the same drawer/reader close order.
- The composer is a controlled auto-growing textarea with Enter-to-send, Shift+Enter for a new line, a 600-character cap, and safe-area padding.

## Suggested device smoke test

1. Force-close and relaunch the Android app. Acharya should open a fresh empty chat; previous chats should remain in History.
2. Send a prompt and verify streaming completes, then open History and confirm the prompt becomes the conversation title.
3. Start another chat and verify its replies/history remain separate from the first chat.
4. Open an older chat and confirm it opens in full-screen focus reading. Hardware Back should close the drawer first, then leave focus reading.
5. Switch accounts/charts and verify no previous transcript flashes into view.
6. Test the microphone on a physical Android device. Verify permission handling, inline listening, stopping, and insertion of the recognised text. Some speech-recognition behavior is device/OS dependent.
7. Open a previously cached chat offline, then reconnect and confirm it reconciles with the server.

The complete Next.js build, lint suite, and Bun test suite still need to be run in an environment with this repository's dependencies installed. Static TypeScript/TSX parsing, locale parity, and the isolated IndexedDB cache behavior checks were run for this update.
