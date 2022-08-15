const WebSocket = require('ws');
const {parseMessage, Command} = require('./messageParser.js');
// !!EXCLUDE_IN_WEB
const path = require('path');
// !!EXCLUDE_IN_WEB
const fs = require('fs');
// !!EXCLUDE_IN_WEB
const https = require('https');
// !!EXCLUDE_IN_WEB
const {parse: urlPars} = require('url');

const client = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

const username = 'WavJaby\'s_bot';

// event listener
let onReady = null, onEvent = null;

/**
 * @param listener {function}
 * */
function setOnEvent(listener) {onEvent = listener}

/**
 * @param listener {function}
 * */
function setOnReady(listener) {onReady = listener}

/**
 * @param msg {string}
 * */
function sendMessage(msg) {
	// console.log(`Send: ${msg}`)
	client.send(msg);
}

/**
 * @param key {{accessToken: String, clientID?: String}}
 * @return void
 */
function startListen(key) {
	client.on('open', function () {
		console.log('Client connected');

		client.send('CAP REQ :twitch.tv/membership twitch.tv/tags twitch.tv/commands');
		client.send(`PASS oauth:${key.accessToken}`);
		client.send(`NICK ${username}`);
	});

	client.on('close', function () {
		console.log('Client closed');
	});

	client.on('message', function (data) {
		data = data.data ? data.data : data.toString();
		if (data.endsWith('\r\n'))
			data = data.slice(0, data.length - 2);
		data = data.split('\r\n');
		for (const message of data) {
			console.log(`"${message}"`);
			const event = parseMessage(message);
			if (event.command.type === Command.LOGIN) {
				console.log('Login successful');
				if (onReady) onReady(event);
			} else if (event.command.type === Command.PING)
				client.send('PONG ' + event.parameters);
			else if (event.command.type === Command.NOTICE) {
				console.log(`Twitch notice from channel "${event.command.channel}", message: ${event.parameters}`);
			} else if (event.command.type < 1000) {
				if (onEvent) onEvent(event);
			}
		}
	});
}

/**
 * @param option {{clientID:String, scopes:[String], redirectUri: String, [state]: String}}
 * @return {Promise<unknown> | null}
 */
function getAccessToken(option) {
	let authUrl = `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${option.clientID}&scope=${encodeURIComponent(option.scopes.join(' '))}&redirect_uri=${encodeURIComponent(option.redirectUri)}`;
	if (option.state)
		authUrl += `&state=${option.state}`;

	// for web
	if (window) {
		window.open(authUrl, '_self');
		return null;
	}
	// for back end
	const openCommand = process.platform === 'darwin' ? 'open ' : process.platform === 'win32' ? 'start ' : 'xdg-open ';
	const url = (process.platform === 'darwin' || process.platform === 'win32')
		? authUrl.replaceAll('&', '^&')
		: authUrl.replaceAll('&', '\\&')
	// !!EXCLUDE_IN_WEB
	require('child_process').exec(openCommand + url);

	const ssh = {};
	const serverPathRoot = path.resolve(__dirname, '..', 'conf', 'server');
	if (fs.existsSync(serverPathRoot + '.crt') && fs.existsSync(serverPathRoot + '.key')) {
		ssh.cert = fs.readFileSync(serverPathRoot + '.crt');
		ssh.key = fs.readFileSync(serverPathRoot + '.key');
	}

	return new Promise(resolve => {
		const server = https.createServer(ssh, function (req, res) {
			const urlInfo = urlPars(req.url);
			if (urlInfo.pathname === '/data') {
				res.writeHead(200);
				res.end();
				resolve(Object.fromEntries(urlInfo.query.split('&').map(i => i.split('=').map(decodeURIComponent))));
				server.close();
			} else
				try {
					res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
					res.end('<!DOCTYPE html><html lang="en"><body><script>fetch(`/data?${window.location.hash.slice(1)}`,{keepalive: true});window.close();</script></body></html>');
				} catch (e) {
					res.writeHead(404);
					res.end();
				}
		});
		server.listen(443, 'localhost');
	});
}

module.exports = {
	startListen,
	getAccessToken,
	setOnEvent,
	setOnReady,
	sendMessage,
}