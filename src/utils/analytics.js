import ReactGA from "react-ga4";

let isGAInitialized = false;

export const initGA = () => {
	const measurementId = import.meta.env?.VITE_GA_MEASUREMENT_ID;	

	if (!measurementId || isGAInitialized) return;

	ReactGA.initialize(measurementId, {
		gaOptions: {
			anonymize_ip: true
		}
	});

	isGAInitialized = true;
};

export const trackPageView = (page) => {
	if (!isGAInitialized) return;

	ReactGA.send({ hitType: "pageview", page });
};
