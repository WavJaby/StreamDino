const {Command} = require('./messageParser');
const key = require('./key.json');
const {
	startListen,
	setOnReady,
	setOnEvent,
	sendMessage
} = require('./twitch');

// twitch
const usersData = {};

function onReady() {
	// console.log(e);
	sendMessage('JOIN #wavjaby');
}

function onEvent(e) {
	if (e.command.type !== Command.PRIVMSG) return;

	const userData = usersData[e.source.nick] = {
		color: e.tags.color,
		displayName: e.tags['display-name'],
		userID: e.tags['user-id'],
	};

	const debugObj = JSON.parse(JSON.stringify(e));
	for (const key in Command)
		if (Command[key] === debugObj.command.type) {
			debugObj.command.type = key;
			break;
		}
	console.log(debugObj);
	// if (e.command.command === Command.PRIVMSG) {
	// 	sendMessage(`PRIVMSG ${e.command.channel} :${e.parameters}`);
	// }
}

// init
setOnReady(onReady);
setOnEvent(onEvent);
startListen(key);