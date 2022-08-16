'use strict';

const perf = window.performance;
let frameCount, nowFps;
let canvasWidth, canvasHeight;

let lastXBlockCount, lastYBlockCount, xBlocks;
const userDino = {};
let order = [];
let dinoCount = 0;

async function initVariable(res, stateData, Twitch) {
	// get token data
	let hashString = window.location.hash.length === 0
		? null
		: Object.fromEntries(window.location.hash.slice(1).split('&').map(i => i.split('=').map(decodeURIComponent)));
	window.location.hash = '';

	// get state
	const queryString = window.location.search.length === 0
		? null
		: window.location.search.slice(1);

	// if token data not given
	if (!hashString) {
		hashString = localStorage.getItem('tokenData');
		if (hashString) {
			hashString = JSON.parse(hashString);
			// validating token
			const validate = await fetch('https://id.twitch.tv/oauth2/validate', {headers: {Authorization: `OAuth ${hashString.access_token}`}})
				.then(i => i.ok ? i.json() : null);
			// is valid
			if (validate) {
				// change settings
				if (queryString)
					hashString.state = queryString;
			}
			// is not valid
			else
				hashString = null;
		}
	}

	// no state given and token data not valid
	if (!hashString && !queryString) {
		window.open('settings.html', '_self');
		return null;
	}

	// if no token data
	if (!hashString) {
		Twitch.getAccessToken({
			clientID: '8z8uiiczsmbkdnfaqjgza8pgy2fpnp',
			redirectUri: window.location.origin + window.location.pathname,
			scopes: [
				'chat:read',
			],
			state: queryString
		})
		return null;
	}

	// read and store token data
	localStorage.setItem('tokenData', JSON.stringify(hashString));
	stateData.accessToken = hashString.access_token;
	stateData.settings = Object.fromEntries(hashString.state.split('&').map(i => i.split('=').map(decodeURIComponent)));
}

/**
 * Twitch listener
 * @param res
 * @param Twitch
 * @param stateData
 * @param Command
 */
function linkTwitch(res, stateData, Twitch, Command) {
	const usersData = {};
	const settings = stateData.settings;
	console.log(settings);

	function onReady() {
		Twitch.sendMessage(`JOIN #${settings.joinChannel}`);
	}

	function onEvent(e) {
		if (e.command.type !== Command.PRIVMSG) return;

		const userData = usersData[e.source.nick] = {
			color: e.tags.color,
			displayName: e.tags['display-name'],
			userID: e.tags['user-id'],
		};

		// give random color if user don't have
		if (!userData.color)
			userData.color = '#' + ((Math.random() * 0xFFFFFF) | 0).toString(16);

		// create Dino
		let dino;
		if (!(dino = userDino[userData.userID])) {
			const dinoScale = (Math.random() * settings.maxDinoScale + 1) | 0;
			dino = userDino[userData.userID] = new Dino(Math.random() * canvasWidth, canvasHeight * 0.1, dinoScale, userData.displayName, userData.color, res, Math.random());
			dino.id = dinoCount++;
			dino.lastPos = -1;
		}
		dino.say(e.parameters, 5);
		if (dino.lastPos !== -1)
			order[dino.lastPos] = null;
		dino.lastPos = order.length;
		order.push(dino);

		// // debug
		// const debugObj = JSON.parse(JSON.stringify(e));
		// for (const key in Command)
		// 	if (Command[key] === debugObj.command.type) {
		// 		debugObj.command.type = key;
		// 		break;
		// 	}
		// console.log(debugObj);
	}

	Twitch.setOnReady(onReady);
	Twitch.setOnEvent(onEvent);
	Twitch.startListen(stateData.accessToken, 1000);
}

async function initResource(res) {
	const startTime = perf.now();
	await loadImageSlice(res, 'res/dino.png');
	const settingBtn = document.createElement('a');
	settingBtn.className = 'settingBtn';
	settingBtn.href = './settings.html';
	const settingIcon = await require('res/setting_icon.svg');
	settingBtn.appendChild(settingIcon);
	document.body.appendChild(settingBtn);

	console.log(`Assets load in: ${(perf.now() - startTime).toFixed(2)}ms`);
}

