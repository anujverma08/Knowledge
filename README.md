# KnowledgeScout — Server README

This document describes the server-side API and behaviour implemented for the KnowledgeScout (Doc Q&A) challenge. It lists endpoints, sample requests/responses, test credentials, seed data, and a short architecture note.

## API summary

- POST /api/docs (multipart) — upload a document. Accepts `Idempotency-Key` header. Returns created `doc` metadata.
- GET /api/docs?limit=&offset= — list documents. Supports pagination. Response: `{ items: [...], next_offset: <number|null> }`.
- GET /api/docs/:id — fetch single doc metadata and content reference.
- POST /api/index/rebuild — trigger reindexing of uploaded docs. Accepts `Idempotency-Key`.
- GET /api/index/stats — return index statistics (document count, chunk count, last_rebuild).
- POST /api/ask {query,k} — query the index and return answers with snippet sources and page references. Queries are cached for 60s.
- POST /auth/register {email,password} — register new user (returns token)
- POST /auth/login {email,password} — login (returns token)
- GET /api/health — health probe (returns 200 and simple status)
- GET /api/_meta — manifest about the implementation and auth method
- GET /.well-known/hackathon.json — simple JSON help file for judge

## Sample requests & responses

Register / Login

Request:

POST /auth/register
{ "email":"tester@example.com", "password":"passw0rd" }

Response:

{ "token": "<bearer-token>", "user": { "id": "user_1", "email":"tester@example.com" } }

Upload document (multipart)

POST /api/docs
Headers: Authorization: Bearer <token>
Headers: Idempotency-Key: <uuid>
Body: form-data: file=@./doc.pdf, title="Doc title", private=true

Response:

{ "doc": { "id":"doc_1", "title":"Doc title", "owner":"user_1", "private": true } }

List documents with pagination

GET /api/docs?limit=10&offset=0

Response:

{ "items": [ { "id":"doc_1", "title":"Doc title" } ], "next_offset": null }

Ask (query)

POST /api/ask
Headers: Authorization: Bearer <token>
Body: { "query": "What is X?", "k": 3 }

Response (must reference real pages):

{
  "answer": "Short answer text...",
  "sources": [ { "doc_id":"doc_1", "page": 3, "snippet": "..." } ],
  "cached": false
}

Error format (all endpoints)

HTTP 400
{
  "error": { "code": "FIELD_REQUIRED", "field": "email", "message": "Email is required" }
}

Rate limit response

HTTP 429
{ "error": { "code": "RATE_LIMIT" } }

## Test user credentials and seed data

- Test user: `admin@mail.com` / `admin123` (server creates a token on register)

## Notes on required behaviours

- Pagination: always honor `limit` (max 100) and `offset` (offset >= 0). Return `next_offset` as `offset + items.length` or `null` when no more items.
- Idempotency: All create POST endpoints (`/api/docs`, `/api/index/rebuild`) must accept `Idempotency-Key` header and return the same response for repeated requests with the same key for the same user.
- Rate limits: enforce 60 requests/minute per user. When exceeded respond with HTTP 429 and the error envelope above.
- CORS: allow all origins during judging (`Access-Control-Allow-Origin: *`).
- Authentication: JWT bearer tokens returned on register/login. Private docs are only visible to the owner unless a `share-token` is provided.
- Query caching: identical ask requests for the same user+query must be cached for 60 seconds; responses must include `cached: true` when served from cache.

## Short architecture note (100–200 words)

The server is a small Express-based API that separates concerns into routes, controllers, and services. Document uploads are persisted to storage (for the hackathon this can be local disk) and are immediately split into chunks for embedding and indexing by the indexing service. The index is kept in-memory or as a lightweight file-backed store for simplicity; rebuilding the index recalculates embeddings and replaces the index snapshot. Authentication is JWT-based with a minimal user store; authorization checks on document access only allow owners or requests with valid share-tokens. A rate-limiter middleware enforces per-user quotas; an idempotency layer records recent Idempotency-Key values to make create operations safe to retry. Queries consult the index, assemble answers with source snippets, and cache responses per user for 60 seconds to reduce cost and improve determinism.

