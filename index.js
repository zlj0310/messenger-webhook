const 
	fs   = require('fs'),
	url  = require('url'),
	path = require('path'),
	http = require('http'),
	request = require('request'),
	express = require('express'),
	bodyParser = require('body-parser'),
	app = express().use(bodyParser.json()),
	server = http.createServer(app),
	port = process.env.PORT || 1337;
	
const Chat = require('./chatApi');
const logger = require('./log');

const msgType = {
	"text": 1,
	"image": 2,
	"file": 3,
	"location": 4,
	"video": 5,
	"fallback": 6,
	"audio": 7
}

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

const io = require('socket.io')(server,{pingTimeout: 60000}); //, 
var ioStatus = false;

//JSON.stringify();
var usocket = {},user = [];
var IoSocket = null;


io.on('connection', (socket) => {
	IoSocket = socket;
	ioStatus = true;
	//成员对象数组

	socket.on('new user', (username) => {
		if(!(username in usocket)) {
			socket.username = username;
			usocket[username] = socket;
			user.push(username);
			socket.emit('login',user);	
		}
		
	})

	socket.on('send private message', function(res){
		
		logger.info(JSON.stringify(res))
		/*if(res.recipient in usocket) {
			usocket[res.recipient].emit('receive private message', res);
		}*/
		//TODO 调用messenger平台发送消息API
		
		let request_body = {
			"messaging_type": "RESPONSE", //UPDATE
			"recipient": {
				"id": res.recipient
			},
			"message": res.body.message
		}
		
		// Send the HTTP request to the Messenger Platform
		request({
			"uri": "https://graph.facebook.com/v2.6/me/messages",
			"qs": { "access_token": res.access_token },
			"method": "POST",
			"json": request_body
		}, (err, response, body) => {
			if (!err) {
				
				logger.info(JSON.stringify(body))
				//fb message消息日志收集
				Chat.msgLog({senderId: res.addresser, recipientId: res.recipient, time: res.time, ftype: 0, type: '1', content: res.body.message.text});
			 } else {
				logger.error("Unable to send message:" + err);
			 }
		});
	});

	socket.on('disconnect', function(){
		//移除
		if(socket.username in usocket){
			delete(usocket[socket.username]);
			user.splice(user.indexOf(socket.username), 1);
		}
		//console.log('disconnect-- ',user);
	})
	

});


app.post('/webhook',(req, res) => {

    let body = req.body;
    if (body.object === 'page') {
	body.entry.forEach(function(entry) {
	    //console.log('-----entry',JSON.stringify(entry))
	    if(!entry.messaging) {
			return false;
        }	
		
        let data = entry.messaging[0];	    
	    if(!data.message) {
			return false;
        }
	    //Get the sender PSID
	    let sender_psid = data.sender.id;
		let recipient_id = data.recipient.id;

	    if (data.message) {
			handleMessage(data);        
 	    } else if (data.postback) {
    		handlePostback(data);
  	    }
		
		
	});
    
        res.status(200).send('EVENT_RECEIVED');	
    } else {
		res.sendStatus(404)
    }
});

app.get('/webhook', (req, res) => {

  // Your verify token. Should be a random string.
  let VERIFY_TOKEN = "shop.onloon.net";
    
  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
    
  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
  
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
});

// Handles messages events
function handleMessage(webhook_event) {
	let response;
	let data = {
			senderId: webhook_event.sender.id, 
			recipientId: webhook_event.recipient.id, 
			time: webhook_event.timestamp, 
			ftype: 1
		};
	let isImage = false;	
  	// Check if the message contains text
 	if (webhook_event.message.text) {    
		data.type = '1';
		data.content = webhook_event.message.text;
   	    // Create the payload for a basic text message
   	    response = {
     	        "text": webhook_event.message.text
   	    }
 	} else if(webhook_event.message.attachments) {
	    let attachment_url = webhook_event.message.attachments[0].payload.url;
		webhook_event.message.attachments[0].type == 'image' ? isImage = true : null;
		
		response = {
			"attachment": {
				"type": webhook_event.message.attachments[0].type,
				"payload": {
					//"template_type": "generic",
					"url": attachment_url, 
					"is_reusable": true
				}
			}
	    }
		data.type = msgType[webhook_event.message.attachments[0].type];
		data.url = 	attachment_url;
		data.content = '';
		data.type == '4' ? 	data.location=['','']: null;
		
		if(isImage) {
			Chat.handleImgUrl(webhook_event.message.attachments[0].payload.url,function(newUrl){
				response.attachment.payload.url = newUrl;
				data.url = newUrl;
				Chat.msgLog(data); 
				callSendAPI(response, webhook_event); 
			})
		}
		
	    
			
	}
	
	if(!isImage) {
		// fb message消息日志收集
		Chat.msgLog(data); 
	  
		// Sends the response message
		callSendAPI(response, webhook_event);    

	}	
	

}

// Handles messaging_postbacks events
function handlePostback(webhook_event) {
    let response;
  
    // Get the payload for the postback
    let payload = webhook_event.postback.payload;

    // Set the response based on the postback payload
    if (payload === 'yes') {
        response = { "text": "Thanks!" }
    } else if (payload === 'no') {
        response = { "text": "Oops, try sending another image." }
    }
    // Send the message to acknowledge the postback
    callSendAPI(response, webhook_event);
}

// Sends response messages via the Send API
function callSendAPI(response, webhook_event) {
    let request_body = {
        "message": response
    }
	
	if(ioStatus) {
		//TODO psid 匹配到客户端用户
		let res = {
			"addresser": webhook_event.sender.id, //Yawei Xu "1818692198201481"
			"recipient": webhook_event.recipient.id, //Hongxiang Ling "307779999647060"
			"time": webhook_event.timestamp,
			"body": request_body
		}
		
		if(res.recipient in usocket) {
			console.log('send to b2c-shop')
			usocket[res.recipient].emit('receive private message', res);				
		}
	}

}