function drawFrame(res, canvas) {
	const blockScale = 2;

	// ground
	const blockWidth = 32;
	const blockHeight = 32;
	const xBlockCount = (1 + canvasWidth / blockWidth * blockScale) | 0;
	const yBlockCount = (1 + canvasHeight / blockHeight * blockScale) | 0;
	const ground = res.ground;

	// resize
	if (lastXBlockCount !== xBlockCount || lastYBlockCount !== yBlockCount) {
		lastXBlockCount = xBlockCount;
		lastYBlockCount = yBlockCount;
		const Random = new RNG(0);
		xBlocks = new Uint8Array(xBlockCount).map(() => Random.nextFloat() * ground.length | 0);
	}

	for (let i = 0; i < xBlocks.length; i++) {
		const piece = ground[xBlocks[i]];
		const width = piece.width * blockScale;
		const height = piece.height * blockScale;
		canvas.drawImage(piece, 0, 0, piece.width, piece.height, width * i, canvas.canvas.height - height, width, height);
	}

	// render dino
	const newOrder = new Array(dinoCount);
	let j = 0;
	for (let i = 0; i < order.length; i++) {
		if (order[i] === null || order[i] === undefined)
			continue;
		order[i].render(canvas);
		newOrder[j++] = order[i];
	}
	order = newOrder;
}


function Dialog(fontSize, borderSize, font, res) {
	const msgBoxTop = res.msgBoxTop;
	const msgBoxBtm = res.msgBoxBtm;
	const msgBoxMid = res.msgBoxMid;
	const msgBoxHdl = res.msgBoxHdl_normal;
	const msgBoxHdlMir = res.msgBoxHdl_xMirror;

	font = `${fontSize}px ${font}`;
	// dialog size
	let borderWidth, borderHeight;
	let dialogCanvas;

	// live change
	let lines, text, textWidth, textHeight;
	let bgColor;
	let lastHandePos, originalX, x, y;
	let needRender = true;
	let showDialog = false;
	let handleFacing = true;

	/**
	 * @param newX {number}
	 * @param newY {number}
	 * @param facing {boolean}
	 */
	function setPosition(newX, newY, facing) {
		if (handleFacing !== facing)
			needRender = true;
		handleFacing = facing;
		originalX = x = newX - (facing ? 0 : borderSize);
		y = newY;

		// keep handle in bound
		if (originalX - borderSize < 0)
			originalX = borderSize;
		else if (originalX + borderSize * 2 > canvasWidth)
			originalX = canvasWidth - borderSize * 2;

		// set origin
		y -= borderHeight + borderSize;
		x -= borderSize;

		// keep border in bound
		if (x < 0)
			x = 0;
		else if (x + borderWidth + borderSize > canvasWidth)
			x = canvasWidth - borderWidth - borderSize;
		x |= 0;
		y |= 0;
		originalX |= 0;
		if (lastHandePos !== originalX - x) {
			lastHandePos = originalX - x;
			needRender = true;
		}
	}

	/**
	 * @param newBgColor {number}
	 */
	function setBackGroundColor(newBgColor) {
		if (newBgColor !== bgColor) {
			bgColor = newBgColor;
			needRender = true;
		}
	}

	/**
	 * @param newText {string|null}
	 */
	function setText(newText) {
		if (!newText) {
			showDialog = false;
		} else if (newText !== text) {
			text = newText;

			// updateText
			lines = text.split(/\r?\n/);
			textWidth = Array.from(lines).map(i => getTextWidth(i, font)).reduce((i, j) => i > j ? i : j);
			textHeight = (fontSize * lines.length) + fontSize * 0.25;
			borderWidth = Math.ceil(textWidth / borderSize + 1) * borderSize;
			borderHeight = Math.ceil(textHeight / borderSize + 1) * borderSize;

			// update canvas
			dialogCanvas = createCanvas(borderWidth + borderSize, borderHeight + borderSize);
			dialogCanvas.fillStyle = 'white';
			dialogCanvas.font = font;

			showDialog = true;
			needRender = true;
		}
	}

	/**
	 * Render dialog
	 * @param canvas {CanvasRenderingContext2D}
	 * @return [x:number, y:number]|null
	 */
	function render(canvas) {
		if (!showDialog) return null;

		if (!needRender) {
			canvas.drawImage(dialogCanvas.canvas, x, y);
			return [x, y];
		}
		// console.log('update dialog box');

		dialogCanvas.clearRect(0, 0, dialogCanvas.canvas.width, dialogCanvas.canvas.height)
		let i;
		// left and right line
		for (i = 0; i < textHeight; i += borderSize) {
			dialogCanvas.drawImage(msgBoxMid[0], 0, borderSize + i, borderSize, borderSize);
			dialogCanvas.drawImage(msgBoxMid[2], borderWidth, borderSize + i, borderSize, borderSize);
		}
		// top and bottom line
		dialogCanvas.drawImage(msgBoxTop[0], 0, 0, borderSize, borderSize);
		dialogCanvas.drawImage(msgBoxBtm[0], 0, borderHeight, borderSize, borderSize);
		for (i = 0; i < textWidth; i += borderSize) {
			dialogCanvas.drawImage(msgBoxTop[1], borderSize + i, 0, borderSize, borderSize);
			dialogCanvas.drawImage(msgBoxBtm[1], borderSize + i, borderHeight, borderSize, borderSize);
		}
		dialogCanvas.drawImage(msgBoxTop[2], borderSize + i, 0, borderSize, borderSize);
		dialogCanvas.drawImage(msgBoxBtm[2], borderSize + i, borderHeight, borderSize, borderSize);

		// handle
		const offsetX = originalX - x;
		dialogCanvas.clearRect(offsetX, borderHeight, borderSize, borderSize);
		dialogCanvas.drawImage(handleFacing ? msgBoxHdl : msgBoxHdlMir, offsetX, borderHeight, borderSize, borderSize);


		// fill background
		const dialogCanvasWidth = dialogCanvas.canvas.width;
		const dialogCanvasHeight = dialogCanvas.canvas.height;
		const imgData = dialogCanvas.getImageData(0, 0, dialogCanvasWidth, dialogCanvasHeight);
		for (let y = 0; y < dialogCanvasHeight; y++) {
			let x, end, start = false;
			// get end
			for (x = dialogCanvasWidth - 1; x > 0; x--) {
				const alpha = imgData.data[(y * dialogCanvasWidth + x) * 4 + 3];
				if (start && alpha === 0) break;
				if (alpha > 0) start = true;
			}
			end = x + 1;
			start = false;
			// get start
			for (x = 0; x < dialogCanvasWidth; x++) {
				const alpha = imgData.data[(y * dialogCanvasWidth + x) * 4 + 3];
				if (start && alpha === 0) break;
				if (alpha > 0) start = true;
			}
			// fill
			for (x; x < end; x++) {
				const i = (y * dialogCanvasWidth + x) * 4;
				imgData.data[i] = (bgColor & 0xFF0000) >> 16;
				imgData.data[i + 1] = (bgColor & 0xFF00) >> 8;
				imgData.data[i + 2] = bgColor & 0xFF;
				imgData.data[i + 3] = 255;
			}
		}
		dialogCanvas.putImageData(imgData, 0, 0);

		// text
		for (let j = 0; j < lines.length; j++)
			dialogCanvas.fillText(lines[j], (borderWidth + borderSize - textWidth) * 0.5, (borderHeight + borderSize - textHeight) * 0.5 + (j + 1) * fontSize);

		canvas.drawImage(dialogCanvas.canvas, x, y);
		needRender = false;
		return [x, y];
	}

	return {render, setPosition, setBackGroundColor, setText};
}

