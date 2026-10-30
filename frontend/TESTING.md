# Testing the Prelegal frontend

Run everything from the `frontend/` directory. The tests read `../documents.json` and the templates in `../templates`, so check out the whole repository. The end-to-end tests also run the backend, so they need [uv](https://docs.astral.sh/uv/). The backend's own tests are described in the [root README](../README.md#tests).

| Command            | Runs                                                      |
| ------------------ | --------------------------------------------------------- |
| `npm test`         | Unit and component tests (Vitest)                         |
| `npm run test:e2e` | End-to-end tests in a real browser (Playwright)           |
| `npm run test:all` | Lint, type-check, unit and component tests, end-to-end    |

### Useful variations

- **One file or test:**
  - `npx vitest run src/lib/nda/buildNda.test.ts`
  - `npx vitest run -t "years box"`
  - `npx playwright test -g "Word"`
- **Watch mode:** `npm run test:watch`.
- **See the browser:** `npx playwright test --headed`, or `--ui` for Playwright's UI mode.
- **Debug a failure:** a trace is kept for each failed end-to-end test. Open it with `npx playwright show-trace test-results/<test>/trace.zip`.

### How the setup works

- **Component tests** opt into a simulated browser (jsdom) with a `// @vitest-environment jsdom` comment at the top of the file. Logic tests run in plain Node.
- **Shared test code** lives in `src/test/`:
  - `fixtures.ts`: the real documents and templates, parsed as the app does, and filled-in NDA values.
  - `drafts.ts`: filled-in drafts (an NDA and a Pilot Agreement), shared with the end-to-end tests.
  - `queries.ts`: shared lookups, e.g. the preview.
  - `setup.ts`: cleanup after each test.
  - `server-only.ts`: stands in for Next's `server-only` guard, so tests can run the build-time loaders.
  - `router.ts`: stand-ins for Next's router and the current address (`usePathname`, `useSearchParams`), and `route()`, which matches a link's href with or without the trailing slash (Vitest doesn't load `next.config`).
  - `api.ts`: `stubApi` replaces `fetch` with a fake backend (routes keyed `"METHOD /path"`; any other request fails loudly). `setSession` puts the session store in a known state. The store lives for a whole test file, so tests set the state they need first.
- **Timezone:** Vitest runs in the `America/Los_Angeles` timezone (set in `vitest.config.mts`). Date code that wrongly uses UTC then fails on every machine, not just some.
- **End-to-end tests** build the static export and serve it with the FastAPI backend on port 3100, with a fresh empty database, for each run. This is the same setup as the Docker image.
  - Use `E2E_PORT` to pick another port.
  - Set `PW_REUSE=1` to reuse a server you started yourself. For example, test the Docker container with `PW_REUSE=1 E2E_PORT=8000 npm run test:e2e`.
  - Accounts are real, and all tests share one database, so each test signs up a fresh user (`uniqueEmail`). Most go through `openApp` in `e2e/helpers.ts`, which signs up through the API and opens the drafting page.
  - Every test also fails if the page logs a console error. Chromium logs every 4xx response as one, so a test that expects one (a wrong password, say) removes it with `expectHttpErrors`.
  - `expectNoAxeViolations` and `axeViolations` run the accessibility checks (axe, WCAG 2.1 AA).
- **Browser:**
  - Locally, the end-to-end tests use your installed Google Chrome.
  - On CI they use Playwright's bundled Chromium, so run `npx playwright install --with-deps chromium` first.
  - Set `PW_CHANNEL=chromium` to use the bundled browser locally too.

## What the automated tests cover

### API calls: `src/lib/api.test.ts`

- **Requests:** JSON in and out, no body for a plain GET, and nothing back for 204.
- **Errors:** the backend's message when it wrote one for users, a generic one otherwise (including validation errors), and "can't reach Prelegal" when offline.
- **Ended session:** a 401 from any endpoint but sign-in itself signs the user out.

### Session: `src/lib/session.test.ts`

- **Who is signed in:** unknown until `GET /api/auth/me` answers. Calls made while one is in flight share it, and an unreachable backend keeps what was known.
- **Sign in, sign up and sign out:** the email and password are sent, and the backend's reason shows when it refuses. Signing out works even offline.
- **Ended session:** a 401 elsewhere signs the user out.
- **Races:** an answer to an older question can't undo a newer sign-out.
- **Change notifications:** subscribers hear about every change, and stop hearing after unsubscribing.

### Sign-in and sign-up form: `src/components/AuthForm.test.tsx`

- Signs in or creates an account, then goes to the drafting page. The button is busy while waiting.
- Shows why it failed (wrong password, email already registered), and lets the user try again.
- The browser checks the fields first: both required, an email, and at least 8 characters on sign-up.
- Links between the two pages. Already signed-in users skip the form.

### Guard and header: `src/components/AuthGuard.test.tsx`, `src/components/AppHeader.test.tsx`

- **Guard:** a loading state while it checks. Signed-in users see the page. Signed-out visitors are sent to the sign-in page without seeing it, including right after signing out.
- **Header:** the product name links home, New document and My documents mark the current page, the signed-in email shows, and Sign out signs out and returns to the sign-in page.

### Saved documents: `src/lib/saved/api.test.ts`, `src/components/DocumentList.test.tsx`, `src/components/DraftWorkspace.test.tsx`

- **API client:** list, read, create, update and delete. A very long conversation saves only its latest 200 messages.
- **My documents:** each document with its parties (or its type), type and last edit, linking to `/draft/?id=N`. An empty list invites the user to draft one. Delete asks to confirm and can be cancelled. Failures show, with Try again.
- **Opening a document:** `/draft/?id=N` loads it with its conversation. A missing, invalid or unreachable one says so, and invalid ids aren't even sent.
- **New draft's address:** when a new draft is first saved it gets the address `/draft/?id=N` and stays on screen. New document then starts afresh, and going back to that address reopens it from the server.

### Standard Terms of the other documents: `src/lib/documents/parseTerms.test.ts`

- **Numbering:** clauses are numbered by position as 1., 1.1, (a) and (i), since the templates write every item as "1.".
- **Markup:** titles, defined terms, bold passages with terms inside them, bare links and a link missing `https://` are all read correctly; cross-reference anchors are dropped.
- **Every real template:** each of the 10 parses into titled sections with no markup left over. The Cloud Service Agreement's 13 sections and the DPA's roman sub-clauses are checked in detail.
- **Errors:** text outside the list, odd indents and skipped levels fail loudly.

### Template parsing: `src/lib/nda/parseTemplate.test.ts`

- **Clauses:** all 11 clauses of the real template, with their titles, in order.
- **Nothing lost:** joining the parsed clauses and attribution back together gives exactly the template text with its markup removed. This is checked with plain string operations, independent of the parser.
- **Cover page references:** each one in the template becomes a defined-term reference (same count and names).
- **Edge cases:** Windows line endings, text spread over several lines, unmatched or adjacent markup, curly quotes, and clear errors for a broken template.

### Cover page wording: `src/lib/nda/templateWording.test.ts`

The cover page is generated in code. These tests check that its wording comes from `Mutual-NDA-coverpage.md`: the default purpose, the sentence for each term option, the headings and hints, the signature table labels and the signing statement. If someone edits the template, these tests flag the mismatch.

### Building the agreement: `src/lib/nda/buildNda.test.ts`

- **Cover page fields:** every field in template order. The years read "1 year" or "2 years" as appropriate.
- **Term options:** the open-ended ("until terminated") and "in perpetuity" options.
- **Placeholders:** blank or whitespace-only input shows placeholders such as `[Purpose]`.
- **Trimming:** surrounding spaces are removed but line breaks are kept.
- **Signature table:** both parties' details are filled in; the signature and date rows are left blank.
- **Input:** the values are never modified.
- **Dates:** leap days work, and impossible dates (`2026-02-30`, `2026-13-01`) or badly formatted ones are rejected.
- **File names:** unsafe characters are removed, and a missing company is handled.

### Word export: `src/lib/nda/toDocx.test.ts`

- **Valid file:** it opens as a valid Word package.
- **Cover page:** the filled-in details are all there.
- **Signature table:** its exact layout, with a label column and one column per party.
- **Formatting:** all 11 clauses with bold titles, bold defined terms, and hints in italics.
- **Links and text:** working hyperlinks, real Word line breaks, and escaped special characters.
- **Page break:** the Standard Terms start on a new page.
- **Draft notice:** the notice is under the title, and the short form is in the footer of both sections. The same test runs for the other documents.

### The other documents: `src/lib/documents/buildDocument.test.ts`, `toDocx.test.ts`

- **Cover page:** the parties with their roles, then every key term: the answer, `None` for a skipped optional term, or a `[placeholder]` for a missing essential one. Dates are written out.
- **Signature table:** one column per role (e.g. PROVIDER, CUSTOMER).
- **Attribution:** credits Common Paper, links the CC BY 4.0 licence, and says what Prelegal changed.
- **File names**, and **`toNdaValues`**, which turns an NDA draft into the NDA's own values.
- **Word export:** the cover page, numbered and indented Standard Terms on a new page, and links. A file is built for each of the 10 documents.

### Today's date: `src/lib/today.test.ts`

- Uses the local calendar day, checked at 23:59 when the UTC date is already tomorrow.

### The preview: `src/components/NdaPreview.test.tsx`

- **Structure:** the headings, every cover page field, placeholders, and the signature table rows and columns.
- **Text:** multi-line values are kept, and all 11 clauses appear in order.
- **Cover page references:** they stay as defined terms, as Common Paper intends, rather than having values filled in.
- **Safety:** links open safely in a new tab, and user input is shown as text, never run as HTML.

### The other documents' preview: `src/components/DocumentPreview.test.tsx`

- The title, every key term, numbered sections, clauses and sub-clauses, highlighted defined terms, and the licence link.

### Chat requests: `src/lib/chat/api.test.ts`

- **Request:** posts the whole conversation, the current draft and the user's local date to `/api/chat`, and returns the reply and the updated draft.
- **Errors:**
  - When the AI is unavailable (502), it shows the backend's message, which is written for users.
  - Anything else gets a generic message. That covers validation errors, server errors, and malformed answers, including a draft without fields or with a bad document id.
  - A network failure says the server can't be reached. An ended session (401) says to sign in again.

### The chat: `src/components/Chat.test.tsx` (the AI is faked)

- **Greeting:** the assistant speaks first, and Send is disabled until something is typed.
- **Sending:** sends the conversation so far, including the greeting, and the current draft. It then shows the reply, clears the box and passes the new draft and the whole conversation up.
- **Resuming:** a saved conversation shows, and carries on from where it was.
- **Keyboard:** Enter sends, and Shift+Enter adds a new line. Blank messages aren't sent.
- **Waiting:** "Assistant is typing…" shows while waiting, and nothing more can be sent until the reply arrives.
- **Errors:** an alert shows the error. **Try again** resends without repeating the user's message, and the alert goes away.
- **Screen readers:** each message is labelled "You:" or "Assistant:".
- **Long conversations:** only the latest 40 messages are sent, so the backend's limit is never reached. The whole conversation stays on screen.

### The page: `src/components/DraftCreator.test.tsx` (the AI is faked)

- **Before a document is chosen:** the preview lists the 11 documents, and the downloads are disabled.
- **Live preview:** the NDA shows with its own cover page, and any other document with a generated cover page and its Standard Terms. Switching document switches the preview, and each message sends the latest draft.
- **Download PDF:** opens the print dialog.
- **Download Word:**
  - It downloads exactly the file the right exporter produced (the NDA's or the other documents'), named after the document and the companies.
  - It cleans up the temporary link and releases the file's memory after a delay.
  - A busy state shows while the file is prepared.
  - An error message appears if export fails, and a retry can succeed.
- **Saving** (the save calls are faked):
  - Nothing is saved until the AI picks a document. Then the first turn creates the document and later turns update the same one.
  - A second turn that finishes before the first save doesn't create a duplicate: the waiting turns are sent as one update with the newest conversation.
  - A failed save says so, doesn't block the chat, and Try again saves.
  - A saved document reopens with its preview and conversation and saves to the same document.
  - A new document's id isn't reported once the page has been left.
- **Draft notice:** the agreement carries it.

### End-to-end: `e2e/drafting.spec.ts` (production build in a real browser, AI faked)

The tests replace the AI with scripted answers (`fakeAi` in `e2e/helpers.ts`), so they are fast and repeatable. The backend's chat endpoint and the real model are tested in `backend/tests` (see the [root README](../README.md#tests)).

| Test                                                                 | Desktop | Mobile (Pixel 7) |
| -------------------------------------------------------------------- | :-----: | :--------------: |
| Opens with the assistant's greeting and the list of documents, downloads disabled |    ✓    |        ✓         |
| Keeps the list while the assistant works out which document is needed (e.g. an unsupported one) |    ✓    |                  |
| Picks the NDA and fills it in as the conversation goes, sending the history, draft and date each time |    ✓    |                  |
| Shows every detail of the NDA                                        |    ✓    |                  |
| Drafts another document (Pilot Agreement) with a generated cover page, full Standard Terms and a Word file |    ✓    |                  |
| Switches document mid-conversation                                   |    ✓    |                  |
| Shows an error when the AI is unavailable, and Try again recovers    |    ✓    |                  |
| Shows that the assistant is typing                                   |    ✓    |                  |
| Downloads the NDA as a Word file and checks its contents             |    ✓    |                  |
| Download PDF opens the print dialog                                  |    ✓    |                  |
| Prints only the agreement over several pages, for the NDA and for a generated document |    ✓    |                  |
| No accessibility violations (axe, WCAG 2.1 AA) at the start, on the NDA and on a generated document |    ✓    |        ✓         |
| Moves through the controls in order with Tab (downloads skipped until there is a document), and Enter sends |    ✓    |                  |
| Layout: chat beside the preview on desktop (message box on screen), stacked on mobile, no sideways scrolling |    ✓    |        ✓         |

### End-to-end: `e2e/platform.spec.ts` (accounts and backend)

| Test                                                                 | Desktop | Mobile (Pixel 7) |
| -------------------------------------------------------------------- | :-----: | :--------------: |
| Creates an account from the sign-in page's link and lands on the drafting page |    ✓    |        ✓         |
| Signs in again with the same email (in any case) and password       |    ✓    |        ✓         |
| A wrong password shows an error and stays on the sign-in page        |    ✓    |                  |
| An email that already has an account shows an error                  |    ✓    |                  |
| The browser checks the fields before anything is sent                |    ✓    |                  |
| Sends signed-out visitors from `/draft/`, `/documents/` and `/draft/?id=1` to the sign-in page |    ✓    |                  |
| Stays signed in across reloads and skips the sign-in page            |    ✓    |                  |
| Signs out back to the sign-in page, and the backend forgets the session |    ✓    |                  |
| The session cookie is httpOnly and SameSite=Lax                      |    ✓    |                  |
| The disclaimer is on the sign-in and sign-up pages                   |    ✓    |                  |
| No accessibility violations on the sign-in and sign-up pages, and with a sign-in error |    ✓    |        ✓ (pages)  |
| Backend: health check, the chat and saved documents refuse signed-out callers, `/draft` redirects to `/draft/`, unknown pages get a 404 |    ✓    |                  |

### End-to-end: `e2e/documents.spec.ts` (My documents and the draft notice)

| Test                                                                 | Desktop | Mobile (Pixel 7) |
| -------------------------------------------------------------------- | :-----: | :--------------: |
| A new user has no documents and is invited to draft one (with axe)   |    ✓    |        ✓         |
| A draft is saved once the AI picks the document, and listed (with axe) |    ✓    |                  |
| Reopens a document with its preview and conversation (with axe), and keeps saving to it |    ✓    |        ✓         |
| Reloading a new draft's page reopens it, saved as one document       |    ✓    |                  |
| New document starts afresh from a saved one                          |    ✓    |                  |
| Deletes a document after confirming (with axe on the confirm step)   |    ✓    |                  |
| Says when a document can't be found (with axe)                       |    ✓    |                  |
| Each user's documents are private, and still there after signing back in |    ✓    |                  |
| The draft notice is on the agreement, on screen and when printed     |    ✓    |                  |
| The disclaimer is in the footer of the platform's pages              |    ✓    |                  |
| The Word file has the notice under the title and in the page footers |    ✓    |                  |

All end-to-end tests also fail on any console error.

## Manual test plan

Run these against the Docker container (`scripts/start-*`) with a real `OPENROUTER_API_KEY` in `.env` before a release. They cover what automation can't: the real AI, how things look, and real files in real apps. Record each run in the results section at the end.

| #   | Area          | Steps                                                                                                    | Expected                                                                                                                     |
| --- | ------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| M0  | Accounts      | Create an account, sign out, sign back in. Try a wrong password, and signing up again with the same email. Then sign out and open `/draft/` directly. | The drafting page opens with your email in the header. The wrong password and the taken email each show a clear message. After signing out, `/draft/` sends you back to the sign-in page. |
| M1  | First load    | Sign in. | Chat beside the list of documents Prelegal can draft, starting with the assistant's greeting. The downloads are disabled, and the save status says it saves once a document is picked. |
| M2  | Choosing      | Describe what you need without naming a document, e.g. "a customer wants to try our app for 3 months". | It suggests the right document (here the Pilot Agreement) and the preview switches to it. |
| M3  | Unsupported   | Ask for something Prelegal can't draft, e.g. an employment contract or a lease. | It says it can't draft that, suggests the closest document and why, and asks whether you want it. The preview doesn't change until you agree. |
| M4  | Conversation  | Answer the questions in your own words until it says the document is complete, for the NDA and for one other document. | Every reply ends with a question while something essential is missing. It asks about the document's terms first and the signers last, mentions the defaults (e.g. Effective Date today), and never invents names or addresses. |
| M5  | Several at once | Give both parties, a term and the governing law in one message. | All of them are filled in from that one message. |
| M6  | Changes       | Ask to change something already filled in, e.g. "make it 3 years", or to drop an optional term. | Only that field changes. A dropped optional term shows "None". |
| M7  | Switching     | Halfway through, ask for a different document. | The preview switches. The companies, signers, effective date and governing law carry over, and it checks who plays which role. |
| M8  | NDA terms     | Ask for the NDA to continue until terminated and for confidentiality in perpetuity, then back to years. | The wording in the preview changes each time. |
| M9  | Unusual input | Use a very long company name, `Zoë O'Brien-Müller`, `&`, `<b>x</b>`, and a two-line address. | Long text wraps in the table, special characters display correctly, HTML shows as plain text, and the line break is kept. |
| M10 | Off topic     | Ask the assistant to ignore its instructions, or to talk about something else. | It stays on drafting the agreement. |
| M11 | AI down       | Stop the container, remove the key from `.env`, start it again, and send a message. | A friendly error with **Try again**. Nothing else breaks. |
| M12 | Keyboard      | Tab through the whole page, and use Enter and Shift+Enter in the message box. | Logical order, with a visible focus ring on every control. Enter sends, and Shift+Enter adds a line. |
| M13 | Mobile        | Use a phone, or DevTools device mode, on the sign-in, sign-up, drafting and My documents pages. | Chat above the preview, no sideways scrolling, buttons easy to tap, and the header fits on one line. |
| M14 | Save as PDF   | For the NDA and one other document: click **Download PDF**, choose "Save as PDF", then open the file. | Only the agreement appears, with the draft notice under the title and the short notice at the foot of every page. The Standard Terms start on a new page, and the signature table isn't split across pages. |
| M15 | Word file     | For the NDA and one other document: click **Download Word** and open the file in Microsoft Word (and Google Docs or LibreOffice if available). | Opens without a repair warning. The draft notice is under the title and in every page's footer. The cover page, signature table, numbering, indents, line breaks and links are all correct, and the Standard Terms start on a new page. |
| M16 | Browsers      | Repeat M0, M1, M4, M14, M15 and M17 in Firefox, Safari and Edge. | Same behaviour. (Firefox and Safari may not print the page footer in M14: the notice under the title is still there.) |
| M17 | Reload        | Have a short conversation and reload. | The address is now `/draft/?id=N`, and the chat and agreement are as they were. |
| M18 | Console       | Keep DevTools open during M1 to M8. | No errors. (A failed save, as in M19, logs a warning.) |
| M19 | Saving        | Draft a document over a few messages, watching the save status. Then stop the container mid-conversation and send another message. | "Saving…" then "All changes saved". With the server down, it says it couldn't save, with Try again; the chat says the server can't be reached. |
| M20 | My documents  | Draft two documents, open **My documents**, open the older one and carry on, then delete one. | Both are listed, newest first, with their parties and type. The older one reopens with its conversation and moves to the top. Delete asks to confirm. |
| M21 | Privacy       | Copy a document's `/draft/?id=N` address, sign in as another user in a private window and open it. | "We couldn't find that document." |
| M22 | Restart       | Restart the container, then reload the app. | You are signed out and your account is gone (the database starts empty on every start, for now). |
| M23 | Disclaimer    | Look at every screen. | The draft notice is on the sign-in and sign-up pages, in the footer of every signed-in page, and on the agreement. Its text is readable (contrast) and focus rings show on the navy header. |

## Manual test results

### 2026-10-30: the NDA-only AI chat (KAN-7), Chrome on Windows 11, Docker container, real AI (partial, automated)

The test numbers refer to the plan at that time.


| #   | Result  | Notes                                                                                                     |
| --- | ------- | --------------------------------------------------------------------------------------------------------- |
| M1  | Pass    |                                                                                                           |
| M2  | Pass    | A three-message conversation filled in every field. The assistant then said the agreement was ready to download. |
| M3  | Pass    | One message filled in both companies, Party 1's signer, the purpose, governing law and jurisdiction.       |
| M15 | Pass    | No console errors.                                                                                        |
| Others | Not run | Left for a person to check.                                                                            |

### 2026-10-28: the form-based prototype (KAN-5), before the AI chat

Chrome on Windows 11, dev server. The test numbers refer to the plan at that time.


| #   | Result    | Notes                                                                                                   |
| --- | --------- | ------------------------------------------------------------------------------------------------------- |
| M1  | Pass      |                                                                                                         |
| M2  | Pass      |                                                                                                         |
| M3  | Pass      | The long company name wraps over three lines. Unfilled table cells stay blank so they can be completed by hand. |
| M4  | Pass      |                                                                                                         |
| M5  | Pass      | Arrow keys move between the options.                                                                    |
| M6  | Pass      |                                                                                                         |
| M7  | Pass      | The focus ring is visible on fields and radio buttons.                                                  |
| M8  | Automated | The browser window couldn't be resized for this run. Covered by the Pixel 7 end-to-end test.            |
| M9  | Not run   | The print dialog blocks browser automation. The print layout and a generated PDF are covered by the end-to-end tests. |
| M10 | Not run   | Needs Microsoft Word. The file's contents are checked by the unit and end-to-end tests.                 |
| M11 | Not run   | Only Chrome is available here.                                                                          |
| M12 | Pass      | Resets as expected. Saving a draft could be added later.                                                |
| M13 | Pass      |                                                                                                         |
