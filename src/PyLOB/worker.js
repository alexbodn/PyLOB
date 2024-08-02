'use strict';

//perform work inside a worker
class WorkerPerformer {
	eventQueue = [];
	performers = [];
	
	constructor(performers=[]) {
		this.addPerformer(...performers);
	}
	addPerformer(...performers) {
		this.performers.push(...performers);
	}
	findPerformer(event) {
		return this.performers.find(performer => {
			return typeof performer[event.data.queryMethod] === 'function';
		});
	}
	processQueue() {
		while (this.eventQueue.length) {
			this.onmessage(this.eventQueue.shift());
		}
	}
	onmessage(event) {
		if (!this.performers.some(x => x)) {
			this.eventQueue.push(event);
			return;
		}
		else if (this.eventQueue.length) {
			this.eventQueue.push(event);
			event = this.eventQueue.shift();
		}
		if (
			event.data instanceof Object &&
			Object.hasOwn(event.data, "queryMethod") &&
			Object.hasOwn(event.data, "queryMethodArguments")
		) {
			let performer = this.findPerformer(event);
			if (performer) {
				performer[event.data.queryMethod].apply(
					performer,
					event.data.queryMethodArguments,
				);
			}
			else {
				this.defaultReply(event.data);
			}
		}
		else {
			this.defaultReply(event.data);
		}
		this.processQueue();
	}
	defaultReply(data) {
		console.log('misrouted', data);
	}
	send(queryMethodListener, ...queryMethodArguments) {
		if (!queryMethodListener) {
			throw new TypeError("performer.send - no method specified");
		}
		postMessage({
			queryMethodListener,
			queryMethodArguments,
		});
	}
	initialized() {
		const urlParams = new URL(self.location.href).searchParams;
		const initReqId = urlParams.get('initReqId');
		this.send('done', initReqId);
		this.processQueue();
	}
};

function doneFunc(reqId, ...args) {
	let [promise, extra] = this.getReqExtra('any', reqId);
	if (promise) {
		promise.resolve(...args);
	}
	return extra;
}

const destinationTypes = Object.freeze({
    REGULAR:   Symbol("REGULAR"),
    REGISTERED:  Symbol("REGISTERED"),
    REGISTERED_EXTRA: Symbol("REGISTERED_EXTRA"),
});

// implements methods to handle info received from worker
// the method name is the first argument, and further args may follow.
// canned methods:
// 1. receipts that may resolve a promise opened when the client was invoked with an optional callback
// that will be called with the received data as argument;
// 2. forwards that may invoke another function (by default this.forwarder) with the method name and args
// exactly as received.
class WorkerReceiver {
	
	request_promises = {};
	reqIds = {};
	reqIdsLocked = false;
	
	constructor({defaultCallback=null, receipts={}, defaultForwarder=null, forwards={}}={}) {
		this.forwarder = defaultForwarder;
		for (let [receipt, callback] of Object.entries(receipts)) {
			if (!callback) {
				callback = defaultCallback;
			}
			if (!Object.hasOwn(this, receipt)) {
				this[receipt] = async (...args) => {
					if (callback && callback.constructor.name == 'String') {
						callback = this[callback];
					}
					return this.receive(receipt, callback, ...args);
				};
			}
		}
		for (let [forward, forwarder] of Object.entries(forwards)) {
			if (!forwarder) {
				forwarder = defaultForwarder;
			}
			if (!Object.hasOwn(this, forward)) {
				this[forward] = async (...args) => {
					return forwarder(forward, ...args);
				};
			}
		}
	}
	
	hasPerformer(event) {
		return typeof this[event.data?.queryMethodListener] === 'function';
	}
	
	getReqExtra(subject, reqId) {
		let promise = null, extra = null;
		try {
			if (reqId in this.request_promises) {
				promise = this.request_promises[reqId];
				delete this.request_promises[reqId];
			}
		}
		catch(error) {
			console.log('getReqExtra', error);
		}
		return [promise, extra];
	}
	
