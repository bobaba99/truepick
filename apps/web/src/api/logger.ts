type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, unknown>
}

const formatLogEntry = (entry: LogEntry): string => {
  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
  return `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${contextStr}`
}

const createLogEntry = (
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): LogEntry => ({
  level,
  message,
  timestamp: new Date().toISOString(),
  context,
})

const isProduction = import.meta.env.PROD

const log = (level: LogLevel, message: string, context?: Record<string, unknown>): void => {
  const entry = createLogEntry(level, message, context)

  if (isProduction) {
    // In production, could send to external logging service
    // For now, use structured console output
    const formatted = formatLogEntry(entry)
    switch (level) {
      case 'error':
        console.error(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      default:
        console.log(formatted)
    }
  } else {
    // In development, use standard console methods
    switch (level) {
      case 'error':
        console.error(message, context ?? '')
        break
      case 'warn':
        console.warn(message, context ?? '')
        break
      case 'info':
        console.info(message, context ?? '')
        break
      default:
        console.log(message, context ?? '')
    }
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
}
