const parameters = [
	{
		name: 'joinChannel',
		type: 'text',
		require: true,
		displayName: 'Channel to join',
		description: '',
		defaultValue: null,
		placeholder: 'Channel Name',
	},
	{
		name: 'maxDinoScale',
		type: 'number',
		require: false,
		displayName: 'Max Dino size',
		description: '',
		defaultValue: 1,
		min: 1,
		max: 10,
	}
];

function parseSetting(queryString) {
	const settings = Object.fromEntries(queryString.split('&').map(i => {
		const pair = i.split('=').map(decodeURIComponent);
		const value = pair[1];
		let isNum = true, isFloat = true;
		for (let j = 0; j < value.length; j++) {
			const chr = value.charCodeAt(j);
			if (isNum && (chr < 0x30 || chr > 0x39) && chr !== 0x2B && chr !== 0x2D)
				isNum = false;
			else if (isFloat && chr !== 0x2E && chr !== 0x45 && chr !== 0x65) {
				isFloat = false;
				break;
			}
		}
		if (isNum)
			pair[1] = parseInt(value);
		else if (isFloat)
			pair[1] = parseFloat(value);
		return pair;
	}));
	for (const par of parameters) {
		if (!(par.name in settings)) {
			if (par.require) {
				const errors = settings.error || (settings.error = []);
				errors.push([par.type, par.displayName]);
			}
			settings[par.name] = par.placeholder ? par.placeholder : null;
		}
	}
	return settings;
}

function createSetting(parent) {
	let settings;
	if (tokenData) {
		tokenData = JSON.parse(tokenData);
		if (tokenData && tokenData.state)
			settings = parseSetting(tokenData.state);
	}

	for (const par of parameters) {
		const settingLabel = document.createElement('label');
		const settingElement = document.createElement('input');
		// for setting key name
		settingElement.name = par.name;
		switch (par.type) {
			case 'text': {
				settingElement.placeholder = par.placeholder;
				break;
			}
			case 'number': {
				settingElement.min = par.min;
				settingElement.max = par.max;
				break;
			}
		}
		settingLabel.for = settingElement.id = par.name;
		settingLabel.textContent = par.displayName;
		settingElement.type = par.type;
		const value = settings && settings[par.name];
		settingElement.value = value ? value : par.defaultValue;
		settingElement.require = par.require;
		settingElement.className = 'inputField focusGlow';

		parent.appendChild(settingLabel);
		parent.appendChild(settingElement);
	}
}