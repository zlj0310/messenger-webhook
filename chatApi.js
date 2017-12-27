var qs = require('query-string'),
	request = require('request');
	baseUrl = 'http://54.193.78.39:8080'; //54.183.188.28


var Chat = {
	/*senderId, recipientId, time, ftype, type, content, sUrl, sLocation*/
	"msgLog": function(data){
		request.post(baseUrl+'/logs/messageAdd?'+qs.stringify(data)).on('error',function(err) {
			console.log('error: /logs/messageAdd ',err)
		})
	},
	//图片消息 更换请求URL
	"handleImgUrl": function(url,cb){
		url = new Buffer(url).toString('base64'); 
		request(baseUrl+'/fb/message/convertImgUrl?url='+url, function (error,response, body) {
			if(!error && response.statusCode == 200) {
				cb(JSON.parse(body).data)
			}else{
				console.log('error: /fb/message/convertImgUrl', error); 
				console.log('statusCode:', body); 
			}
		})
	}
	
}

module.exports = Chat;