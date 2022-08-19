const parameters = [
	{
		name: 'joinChannel',
		type: 'text',
		require: true,
		title: 'Channel to join',
		description: null,
		defaultValue: null,
		placeholder: 'Channel Name',
	},
	{
		type: 'section',
		title: 'Dino Settings',
		description: 'Settings for control Dino.',
		items: [
			{
				name: 'maxDinoScale',
				type: 'number',
				require: false,
				title: 'Max Dino size',
				description: null,
				defaultValue: 1,
				min: 1,
				max: 20,
			},
			{
				name: 'maxDinoCount',
				type: 'number',
				require: false,
				title: 'Max Dino count',
				description: null,
				defaultValue: 20,
				min: 10,
				max: 10000,
			}
		],
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
		if (par.type === 'section') {
			for (const parI of par.items) {
				if (!settings[parI.name]) {
					if (parI.require) {
						const errors = settings.error || (settings.error = []);
						errors.push([parI.type, parI.title]);
					}
					settings[parI.name] = parI.defaultValue ? parI.defaultValue : null;
				}
			}
		} else {
			if (!settings[par.name]) {
				if (par.require) {
					const errors = settings.error || (settings.error = []);
					errors.push([par.type, par.title]);
				}
				settings[par.name] = par.defaultValue ? par.defaultValue : null;
			}
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
		if (par.type === 'section') {
			const title = document.createElement('h3');
			title.className = 'sectionTitle';
			title.textContent = par.title;
			parent.appendChild(title);
			if (par.description) {
				const description = document.createElement('p');
				description.className = 'sectionDescription';
				description.textContent = par.description;
				parent.appendChild(description);
			}
			const section = document.createElement('div');
			section.className = 'section';
			parent.appendChild(section);
			for (const item of par.items)
				createSettingInput(item, settings, section);
		} else
			createSettingInput(par, settings, parent);
	}
}

function createSettingInput(par, settings, parent) {
	const settingTitle = document.createElement('label');
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
	settingTitle.for = settingElement.id = par.name;
	settingTitle.textContent = par.title;
	settingElement.type = par.type;
	const value = settings && settings[par.name];
	settingElement.value = value ? value : par.defaultValue;
	settingElement.require = par.require;
	settingElement.className = 'inputField focusGlow';

	parent.appendChild(settingTitle);
	parent.appendChild(settingElement);
}