function Dino(initX, initY, dinoScale, name, initColor, res, seed) {
	const cullWidth = 4, cullXLeft = -2, cullYBottom = -5, cullYTop = -4;
	const Random = new RNG(seed);
	const speed = 10 * dinoScale;
	const dialog = new Dialog(20, 16, 'Arial', res);

	const nameFontSize = 15, nameFont = `${nameFontSize}px Arial`, nameWidth = getTextWidth(name, nameFont);

	// for render
	let dinoRes = [], dinoCanvas;
	// transform
	let textureW, textureH,
		x = initX, y = initY,
		vx = 0, vy = 0;
	let facingNormal = true;
	// animation state
	let lastChangeStateFrame = frameCount, nextStateDelay;
	let lastBlinkFrame = frameCount, nextBlinkDelay, blinked = false;
	let lastMoveChangeFrame = frameCount, moveChangeDelay, moveChangeState = 0;
	// moving state
	let lastState = 0;
	let dinoColor;
	// dialog
	let lastDialogFrame = frameCount, dialogCloseDelay = -1;

	function setDinoColor(colorHex) {
		dinoColor = parseInt(colorHex.slice(1), 16);
		dialog.setBackGroundColor(dinoColor);
		initDinoRes();
	}

	function initDinoRes() {
		// render res
		const dinoNormal = res['dino_normal'];
		const dinoMirror = res['dino_xMirror'];
		dinoRes = new Array(dinoNormal.length + dinoMirror.length);
		for (let i = 0; i < dinoRes.length; i++) {
			const cache = i < dinoNormal.length ? dinoNormal[i] : dinoMirror[i - dinoNormal.length];
			const cacheCanvas = dinoRes[i] = createCanvas(cache.width, cache.height);
			cacheCanvas.drawImage(cache, 0, 0, cache.width, cache.height, 0, 0, cache.width, cache.height);

			// change dino color
			const imgData = cacheCanvas.getImageData(0, 0, cache.width, cache.height);
			for (let i = 0; i < imgData.data.length; i += 4) {
				if (imgData.data[i + 3] === 0 || imgData.data[i] > 0 || imgData.data[i + 1] > 0 || imgData.data[i + 1] > 0)
					continue;
				imgData.data[i] = (dinoColor & 0xFF0000) >> 16;
				imgData.data[i + 1] = (dinoColor & 0xFF00) >> 8;
				imgData.data[i + 2] = dinoColor & 0xFF;
			}
			cacheCanvas.putImageData(imgData, 0, 0);
		}
		// console.log('update dino state');
	}

	function say(newText, showSec) {
		dialogCloseDelay = nowFps * showSec;
		lastDialogFrame = frameCount;
		dialog.setText(newText);
	}

	function setNextState() {
		nextStateDelay = Random.nextRange(nowFps * 2, nowFps * 4);
	}

	function setNextBlink() {
		nextBlinkDelay = Random.nextRange(nowFps * 2, nowFps * 6);
	}

	function setState(index) {
		const state = dinoRes[facingNormal ? index : (4 + index)];
		dinoCanvas = state.canvas;
		textureW = dinoCanvas.width * dinoScale;
		textureH = dinoCanvas.height * dinoScale;
	}

	/**
	 * @param canvas {CanvasRenderingContext2D}
	 */
	function render(canvas) {
		// constant move animation time
		moveChangeDelay = nowFps * 0.3;
		const dt = nowFps > 0 ? 1 / nowFps : 0.0001;
		const gravity = 9.81;
		const scale = 150;
		if (y > 10) {
			vy += -gravity * scale * dt;
			y += vy * dt;
		} else {
			vy = 0;
			y = 10;
		}
		if (y < 10)
			y = 10;

		x += vx * dt;
		if (x < 0) {
			x = 0;
			// stop moving
			vx = 0;
			lastState = 2;
			setState(0);
		} else if (x > canvasWidth - textureW + cullWidth * dinoScale) {
			x = canvasWidth - textureW + cullWidth * dinoScale;
			// stop moving
			vx = 0;
			lastState = 1;
			setState(0);
		}

		// move
		if (frameCount - lastChangeStateFrame > nextStateDelay) {
			lastChangeStateFrame = frameCount;
			setNextState();
			let state = Random.nextInt(5);
			// state = state > 1 ? 0 : (state + 1);

			if (lastState === 0) {
				state = state > 1 ? 0 : (state + 1);
			} else if (lastState === 1) {
				state = state > 1 ? 1 : (state * 2);
			} else if (lastState === 2) {
				state = state > 1 ? 2 : (state);
			}

			// if(lastState === 1)
			// 	state = 2
			// else if (lastState === 2)
			// 	state = 1

			// idle
			if (state === 0)
				vx = 0;
			// left
			else if (state === 1) {
				vx = -speed;
			}
			// right
			else if (state === 2) {
				vx = speed;
			}


			// flip, center leg
			if (facingNormal && state === 1) {
				x -= 6;
				facingNormal = false;
				setState(0);
			} else if (!facingNormal && state === 2) {
				x += 6;
				facingNormal = true;
				setState(0);
			}

			lastState = state;
		}

		// blink
		if (frameCount - lastBlinkFrame > nextBlinkDelay) {
			// not moving or blinked when moving
			if (moveChangeState === 0 || !blinked) {
				lastBlinkFrame = frameCount;
				setNextBlink();
				blinked = false;
				if (moveChangeState === 0)
					setState(0);
				else
					setState(moveChangeState + 1);
			} else
				lastBlinkFrame += nowFps * 0.1;
		} else if (frameCount - lastBlinkFrame > nextBlinkDelay - nowFps * 0.1) {
			if (!blinked) {
				blinked = true;
				if (moveChangeState === 0)
					setState(1);
			}
		}

		// move animation
		if (vx !== 0) {
			const passed = frameCount - lastMoveChangeFrame;
			if (passed > moveChangeDelay) {
				lastMoveChangeFrame = frameCount;
				moveChangeState = 0;
				if (blinked) {
					setState(1);
					blinked = false;
				} else
					setState(0);
			} else if (passed > moveChangeDelay * 2 / 3) {
				if (moveChangeState === 1) {
					moveChangeState = 2;
					setState(3);
				}
			} else if (passed > moveChangeDelay / 3) {
				if (moveChangeState === 0) {
					moveChangeState = 1;
					setState(2);
				}
			}
		}
		// reset if still at moving animate frame
		else if (moveChangeState > 0) {
			moveChangeState = 0;
			setState(0);
		}

		const finalY = canvasHeight - textureH - 1 - (y + (cullYBottom + cullYTop) * dinoScale);
		// render dino
		canvas.drawImage(dinoCanvas, 0, 0, dinoCanvas.width, dinoCanvas.height, x + cullXLeft * dinoScale, finalY + cullYTop * dinoScale, textureW, textureH);

		// render dialog
		if (dialogCloseDelay !== -1 && frameCount - lastDialogFrame > dialogCloseDelay) {
			dialogCloseDelay = -1;
			dialog.setText(null);
		}
		dialog.setPosition(x + (facingNormal ? (textureW - cullWidth * dinoScale) : 0), finalY, facingNormal);
		const location = dialog.render(canvas);

		// render name
		canvas.fillStyle = 'white';
		canvas.font = nameFont;
		if (location === null)
			canvas.fillText(name, (x + cullXLeft * dinoScale) + (textureW - nameWidth) * 0.5, finalY - 5);
		else
			canvas.fillText(name, location[0] + 10, location[1] + 5);
	}

	// init
	setNextBlink();
	setNextState();
	setDinoColor(initColor);
	setState(0);
	return {render, setDinoColor, say};
}

