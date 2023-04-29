
'use strict';
/**
 * Determine whether the given `input` is iterable.
 *
 * @returns {Boolean}
 */
function isIterable(input) {  
  if (input === null || input === undefined) {
    return false
  }

  return typeof input[Symbol.iterator] === 'function';
}

function peakdet1(v, delta, allev) {
	/*
	this code was kindly provided  by it's original developer.
	// Eli Billauer, 3.4.05 (Explicitly not copyrighted).
	my humble additions were aimed to catch more peaks and values, 
	in the following 2 cases:
	* record the first extreme when it is a minimum. 
	  since lookformax is initially true, the original misses this case.
	* record the last extreme. the original missed it, 
	  as being last is not being followed, 
	  especially not by a direction breaking value.
	my aim is to lessen the memory commitment, and provide iterables as input.
	the original functionality may be obtained by using the 'original' parameter.
	
	this is the original doc:
	//PEAKDET Detect peaks in a vector
	// [MAXTAB, MINTAB] = PEAKDET(V, DELTA) finds the local
	// maxima and minima ("peaks") in the vector V.
	// MAXTAB and MINTAB consists of two columns. Column 1
	// contains indices in V, and column 2 the found values.
	//
	// With [MAXTAB, MINTAB] = PEAKDET(V, DELTA, X) the indices
	// in MAXTAB and MINTAB are replaced with the corresponding
	// X-values.
	//
	// A point is considered a maximum peak if it has the maximal
	// value, and was preceded (to the left) by a value lower by
	// DELTA.
	
	// Eli Billauer, 3.4.05 (Explicitly not copyrighted).
	// This function is released to the public domain; Any use is allowed.
	*/
	
	var maxtab = Array();
	var mintab = Array();
	if (allev === undefined) {
		allev = [];
	}
	if (!isIterable(v)) {
		throw new Error('values should be iterable');
	}
	if (typeof(delta) !== 'number' || delta <= 0) {
		throw new Error('Input argument DELTA must be a positive number');
	}
	
	var mnpos = NaN, mn = Infinity;
	var mxpos = NaN, mx = -Infinity;
	
	var lookformax = 1;
	var firstmn = true;
	var lastmn = null;
	var lastmx = null;
	
	for (let [thispos, _this] of v)
	{
		if (_this > mx)
		{
			[mxpos, mx]=[thispos, _this];
			if (mx >= mn+delta) {
				if (firstmn) {
					// as lookformax is initially true, 
					// the min that precedes the first max
					// gets ignored
					mintab.push([mnpos, mn]);
					allev.push([mnpos, mn]);
					firstmn = false;
					lastmn = null;
				}
				lastmx = [mxpos, mx];
			}
		}
		if (_this < mn)
		{
			mnpos = thispos; mn = _this;
			if (mn <= mx+delta) {
				lastmn = [mnpos, mn];
			}
		}
		if (lookformax) {
			if (_this < mx-delta) {
				maxtab.push([mxpos, mx]);
				allev.push([mxpos, mx]);
				mnpos = thispos; mn = _this;
				lookformax = 0;
				lastmx = null;
			}
		}
		else {
			if (_this > mn+delta) {
				mintab.push([mnpos, mn]);
				allev.push([mnpos, mn]);
				firstmn = false;
				mxpos = thispos; mx = _this;
				lookformax = 1;
				lastmn = null;
			}
		}
	}
	// if there was no change >= delta after the last mn/mx, that 
	// are here only if they moved by delta from the point before them

	if (lastmx) {
		maxtab.push(lastmx);
		allev.push(lastmx);
	}
	if (lastmn) {
		mintab.push(lastmn);
		allev.push(lastmn);
	}
	
	var resp = [maxtab, mintab];
	return resp;
}

