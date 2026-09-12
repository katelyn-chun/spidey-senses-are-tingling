const DEFAULT_SETTINGS = { enabled: true, threshold: 0.8 };
const extensionApi = globalThis.chrome;
const elements = {
	enabled: document.querySelector('#enabled'), threshold: document.querySelector('#threshold'),
	thresholdValue: document.querySelector('#threshold-value'), statusLabel: document.querySelector('#status-label'),
	statusDetail: document.querySelector('#status-detail'), statusDot: document.querySelector('#status-dot'),
	scannedCount: document.querySelector('#scanned-count'), blurredCount: document.querySelector('#blurred-count'),
	pauseSite: document.querySelector('#pause-site'),
};

function setStatus(label, detail, state = 'ready') {
	elements.statusLabel.textContent = label;
	elements.statusDetail.textContent = detail;
	elements.statusDot.dataset.state = state;
}

function renderSettings(settings) {
	elements.enabled.checked = settings.enabled;
	elements.threshold.value = Math.round(settings.threshold * 100);
	elements.thresholdValue.value = `${elements.threshold.value}%`;
	elements.thresholdValue.textContent = `${elements.threshold.value}%`;
	setStatus(settings.enabled ? 'Protection is on' : 'Protection is paused', 'Images are analyzed on this device.', settings.enabled ? 'ready' : 'paused');
}

async function updateActiveTab(message) {
	if (!extensionApi?.tabs?.query) return;
	const [tab] = await extensionApi.tabs.query({ active: true, currentWindow: true });
	if (!tab?.id) return;
	try {
		const response = await extensionApi.tabs.sendMessage(tab.id, message || { type: 'get-status' });
		if (response) {
			elements.scannedCount.textContent = response.scanned ?? 0;
			elements.blurredCount.textContent = response.blurred ?? 0;
		}
	} catch {
		setStatus('Ready for a web page', 'This page does not expose extension controls.', 'paused');
	}
}

async function saveSettings() {
	const settings = { enabled: elements.enabled.checked, threshold: Number(elements.threshold.value) / 100 };
	renderSettings(settings);
	if (extensionApi?.storage?.local) {
		await extensionApi.storage.local.set(settings);
		await updateActiveTab({ type: 'settings-updated', settings });
	}
}

async function loadSettings() {
	if (!extensionApi?.storage?.local) {
		renderSettings(DEFAULT_SETTINGS);
		setStatus('Preview mode', 'Load this folder as an unpacked extension to connect controls.', 'paused');
		return;
	}
	renderSettings({ ...DEFAULT_SETTINGS, ...(await extensionApi.storage.local.get(DEFAULT_SETTINGS)) });
	await updateActiveTab();
}

elements.enabled.addEventListener('change', saveSettings);
elements.threshold.addEventListener('input', () => {
	elements.thresholdValue.value = `${elements.threshold.value}%`;
	elements.thresholdValue.textContent = `${elements.threshold.value}%`;
});
elements.threshold.addEventListener('change', saveSettings);
elements.pauseSite.addEventListener('click', async () => {
	await updateActiveTab({ type: 'pause-site' });
	setStatus('Paused on this site', 'Use the protection toggle to resume scanning.', 'paused');
});
loadSettings().catch(() => setStatus('Could not load settings', 'Reload the extension and try again.', 'error'));