	getReqId = (subject, reqId=null, {extra=null, withPromise=false}={}) => {
		this.reqIdsLock();
		if (!(subject in this.reqIds)) {
			this.reqIds[subject] = 0;
		}
		if (!reqId) {
			reqId = ++this.reqIds[subject];
		}
		this.reqIdsLock(false);
		if (withPromise) {
			const promise = Promise.withResolvers();
			this.request_promises[reqId] = promise;
			return [reqId, promise.promise];
		}
		return reqId;
	}
	
	reqIdsLock(lock=true) {
		if (lock) {
			let checkInterval = setInterval(
				() => {
				if (!this.reqIdsLocked) {
					this.reqIdsLocked = true;
					clearInterval(checkInterval);
				}
			}, 1);
		}
		else {
			this.reqIdsLocked = false;
		}
	}
	
	done = doneFunc;
	
	receive(destination, callback, ...args) {
		let [reqId, ...data] = args;
		let [promise, extra] = this.getReqExtra('any', reqId);
		if (callback) {
			callback(...data, extra);
		}
		if (promise) {
			promise.resolve(...data, extra);
		}
	}
	
	forward(method, ...args) {
		this.forwarder(method, ...args);
	}
};

// create and call a worker
class WorkerClient {
	
	worker = null;
	destinations = {};
	
	constructor(worker_url, receiver, {destinations={}}={}) {
		this.worker_url = worker_url;
		this.receiver = receiver;
		if (receiver?.clientError) {
			this.clientError = receiver.clientError;
		}
		Object.assign(this.destinations, destinations);
		return new Proxy(this, {
			get: (target, name) => {
				if (!(name in target) && name in this.destinations) {
					switch (target.destinations[name]) {
					case destinationTypes.REGULAR: {
						target[name] = async (...args) => {
							return target.sendQuery(name, ...args);
						}
						break;
					}
					case destinationTypes.REGISTERED: {
						target[name] = async (...args) => {
							return target.sendRegistered(name + 'Req', null, ...args);
						}
						break;
					}
					case destinationTypes.REGISTERED_EXTRA: {
						target[name] = async (...args) => {
							let args1 = [...args];
							let extra = args1.pop();
							return target.sendRegistered(name + 'Req', extra, ...args1);
						}
						break;
					}
					};
				}
				return target[name];
			}
		});
	}
	// This functions takes at least one argument, the method name we want to query.
	// Then we can pass in the arguments that the method needs.
	sendQuery = (queryMethod, ...queryMethodArguments) => {
//console.log('sending', queryMethod, ...queryMethodArguments);
		if (!queryMethod) {
			throw new TypeError(
				"sendQuery takes at least one argument",
			);
		}
		const message = {
			queryMethod,
			queryMethodArguments,
		};
		this.worker.postMessage(message);
	};
	async sendRegistered(method, extra, ...args) {
		let [reqId, promise] = this.receiver.getReqId('any', null, {extra, withPromise: true});
		this.sendQuery(method, reqId, ...args);
		return promise;
	}
	clientError(...args) {
		console.error(...args);
	}
	init = async () => {
		let [initReqId, promise] = this.receiver.getReqId('any', null, {withPromise: true});
		this.worker_url += `&initReqId=${initReqId}`;
		this.worker = this.worker || new Worker(this.worker_url);
		this.worker.onmessage = (event) => {
			if (
				event.data instanceof Object &&
				Object.hasOwn(event.data, "queryMethodListener") &&
				Object.hasOwn(event.data, "queryMethodArguments") &&
				this.receiver.hasPerformer(event)
			) {
				this.receiver[event.data.queryMethodListener].apply(
					this.receiver,
					event.data.queryMethodArguments,
				);
			}
			else {
				this.clientError('received misrouted', event.data, 'from worker');
			}
		};
		this.worker.onerror = this.clientError;
		return promise;
	}
	terminate() {
		console.warn('terminating worker')
		this.worker.terminate();
		this.worker = null;
	}
	close() {
		this.terminate();
	}
};