function peakdet2(v, delta, {getv=v => v, maxtab=[], mintab=[], allev=[]}={}) {
	/*
	this code was kindly provided  by it's original developer.
	// Eli Billauer, 3.4.05 (Explicitly not copyrighted).
	my humble additions were aimed to catch more peaks and values, 
	in the following 2 cases:
	* record the first extreme when it is a minimum. 
	  since lookformax is initially true, the original misses this case.
	* record the last extreme. the original missed it, 
	  as being last is not being followed, 
	  especially not by a direction breaking value.
	my aim is to lessen the memory commitment, and provide iterables as input.

	this is the original doc:
	//PEAKDET Detect peaks in a vector
	// [MAXTAB, MINTAB] = PEAKDET(V, DELTA) finds the local
	// maxima and minima ("peaks") in the vector V.
	// MAXTAB and MINTAB consists of two columns. Column 1
	// contains indices in V, and column 2 the found values.
	//
	// With [MAXTAB, MINTAB] = PEAKDET(V, DELTA, X) the indices
	// in MAXTAB and MINTAB are replaced with the corresponding
	// X-values.
	//
	// A point is considered a maximum peak if it has the maximal
	// value, and was preceded (to the left) by a value lower by
	// DELTA.
	
	// Eli Billauer, 3.4.05 (Explicitly not copyrighted).
	// This function is released to the public domain; Any use is allowed.
	*/
	
	//maxtab = []
	//mintab = []
	if (!isIterable(v)) {
		throw new Error('values should be iterable');
	}
	if (typeof(delta) !== 'number' || delta <= 0) {
		throw new Error('Input argument DELTA must be a positive number');
	}
	
	var mn = Infinity, mnpt = null, mx = -Infinity, mxpt = null;
	
	var lookformax = 1, firstmn = true, lastmn = null, lastmx = null;
	
	for (let thisv of v) {
		let _this = getv(thisv);
		
		if (_this > mx) {
			mxpt = thisv; mx = _this;
			if (mx >= mn+delta) {
				if (firstmn) {
					// as lookformax is initially true, 
					// the min that precedes the first max
					// will be ignored
					if (mnpt) {
						mintab.push(mnpt);
						allev.push(mnpt);
					}
					mnpt = null;
					firstmn = false;
					lastmn = null;
				}
				lastmx = mxpt;
			}
		}
		if (_this < mn) {
			mnpt = thisv; mn = _this;
			if (mn <= mx+delta) {
				lastmn = mnpt;
			}
		}
		
		if (lookformax) {
			if (_this < mx-delta) {
				if (mxpt) {
					maxtab.push(mxpt);
					allev.push(mxpt);
				}
				mxpt = null;
				mnpt = thisv; mn = _this;
				lookformax = 0;
				lastmx = null;
			}
		}
		else {
			if (_this > mn+delta) {
				if (mnpt) {
					mintab.push(mnpt);
					allev.push(mnpt);
				}
				mnpt = null;
				firstmn = false;
				mxpt = thisv; mx = _this;
				lookformax = 1;
				lastmn = null;
			}
		}
	}
	// if there was no change >= delta after the last mn/mx, that 
	// are here only if they moved by delta from the point before them

	if (lastmx) {
		maxtab.push(lastmx);
		allev.push(lastmx);
	}
	if (lastmn) {
		mintab.push(lastmn);
		allev.push(lastmn);
	}
	return [maxtab, mintab];
}

