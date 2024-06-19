		
		self.sob = null;
		self.inputQueue = [];
		
		console.log("Running demo from Worker thread.");
		let logHtml = function(cssClass,...args){
			workerSend('logHtml', {cssClass, args});
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
			new URL('./orderbook.js', self.location.href),
		);
		
		self.sqlite3InitModule({
			// We can redirect any stdout/stderr from the module
			// like so...
			print: log,
			printErr: console.error
		}).then(function(sqlite3){
			console.log("Done initializing. Running demo...");
			try {
				self.oo = sqlite3.oo1/*high-level OO API*/;
				self.forwarder = new LOBForwarder(workerSend);
				self.sob = new OrderBook(
					self.oo, 0.0001, true,
					new URL('./', self.location.href),
					true, self.forwarder
				);
				console.time('sob_init');
				self.sob.init().then(obj => {
					warn('initialization done.');
					console.timeEnd('sob_init');
					workerSend('done', self.initReqId);
					while (self.inputQueue.length) {
						const event = self.inputQueue.shift();
						onmessage(event);
					}
				});
			}
			catch(e){
				warn("Exception:",e.message);
			}
		});
		
		onmessage = (event) => {
//console.log('workerReceived', event.data);
			if (!self.sob) {
				self.inputQueue.push(event);
			}
			else if (
				event.data instanceof Object &&
				Object.hasOwn(event.data, "queryMethod") &&
				Object.hasOwn(event.data, "queryMethodArguments")
			) {
				if (typeof self.sob[event.data.queryMethod] === 'function') {
					self.sob[event.data.queryMethod].apply(
						self.sob,
						event.data.queryMethodArguments,
					);
				}
				else if (typeof self.forwarder[event.data.queryMethod] === 'function') {
					self.forwarder[event.data.queryMethod].apply(
						self.forwarder,
						event.data.queryMethodArguments,
					);
				}
				else {
					defaultReply(event.data);
				}
			}
			else {
				defaultReply(event.data);
			}
		};
		
		function defaultReply(data) {
			console.log('misrouted', data);
		}
		
		function workerSend(queryMethodListener, ...queryMethodArguments) {
//console.log('workerSend', queryMethodListener, ...queryMethodArguments);
			if (!queryMethodListener) {
				throw new TypeError("workerSend - not enough arguments");
			}
			postMessage({
				queryMethodListener,
				queryMethodArguments,
			});
		}
