// init.js
// Load your local module(s) first
localRequirejs('similarArtists'); // -> window.SimilarArtists

// Register debugger entry point on the SimilarArtists module
//requirejs('helpers/debugTools');
//registerDebuggerEntryPoint.call(window.SimilarArtists, 'start');

(function () {

	window.whenReady(() => {

		// Initialize defaults
		window.SimilarArtists?.start();
	});
})();
