const parameters = [
	{
		id: 'joinChannel',
		type: 'string',
		require: true,
		title: 'Channel to join',
		description: 'Copy channel url to here',
		defaultValue: null,
		placeholder: 'https://www.twitch.tv/wavjaby',
		selectAllOnClick: true,
		width: 300,
	},
	{
		id: 'ignoreUserName',
		type: 'string[]',
		require: false,
		title: 'Ignore user list',
		description: 'List for user you dont want to show',
		defaultValue: null,
		placeholder: 'Username',
		width: 150,
	},
	{
		type: 'section',
		title: 'Dino Settings',
		description: 'Settings for control Dino.',
		items: [
			{
				id: 'maxDinoScale',
				type: 'int',
				require: false,
				title: 'Max Dino size',
				description: null,
				defaultValue: 1,
				min: 1,
				max: 20,
			},
			{
				id: 'maxDinoCount',
				type: 'int',
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
	const types = {};
	flattenType(parameters, types);
	const settings = {};
	queryString.split('&').forEach(i => {
		const pair = i.split('=');
		const key = decodeURIComponent(pair[0]);
		let value = decodeURIComponent(pair[1]);
		const type = types[key];
		if (!type) return;
		if (!value || value.length === 0) {
			if (type.endsWith('[]') && !(key in settings)) settings[key] = [];
			return;
		}

		if (type.startsWith('int'))
			value = parseInt(value);
		else if (type.startsWith('float'))
			value = parseFloat(value);

		// array
		if (type.endsWith('[]')) {
			const valueIn = settings[key];
			if (valueIn)
				valueIn.push(value);
			else
				settings[key] = [value];
		}
		// value
		else
			settings[key] = value;
	});
	for (const par of parameters) {
		if (par.type === 'section') {
			for (const parI of par.items)
				processValue(parI);
		} else
			processValue(par);
	}

	function processValue(par) {
		if (!settings[par.id]) {
			if (par.require) {
				const errors = settings.error || (settings.error = []);
				errors.push([par.type, par.title]);
			}
			settings[par.id] = par.defaultValue ? par.defaultValue : null;
		}
	}

	return settings;
}

function flattenType(parameters, output) {
	for (const par of parameters) {
		if (par.type === 'section')
			flattenType(par.items, output);
		else
			output[par.id] = par.type;
	}
}

function createSetting(parent) {
	let tokenData = localStorage.getItem('tokenData');
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
				createSettingField(item, section);
		} else
			createSettingField(par, parent);
	}

	function createSettingField(par, parent) {
		createFieldTitle(par, parent);
		// array
		if (par.type.endsWith('[]')) {
			const list = document.createElement('div');
			list.className = 'list';
			const add = document.createElement('button');
			add.className = 'addButton squareButton focusGlow';
			add.type = 'button';
			add.innerHTML = `
				<svg viewBox="0 0 32 32">
					<rect x="1" y="12" rx="2" ry="2" width="30" height="8" style="fill:white"/>
					<rect x="12" y="1" rx="2" ry="2" width="8" height="30" style="fill:white"/>
				</svg>
			`;
			add.onclick = function () {
				createListItem(par, list);
			};

			// fill saved settings
			const savedList = settings[par.id];
			if (savedList.length > 0)
				for (const value of savedList)
					createListItem(par, list).value = value;
			else
				createListItem(par, list);
			parent.appendChild(list);
			parent.appendChild(add);
		}
		// normal field
		else
			createInputField(par, parent);
		// add if description
		if (par.description)
			createFieldDescription(par, parent);
	}

	function createListItem(par, list) {
		const item = document.createElement('div');
		item.className = 'listItem';
		const remove = document.createElement('button');
		remove.className = 'removeButton squareButton';
		remove.type = 'button';
		remove.innerHTML = `
			<svg viewBox="0 0 32 32">
				<g transform="rotate(45 16 16)">
					<rect x="1" y="14" rx="2" ry="2" width="30" height="4" style="fill:white"/>
					<rect x="14" y="1" rx="2" ry="2" width="4" height="30" style="fill:white"/>
				</g>
			</svg>
		`;
		const field = createInputField(par, item);
		remove.onclick = function () {
			if (list.children.length === 1)
				field.value = '';
			else
				list.removeChild(item);
		}
		item.appendChild(remove);
		list.appendChild(item);
		return field;
	}

	function createFieldTitle(par, parent) {
		const settingTitle = document.createElement('label');
		settingTitle.className = 'settingTitle';
		settingTitle.for = par.id;
		settingTitle.textContent = par.title;
		parent.appendChild(settingTitle);
	}

	// input field
	function createInputField(par, parent) {
		const settingElement = document.createElement('input');
		settingElement.className = 'inputField focusGlow';

		const isArray = par.type.endsWith('[]');
		const type = isArray
			? par.type.slice(0, par.type.length - 2)
			: par.type;
		// for setting key name
		switch (type) {
			case 'string': {
				settingElement.type = 'text';
				settingElement.placeholder = par.placeholder;
				break;
			}
			case 'int': {
				settingElement.type = 'number';
				settingElement.step = par.step || '1';
				settingElement.min = par.min;
				settingElement.max = par.max;
				break;
			}
			case 'float': {
				settingElement.type = 'number';
				settingElement.step = par.step || '0.01';
				settingElement.min = par.min;
				settingElement.max = par.max;
				break;
			}
		}
		if (par.width)
			settingElement.style.width = par.width + 'px';
		settingElement.name = settingElement.id = par.id;
		if (!isArray) {
			const value = settings && settings[par.id];
			settingElement.value = value ? value : par.defaultValue;
		}
		settingElement.required = par.require;

		// select all text on click
		if (par.selectAllOnClick)
			settingElement.onfocus = function () {
				this.setSelectionRange(0, this.value.length);
			}
		parent.appendChild(settingElement);
		return settingElement;
	}

	function createFieldDescription(par, parent) {
		const description = document.createElement('p');
		description.className = 'settingDescription';
		description.textContent = par.description;
		parent.appendChild(description);
	}
}