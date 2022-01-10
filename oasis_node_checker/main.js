const cfg = require('dotenv').config({ path: './config' }).parsed //load config file
const logger = require('./process/logger').log4js
const alert = require('./process/alert')
const server = require('./process/server')
const rpc = require('./process/rpc')
const telegramBot = require('./process/telegram_bot')
const CronJob = require('cron').CronJob

// global variable
let memAlertCnt = 0
let cpuAlertCnt = 0
let diskAlertCnt = 0
let peerAlertCnt = 0
let lcdAlertCnt = 0
let checkedBlockHeight = 0
let missedBlockHeight = 0
let validatorConnectTryCnt = 0
let botStatusFlag = false
let executeCnt = 0
let blockCheck = [] // block check height array

//curl -s 'http://localhost:8080/api/consensus/block?name=Provalidator' | jq '.result.height' | tr -d '"'
//curl -s 'http://localhost:8080/api/consensus/blocklastcommit?name=Provalidator' | grep B9582118624D1FD1F07E060F4B76939AE42F79C8 | wc -l

const botJob = new CronJob(`*/10 * * * * *`, async function () {
	let mem = await server.getMemoryUsage()
	let cpu = await server.getCpuUsage()
	let disk = await server.getDiskUsage()
	let peer = await server.getPeerCount()
	let blockHeight = await server.getBlockHeight()
	let checkDialPort = await server.checkDialPort()
	let checkLcdPort = false
	let checkValidatorConnect = false
	let checkValidatorSign = await server.checkValidatorSign()
	
	logger.info(`mjb ${checkValidatorSign}`)
	
	telegramBot.setVariables({
		mem : mem,
		cpu : cpu,
		disk : disk,
		peer : peer,
		blockHeight : blockHeight
		//rpcHeight : rpcHeight		
	})
	// memory check
	if(mem > parseFloat(cfg.SERVER_ALERT_MEMORY)) {
		if(memAlertCnt == 0){
			alert.sendMSG(`ALERT! Memory usesage is ${mem}% (${cfg.SERVER_ALERT_MEMORY}%)`)
		} 
		
		memAlertCnt = memAlertCnt < cfg.SERVER_ALERT_MEMORY_WAIT ? memAlertCnt + 1 : 0 
//		logger.info(`memAlertCnt : ${memAlertCnt}`)
	}
	
	// cpu check
	if(cpu > parseFloat(cfg.SERVER_ALERT_CPU)) {
		if(cpuAlertCnt == 0){
			alert.sendMSG(`ALERT! Cpu usesage is ${cpu}% (${cfg.SERVER_ALERT_CPU}%)`)
		} 
		
		cpuAlertCnt = cpuAlertCnt < cfg.SERVER_ALERT_CPU_WAIT ? cpuAlertCnt + 1 : 0 
//		logger.info(`cpuAlertCnt : ${cpuAlertCnt}`)
	}
	
	// disk check
	if(disk > parseFloat(cfg.SERVER_ALERT_DISK)) {
		if(diskAlertCnt == 0){
			alert.sendMSG(`ALERT! Disk usesage is ${disk}% (${cfg.SERVER_ALERT_DISK}%)`)
		} 
		
		diskAlertCnt = diskAlertCnt < cfg.SERVER_ALERT_DISK_WAIT ? diskAlertCnt + 1 : 0 
//		logger.info(`diskAlertCnt : ${diskAlertCnt}`)
	}
	
	// peer check
	if(peer < parseFloat(cfg.SERVER_ALERT_PEER)) {
		if(peerAlertCnt == 0){
			alert.sendMSG(`ALERT! Peer count is ${peer} (${cfg.SERVER_ALERT_PEER}%)`)
		} 
		
		peerAlertCnt = peerAlertCnt < cfg.SERVER_ALERT_PEER_WAIT ? peerAlertCnt + 1 : 0 
//		logger.info(`peerAlertCnt : ${peerAlertCnt}`)
	}
	
	// block height check
	blockCheck[executeCnt] = blockHeight
	let heightDiff = blockCheck[executeCnt] - blockCheck[executeCnt-1]

//	logger.info(`executeCnt:${executeCnt}`)
//	logger.info(`blockCheck.length:${blockCheck.length}`)

	if(blockCheck.length > 1){ //need history
		if(heightDiff > cfg.SERVER_ALERT_BLOCK_ERROR_RANGE){ // server block height is abnormal
			let rpcHeight = await rpc.getRpcHeight()
			//block height smaller than extern block height
			if(blockCheck[executeCnt] < rpcHeight -1 ){
				alert.sendMSG(`ALERT! Server height is abnormal.\n${cfg.RPC_URL}/status\nExtern=${rpcHeight.toLocaleString()}\nDiff=${heightDiff.toLocaleString()}\nCurrentblockheight=${blockCheck[executeCnt].toLocaleString()}\nPreblockheight=${blockCheck[executeCnt-1].toLocaleString()}`)
			}
		} else {
			let rpcHeight = await rpc.getRpcHeight()
			if(blockCheck[executeCnt] === blockCheck[executeCnt-1] === blockCheck[executeCnt-2] === blockCheck[executeCnt-3] === blockCheck[executeCnt-4]){ //chain is stop
				alert.sendMSG(`ALERT! Maybe chain is down.\n${cfg.RPC_URL}/status\nExtern=${rpcHeight.toLocaleString()}\nDiff=${heightDiff.toLocaleString()}\nCurrentblockheight=${blockCheck[executeCnt].toLocaleString()}\nPreblockheight=${blockCheck[executeCnt-1].toLocaleString()}`)
			}else{
				// normal
//				logger.info(`Diff=${heightDiff.toLocaleString()}\nCurrentblockheight=${blockCheck[executeCnt].toLocaleString()}\nPreblockheight=${blockCheck[executeCnt-1].toLocaleString()}`)
			}
		}
	}
	
	// validator connect check
	if(cfg.SERVER_TYPE == 'validator'){
		// sign check
		if(checkValidatorSign === false && blockHeight > missedBlockHeight) {
			missedBlockHeight = blockHeight
			alert.sendMSG(`ALERT! Height ${blockHeight.toLocaleString()} is missed.\n${cfg.EXTERN_EXPLORER}/blocks/${blockHeight}`)
		}
	} else if(cfg.SERVER_TYPE == 'lcd'){//lcd
		//nothing
	}else { //sentry
		if(cfg.CHECK_VALIDATOR_CONNECT == 'true'){
			checkValidatorConnect = await server.checkValidatorConnect()
			if (checkValidatorConnect === false) {
				if(checkDialPort) {
					if(validatorConnectTryCnt == 0){
//						alert.sendMSG(`ALERT! Validator is not connected. Try connect validator.`)
						logger.warn(`ALERT! Validator is not connected. Try connect validator.`)
						await server.connectValidator()
//						let connectValidator = await server.connectValidator()
						
//						if(connectValidator === false){
//							alert.sendMSG(`ALERT! Validator connect fail.`)
//						}
					}
					validatorConnectTryCnt = validatorConnectTryCnt < cfg.SERVER_ALERT_VALIDATORCONNECT_WAIT ? validatorConnectTryCnt + 1 : 0
				} else {
					alert.sendMSG(`ALERT! Dialingport is not opened.`)
				}
			}
		}
	}
	
	// LCD check
	if (cfg.PROJECT_LCD_USE == 'true'){
		checkLcdPort = await server.checkLcdPort()

		if(checkLcdPort === false){
			if(lcdAlertCnt == 0){
				alert.sendMSG(`ALERT! LCD is down.`)
			}
		
			lcdAlertCnt = lcdAlertCnt < cfg.SERVER_ALERT_LCD_WAIT ? lcdAlertCnt + 1 : 0 
		}
	}
		
		
	//	console.log('====================================')
	//	
	//	console.log(`mem : ${mem}`)
	//	console.log(`cpu : ${cpu}`)
	//	console.log(`disk : ${disk}`)
	//	console.log(`peer : ${peer}`)
	//	console.log(`blockHeight : ${blockHeight}`)
	//	console.log(`rpcHeight : ${rpcHeight}`)
	//	console.log(`checkDialPort : ${checkDialPort}`)
	//	console.log(`checkLcdPort : ${checkLcdPort}`)
	//	console.log(`checkValidatorConnect : ${checkValidatorConnect}`)
	//	console.log(`checkValidatorSign : ${checkValidatorSign}`)
	//	
	//	console.log('====================================\n\n')
		
	executeCnt = executeCnt < 5 ? executeCnt + 1 : 0 //execute count history limit 5   
})//.start()

const botStart = (() => {
	botJob.start()
	botStatusFlag = true
})

const botStop = (() => {
	botJob.stop()
	botStatusFlag = false
})

const botStatus = (() => {
	return botStatusFlag
})

module.exports = {
	botStart : botStart,
	botStop : botStop,
	botStatus : botStatus
}
