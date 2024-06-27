
// receives from worker
class WorkerReceiver {
	constructor() {}
	
	// the final receiver should implement getReqExtra
	getReqExtra(subject, reqId) {
		return null;
	}
	done(reqId) {
		let [promise, extra] = this.getReqExtra('any', reqId);
		if (promise) {
			promise.resolve();
		}
		return extra;
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
		error(`simulob received ${JSON.stringify(data)}`);
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

