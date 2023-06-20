'use strict';

function csvLoad(simu, label) {
	let fieldTransforms = [
		(val) => val,
		(ts) => parseInt(ts) * 1000,
		(val) => val,
		parseFloat,
	];
	let fieldsNames = [
		'instrument',
		'timestamp',
		'label',
		'price',
	];
	
	let resp = new Promise(
		(resolve, reject) => {
		let parserConfig = {
			delimiter: "\t",	// empty auto-detect
			newline: "\n",	// empty auto-detect
			quoteChar: '',
			escapeChar: '',
			header: false,
			step: (results, parser) => {
				if (results.errors.length) {
					console.log("Row data:", results.data);
					console.log("Row errors:", results.errors);
					reject();
					return;
				}
				let tick = results.data
					.reduce(
						(obj, field, ix) => {
							obj[fieldsNames[ix]] = field;
							return obj;
						}, {});
				simu.pushTick(tick);
			},
			complete: (results, file) => {
			simu.ticks.push({
				label: 'endOfDay',
				title: label,
			});
			simu.dataComing = false;
				console.timeEnd('loading csv')
				resolve();
			},
			skipEmptyLines: true,
			transform: (value, index) => {
				return fieldTransforms[index](value);
			},
		};
		simu.dataComing = true;
		simu.file_loader(
			label, simu.location + '/data/lobdata/' + label + '.csv'
		).then(result => {
			let [label, csv] = result;
			simu.ticks.push({
				label: 'chartReset',
				title: label,
			});
			console.time('loading csv')
			Papa.parse(csv, parserConfig);
		});
	});
	return resp.then(() => `loaded ${label}`);
}

function fetchPricesCSV(label, location) {
	let fieldTransforms = [
		(val) => val,
		(ts) => parseInt(ts) * 1000,
		(val) => val,
		parseFloat,
	];
	let fieldsNames = [
		'instrument',
		'timestamp',
		'label',
		'price',
	];
	
	let url = `${location}/PyLOB/data/lobdata/${label}.csv`;
	let data = [];
	let resp = new Promise(
		(resolve, reject) => {
		let parserConfig = {
			delimiter: "\t",	// empty auto-detect
			newline: "\n",	// empty auto-detect
			quoteChar: '',
			escapeChar: '',
			header: false,
			step: (results, parser) => {
				if (results.errors.length) {
					console.log("Row data:", results.data);
					console.log("Row errors:", results.errors);
					reject();
					return;
				}
				let tick = results.data
					.reduce(
						(obj, field, ix) => {
							obj[fieldsNames[ix]] = field;
							return obj;
						}, {});
				data.push(tick);
			},
			complete: (results, file) => {
				console.timeEnd('loading csv')
				resolve(data);
			},
			skipEmptyLines: true,
			transform: (value, index) => {
				return fieldTransforms[index](value);
			},
		};
		fetch(
			url
		).then(
			reply => {
			reply.text()
				.then(
					csv => {
						//console.log(csv);
						console.time('loading csv')
						Papa.parse(csv, parserConfig);
					}
				);
			}
		);
	});
	return resp;
}

// x, y, label,rowid
//this.ticks = dataTicks(this, data);
/*
function dataTicks(simu, data) { // x, y, label,rowid
	console.time('data sort');
	let ticks = data
		.filter(branch=>simu.data_branches.includes(branch.title))
		.map(
			branch=>branch
			.data
			.map(
				(datum, rowid)=>{
					datum = Object.assign({}, datum);
					datum.label = branch.title;
					datum.rowid = rowid;
					return datum;
				}
			)
		)
		.reduce((a, b)=>a.concat(b))
		.sort((a, b)=>objCmp(a, b, ['x', 'rowid']))
		;
	console.timeEnd('data sort');
	//cut consecutive duplicates
	let current = {};
	ticks = ticks
		.filter(
			tick => {
				let ret = tick.y && tick.y != current[tick.label];
				current[tick.label] = tick.y;
				return ret;
				
			})
		.map(
			datum => {
				datum.x = parseDate(datum.x);
			});
	
	return ticks;
}
*/