(async function () {
	// init canvas
	const canvasEle = document.createElement('canvas');
	canvasEle.className = 'mainCanvas';
	const canvas = canvasEle.getContext('2d');
	window.onload = function () {
		document.body.appendChild(canvasEle);
	}

	// import
	const Twitch = await require('backend/twitch');
	const {Command} = await require('backend/messageParser');
	const res = {};
	const stateData = {};
	// get state, token, settings
	await initVariable(res, stateData, Twitch);
	linkTwitch(res, stateData, Twitch, Command);

	// init
	frameCount = 0;
	nowFps = 0;
	let lastFrameTime = perf.now();
	const fps = new Float32Array(4);
	// load resource
	await initResource(res);
	resizeCanvas();
	renderFrame();

	function renderFrame() {
		canvas.clearRect(0, 0, canvasEle.width, canvasEle.height);
		canvas.fillStyle = 'white';

		canvas.font = '15px Arial';
		canvas.fillText(`DinoCount: ${dinoCount}, Order: ${order.length}, FPS: ${nowFps.toFixed(2)}`, 5, 20);

		drawFrame(res, canvas);

		frameCount++;
		requestAnimationFrame(renderFrame);
		const now = perf.now();
		if (frameCount % 5 === 0)
			nowFps = (
				(fps[0]) +
				(fps[0] = fps[1]) +
				(fps[1] = fps[2]) +
				(fps[2] = fps[3]) +
				(fps[3] = 1000 / (now - lastFrameTime))
			) / 5;
		lastFrameTime = now;
	}

	function resizeCanvas() {
		canvasWidth = canvasEle.width = window.innerWidth;
		canvasHeight = canvasEle.height = window.innerHeight;
		canvas.imageSmoothingEnabled = false;
	}

	window.addEventListener('resize', resizeCanvas);
})();

