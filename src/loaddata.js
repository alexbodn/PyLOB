'use strict';

function csvLoad(simu, label) {
	let fieldTransforms = [
		null,
		parseInt,
		null,
		parseFloat,
	];
	
	let parserConfig = {
		delimiter: "\t",	// empty auto-detect
		newline: "\n",	// empty auto-detect
		quoteChar: '',
		escapeChar: '',
		header: false,
		step: function(results, parser) {
			if (results.errors.length) {
				console.log("Row data:", results.data);
				console.log("Row errors:", results.errors);
				return;
			}
			simu.ticks.push({
				x: results.data[1] * 1000,
				label: results.data[2],
				y: results.data[3],
			});
		},
		complete: function(results, file) {
			simu.dataComing = false;
		},
		skipEmptyLines: true,
		transform: (value, index) => {
			let func = fieldTransforms[index];
			return func === null ? value : func(value);
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
		Papa.parse(csv, parserConfig);
	});
}

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
	}*/