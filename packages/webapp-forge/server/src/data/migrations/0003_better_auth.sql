-- 0003 Better Auth integration: schema for the four core tables
-- (user, session, account, verification) plus the username plugin's
-- additions on `user`.
--
-- This migration adds the Better Auth tables ALONGSIDE the existing
-- `users` table. Cutover (queries, seed, then rename/drop) lands in
-- a follow-up migration once code reads from the Better Auth schema.
--
-- Column types follow Better Auth's Kysely SQLite adapter conventions:
--
-- - `text` for string and id fields
-- - `integer` for boolean (0 or 1) and numeric fields
-- - `date` for date fields (Kysely's libsql dialect serialises Date as ISO text;
--   SQLite stores them with TEXT affinity)
--
-- The `user.username` and `user.displayUsername` columns come from the
-- username plugin (`better-auth/plugins`) and are nullable + unique
-- on the normalised handle.

CREATE TABLE IF NOT EXISTS user (
  id              text NOT NULL PRIMARY KEY,
  name            text NOT NULL,
  email           text NOT NULL UNIQUE,
  emailVerified   integer NOT NULL,
  image           text,
  createdAt       date NOT NULL,
  updatedAt       date NOT NULL,
  username        text UNIQUE,
  displayUsername text
);

CREATE TABLE IF NOT EXISTS session (
  id        text NOT NULL PRIMARY KEY,
  expiresAt date NOT NULL,
  token     text NOT NULL UNIQUE,
  createdAt date NOT NULL,
  updatedAt date NOT NULL,
  ipAddress text,
  userAgent text,
  userId    text NOT NULL REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS session_userId_idx ON session(userId);

CREATE TABLE IF NOT EXISTS account (
  id                    text NOT NULL PRIMARY KEY,
  accountId             text NOT NULL,
  providerId            text NOT NULL,
  userId                text NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accessToken           text,
  refreshToken          text,
  idToken               text,
  accessTokenExpiresAt  date,
  refreshTokenExpiresAt date,
  scope                 text,
  password              text,
  createdAt             date NOT NULL,
  updatedAt             date NOT NULL
);

CREATE INDEX IF NOT EXISTS account_userId_idx ON account(userId);

CREATE TABLE IF NOT EXISTS verification (
  id         text NOT NULL PRIMARY KEY,
  identifier text NOT NULL,
  value      text NOT NULL,
  expiresAt  date NOT NULL,
  createdAt  date NOT NULL,
  updatedAt  date NOT NULL
);

CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);
