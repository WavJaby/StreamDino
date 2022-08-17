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

// client data
const clientID = '8z8uiiczsmbkdnfaqjgza8pgy2fpnp';
const endpointURL = 'wss://irc-ws.chat.twitch.tv:443';
const username = 'WavJaby\'s_Bot';
let client;
let token;
let retryTimer;
let timeout;
let requestHeader;
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
 * @param accessToken {string}
 * @param timeoutTime {number}
 * @return void
 */
function startListen(accessToken, timeoutTime) {
	if (accessToken)
		token = accessToken;
	if (timeoutTime)
		timeout = timeoutTime;

	requestHeader = {
		'Authorization': `Bearer ${accessToken}`,
		'Client-Id': clientID
	};

	// check if connected
	retryTimer = setInterval(() => {
		if (client)
			client.close();
	}, timeout);
	connectToTwitch(accessToken, retryTimer);
}

function connectToTwitch() {
	client = new WebSocket(endpointURL);
	client.on('open', onOpen);
	client.on('close', onClose);
	client.on('message', onMessage);
}

function onOpen() {
	console.log('Client connected');

	client.send('CAP REQ :twitch.tv/membership twitch.tv/tags twitch.tv/commands');
	client.send(`PASS oauth:${token}`);
	client.send(`NICK ${username}`);
	// stop timer
	clearInterval(retryTimer);
}

function onClose() {
	console.log('Client closed');
	client.removeEventListener('open', onOpen);
	client.removeEventListener('close', onClose);
	client.removeEventListener('message', onMessage);
	client = null;

	// reconnect
	const reconnectTime = 1000;
	console.log(`Reconnect in ${reconnectTime}sec`);
	setTimeout(startListen, reconnectTime);
}

function onMessage(data) {
	data = data.data ? data.data : data.toString();
	if (data.endsWith('\r\n'))
		data = data.slice(0, data.length - 2);
	data = data.split('\r\n');
	for (const message of data) {
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
		} else
			console.log(`"${message}"`);
	}
}

function getChannelEmote(broadcasterID) {
	const emotes = {};
	return fetch(
		`https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${broadcasterID}`,
		{headers: requestHeader})
		.then(i => i.json())
		.then(i => Promise.all(i.data.map(j => ((j = loadEmote(j)) && (emotes[j.name] = j)).loadEmote)) && emotes);
}

function getTwitchEmote() {
	const emotes = {};
	return fetch(
		'https://api.twitch.tv/helix/chat/emotes/global',
		{headers: requestHeader})
		.then(i => i.json())
		.then(i => Promise.all(i.data.map(j => ((j = loadEmote(j)) && (emotes[j.name] = j)).loadEmote)) && emotes);
}

function loadEmote(data) {
	let imgUrl;
	for (let i = 0; i < data.scale.length; i++)
		if (data.scale[i] === '2.0') {
			imgUrl = data.images[`url_${data.scale[i][0]}x`];
			break;
		}
	if (!imgUrl)
		imgUrl = data.images[0];

	// load image
	const image = new Image();
	const promise = new Promise(resolve => image.onload = resolve);
	image.src = imgUrl;
	image.crossOrigin = 'Anonymous';

	return {
		id: data.id,
		name: data.name,
		imgUrl: imgUrl,
		img: image,
		loadEmote: promise
	};
}

/**
 * @param option {{clientID:string, scopes:[string], redirectUri: string, [state]: string}}
 * @return {Promise<unknown> | null}
 */
function getAccessToken(option) {
	let authUrl = `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${clientID}&scope=${encodeURIComponent(option.scopes.join(' '))}&redirect_uri=${encodeURIComponent(option.redirectUri)}`;
	if (option.state)
		authUrl += `&state=${encodeURIComponent(option.state)}`;

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
	getChannelEmote,
	getTwitchEmote,
	setOnEvent,
	setOnReady,
	sendMessage,
}