const parameters = [
	{
		name: 'joinChannel',
		type: 'text',
		require: true,
		displayName: 'Channel to join',
		defaultValue: null,
		placeholder: 'Channel Name',
	},
	{
		name: 'maxDinoScale',
		type: 'number',
		require: false,
		displayName: 'Max Dino size',
		defaultValue: 1,
		min: 1,
		max: 10,
	}
];

function parseSetting(queryString) {
	const settings = Object.fromEntries(queryString.split('&').map(i => i.split('=').map(decodeURIComponent)));
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