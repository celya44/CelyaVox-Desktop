/**
 * Logger - Système de journalisation dans un fichier
 * Redirige console.log, console.error, etc. vers un fichier de log unique
 * Le fichier est écrasé à chaque démarrage de l'application
 */

const fs = require('fs');
const path = require('path');

class Logger {
  constructor(logDir) {
    this.logDir = logDir;
    // Nom de fichier fixe - toujours le même
    this.logFile = path.join(logDir, 'debug.log');
    
    // Créer le répertoire de logs s'il n'existe pas
    if (!fs.existsSync(this.logDir)) {
      try {
        fs.mkdirSync(this.logDir, { recursive: true });
      } catch (err) {
        console.error(`Erreur création répertoire logs: ${err.message}`);
      }
    }
    
    // Initialiser le fichier de log (écraser le fichier existant)
    this._initializeFile();
  }

  _initializeFile() {
    try {
      // Écraser le fichier avec un nouveau contenu
      fs.writeFileSync(this.logFile, `\n${'='.repeat(80)}\n🚀 Application démarrée à ${new Date().toISOString()}\n${'='.repeat(80)}\n`, 'utf-8');
    } catch (err) {
      console.error(`Erreur initialisation fichier log: ${err.message}`);
    }
  }

  _getTimestamp() {
    return new Date().toISOString();
  }

  _writeToFile(message) {
    try {
      fs.appendFileSync(this.logFile, message + '\n', 'utf-8');
    } catch (err) {
      // Silencieusement, pour éviter une boucle infinie
    }
  }

  _formatMessage(level, args) {
    const timestamp = this._getTimestamp();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    return `[${timestamp}] [${level}] ${message}`;
  }

  log(...args) {
    const formatted = this._formatMessage('INFO', args);
    console.log(formatted);
    this._writeToFile(formatted);
  }

  error(...args) {
    const formatted = this._formatMessage('ERROR', args);
    console.error(formatted);
    this._writeToFile(formatted);
  }

  warn(...args) {
    const formatted = this._formatMessage('WARN', args);
    console.warn(formatted);
    this._writeToFile(formatted);
  }

  info(...args) {
    const formatted = this._formatMessage('INFO', args);
    console.info(formatted);
    this._writeToFile(formatted);
  }

  debug(...args) {
    const formatted = this._formatMessage('DEBUG', args);
    console.log(formatted);
    this._writeToFile(formatted);
  }

  getLogFilePath() {
    return this.logFile;
  }

  getLogDirectory() {
    return this.logDir;
  }
}

module.exports = Logger;
