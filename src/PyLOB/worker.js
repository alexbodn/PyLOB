'use strict';

// perform work inside a worker
class WorkerPerformer {
	
	constructor() {
	}
	postMessage = (queryMethodListener, queryMethodArguments) => {
		postMessage({
			queryMethodListener,
			queryMethodArguments,
		});
	}
};

// create and invoke a worker
class WorkerClient {
	
	constructor(worker_url, receiver) {
		this.worker_url = worker_url;
		this.receiver = receiver;
		if (receiver?.clientError) {
			this.clientError = receiver.clientError;
		}
	}
	postMessage = (queryMethod, queryMethodArguments) => {
		this.worker.postMessage({
			queryMethod,
			queryMethodArguments,
		});
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
};

if (typeof module !== 'undefined') {
	module.exports = {
		performer: WorkerPerformer,
		client: WorkerClient,
	};
}
