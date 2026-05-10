/**
 * Logger Service
 * 
 * Centraliza logging para toda la app
 * Facilita migración a servicios como Sentry, LogRocket, etc.
 */

import * as Sentry from "@sentry/react";

const isDev = import.meta.env.DEV;

/**
 * Niveles de log
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

/**
 * Logger con métodos por nivel
 */
class Logger {
  constructor(name = 'App') {
    this.name = name;
  }

  /**
   * Emitir log con contexto
   * @param {string} level - Nivel de log
   * @param {string} message - Mensaje
   * @param {*} data - Datos adicionales
   */
  #emit(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.name}] [${level.toUpperCase()}]`;

    if (isDev) {
      console.log(`${prefix} ${message}`, data || '');
    }

    if (!isDev && level === LogLevel.ERROR) {
      Sentry.captureException(new Error(message), { extra: data || {} });
    }
  }

  debug(message, data) {
    this.#emit(LogLevel.DEBUG, message, data);
  }

  info(message, data) {
    this.#emit(LogLevel.INFO, message, data);
  }

  warn(message, data) {
    this.#emit(LogLevel.WARN, message, data);
  }

  error(message, data) {
    this.#emit(LogLevel.ERROR, message, data);
  }
}

// Export singleton
export const logger = new Logger('NoSee');

export default logger;
