# Testing the Prelegal frontend

Run everything from the `frontend/` directory. The tests read the templates in `../templates`, so check out the whole repository. The end-to-end tests also run the backend, so they need [uv](https://docs.astral.sh/uv/). The backend's own tests are described in the [root README](../README.md#tests).

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
  - `fixtures.ts`: the parsed real templates and a fully filled-in agreement.
  - `queries.ts`: shared lookups, e.g. the preview.
  - `setup.ts`: cleanup after each test.
  - `router.ts`: a stand-in for Next's router, for components that navigate.
- **Timezone:** Vitest runs in the `America/Los_Angeles` timezone (set in `vitest.config.mts`). Date code that wrongly uses UTC then fails on every machine, not just some.
- **End-to-end tests** build the static export and serve it with the FastAPI backend on port 3100, with a fresh empty database, for each run. This is the same setup as the Docker image.
  - Use `E2E_PORT` to pick another port.
  - Set `PW_REUSE=1` to reuse a server you started yourself. For example, test the Docker container with `PW_REUSE=1 E2E_PORT=8000 npm run test:e2e`.
  - Most tests sign in through the sign-in form first (`openApp` in `e2e/helpers.ts`).
  - Every test also fails if the page logs a console error.
- **Browser:**
  - Locally, the end-to-end tests use your installed Google Chrome.
  - On CI they use Playwright's bundled Chromium, so run `npx playwright install --with-deps chromium` first.
  - Set `PW_CHANNEL=chromium` to use the bundled browser locally too.

## What the automated tests cover

### Fake session: `src/lib/session.test.ts`

- **Sign in and out:** signing in stores the trimmed email, and signing out clears it.
- **Stable value:** the same object is returned until the session changes, as React's `useSyncExternalStore` requires.
- **Bad storage:** corrupt stored values and blocked storage count as signed out, without errors.
- **Change notifications:** subscribers hear about sign in, sign out and changes made in other tabs, and stop hearing after unsubscribing.

### Sign-in form: `src/components/LoginForm.test.tsx`

- Any email and password sign in and go to the NDA creator.
- Both fields are required, and the email must look like one.
- Already signed-in users skip the form.

### Guard and header: `src/components/AuthGuard.test.tsx`, `src/components/AppHeader.test.tsx`

- **Guard:** signed-in users see the page. Signed-out visitors are sent to the sign-in page without seeing it, including right after signing out.
- **Header:** it shows the product name and the signed-in email, and Sign out signs out and returns to the sign-in page.

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

### Defaults: `src/lib/nda/defaults.test.ts`

- **Date:** today's date uses the local calendar day, checked at 23:59 when the UTC date is already tomorrow.
- **Starting values:** both terms start at one year, and each party gets its own object.

### The preview: `src/components/NdaPreview.test.tsx`

- **Structure:** the headings, every cover page field, placeholders, and the signature table rows and columns.
- **Text:** multi-line values are kept, and all 11 clauses appear in order.
- **Cover page references:** they stay as defined terms, as Common Paper intends, rather than having values filled in.
- **Safety:** links open safely in a new tab, and user input is shown as text, never run as HTML.

### Chat requests: `src/lib/chat/api.test.ts`

- **Request:** posts the whole conversation and the current values to `/api/chat`, and returns the reply and updated values.
- **Errors:**
  - When the AI is unavailable (502), it shows the backend's message, which is written for users.
  - Anything else gets a generic message. That covers validation errors, server errors, and malformed answers, including the wrong number of parties.
  - A network failure says the server can't be reached.

### The chat: `src/components/Chat.test.tsx` (the AI is faked)

- **Greeting:** the assistant speaks first, and Send is disabled until something is typed.
- **Sending:** sends the conversation so far, including the greeting, and the current values. It then shows the reply, clears the box and passes the new values up.
- **Keyboard:** Enter sends, and Shift+Enter adds a new line. Blank messages aren't sent.
- **Waiting:** "Assistant is typing…" shows while waiting, and nothing more can be sent until the reply arrives.
- **Errors:** an alert shows the error. **Try again** resends without repeating the user's message, and the alert goes away.
- **Screen readers:** each message is labelled "You:" or "Assistant:".
- **Long conversations:** only the latest 40 messages are sent, so the backend's limit is never reached. The whole conversation stays on screen.

### The page: `src/components/NdaCreator.test.tsx` (the AI is faked)

- **Date default:** the Effective Date defaults to today in the user's timezone, and that date is sent to the AI.
- **Live preview:** the preview fills in from the AI's answers, and each message sends the latest values.
- **Download PDF:** opens the print dialog.
- **Download Word:**
  - It downloads exactly the file the exporter produced, named after the companies.
  - It cleans up the temporary link and releases the file's memory after a delay.
  - A busy state shows while the file is prepared.
  - An error message appears if export fails, and a retry can succeed.

### End-to-end: `e2e/nda-creator.spec.ts` (production build in a real browser, AI faked)

The tests replace the AI with scripted answers (`fakeAi` in `e2e/helpers.ts`), so they are fast and repeatable. The backend's chat endpoint and the real model are tested in `backend/tests` (see the [root README](../README.md#tests)).

| Test                                                                 | Desktop | Mobile (Pixel 7) |
| -------------------------------------------------------------------- | :-----: | :--------------: |
| Opens with the assistant's greeting and a default agreement          |    ✓    |        ✓         |
| Fills in the agreement as the conversation goes, sending the history and values each time |    ✓    |                  |
| Shows every detail the AI filled in                                  |    ✓    |                  |
| Shows an error when the AI is unavailable, and Try again recovers    |    ✓    |                  |
| Shows that the assistant is typing                                   |    ✓    |                  |
| Downloads a Word file and checks its contents                        |    ✓    |                  |
| Download PDF opens the print dialog                                  |    ✓    |                  |
| Prints only the agreement, and the generated PDF has several pages   |    ✓    |                  |
| No accessibility violations (axe, WCAG 2.1 AA) before and after a reply |    ✓    |        ✓         |
| Moves through the controls in order with Tab, and Enter sends        |    ✓    |                  |
| Layout: chat beside the preview on desktop (message box on screen), stacked on mobile, no sideways scrolling |    ✓    |        ✓         |

### End-to-end: `e2e/platform.spec.ts` (sign-in and backend)

| Test                                                                 | Desktop | Mobile (Pixel 7) |
| -------------------------------------------------------------------- | :-----: | :--------------: |
| Signs in with any email and password and lands in the NDA creator    |    ✓    |        ✓         |
| Requires an email and a password                                     |    ✓    |                  |
| Sends signed-out visitors from the NDA creator to the sign-in page   |    ✓    |                  |
| Stays signed in across reloads and skips the sign-in page            |    ✓    |                  |
| Signs out back to the sign-in page                                   |    ✓    |                  |
| No accessibility violations on the sign-in page                      |    ✓    |        ✓         |
| Backend: health check, `/nda` redirects to `/nda/`, unknown pages get a 404 |    ✓    |                  |

All end-to-end tests also fail on any console error.

## Manual test plan

Run these against the Docker container (`scripts/start-*`) with a real `OPENROUTER_API_KEY` in `.env` before a release. They cover what automation can't: the real AI, how things look, and real files in real apps. Record each run in the results section at the end.

| #   | Area          | Steps                                                                                                    | Expected                                                                                                                     |
| --- | ------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| M0  | Sign in       | Open the app, sign in with any email and password, then sign out and open `/nda/` directly.              | The NDA creator opens with your email in the header. After signing out, `/nda/` sends you back to the sign-in page.          |
| M1  | First load    | Sign in.                                                                                                 | Chat beside the agreement, starting with the assistant's greeting. Effective Date is today, terms are 1 year, Purpose has the default text. |
| M2  | Conversation  | Answer the assistant's questions in your own words until it says the agreement is complete.             | It asks about the parties, purpose, terms, governing law and jurisdiction. Each answer appears in the preview, and it never invents names or addresses. |
| M3  | Several at once | Give both parties, the purpose and the governing law in one message.                                   | All of them are filled in from that one message.                                                                             |
| M4  | Changes       | Ask to change something already filled in, e.g. "make it 3 years" or "the purpose is a merger".          | Only that field changes.                                                                                                     |
| M5  | Terms         | Ask for the NDA to continue until terminated and for confidentiality in perpetuity, then back to years.  | The wording in the preview changes each time.                                                                                |
| M6  | Unusual input | Use a very long company name, `Zoë O'Brien-Müller`, `&`, `<b>x</b>`, and a two-line address.              | Long text wraps in the table, special characters display correctly, HTML shows as plain text, and the line break is kept.    |
| M7  | Off topic     | Ask for a different document, or ask the assistant to ignore its instructions.                           | It politely says only the Mutual NDA is supported and steers back to the NDA.                                                |
| M8  | AI down       | Stop the container, remove the key from `.env`, start it again, and send a message.                      | A friendly error with **Try again**. Nothing else breaks.                                                                    |
| M9  | Keyboard      | Tab through the whole page, and use Enter and Shift+Enter in the message box.                            | Logical order, with a visible focus ring on every control. Enter sends, and Shift+Enter adds a line.                         |
| M10 | Mobile        | Use a phone, or DevTools device mode.                                                                    | Chat above the preview, no sideways scrolling, buttons easy to tap.                                                          |
| M11 | Save as PDF   | Finish a conversation, click **Download PDF**, choose "Save as PDF", then open the file.                 | Only the agreement appears. The Standard Terms start on a new page, and the signature table isn't split across pages.        |
| M12 | Word file     | Click **Download Word** and open the file in Microsoft Word (and Google Docs or LibreOffice if available). | Opens without a repair warning. The cover page, signature table, line breaks and links are all correct, and the Standard Terms start on a new page. |
| M13 | Browsers      | Repeat M1, M2, M11 and M12 in Firefox, Safari and Edge.                                                  | Same behaviour.                                                                                                              |
| M14 | Reload        | Have a short conversation and reload.                                                                    | The chat and agreement start over. Nothing is saved yet, which is expected for now.                                          |
| M15 | Console       | Keep DevTools open during M1–M5.                                                                         | No errors or warnings.                                                                                                       |

## Manual test results

### 2026-10-30: Chrome on Windows 11, Docker container, real AI (partial, automated)

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
