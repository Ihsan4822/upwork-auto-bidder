# Web Authentication and Session Library

This module handles session management, cookie parsing, and route protection for the Upwork Proposal Assistant web application.

## Change Recipes

### 1. How to allow a new sign-in email

To grant access to a new user email:

1. Open your `.env` configuration file.
2. Locate `LOGIN_ALLOWED_EMAILS` (comma-separated list of lowercased emails).
3. Append the new email address, e.g.:
   ```env
   LOGIN_ALLOWED_EMAILS=user@example.com,newuser@example.com
   ```
4. Restart the web server. When the user requests a magic link, their email will now be recognized.

### 2. How to change the session length

By default, authenticated sessions last 30 days.
To change session lifetime:

1. Open `.env`.
2. Set `SESSION_TTL_DAYS` to your desired duration in integer days (e.g. 7 days):
   ```env
   SESSION_TTL_DAYS=7
   ```
3. Restart the web server. New sessions will receive cookies and database records with the updated TTL.

### 3. How reconnect works when a refresh fails

When an Upwork OAuth refresh token fails (e.g. revoked remotely, invalid grant, network permanent failure, or altered scopes):

1. The backend sets `Profile.connectionStatus` to `DISCONNECTED`.
2. An audit record is logged with `jobId: null` detailing the refresh failure reason.
3. The UI (`/settings/connection`) presents a clear "Reconnect Upwork" button and status notice.
4. The user clicks "Reconnect Upwork" to initiate a fresh OAuth 2.1 PKCE authorization flow.
