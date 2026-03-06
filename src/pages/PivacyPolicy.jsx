import { Link } from "react-router-dom";

const PrivacyPolicy = () => {
	return (
		<div className="max-w-3xl mx-auto px-6 py-12 text-gray-800">
			<h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>

			<p className="mb-6">
				We are committed to protecting your privacy. This page outlines what data we collect and how we use it.
			</p>

			<section className="mb-10">
				<h2 className="text-2xl font-semibold mb-4">Analytics</h2>
				<p className="mb-4">
					We use <strong>Google Analytics 4 (GA4)</strong> to collect anonymous data about how visitors use our site.
					This helps us understand usage patterns and improve our services.
				</p>
				<p className="mb-4">
					The information collected includes pages visited, time spent on pages, and device/browser types. GA4 may set
					cookies to help distinguish between users and sessions.
				</p>
				<p className="mb-4">
					We do <strong>not</strong> use analytics data for advertising or user profiling. Data is processed based on
					user consent.
				</p>
				<p>
					You can opt in or out of analytics tracking at any time via the{" "}
					<Link to="/cookie-preferences" className="text-blue-600 hover:underline">
						cookie settings
					</Link>{" "}
					page.
				</p>
			</section>

			<p className="text-sm text-gray-600">
				If you have any questions about our privacy policy, please contact us.
			</p>
		</div>
	);
};

export default PrivacyPolicy;
