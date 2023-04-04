(window.webpackJsonp=window.webpackJsonp||[]).push([[29],{333:function(n,t,e){"use strict";e.r(t);var o=e(3),l=Object(o.a)({},(function(){var n=this,t=n.$createElement,e=n._self._c||t;return e("ContentSlotsDistributor",{attrs:{"slot-key":n.$parent.slotKey}},[e("h1",{attrs:{id:"selection"}},[e("a",{staticClass:"header-anchor",attrs:{href:"#selection"}},[n._v("#")]),n._v(" Selection")]),n._v(" "),e("p",[e("RouterLink",{attrs:{to:"/guide/events.html"}},[n._v("Click events")]),n._v(" are handled to select labels, returning "),e("code",[n._v("true")]),n._v(" to re-render\nthe chart and update labels (see the "),e("code",[n._v("Output")]),n._v(" tab).")],1),n._v(" "),e("chart-editor",{attrs:{code:"// <block:setup:2>\nvar DATA_COUNT = 8;\nvar selection = [];\nvar labels = [];\n\nUtils.srand(7);\n\nfor (var idx = 0; idx < DATA_COUNT; ++idx) {\n  labels.push('' + idx);\n}\n\nfunction lookup(context) {\n  var dataset = context.datasetIndex;\n  var index = context.dataIndex;\n  var i, ilen;\n\n  for (i = 0, ilen = selection.length; i < ilen; ++i) {\n    if (selection[i].dataset === dataset && selection[i].index === index) {\n      return i;\n    }\n  }\n\n  return -1;\n}\n\nfunction isSelected(context) {\n  return lookup(context) !== -1;\n}\n\nfunction log(selected) {\n  console.log('selection: ' + selected.map(function(item) {\n    return item.value;\n  }).join(', '));\n}\n\nfunction select(context) {\n  var dataset = context.datasetIndex;\n  var index = context.dataIndex;\n  var value = context.dataset.data[index];\n\n  selection.push({\n    dataset: dataset,\n    index: index,\n    value: value\n  });\n\n  log(selection);\n}\n\nfunction deselect(context) {\n  var index = lookup(context);\n  if (index !== -1) {\n    selection.splice(index, 1);\n    log(selection);\n  }\n}\n// </block:setup>\n\nvar config = /* <block:config:0> */ {\n  type: 'line',\n  data: {\n    labels: labels,\n    datasets: [{\n      backgroundColor: Utils.color(0),\n      borderColor: Utils.color(0),\n      data: Utils.numbers({\n        count: DATA_COUNT,\n        decimals: 0,\n        min: 0,\n        max: 100\n      }),\n      datalabels: {\n        align: 'start'\n      }\n    }, {\n      backgroundColor: Utils.color(1),\n      borderColor: Utils.color(1),\n      data: Utils.numbers({\n        count: DATA_COUNT,\n        decimals: 0,\n        min: 0,\n        max: 100\n      })\n    }, {\n      backgroundColor: Utils.color(2),\n      borderColor: Utils.color(2),\n      data: Utils.numbers({\n        count: DATA_COUNT,\n        decimals: 0,\n        min: 0,\n        max: 100\n      }),\n      datalabels: {\n        align: 'end'\n      }\n    }]\n  },\n  options: {\n    plugins: {\n      datalabels: {\n        backgroundColor: function(context) {\n          return isSelected(context)\n            ? context.dataset.backgroundColor\n            : 'white';\n        },\n        borderColor: function(context) {\n          return context.dataset.backgroundColor;\n        },\n        borderWidth: 2,\n        color: function(context) {\n          return isSelected(context)\n            ? 'white'\n            : context.dataset.backgroundColor;\n        },\n        font: {\n          weight: 'bold'\n        },\n        offset: 8,\n        padding: 6,\n        listeners: {\n          click: function(context) {\n            if (isSelected(context)) {\n              deselect(context);\n            } else {\n              select(context);\n            }\n\n            return true;\n          }\n        }\n      }\n    },\n\n    // Core options\n    aspectRatio: 5 / 3,\n    layout: {\n      padding: {\n        top: 42,\n        right: 16,\n        bottom: 32,\n        left: 8\n      }\n    },\n    elements: {\n      line: {\n        fill: false,\n        tension: 0.4\n      }\n    },\n    scales: {\n      y: {\n        stacked: true\n      }\n    }\n  }\n} /* </block:config> */;\n\nmodule.exports = {\n  config: config,\n  output: 'Click on labels to log events'\n};\n"}})],1)}),[],!1,null,null,null);t.default=l.exports}}]);