async function loadImageSlice(res, path) {
	const name = path.slice(0, path.lastIndexOf('.'));

	const image = await require(path);
	const sliceData = await require(name + '.slice.json');

	for (const info of sliceData) {
		const baseImage = await sliceImage(image, info.x, info.y, info.w, info.h);
		if (info.pieceW || info.piece || info.mode) {
			let pieceWidth, pieceCount;
			if (info.pieceW) {
				pieceWidth = info.pieceW;
				pieceCount = (info.w / (info.gap ? info.gap + pieceWidth : pieceWidth)) | 0;
			} else if (info.piece) {
				pieceCount = info.piece;
				pieceWidth = info.w / pieceCount - (info.gap ? info.gap : 0);
			} else {
				pieceCount = 1;
				pieceWidth = info.w;
			}

			// no mode
			if (!info.mode || info.mode.length === 0 || info.mode.length === 1 && info.mode[0] === 'normal') {
				const pieceArr = new Array(pieceCount);
				for (let i = 0; i < pieceCount; i++)
					pieceArr[i] = await sliceImage(baseImage, (info.gap ? info.gap + pieceWidth : pieceWidth) * i, 0, pieceWidth, info.h);
				if (res[info.name]) {
					res[info.name].push(...pieceArr);
				} else
					res[info.name] = pieceArr;
			} else {
				for (const mode of info.mode) {
					const pieceArr = new Array(pieceCount);
					if (mode === 'normal') {
						for (let i = 0; i < pieceCount; i++)
							pieceArr[i] = await sliceImage(baseImage, (info.gap ? info.gap + pieceWidth : pieceWidth) * i, 0, pieceWidth, info.h, false);
						res[info.name + '_normal'] = pieceCount === 1 ? pieceArr[0] : pieceArr;
					} else if (mode === 'xMirror') {
						for (let i = 0; i < pieceCount; i++)
							pieceArr[i] = await sliceImage(baseImage, (info.gap ? info.gap + pieceWidth : pieceWidth) * i, 0, pieceWidth, info.h, true);
						res[info.name + '_xMirror'] = pieceCount === 1 ? pieceArr[0] : pieceArr;
					}
				}
			}
		} else
			res[info.name] = baseImage;
	}
}

