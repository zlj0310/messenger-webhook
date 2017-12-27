const log4js = require('log4js');

log4js.configure(
  {
    appenders: {
      /*file: {
        type: 'file',
        filename: './logs/seller-send-msg.log',
        maxLogSize: 100 * 1024 * 1024, // = 100Mb
        numBackups: 5, // keep five backup files
        compress: true, // compress the backups
        encoding: 'utf-8',
        mode: 0o0640,
        flags: 'w+'
      },*/
      dateFile: {
        type: 'dateFile',
        filename: './logs/seller-send-msg',
		alwaysIncludePattern: true,
        pattern: '-yyyy-MM-dd',
        compress: true
      },
      out: {
        type: 'stdout'
      }
    },
    categories: {
      default: { appenders: ['dateFile', 'out'], level: 'trace' }
    }
  }
);

const logger = log4js.getLogger('hook');

module.exports = logger;