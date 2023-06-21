
class Dispersion {
	
	constructor(allData=[], {population=true, getv=v => v, withQuartile=false}={}) {
		this.population = population ? 1 : 0;
		this.getv = getv;
		this.length = allData.length;
		this.min = Infinity;
		this.max = -Infinity;
		this.withQuartile = withQuartile;
		//todo try to use dataSorted to avoid getv calls
		this.mean = allData
			.reduce(
				(acc, curr) => {
					let v = this.getv(curr);
					this.calcRange(v);
					return acc + v;
				}, 0
			) /
			Math.max(this.length - 1 + this.population, 1);
		this.variance = allData
			.map(curr => (this.getv(curr) - this.mean) ** 2)
			.reduce((acc, curr) => acc + curr, 0) /
			Math.max(this.length - 1 + this.population, 1);
		this.stddev = Math.sqrt(this.variance);
		if (this.withQuartile) {
			this.dataSorted = allData.map(getv).sort();
			this.calcQuartile();
		}
	}
	
	calcRange(v) {
		if (v < this.min) {
			this.min = v;
		}
		if (v > this.max) {
			this.max = v;
		}
		this.range = this.max - this.min;
	}
	
	calcQuartile(v) {
		if (!this.withQuartile) {
			return;
		}
		if (typeof v !== undefined) {
			let where = this.dataSorted.findIndex(val => val >= v);
			if (where < 0) {
				this.dataSorted.push(v);
			}
			else {
				this.dataSorted.splice(where, 0, v);
			}
		}
		this.q1 = this.dataSorted[Math.floor(this.length / 4)];
		this.q3 = this.dataSorted[Math.floor(3 * this.length / 4)];
		this.interQuartile = this.q3 - this.q1;
	}
	
	addOne(curr) {
		let v = this.getv(curr);
		let mean = (this.mean * this.length + v) / (this.length + 1);
		let variance = 
			((this.length - 1 + this.population) * this.variance +
			(v - mean) * (v - this.mean)) /
			(this.length + this.population);
		++this.length;
		this.mean = mean;
		this.variance = variance;
		this.stddev = Math.sqrt(this.variance);
		this.calcRange(v);
		this.calcQuartile(v);
	}
	
	print() {
		console.log({
			mean: this.mean,
			variance: this.variance,
			stddev: this.stddev,
			length: this.length,
			range: this.range,
			q1: this.q1,
			q3: this.q3,
			interQuartile: this.interQuartile,
		});
	}
};

