function RNG(seed) {
	const key = [];
	const _seed = cyrb128(mixkey(flatten(seed === undefined ? Math.random() : seed, 3), key));
	this.a = _seed[0];
	this.b = _seed[1];
	this.c = _seed[2];
	this.d = _seed[3];
}

RNG.prototype.nextInt = function (value) {
	return this.nextFloat() * value | 0;
}

RNG.prototype.nextFloat = function () {
	this.a >>>= 0;
	this.b >>>= 0;
	this.c >>>= 0;
	this.d >>>= 0;
	let t = (this.a + this.b) | 0;
	this.a = this.b ^ this.b >>> 9;
	this.b = this.c + (this.c << 3) | 0;
	this.c = (this.c << 21 | this.c >>> 11);
	this.d = this.d + 1 | 0;
	t = t + this.d | 0;
	this.c = this.c + t | 0;
	return (t >>> 0) / 4294967296;
}

RNG.prototype.nextRange = function (start, end) {
	return start + this.nextFloat() * (end + 1 - start) | 0;
}

RNG.prototype.choice = function (array) {
	return array[this.nextRange(0, array.length - 1)];
}

function cyrb128(str) {
	let h1 = 1779033703, h2 = 3144134277,
		h3 = 1013904242, h4 = 2773480762;
	for (let i = 0, k; i < str.length; i++) {
		k = str.charCodeAt(i);
		h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
		h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
		h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
		h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
	}
	h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
	h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
	h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
	h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
	return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

//
// flatten()
// Converts an object tree to nested arrays of strings.
//
function flatten(obj, depth) {
	let result = [], typ = (typeof obj), prop;
	if (depth && typ === 'object')
		for (prop in obj)
			try {
				result.push(flatten(obj[prop], depth - 1));
			} catch (e) {
			}
	return (result.length ? result : typ === 'string' ? obj : obj + '');
}

//
// mixkey()
// Mixes a string seed into a key that is an array of integers, and
// returns a shortened string seed that is equivalent to the result key.
//
function mixkey(seed, key) {
	const stringseed = seed + '', mask = 256 - 1;
	let smear = 0, j = 0;
	while (j < stringseed.length) {
		key[mask & j] = mask & ((smear ^= key[mask & j] * 19) + stringseed.charCodeAt(j++));
	}
	return String.fromCharCode.apply(0, key);
}