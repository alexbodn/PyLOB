    var someSeries = [
        [0, 11],
        [1, 15],
        [2, 25],
        [3, 24],
        [4, 13],
        [5, 18],
        [6, 22],
        [7, 45],
        [8, 33],
        [9, 12],
        [10, 27],
        [11, 24],
        [12, 20]
    ];
    var bin = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 8],
        [8, 9],
        [9, 10],
        [10, 11],
        [11, 12],
        [12, 13],
        [13, 14]
    ];


  // calc slope and intercept
  // then use resulting y = mx + b to create trendline
  lineFit = function(points){
    sI = slopeAndIntercept(points);
    if (sI){
      // we have slope/intercept, get points on fit line
      var N = points.length;
      var rV = [];
      rV.push([points[0][0], sI.slope * points[0][0] + sI.intercept]);
      rV.push([points[N-1][0], sI.slope * points[N-1][0] + sI.intercept]);
      return rV;
    }
    return [];
  }

  // simple linear regression
  slopeAndIntercept = function(points){
    var rV = {},
        N = points.length,
        sumX = 0, 
        sumY = 0,
        sumXx = 0,
        sumYy = 0,
        sumXy = 0;

    // can't fit with 0 or 1 point
    if (N < 2){
      return rV;
    }    

    for (var i = 0; i < N; i++){
      var x = points[i][0],
          y = points[i][1];
      sumX += x;
      sumY += y;
      sumXx += (x*x);
      sumYy += (y*y);
      sumXy += (x*y);
    }

    // calc slope and intercept
    rV['slope'] = ((N * sumXy) - (sumX * sumY)) / (N * sumXx - (sumX*sumX));
    rV['intercept'] = (sumY - rV['slope'] * sumX) / N;
    rV['rSquared'] = Math.abs((rV['slope'] * (sumXy - (sumX * sumY) / N)) / (sumYy - ((sumY * sumY) / N)));

    return rV;
  }
  
  lineFitSeries = lineFit(someSeries);
  
  console.log(lineFitSeries);