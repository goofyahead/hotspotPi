var express = require('express');
var app = express();
var ping = require('net-ping');
var session = ping.createSession ();
var config = require('./config');
var HOTSPOTMODE = "HOTSPOTMODE";
var redis = require("redis"),
redisClient = redis.createClient();
var colors = require ('colors');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var favicon = require('static-favicon');
// Twilio Credentials 
var accountSid = 'AC0b488ea0c7b3e3cd4c698077cbf31c64'; 
var authToken = '231599f9c72806e6853b1f514e1e2e1f'; 
//require the Twilio module and create a REST client 
var client = require('twilio')(accountSid, authToken);

setTimeout(function () {
	//check if its on hotstpot mode
	redisClient.get(HOTSPOTMODE, function (err, value) {
		console.log("reply: ");
		console.log(value);
		console.log('end reply.');
		if (err) throw err;
		if (value && value == 1) {
			console.log('STARTING SERVER FOR CONFIG NETWORK');
			// in hotspot mode wait for config and reboot on click
			setUpServer();
		} else {
			console.log('CHECKING CONNECTION');
			// if not in hotspot, check if internet, if not internet go to hotspot and reboot
			session.pingHost ('8.8.8.8', function (error, target) {
				if (error) {
					console.log('No internet, changing files and rebooting on HOTSPOT'.green);
					config.toHotspot();
				}
				else {
					console.log('RASPBERRY PI ONLINE'.green);
					console.log (target + ": Alive");

					var myLocalIp = '';
					var os = require( 'os' );
					var networkInterfaces = os.networkInterfaces( );

					for (property in networkInterfaces) {	
						for (var x = 0; x < networkInterfaces[property].length; x++){
							if (networkInterfaces[property][x].internal == false && networkInterfaces[property][x].family == 'IPv4'){
								myLocalIp = networkInterfaces[property][x].address;
								console.log('Current ip is: ' + myLocalIp);
							}
						}
					}

					// notify local ip
					client.messages.create({
						from: "+14156914520",
						to: "+34626292957",
						body: "my new local Ip is: " + myLocalIp
					}, function(err, message) {
						if (! err) {
							console.log("message sent: ".green + message.sid); 
						}else {
							console.log(error);
						}
					});
					setUpServer();
				}
			});
		}
	});
}, 10000);

function setUpServer() {
	app.set('views', __dirname + '/views');
	app.use(favicon());

	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded());
	app.use(cookieParser());
	app.engine('.html', require('ejs').renderFile);
	app.set('view engine', 'html');
	app.use(express.static(__dirname + '/public'));

	var multipart = require('connect-multiparty');
	var multipartMiddleware = multipart();

	app.post('/upload', multipartMiddleware, function (req, res) {
		console.log('call received');
		var video = req.files;
		console.log(video);
		res.status(200).end();
		//delete all temp files!
	});

	app.post('/config', function (req, res) {
		var crypto = require('crypto');

		var ssid = req.param('ssid');
		var password = req.param('pass');
		var host = req.param('host');
		var username = req.param('username');
		var userpass = req.param('userpass');
		var shashum = crypto.createHash('sha256');
		var content = username + ":" + userpass;
		
		var cyphered = shashum.update(content).digest('hex');

		console.log(cyphered);

		redisClient.set('HOSTADDRESS', host);
		redisClient.set('HASH', cyphered);

		if (ssid) {	
			console.log('configuration received: '.yellow + password + ' ssid ' + ssid);
			config.toConnected(ssid, password);
		} else {
			console.log('just saving host and client.'.yellow);
		}

		res.render('saving');
	});

	app.get('/', function (req, res){
		res.render('form');
	});

	app.listen(3000);
}

