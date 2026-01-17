// init.js
// Load your local module(s) first
localRequirejs('similarArtists'); // -> window.SimilarArtists
//requirejs('helpers/debugTools');

// Register debugger entry point on the SimilarArtists module
//registerDebuggerEntryPoint.call(window.SimilarArtists, 'start');

(function () {

	window.whenReady(() => {

		// Initialize defaults
		//window.SimilarArtists?.ensureDefaults?.();
		window.SimilarArtists?.start();
	});
})();
