import winston from 'winston';

class Logger {
  constructor() {
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
      })
    );

    this.logger = winston.createLogger({
      level: 'info',
      format: logFormat,
      transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
      ],
    });

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.simple(),
      }));
    }
  }

  info(message) {
    this.logger.info(message);
  }

  // Added warn method to resolve the error in your middleware
  warn(message) {
    this.logger.warn(message);
  }

  error(message) {
    this.logger.error(message);
  }

  // Morgan requires a stream object with a write function
  get stream() {
    return {
      write: (message) => this.info(`API Hit: ${message.trim()}`)
    };
  }
}

// Export a single instance (Singleton pattern)
export default new Logger();