async function sliceImage(image, x, y, w, h, xMirror) {
	const sliceCanvas = document.createElement('canvas');
	sliceCanvas.width = w;
	sliceCanvas.height = h;
	const context = sliceCanvas.getContext('2d');
	if (xMirror) {
		context.scale(-1, 1);
	}
	context.drawImage(image, x, y, w, h, 0, 0, xMirror ? -w : w, h);
	const outImage = new Image();
	outImage.src = sliceCanvas.toDataURL();
	return await new Promise(resolve => outImage.onload = () => resolve(outImage));
}

function createCanvas(w, h) {
	const sliceCanvas = document.createElement('canvas');
	sliceCanvas.width = w;
	sliceCanvas.height = h;
	const ctx = sliceCanvas.getContext('2d');
	ctx.imageSmoothingEnabled = false;
	return ctx;
}

function getTextWidth(text, font) {
	const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement('canvas'));
	const context = getTextWidth.ctx || (getTextWidth.ctx = canvas.getContext('2d'));
	context.font = font;
	return context.measureText(text).width;
}

/**
 * @param url{string}
 * @return {Promise<Object>}
 */
function require(url) {
	let nameStart = url.lastIndexOf('/');
	let nameEnd = url.lastIndexOf('.');
	if (nameStart === -1) nameStart = 0;
	if (nameEnd === -1) nameEnd = 0;

	// js file
	if (nameEnd <= nameStart) {
		nameEnd = url.length;
		url += '.js';
	} else if (nameEnd === 0)
		nameEnd = url.length;

	const fileName = url.slice(nameStart + 1, nameEnd);
	const pathName = url.slice(0, nameStart);

	return fetch(url).then(async i => {
		const contentType = i.headers.get('Content-Type');
		if (contentType.startsWith('image')) {
			const image = new Image();
			const loadImage = new Promise(resolve => image.onload = () => resolve(image));
			image.src = URL.createObjectURL(await i.blob());
			return loadImage;
		} else if (contentType.indexOf('application/json') !== -1)
			return i.json();
		else if (contentType.indexOf('application/javascript') !== -1) {
			const script = (await i.text())
				.replace(/\n?module.exports/, `module_${fileName}`)
				.replace(/\/\/ ?!!EXCLUDE_IN_WEB\r?\n/g, '//')
				// .replace(/\/\/ ?!!INCLUDE_IN_WEB */g, '')
				.replace(/require\( ?'/g, `await require('${pathName}/`);
			return eval(`(async function () {
				let module_${fileName};
				${script}
				return module_${fileName};
			})()`);
		} else
			console.log(contentType);
	});
}

