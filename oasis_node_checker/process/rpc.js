const cfg = require('dotenv').config({ path: './config' }).parsed //load config file
const exec = require('child_process').execSync

//memory
const getRpcHeight = (async () => {
	let cmd = `curl -s '${cfg.EXTERN_RPC_URL}/api/consensus/block?name=Provalidator' | jq '.result.height' | tr -d '"'`
	let res = await exec(cmd)
	let blockHeight = parseInt(res.toString())
	return blockHeight
})

//convert object to array
const getArrayFromJsonObject = ((json) => {
	let arr = []
	
	for(item in json){
		arr[item] = json[item]
	}
	return arr
})

module.exports = {
	getRpcHeight : getRpcHeight
} 