function peakdet(v, delta, x=undefined, xinit=1, original=false) {
	/*
	this code was kindly provided  by it's original developer.
	// Eli Billauer, 3.4.05 (Explicitly not copyrighted).
	my humble additions were aimed to catch more peaks and values, 
	in the following 2 cases:
	* record the first extreme when it is a minimum. 
	  since lookformax is initially true, the original misses this case.
	* record the last extreme. the original missed it, 
	  as being last is not being followed, 
	  especially not by a direction breaking value.
	my aim is to lessen the memory commitment, and provide iterables as input.
	the original functionality may be obtained by using the 'original' parameter.
	
	this is the original doc:
	//PEAKDET Detect peaks in a vector
	// [MAXTAB, MINTAB] = PEAKDET(V, DELTA) finds the local
	// maxima and minima ("peaks") in the vector V.
	// MAXTAB and MINTAB consists of two columns. Column 1
	// contains indices in V, and column 2 the found values.
	//
	// With [MAXTAB, MINTAB] = PEAKDET(V, DELTA, X) the indices
	// in MAXTAB and MINTAB are replaced with the corresponding
	// X-values.
	//
	// A point is considered a maximum peak if it has the maximal
	// value, and was preceded (to the left) by a value lower by
	// DELTA.
	
	// Eli Billauer, 3.4.05 (Explicitly not copyrighted).
	// This function is released to the public domain; Any use is allowed.
	*/
	
	function* infinite_sequence(init=0)
	{
		let num = init;
		while(true) {
			yield num;
			++num;
		}
		return num;
	}
	
	var maxtab = [];
	var mintab = [];
	
	if (!isIterable(v)) {
		throw new Error('values should be iterable');
	}
	if (!(typeof(delta) === 'number' && delta > 0)) {
		throw new Error('Input argument DELTA must be a positive number');
	}
	if (!x) {
		x = infinite_sequence(xinit);
	}
	else if (!isIterable(x)) {
		throw new Error('if given, x values should be iterable');
	}
	else {
		x = x[Symbol.iterator].bind(x)();
	}
	
	var mn = Infinity, mx = -Infinity;
	var mnpos = NaN, mxpos = NaN;
	
	var lookformax = 1;
	var firstmn = true;
	var lastmn = null;
	var lastmx = null;
	
	for (let _this of v)
	{
		let thispos = x.next().value;
		//console.log(_this, thispos);
		
		if (_this > mx)
		{
			mx = _this; mxpos = thispos;
			if (mx >= mn+delta && !original)
			{
				if (firstmn)
				{
					// as lookformax is initially true, 
					// the min that precedes the first max
					// will be ignored
					mintab.push([mnpos, mn]);
					firstmn = false;
					lastmn = null;
				}
				lastmx = [mxpos, mx];
			}
		}
		if (_this < mn)
		{
			mn = _this; mnpos = thispos;
			if (mn <= mx+delta)
			{
				lastmn = [mnpos, mn];
			}
		}
		if (lookformax) {
			if (_this < mx-delta) {
				maxtab.push([mxpos, mx]);
				mn = _this; mnpos = thispos;
				lookformax = 0;
				lastmx = null;
			}
		}
		else {
			if (_this > mn+delta) {
				mintab.push([mnpos, mn]);
				firstmn = false;
				mx = _this; mxpos = thispos;
				lookformax = 1;
				lastmn = null;
			}
		}
	}
	// if there was no change >= delta after the last mn/mx, that 
	// are here only if they moved by delta from the point before them
	if (!original)
	{
		if (lastmx) {
			maxtab.push(lastmx);
		}
		if (lastmn) {
			mintab.push(lastmn);
		}
	}
	return [maxtab, mintab];
}

/*//import matplotlib.pyplot as plt
from operator import itemgetter
*/

function split_tab(tab) {
	var x = [];
	var y = [];
	for (let row of tab){
		x.push(row[0]);
		y.push(row[1]);
	}
	return [x, y];
}

