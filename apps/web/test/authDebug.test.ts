import test from 'node:test'
import assert from 'node:assert/strict'

import {
  redactAuthParamValue,
  summarizeErrorDebug,
  summarizeAuthLocation,
  summarizeSessionDebug,
} from '../src/utils/authDebug'

test('redactAuthParamValue hides sensitive OAuth values', () => {
  assert.equal(redactAuthParamValue('access_token', 'abc123456789'), '[redacted:12]')
  assert.equal(redactAuthParamValue('code', 'oauth-code-value'), '[redacted:16]')
  assert.equal(redactAuthParamValue('state', 'plain-state'), 'plain-state')
})

test('summarizeAuthLocation redacts tokens and codes in hash and query params', () => {
  assert.deepEqual(
    summarizeAuthLocation(
      'http://localhost:5173/auth?code=oauth-code&next=/dashboard#error=server_error&access_token=token',
    ),
    {
      origin: 'http://localhost:5173',
      path: '/auth',
      searchParams: {
        code: '[redacted:10]',
        next: '/dashboard',
      },
      hashParams: {
        error: 'server_error',
        access_token: '[redacted:5]',
      },
    },
  )
})

test('summarizeSessionDebug keeps only safe session fields', () => {
  assert.deepEqual(
    summarizeSessionDebug({
      user: {
        id: 'user-123',
        email: 'user@example.com',
        is_anonymous: false,
        app_metadata: { provider: 'google' },
      },
      access_token: 'secret',
    }),
    {
      userId: 'user-123',
      email: 'user@example.com',
      isAnonymous: false,
      provider: 'google',
    },
  )
  assert.equal(summarizeSessionDebug(null), null)
})

test('summarizeErrorDebug extracts known error fields safely', () => {
  assert.deepEqual(
    summarizeErrorDebug({
      message: 'Database error saving new user',
      code: 'unexpected_failure',
      details: 'trigger failed',
      hint: 'check function',
    }),
    {
      message: 'Database error saving new user',
      code: 'unexpected_failure',
      details: 'trigger failed',
      hint: 'check function',
    },
  )
})
