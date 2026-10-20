// After the first visit a worker keeps every file of the app on this device, so a notebook opens with the network off.
// It has no imports on purpose: the first load only has to know that this file exists.
navigator.serviceWorker?.register(new URL('sw.js', document.baseURI)).catch(() => {});
