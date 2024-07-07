'use strict';

//perform work inside a worker
class WorkerPerformer {
	eventQueue = [];
	performers = [];
	
	constructor(performers=[]) {
		this.performers = performers;
	}
	addPerformer(...performers) {
		this.performers.push(...performers);
	}
	findPerformer(event) {
		return this.performers.find(performer => {
			return typeof performer[event.data.queryMethod] === 'function'
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
//console.log('workerSend', queryMethodListener, ...queryMethodArguments);
		if (!queryMethodListener) {
			throw new TypeError("performer.send - not enough arguments");
		}
		postMessage({
			queryMethodListener,
			queryMethodArguments,
		});
	}
};

function doneFunc(reqId, ...args) {
	let [promise, extra] = this.getReqExtra('any', reqId);
	if (promise) {
		promise.resolve(...args);
	}
	return extra;
}

// receives from worker
class WorkerReceiver {
	constructor(forwarder=null) {
		this.forwarder = forwarder;
	}
	
	// a derived class should implement getReqExtra and getReqId
	getReqExtra(subject, reqId) {
		return null;
	}
	getReqId = (subject, reqId=null, {extra=null, withPromise=false}={}) => {
	}
	done = doneFunc;
	forward(method, ...args) {
		this.forwarder(method, ...args);
	}
};

// create and contact a worker
class WorkerClient {
	
	worker = null;
	
	constructor(worker_url, receiver, dtFormat) {
		this.worker_url = worker_url;
		this.receiver = receiver;
		if (receiver?.clientError) {
			this.clientError = receiver.clientError;
		}
		this.dtFormat = dtFormat;
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
	clientError(data) {
		error(`worker sent ${JSON.stringify(data)}`);
	}
	init = async () => {
		let [initReqId, promise] = this.receiver.getReqId('any', null, {withPromise: true});
		this.worker_url += `&initReqId=${initReqId}`;
		this.worker = this.worker || new Worker(this.worker_url);
		this.worker.onmessage = (event) => {
//console.log('workerReplied', event.data);
			if (
				event.data instanceof Object &&
				Object.hasOwn(event.data, "queryMethodListener") &&
				Object.hasOwn(event.data, "queryMethodArguments") &&
				typeof this.receiver[event.data.queryMethodListener] === 'function'
			) {
				this.receiver[event.data.queryMethodListener].apply(
					this.receiver,
					event.data.queryMethodArguments,
				);
			}
			else {
				this.clientError(event.data);
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