/*function show(inputs, delta, original, scale=1, subplt=null, plt=null):
	
	whole = false
	if subplt is null:
		subplt = plt
		whole = true
	
	inputs = [(c, value * scale) for c, value in enumerate(inputs, start=1)]
	x, v = split_tab(inputs)
	maxtab, mintab = peakdet(v, delta, x, original=original)
	
	console.log('inputs:', inputs)
	console.log('maxtab:', maxtab)
	console.log('mintab:', mintab)
	
	subplt.plot(x, v, 'b-', label='inputs')
	
	if whole:
		subplt.xticks(x, x)
		subplt.yticks(v, v)
	else:
		subplt.set_xticks(x, x, minor=false)
		subplt.set_yticks(v, v, minor=false)
	
	x, v = split_tab(sorted(mintab + maxtab, key=itemgetter(0)))
	subplt.plot(x, v, 'co-.', label='evt')
	
	x, v = split_tab(maxtab)
	subplt.plot(x, v, 'g+', label='peaks')
	
	x, v = split_tab(mintab)
	subplt.plot(x, v, 'r+', label='valleys')
	
	subplt.plot([], [], 'yo', label='delta=%g' % delta)
	
	if original:
		subplt.plot([], [], 'yo', label='original')
	
	if whole:
		subplt.title('peaks & valleys')
		subplt.ylabel('value')
		subplt.xlabel('index')
	else:
		subplt.set_title('peaks & valleys')
		subplt.set_ylabel('value')
		subplt.set_xlabel('index')
	subplt.grid()
	subplt.legend(loc='best')
*/
function test(inputs, delta, original=false, scale=1)
{
	var inputs2 = inputs.map(
		function(val, index) {
			return {x: (index+1).toString(), y: val * scale};
		}
	);
	inputs = inputs.map(function(val, index) {return [index+1,val * scale];});
	
	//console.log(JSON.stringify(inputs));
	var [x, v] = split_tab(inputs);
	//console.log(x, v);
	//
	//var x;
	var [maxtab, mintab] = peakdet(v, delta, x, original=original)
	console.log(JSON.stringify([maxtab, mintab]));
	
	var allev = [];
	var [maxtab1, mintab1] = peakdet1(inputs, delta, allev);
	console.log(JSON.stringify([maxtab1, mintab1]));
	//console.log('test1:', ([maxtab1, mintab1].toString() == [maxtab, mintab].toString()));
	
	var [maxtab2, mintab2, allev, allev2] = [[], [], [], []];
	peakdet2(inputs2, delta, {getv: function (v) {return v.y;}, maxtab: maxtab2, mintab: mintab2, allev: allev2});
	/*
	console.log('test2:', ([maxtab2, mintab2].toString() == [maxtab, mintab].toString()));
	console.log('maxtab:', JSON.stringify(maxtab));
	console.log('maxtab2:', JSON.stringify(maxtab2));
	console.log('mintab:', JSON.stringify(mintab));
	console.log('mintab2:', JSON.stringify(mintab2));
	*/
	
	allev2 = allev2.map(
		row => {
				
				//text = row.y.toString();
				//row.label = {text: text};
				row.label = maxtab2.includes(row) ? 
					{text: '+', color: 'green'} : 
					{text: '-', color: 'red'};
				console.log(JSON.stringify(row));
				return row;
			}
	);
	//console.log('allev2:', JSON.stringify(allev2));
	/*half = len(inputs) // 2
	half1 = inputs[:half]
	half2 = inputs[half:]
	console.log ('halves:', inputs == half1 + half2)

	from queue import Queue, Empty
	
	def inputs_gen():
		q = Queue()
		for val in half1:
			q.put(val)
		c = 0
		while true:
			//if c >= len(inputs):
			if len(allev) >= 5:
				break
			try:
				val = q.get(false)
				c += 1
				yield val
			except Empty:
				for val in half2:
					q.put(val)
	
	peakdet2(inputs_gen(), delta, getv=lambda v: v[1], maxtab=maxtab2, mintab=mintab2, allev=allev)
	console.log('test2:', (maxtab2, mintab2) == (maxtab, mintab))
	console.log('allev:', allev)
	*/
	return [
		{title: 'inputs2', data: inputs2}, 
		{title: 'allev2',  data: allev2}
	];
}
/*

def show_compare(inputs, delta, plt):
	fig, axs = plt.subplots(2, 2)
	show(inputs, delta, original=false, scale=1, subplt=axs[0, 0], plt=plt)
	show(inputs, delta, original=false, scale=-1, subplt=axs[0, 1], plt=plt)
	show(inputs, delta, original=true, scale=1, subplt=axs[1, 0], plt=plt)
	show(inputs, delta, original=true, scale=-1, subplt=axs[1, 1], plt=plt)
	
	// Hide x labels and tick labels for top plots and y ticks for right plots.
	for ax in axs.flat:
		ax.label_outer()
*/
function peakdet_main()
	{
	var inputs = [
		2.0, 1.0, 2.0, 3.0, 2.0, 1.0, 0.0, 2.0, 4.0, 6.0, 8.0, 
		12.0, 11.0, 10.0, 11.0, 9.0, 7.0, 5.0, 3.0, 2.0, 1.0
	];
	var delta = 1.5;
	
	var data = test(inputs, delta);

	/*import matplotlib.pyplot as plt
	show_compare(inputs, delta, plt)
	plt.show()*/
	return data;
}
if (0) {
	peakdet_main();
}