
'use strict';
		
		console.log("Running demo from Worker thread.");
		let logHtml = function(cssClass,...args){
			console.log(args);
		};
		const log = (...args)=>logHtml('',...args);
		const warn = (...args)=>logHtml('warning',...args);
		const error = (...args)=>logHtml('error',...args);
		
		/*
		If sqlite3.js is in a directory other than this script, in order
		to get sqlite3.js to resolve sqlite3.wasm properly, we have to
		explicitly tell it where sqlite3.js is being loaded from. We do
		that by passing the `sqlite3.dir=theDirName` URL argument to
		_this_ script. That URL argument will be seen by the JS/WASM
		loader and it will adjust the sqlite3.wasm path accordingly. If
		sqlite3.js/.wasm are in the same directory as this script then
		that's not needed.

		URL arguments passed as part of the filename via importScripts()
		are simply lost, and such scripts see the self.location of
		_this_ script.
		*/
		let sqlite3Js = 'sqlite3.js';
		const urlParams = new URL(self.location.href).searchParams;
		if(urlParams.has('sqlite3.dir')){
			sqlite3Js = `${urlParams.get('sqlite3.dir')}/${sqlite3Js}`;
		}
		self.initReqId = urlParams.get('initReqId');
		importScripts(
			sqlite3Js,
			new URL('../worker.js', self.location.href),
			new URL('../orderbook.js', self.location.href),
			'/node_modules/jszip/dist/jszip.min.js',
			'/node_modules/papaparse/papaparse.min.js',
			'/node_modules/luxon/build/global/luxon.js',
			"../../require.js",
			new URL('./loaddata.js', self.location.href),
			new URL('./simu_strategy.js', self.location.href),
			new URL('./simulob.js', self.location.href),
			new URL('../commission.js', self.location.href),
			new URL('./peakdet.js', self.location.href),
		);
		require(new URL('./strategies/peakswinger.js', self.location.href).toString()); //TODO this dynamically
		
		self.sqlite3InitModule({
			// We can redirect any stdout/stderr from the module
			// like so...
			print: log,
			printErr: console.error
		}).then(function(sqlite3){
			console.log("Done initializing. Running demo...");
			try {
				self.oo = sqlite3.oo1/*high-level OO API*/;
				self.performer = new WorkerPerformer();
				logHtml = function(cssClass,...args){
					self.performer.send('logHtml', {cssClass, args});
				};
				self.forwarder = new StrategyForwarder(self.performer.send);
				self.sob = new SimuLOB(
					self.oo,
					new URL('./', self.location.href),
					self.forwarder,
				);
				console.time('sob_init');
				self.sob.init().then(obj => {
					warn('initialization done.');
					console.timeEnd('sob_init');
					self.performer.addPerformer(self.sob, self.forwarder);
					self.performer.send('done', self.initReqId);
					self.performer.processQueue();
				});
			}
			catch(e){
				warn("Exception:",e.message);
			}
		});
		
		onmessage = (event) => {
			return self.performer.onmessage(event);
		};
