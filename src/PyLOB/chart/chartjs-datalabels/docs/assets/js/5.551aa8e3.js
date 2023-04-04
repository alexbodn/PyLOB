(window.webpackJsonp=window.webpackJsonp||[]).push([[5],{291:function(e,t,a){e.exports=a.p+"assets/img/anchor.af396841.png"},292:function(e,t,a){e.exports=a.p+"assets/img/clamp.3d93ea42.png"},293:function(e,t,a){e.exports=a.p+"assets/img/align.fe79da09.png"},324:function(e,t,a){"use strict";a.r(t);var o=a(3),i=Object(o.a)({},(function(){var e=this,t=e.$createElement,o=e._self._c||t;return o("ContentSlotsDistributor",{attrs:{"slot-key":e.$parent.slotKey}},[o("h1",{attrs:{id:"positioning"}},[o("a",{staticClass:"header-anchor",attrs:{href:"#positioning"}},[e._v("#")]),e._v(" Positioning")]),e._v(" "),o("h2",{attrs:{id:"anchoring"}},[o("a",{staticClass:"header-anchor",attrs:{href:"#anchoring"}},[e._v("#")]),e._v(" Anchoring")]),e._v(" "),o("p",[e._v("An anchor point is defined by an orientation vector and a position on the data element. The orientation depends on the scale type (vertical, horizontal or radial). The position is calculated based on the "),o("code",[e._v("anchor")]),e._v(" option and the orientation vector.")]),e._v(" "),o("p",[e._v("Supported values for "),o("code",[e._v("anchor")]),e._v(":")]),e._v(" "),o("ul",[o("li",[o("code",[e._v("'center'")]),e._v(" (default): element center")]),e._v(" "),o("li",[o("code",[e._v("'start'")]),e._v(": lowest element boundary")]),e._v(" "),o("li",[o("code",[e._v("'end'")]),e._v(": highest element boundary")])]),e._v(" "),o("p",[o("img",{attrs:{src:a(291),alt:"chartjs-plugin-datalabels"}})]),e._v(" "),o("h2",{attrs:{id:"clamping"}},[o("a",{staticClass:"header-anchor",attrs:{href:"#clamping"}},[e._v("#")]),e._v(" Clamping")]),e._v(" "),o("p",[e._v("The "),o("code",[e._v("clamp")]),e._v(" option, when "),o("code",[e._v("true")]),e._v(", enforces the anchor position to be calculated based on the "),o("em",[e._v("visible geometry")]),e._v(" of the associated element (i.e. part inside the chart area).")]),e._v(" "),o("p",[o("img",{attrs:{src:a(292),alt:"chartjs-plugin-datalabels"}})]),e._v(" "),o("div",{staticClass:"custom-block tip"},[o("p",{staticClass:"custom-block-title"},[e._v("TIP")]),e._v(" "),o("p",[e._v("If the element is fully hidden (i.e. entirely outside the chart area), anchor points will "),o("strong",[e._v("not")]),e._v(" be adjusted and thus will also be outside the viewport.")])]),e._v(" "),o("h2",{attrs:{id:"alignment-and-offset"}},[o("a",{staticClass:"header-anchor",attrs:{href:"#alignment-and-offset"}},[e._v("#")]),e._v(" Alignment and Offset")]),e._v(" "),o("p",[e._v("The "),o("code",[e._v("align")]),e._v(" option defines the position of the label relative to the anchor point position and orientation. Its value can be expressed either by a number representing the clockwise angle (in degree) or by one of the following string presets:")]),e._v(" "),o("ul",[o("li",[o("code",[e._v("'center'")]),e._v(" (default): the label is centered on the anchor point")]),e._v(" "),o("li",[o("code",[e._v("'start'")]),e._v(": the label is positioned before the anchor point, following the same direction")]),e._v(" "),o("li",[o("code",[e._v("'end'")]),e._v(": the label is positioned after the anchor point, following the same direction")]),e._v(" "),o("li",[o("code",[e._v("'right'")]),e._v(": the label is positioned to the right of the anchor point (0°)")]),e._v(" "),o("li",[o("code",[e._v("'bottom'")]),e._v(": the label is positioned to the bottom of the anchor point (90°)")]),e._v(" "),o("li",[o("code",[e._v("'left'")]),e._v(": the label is positioned to the left of the anchor point (180°)")]),e._v(" "),o("li",[o("code",[e._v("'top'")]),e._v(": the label is positioned to the top of the anchor point (270°)")])]),e._v(" "),o("p",[e._v("The "),o("code",[e._v("offset")]),e._v(" represents the distance (in pixels) to pull the label "),o("em",[e._v("away")]),e._v(" from the anchor point. This option is "),o("strong",[e._v("not applicable")]),e._v(" when "),o("code",[e._v("align")]),e._v(" is "),o("code",[e._v("'center'")]),e._v(". Also note that if "),o("code",[e._v("align")]),e._v(" is "),o("code",[e._v("'start'")]),e._v(", the label is moved in the opposite direction. The default value is "),o("code",[e._v("4")]),e._v(".")]),e._v(" "),o("p",[o("img",{attrs:{src:a(293),alt:"chartjs-plugin-datalabels"}})]),e._v(" "),o("h2",{attrs:{id:"rotation"}},[o("a",{staticClass:"header-anchor",attrs:{href:"#rotation"}},[e._v("#")]),e._v(" Rotation")]),e._v(" "),o("p",[e._v("This option controls the clockwise rotation angle (in degrees) of the label, the rotation center point being the label center. The default value is "),o("code",[e._v("0")]),e._v(" (no rotation).")]),e._v(" "),o("h2",{attrs:{id:"visibility"}},[o("a",{staticClass:"header-anchor",attrs:{href:"#visibility"}},[e._v("#")]),e._v(" Visibility")]),e._v(" "),o("p",[e._v("The "),o("code",[e._v("display")]),e._v(" option controls the visibility of labels and accepts the following values:")]),e._v(" "),o("ul",[o("li",[o("code",[e._v("true")]),e._v(" (default): the label is drawn")]),e._v(" "),o("li",[o("code",[e._v("false")]),e._v(": the label is hidden")]),e._v(" "),o("li",[o("code",[e._v("'auto'")]),e._v(": the label is hidden if it "),o("a",{attrs:{href:"#overlap"}},[e._v("overlap")]),e._v(" with another label")])]),e._v(" "),o("p",[e._v("This option is "),o("RouterLink",{attrs:{to:"/guide/options.html#scriptable-options"}},[e._v("scriptable")]),e._v(", so it's possible to show/hide specific labels:")],1),e._v(" "),o("div",{staticClass:"language-javascript extra-class"},[o("pre",{pre:!0,attrs:{class:"language-javascript"}},[o("code",[o("span",{pre:!0,attrs:{class:"token function-variable function"}},[e._v("display")]),o("span",{pre:!0,attrs:{class:"token operator"}},[e._v(":")]),e._v(" "),o("span",{pre:!0,attrs:{class:"token keyword"}},[e._v("function")]),o("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("(")]),o("span",{pre:!0,attrs:{class:"token parameter"}},[e._v("context")]),o("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(")")]),e._v(" "),o("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("{")]),e._v("\n  "),o("span",{pre:!0,attrs:{class:"token keyword"}},[e._v("return")]),e._v(" context"),o("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(".")]),e._v("dataIndex "),o("span",{pre:!0,attrs:{class:"token operator"}},[e._v("%")]),e._v(" "),o("span",{pre:!0,attrs:{class:"token number"}},[e._v("2")]),o("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(";")]),e._v(" "),o("span",{pre:!0,attrs:{class:"token comment"}},[e._v("// display labels with an odd index")]),e._v("\n"),o("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("}")]),e._v("\n")])])]),o("h2",{attrs:{id:"overlap"}},[o("a",{staticClass:"header-anchor",attrs:{href:"#overlap"}},[e._v("#")]),e._v(" Overlap")]),e._v(" "),o("p",[e._v("The "),o("code",[e._v("display: 'auto'")]),e._v(" option can be used to prevent overlapping labels, based on the following rules when two labels overlap:")]),e._v(" "),o("ul",[o("li",[e._v("if both labels are "),o("code",[e._v("display: true")]),e._v(", they will be drawn overlapping")]),e._v(" "),o("li",[e._v("if both labels are "),o("code",[e._v("display: 'auto'")]),e._v(", the one with the highest data index will be hidden. If labels are at the same data index, the one with the highest dataset index will be hidden")]),e._v(" "),o("li",[e._v("if one label is "),o("code",[e._v("display: true")]),e._v(" and the other one is "),o("code",[e._v("display: 'auto'")]),e._v(", the one with "),o("code",[e._v("'auto'")]),e._v(" will be hidden (whatever the data/dataset indices)")])]),e._v(" "),o("div",{staticClass:"custom-block tip"},[o("p",{staticClass:"custom-block-title"},[e._v("TIP")]),e._v(" "),o("p",[e._v("Labels with "),o("code",[e._v("display: false")]),e._v(" don't contribute to the overlap detection.")])]),e._v(" "),o("h2",{attrs:{id:"clipping"}},[o("a",{staticClass:"header-anchor",attrs:{href:"#clipping"}},[e._v("#")]),e._v(" Clipping")]),e._v(" "),o("p",[e._v("When the "),o("code",[e._v("clip")]),e._v(" option is "),o("code",[e._v("true")]),e._v(", the part of the label which is outside the chart area will be masked (see "),o("a",{attrs:{href:"https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/clip",target:"_blank",rel:"noopener noreferrer"}},[e._v("CanvasRenderingContext2D.clip()"),o("OutboundLink")],1),e._v(")")])])}),[],!1,null,null,null);t.default=i.exports}}]);