# Upwork MCP OAuth 2.1 Discovery Spike Report

Date: 2026-11-06
Endpoint tested: https://mcp.upwork.com/mcp
Status: Verified via live endpoint queries

---

## 1. Authorization Server Discovery

Source endpoints queried:

- `GET https://mcp.upwork.com/.well-known/oauth-authorization-server`
- `GET https://mcp.upwork.com/.well-known/oauth-protected-resource`
- `GET https://mcp.upwork.com/.well-known/oauth-protected-resource/mcp`

Live Metadata Responses:

```json
{
  "issuer": "https://mcp.upwork.com",
  "authorization_endpoint": "https://www.upwork.com/ab/account-security/oauth2/authorize",
  "token_endpoint": "https://www.upwork.com/api/v3/oauth2/token",
  "revocation_endpoint": "https://www.upwork.com/api/v3/oauth2/token/revoke",
  "registration_endpoint": "https://www.upwork.com/register",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token", "client_credentials"],
  "token_endpoint_auth_methods_supported": [
    "none",
    "client_secret_basic",
    "client_secret_post",
    "private_key_jwt"
  ],
  "code_challenge_methods_supported": ["S256"],
  "client_id_metadata_document_supported": true
}
```

Protected Resource Metadata:

```json
{
  "resource": "https://mcp.upwork.com/mcp",
  "authorization_servers": ["https://mcp.upwork.com"],
  "bearer_methods_supported": ["header"],
  "resource_name": "Upwork MCP"
}
```

Confirmed Endpoints:

- Authorization endpoint: `https://www.upwork.com/ab/account-security/oauth2/authorize`
- Token endpoint: `https://www.upwork.com/api/v3/oauth2/token`
- Revocation endpoint: `https://www.upwork.com/api/v3/oauth2/token/revoke`

---

## 2. Client Registration & Authentication

- `token_endpoint_auth_methods_supported` includes `"none"`. This means public clients with PKCE do not need a client secret from a developer portal.
- `client_id_metadata_document_supported: true` indicates support for OAuth 2.0 Client ID Metadata Documents (draft-ietf-oauth-client-id-metadata-document), allowing client discovery without pre-registration where required.
- No developer app registration or Developer Portal client secret is required for the MCP public client flow.

---

## 3. PKCE Support

- `code_challenge_methods_supported`: `["S256"]`
- S256 is fully supported and enforced for authorization code exchanges.
- The client generates a random 32-byte `code_verifier` (base64url) and passes `code_challenge = BASE64URL(SHA256(code_verifier))` with `code_challenge_method=S256`.

---

## 4. Scopes

- Requested read-only scopes: `jobs:read`, `profile:read`.
- No proposal submission, messaging, or financial scopes requested or permitted.
- Scope validation logic (`validateGrantedScopes`) enforces that only approved read-only scopes are accepted and stored.

---

## 5. Token Lifetimes

- Access token lifetime: returned via `expires_in` in the token response (typically 86400s / 24 hours, but dynamically read from response).
- Refresh token: returned on authorization code grant and rotated on refresh grant.
- Refresh token lifetime: not documented in discovery metadata; application treats it as active until `invalid_grant` or revoked.

---

## 6. Transport & Protocol

- Transport protocol: Streamable HTTP with JSON-RPC 2.0 at `https://mcp.upwork.com/mcp`.
- Authorization header: `Authorization: Bearer <token>`.
- Header requirements: `mcp-protocol-version` supported.
- Unauthenticated response: HTTP 401 with `WWW-Authenticate: Bearer error="invalid_token", error_description="The access token is missing or invalid", resource_metadata="https://mcp.upwork.com/.well-known/oauth-protected-resource/mcp"`.

---

## 7. Error Handling & Refresh Flow

- Expired or invalid token on MCP call returns HTTP 401 with `WWW-Authenticate: Bearer`.
- Token service catches 401, issues `grant_type=refresh_token` exchange to `https://www.upwork.com/api/v3/oauth2/token`, stores new access token and new refresh token, and retries the request once.
- If refresh returns `invalid_grant` (refresh token revoked or expired), token service marks profile as `DISCONNECTED`, logs reason, and throws `NeedsReconnectError`.
