		console.log("Running demo from Worker thread.");
		let logHtml = function(cssClass,...args){
			reply('logHtml', {cssClass, args});
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
		importScripts(
			sqlite3Js,
			new URL('./PyLOB/orderbook.js', self.location.href),
			'example.js',
		);
		
		self.sqlite3InitModule({
			// We can redirect any stdout/stderr from the module
			// like so...
			print: log,
			printErr: console.error
		}).then(function(sqlite3){
			console.log("Done initializing. Running demo...");
			try {
				const oo = sqlite3.oo1/*high-level OO API*/;
				self.sob = new OrderBook(
					oo, 0.0001, true,
					new URL('./PyLOB/', self.location.href),
					true, new LOBReceiver()
				);
				console.time('sob_init');
				self.sob.init().then(
					obj => {
						warn('initialization done.');
						console.timeEnd('sob_init');
						test_perform(self.sob);
					}
				); 
			}
			catch(e){
				warn("Exception:",e.message);
			}
		});
			
		const queryableFunctions = {
			// example #1: get the difference between two numbers:
			getDifference(minuend, subtrahend) {
				reply("printStuff", minuend - subtrahend);
			},
			
			// example #2: wait three seconds
			waitSomeTime() {
				setTimeout(() => {
					reply("doAlert", 3, "seconds");
				}, 3000);
			},
			
			print(instrument) {
				self.sob.print(instrument);
			},
		};
		
		// system functions
		
		function defaultReply(message) {
			// your default PUBLIC function executed only when main page calls the queryableWorker.postMessage() method directly
			// do something
		}
		
		function reply(queryMethodListener, ...queryMethodArguments) {
			if (!queryMethodListener) {
				throw new TypeError("reply - not enough arguments");
			}
			postMessage({
				queryMethodListener,
				queryMethodArguments,
			});
		}
		
		onmessage = (event) => {
			if (
				event.data instanceof Object &&
				Object.hasOwn(event.data, "queryMethod") &&
				Object.hasOwn(event.data, "queryMethodArguments") &&
				self.sob.hasOwn(event.data.queryMethod)
			) {
				self.sob[event.data.queryMethod].apply(
					self.sob,
					event.data.queryMethodArguments,
				);
			} else {
				defaultReply(event.data);
			}
		};

