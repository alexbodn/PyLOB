(window.webpackJsonp=window.webpackJsonp||[]).push([[32],{337:function(n,t,a){"use strict";a.r(t);var e=a(3),o=Object(e.a)({},(function(){var n=this,t=n.$createElement,a=n._self._c||t;return a("ContentSlotsDistributor",{attrs:{"slot-key":n.$parent.slotKey}},[a("h1",{attrs:{id:"indices"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#indices"}},[n._v("#")]),n._v(" Indices")]),n._v(" "),a("p",[n._v("Use "),a("RouterLink",{attrs:{to:"/guide/options.html#scriptable-options"}},[n._v("scriptable options")]),n._v(" to alternate the style of the\nlabels based on the data indices.")],1),n._v(" "),a("chart-editor",{attrs:{code:"// <block:setup:2>\nvar DATA_COUNT = 16;\nvar labels = [];\n\nUtils.srand(4);\n\nfor (var i = 0; i < DATA_COUNT; ++i) {\n  labels.push('' + i);\n}\n// </block:setup>\n\nvar config = /* <block:config:0> */ {\n  type: 'line',\n  data: {\n    labels: labels,\n    datasets: [{\n      backgroundColor: Utils.color(0),\n      borderColor: Utils.color(0),\n      data: Utils.numbers({\n        count: DATA_COUNT,\n        min: 0,\n        max: 100\n      })\n    }]\n  },\n  options: {\n    plugins: {\n      datalabels: {\n        align: function(context) {\n          return context.dataIndex % 2 ? 'end' : 'center';\n        },\n        backgroundColor: function(context) {\n          return context.dataIndex % 2 ?\n            context.dataset.borderColor :\n            'rgba(255, 255, 255, 0.8)';\n        },\n        borderColor: function(context) {\n          return context.dataIndex % 2 ? null : context.dataset.borderColor;\n        },\n        borderWidth: function(context) {\n          return context.dataIndex % 2 ? 0 : 2;\n        },\n        color: function(context) {\n          return context.dataIndex % 2 ? 'white' : context.dataset.borderColor;\n        },\n        font: {\n          weight: 'bold',\n        },\n        formatter: function(value, context) {\n          return context.dataIndex + ': ' + Math.round(value) + '\\'';\n        },\n        offset: 8,\n        padding: 6,\n      }\n    },\n\n    // Core options\n    aspectRatio: 5 / 3,\n    layout: {\n      padding: {\n        top: 32,\n        right: 24,\n        bottom: 24,\n        left: 0\n      }\n    },\n    elements: {\n      line: {\n        fill: false,\n        tension: 0.4\n      }\n    },\n  }\n} /* </block:config> */;\n\nvar actions = [\n  {\n    name: 'Randomize',\n    handler: function(chart) {\n      chart.data.datasets.forEach(function(dataset, i) {\n        var color = Utils.color();\n        dataset.backgroundColor = color;\n        dataset.borderColor = color;\n        dataset.data = dataset.data.map(function(value) {\n          return Utils.rand(0, 100);\n        });\n      });\n\n      chart.update();\n    }\n  },\n  {\n    name: 'Add data',\n    handler: function(chart) {\n      chart.data.labels.push(chart.data.labels.length);\n      chart.data.datasets.forEach(function(dataset, i) {\n        dataset.data.push(Utils.rand(0, 100));\n      });\n\n      chart.update();\n    }\n  },\n  {\n    name: 'Remove data',\n    handler: function(chart) {\n      chart.data.labels.shift();\n      chart.data.datasets.forEach(function(dataset, i) {\n        dataset.data.shift();\n      });\n\n      chart.update();\n    }\n  }\n];\n\nmodule.exports = {\n  actions: actions,\n  config: config,\n};\n"}})],1)}),[],!1,null,null,null);t.default=o.exports}}]);