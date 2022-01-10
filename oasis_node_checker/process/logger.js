const cfg = require('dotenv').config({ path: './config' }).parsed //load config file
const log4js = require('log4js')


// logger
log4js.configure({
    appenders: { 
    	'log': { 
			type: 'dateFile', 
			filename: `./log/${cfg.PROJECT_NAME}.log`,
			compress: true
	   	} 
    },
    categories: { 
     	default: { 
     		appenders: ['log'], 
     		level: 'info' 
     	} 
    }
})

module.exports = {
	log4js : log4js.getLogger('log')
}