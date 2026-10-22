# Barangay Sta. Lucia — Resident Portal & Admin Panel

This build adds a working resident account system, a service-request tracker, a concern tracker, public announcements, and a barangay administrator panel to the existing static website.

## Getting started

1. Open `index.html` or `login.html` in a modern browser (Chrome, Edge, Firefox, or Safari).
2. Click **Resident Login** in the header.
3. Choose **Create account**, register, and you will be taken to the resident portal.
4. File a service request from `services.html` or a concern from `concerns.html`.
5. Return to the portal to view the requests and concerns you submitted, along with their status and any barangay response.

When you are signed in, the full name, contact number, and address on both forms are filled from your resident account and locked. Visitors without an account see an **Account required** notice, and every form field is disabled until they sign in or create an account. Submitted requests and concerns always use the signed-in account's name, number, and address.

> If your browser blocks storage when the files are opened directly, serve the folder over HTTP instead. Any static server works. For example, copy the folder into `htdocs` in XAMPP and open `http://localhost/barangay-sta-lucia/`.
>
> Passwords are hashed with PBKDF2 in the browser, which needs a secure browser context. Current Chrome, Edge, Firefox, and Safari support this for local files and localhost.

## Where the data is saved

The demo uses **browser local storage** as its database. Nothing is sent to a server.

| Local storage key | Contents |
| --- | --- |
| `bsl.db.v1` | `users`, `requests`, `concerns`, and `announcements` tables plus reference-number counters |
| `bsl.session.v1` | The signed-in account and session expiry |
| `bsl.flash.v1` | Short-lived confirmation messages |

You can view the stored records in your browser's developer tools under **Application → Local Storage**.

Important consequences:

- Accounts and records belong to **one browser profile on one device**. They are not shared with other browsers or phones.
- Clearing site data deletes the accounts and records.
- This is a front-end demonstration database, not a secure multi-user server. Anyone who can use that browser profile can read or modify its local storage. Do not use it for real resident information as-is.

### Reset the demo database

Open the browser console on any site page and run:

```js
BSL.resetDatabase();
```

Then reload the page.

## Default administrator

This build seeds one administrator into the local database:

| Field | Value |
| --- | --- |
| Email | `nikkolai@gmail.com` |
| Password | `Nikkolai2026` |
| Name | Nikkolai Pabalate |
| Mobile number | `09935503423` |
| Address | Barangay Sta. Lucia, Santa Ana, Pampanga |

Sign in with these details at `login.html`. The **Admin panel** button appears on the portal only for administrator accounts. The account is added automatically to a new browser database and migrated into an existing database the first time this version loads.

These are intentional demo credentials for this local build. Change the password before storing real resident information.

### Giving another account administrator access

1. Sign in as the default administrator.
2. Open **Admin panel**.
3. Scroll to **Residents & administrators**.
4. Click **Make admin** beside any registered resident.
5. To revoke access, click **Remove admin**.

Safeguards:

- An administrator cannot remove their own administrator access; another administrator must do it.
- The last administrator cannot be demoted.
- Only administrators can see the Admin panel link, open `admin.html`, update statuses, or change account roles.
- The in-site confirmation dialog is still used for role changes, cancellations, and deletions.

## What the admin panel can do

- See totals for registered residents, requests, concerns, and items needing attention.
- Add, edit, and delete the announcements shown on the home page and `announcements.html`. Announcement controls are visible only to administrators.
- View every service request with the resident's name, contact details, address, purpose, and reference number.
- Change a request's status: Pending, Processing, Ready for Pickup, or Completed.
- Delete any service request or concern permanently with its **Delete** button.
- View every concern and change its status: Open, In Review, Resolved, or Closed.
- Write a response to a concern; the resident sees it in their portal.
- Promote residents to administrators and demote administrators back to residents.

Residents see status changes, responses, and new announcements the next time they open or refresh the relevant page.

In the portal, a resident can cancel their own service request while it is still **Pending**, or their own concern while it is still **Open**. Cancelling permanently deletes that record from the local database, so it disappears from both the resident portal and the admin panel. Once the barangay office starts processing an item, it can no longer be cancelled from the portal. Administrators can permanently delete any request or concern from the admin panel using its **Delete** button. Resident cancellations, admin deletions, and account-role changes open an in-site confirmation dialog; choosing **Keep**, pressing Escape, or clicking outside the dialog leaves the record untouched.

## Account and password handling

- Emails are unique and case-insensitive.
- Passwords must be at least 8 characters and include a letter and a number.
- Passwords are stored as a PBKDF2-SHA-256 hash with a random 16-byte salt and 150,000 iterations. Plain-text passwords are never stored.
- Sessions expire after 30 days when “Keep me signed in” is checked, or after 12 hours otherwise.

## Files added or changed

| File | Purpose |
| --- | --- |
| `login.html` | Combined login and registration page |
| `portal.html` + `js/portal.js` | Resident dashboard that displays submitted requests and concerns, with permanent cancellation for items still open |
| `admin.html` + `js/admin.js` | Administrator dashboard, including announcement management |
| `js/db.js` | Local database, authentication, roles, announcements, and all data operations |
| `js/auth.js` | Login/registration page behaviour |
| `js/forms.js` | Database submission for `services.html` and `concerns.html` |
| `js/announcements.js` | Public announcement lists and the announcement detail dialog |
| `js/site.js` | Header account-state label, page transitions, and the shared confirmation dialog |
| `styles.css` | Styling for the account, portal, admin, announcement, and confirmation screens |

The existing public pages now link to the portal, prefill resident details, and save requests/concerns to the database instead of opening an email draft. The portal is a tracker only; creating a request or concern happens on the public forms.

## Data storage (no SQL schema)

This build intentionally has **no SQL schema file** and does not require one. All demo data lives in browser local storage under `bsl.db.v1`, and its shape is defined in `js/db.js`:

- `users` — resident and administrator accounts
- `requests` — service requests
- `concerns` — concerns and suggestions
- `announcements` — public announcements
- `counters` — reference-number counters

If the project later needs data shared across devices, rewrite the `BSL` functions in `js/db.js` to call an API. That API can use any database or a managed backend; the front-end does not depend on a schema file.
