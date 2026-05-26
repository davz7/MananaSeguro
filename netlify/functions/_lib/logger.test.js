import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLogger, generateRequestId, resetRequestId, log } from './logger.js'

describe('createLogger', () => {
  beforeEach(() => {
    resetRequestId()
    vi.restoreAllMocks()
  })

  it('logs info level with correct JSON shape', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const logger = createLogger('test-function')

    logger.info('Test message', { userId: '123' })

    const call = console.log.mock.calls[0][0]
    const entry = JSON.parse(call)

    expect(entry.timestamp).toBeDefined()
    expect(entry.level).toBe('info')
    expect(entry.function).toBe('test-function')
    expect(entry.requestId).toBeDefined()
    expect(entry.message).toBe('Test message')
    expect(entry.userId).toBe('123')
  })

  it('logs warn level', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const logger = createLogger('test-function')

    logger.warn('Something suspicious', { detail: 'maybe' })

    const entry = JSON.parse(console.log.mock.calls[0][0])
    expect(entry.level).toBe('warn')
    expect(entry.message).toBe('Something suspicious')
  })

  it('logs error level', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const logger = createLogger('test-function')

    logger.error('Something broke', { error: 'timeout' })

    const entry = JSON.parse(console.log.mock.calls[0][0])
    expect(entry.level).toBe('error')
    expect(entry.message).toBe('Something broke')
  })

  it('generates requestId per invocation', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const logger = createLogger('test-function')

    logger.info('First call')
    logger.info('Second call')

    const first = JSON.parse(console.log.mock.calls[0][0])
    const second = JSON.parse(console.log.mock.calls[1][0])

    // Same invocation = same requestId
    expect(first.requestId).toBe(second.requestId)

    // Reset for next invocation
    resetRequestId()
    logger.info('Third call')
    const third = JSON.parse(console.log.mock.calls[2][0])
    expect(third.requestId).not.toBe(first.requestId)
  })

  it('accepts custom requestId in meta', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const logger = createLogger('test-function')
    const customId = 'custom-req-id-123'

    logger.info('Custom ID test', { requestId: customId })

    const entry = JSON.parse(console.log.mock.calls[0][0])
    expect(entry.requestId).toBe(customId)
  })
})

describe('PII sanitization', () => {
  it('sanitizes email addresses', () => {
    expect(log.sanitize('user@gmail.com')).toBe('u***@gmail.com')
    expect(log.sanitize('john.doe@company.org')).toBe('j***@company.org')
  })

  it('sanitizes wallet addresses', () => {
    const wallet = 'GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4'
    expect(log.sanitize(wallet)).toBe('****7UPS4')
  })

  it('sanitizes CLABE numbers', () => {
    const clabe = '646180123456789012'
    expect(log.sanitize(clabe)).toBe('****9012')
  })

  it('does not modify UUIDs', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    expect(log.sanitize(uuid)).toBe(uuid)
  })

  it('sanitizes known PII fields in objects', () => {
    const obj = {
      email: 'user@gmail.com',
      depositClabe: '646180123456789012',
      walletAddress: 'GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4',
      userId: '123',
      amount: 500,
    }

    const sanitized = log.sanitizeObject(obj)

    expect(sanitized.email).toBe('u***@gmail.com')
    expect(sanitized.depositClabe).toBe('****9012')
    expect(sanitized.walletAddress).toBe('****7UPS4')
    expect(sanitized.userId).toBe('123')
    expect(sanitized.amount).toBe(500)
  })

  it('recursively sanitizes nested objects', () => {
    const nested = {
      order: {
        orderId: 'abc-123',
        email: 'user@gmail.com',
      },
      user: {
        walletAddress: 'GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4',
      },
    }

    const sanitized = log.sanitizeObject(nested)

    expect(sanitized.order.email).toBe('u***@gmail.com')
    expect(sanitized.user.walletAddress).toBe('****7UPS4')
  })
})

describe('generateRequestId', () => {
  beforeEach(() => {
    resetRequestId()
  })

  it('returns a valid UUID format', () => {
    const id = generateRequestId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('returns same ID within same invocation', () => {
    const id1 = generateRequestId()
    const id2 = generateRequestId()
    expect(id1).toBe(id2)
  })

  it('returns different ID after reset', () => {
    const id1 = generateRequestId()
    resetRequestId()
    const id2 = generateRequestId()
    expect(id1).not.toBe(id2)
  })
})
