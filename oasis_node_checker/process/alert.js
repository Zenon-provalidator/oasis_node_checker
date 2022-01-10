const cfg = require('dotenv').config({ path: './config' }).parsed //load config file
const exec = require('child_process').exec
const logger = require('./logger').log4js

// Send to Telegram Message
const sendMSG = ((msg) => {
	const telegraf = require('telegraf')
	const bot = new telegraf(cfg.TELEGRAM_BOT_TOKEN)
	let title = `[${cfg.PROJECT_NAME}-${cfg.SERVER_TYPE}-${cfg.SERVER_NAME}]`
	let message= `${title}\n${msg}`
	
	bot.telegram.sendMessage(cfg.TELEGRAM_BOT_ROOM, message)
	.then(()=>{
		logger.info(message)
	})
	.catch((err)=>{
		logger.error(err)
		Bot.telegram.sendMessage(cfg.TELEGRAM_BOT_ROOM, `${title} [Error] ${err}`)
	})	
})

// unavailabled only US or CA
const sendSMS = ((contents) => {
	const phoneNumbers = cfg.PROJECT_MANAGER_PHONNUM.split(',')
	
	phoneNumbers.forEach((phoneNumber)=>{
		let cmd = `curl -s -d "to=%2B${phoneNumber}" -d "body=${contents}" https://utils.api.stdlib.com/sms@2.0.0/`
		logger.info(cmd)
		
		exec(cmd, (error, stdout, stderr) => {			
			if(error){
				logger.error(`sms sent.\n${error}`)
			}else{
				let json = JSON.parse(stdout)
				
				logger.info(`sms sented, json Start---------`)
				logger.info(json)
				logger.info(`sms sented, json End---------`)
				
				if(json.status !== 'sent'){
					logger.error('sms sented, but status is bad.')
					logger.error(error)
				}
			}
		})
	})
})

module.exports = {
	sendSMS : sendSMS,
	sendMSG : sendMSG
}