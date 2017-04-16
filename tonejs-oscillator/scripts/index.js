/**
 *  StartAudioContext.js
 *  @author Yotam Mann
 *  @license http://opensource.org/licenses/MIT MIT License
 *  @copyright 2016 Yotam Mann
 */
(function (root, factory) {
	if (typeof define === "function" && define.amd) {
		define([], factory)
	 } else if (typeof module === "object" && module.exports) {
        module.exports = factory()
	} else {
		root.StartAudioContext = factory()
  }
}(this, function () {

	//TAP LISTENER/////////////////////////////////////////////////////////////

	/**
	 * @class  Listens for non-dragging tap ends on the given element
	 * @param {Element} element
	 * @internal
	 */
	var TapListener = function(element, context){

		this._dragged = false

		this._element = element

		this._bindedMove = this._moved.bind(this)
		this._bindedEnd = this._ended.bind(this, context)

		element.addEventListener("touchmove", this._bindedMove)
		element.addEventListener("touchend", this._bindedEnd)
		element.addEventListener("mouseup", this._bindedEnd)
	}

	/**
	 * drag move event
	 */
	TapListener.prototype._moved = function(e){
		this._dragged = true
	};

	/**
	 * tap ended listener
	 */
	TapListener.prototype._ended = function(context){
		if (!this._dragged){
			startContext(context)
		}
		this._dragged = false
	};

	/**
	 * remove all the bound events
	 */
	TapListener.prototype.dispose = function(){
		this._element.removeEventListener("touchmove", this._bindedMove)
		this._element.removeEventListener("touchend", this._bindedEnd)
		this._element.removeEventListener("mouseup", this._bindedEnd)
		this._bindedMove = null
		this._bindedEnd = null
		this._element = null
	};

	//END TAP LISTENER/////////////////////////////////////////////////////////

	/**
	 * Plays a silent sound and also invoke the "resume" method
	 * @param {AudioContext} context
	 * @private
	 */
	function startContext(context){
		// this accomplishes the iOS specific requirement
		var buffer = context.createBuffer(1, 1, context.sampleRate)
		var source = context.createBufferSource()
		source.buffer = buffer
		source.connect(context.destination)
		source.start(0)

		// resume the audio context
		if (context.resume){
			context.resume()
		}
	}

	/**
	 * Returns true if the audio context is started
	 * @param  {AudioContext}  context
	 * @return {Boolean}
	 * @private
	 */
	function isStarted(context){
		 return context.state === "running"
	}

	/**
	 * Invokes the callback as soon as the AudioContext
	 * is started
	 * @param  {AudioContext}   context
	 * @param  {Function} callback
	 */
	function onStarted(context, callback){

		function checkLoop(){
			if (isStarted(context)){
				callback()
			} else {
				requestAnimationFrame(checkLoop)
				if (context.resume){
					context.resume()
				}
			}
		}

		if (isStarted(context)){
			callback()
		} else {
			checkLoop()
		}
	}

	/**
	 * Add a tap listener to the audio context
	 * @param  {Array|Element|String|jQuery} element
	 * @param {Array} tapListeners
	 */
	function bindTapListener(element, tapListeners, context){
		if (Array.isArray(element) || (NodeList && element instanceof NodeList)){
			for (var i = 0; i < element.length; i++){
				bindTapListener(element[i], tapListeners, context)
			}
		} else if (typeof element === "string"){
			bindTapListener(document.querySelectorAll(element), tapListeners, context)
		} else if (element.jquery && typeof element.toArray === "function"){
			bindTapListener(element.toArray(), tapListeners, context)
		} else if (Element && element instanceof Element){
			//if it's an element, create a TapListener
			var tap = new TapListener(element, context)
			tapListeners.push(tap)
		}
	}

	/**
	 * @param {AudioContext} context The AudioContext to start.
	 * @param {Array|String|Element|jQuery} elements For iOS, the list of elements
	 *                                               to bind tap event listeners
	 *                                               which will start the AudioContext.
	 * @param {Function=} callback The callback to invoke when the AudioContext is started.
	 * @return {Promise} The promise is invoked when the AudioContext
	 *                       is started.
	 */
	function StartAudioContext(context, elements, callback){

		//the promise is invoked when the AudioContext is started
		var promise = new Promise(function(success) {
			onStarted(context, success)
		})

		// The TapListeners bound to the elements
		var tapListeners = []

		// add all the tap listeners
		if (elements){
			bindTapListener(elements, tapListeners, context)
		}

		//dispose all these tap listeners when the context is started
		promise.then(function(){
			for (var i = 0; i < tapListeners.length; i++){
				tapListeners[i].dispose()
			}
			tapListeners = null

			if (callback){
				callback()
			}
		})

		return promise
	}

	return StartAudioContext
}))

/* globals Tone, StartAudioContext */


var Interface = {
	isMobile : false
};

/**
 *
 *
 *  INIT
 *
 */
$(function(){
	//mobile start
	if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
		Interface.isMobile = true;
		$("body").addClass("Mobile");
		var element = $("<div>", {"id" : "MobileStart"}).appendTo("body");
		var button = $("<div>").attr("id", "Button").text("Enter").appendTo(element);
		StartAudioContext(Tone.context, button, function(){
			element.remove();
		});
	}
});

/**
 *
 *
 *  DRAGGER
 *
 */
Interface.Dragger = function(params){

	if (this instanceof Interface.Dragger){

		if ($("#DragContainer").length === 0){
			$("<div>", {
				"id" : "DragContainer"
			}).appendTo(params.parent || "#Content");
		}

		this.container = $("#DragContainer");

		/**
		 *  the tone object
		 */
		this.tone = params.tone;

		/**
		 *  callbacks
		 */
		this.start = params.start;

		this.end = params.end;

		this.drag = params.drag;

		/**
		 *  the name
		 */
		var name = params.name ? params.name : this.tone ? this.tone.toString() : "";

		/**
		 *  elements
		 */
		this.element = $("<div>", {
			"class" : "Dragger",
			"id" : name
		}).appendTo(this.container)
			.on("dragMove", this._ondrag.bind(this))
			.on("touchstart mousedown", this._onstart.bind(this))
			.on("dragEnd touchend mouseup", this._onend.bind(this));

		this.name = $("<div>", {
			"id" : "Name",
			"text" : name
		}).appendTo(this.element);

		this.element.draggabilly({
			"axis" : this.axis,
			"containment": this.container
		});

		/**
		 *  x slider
		 */
		var xParams = params.x;
		xParams.axis = "x";
		xParams.element = this.element;
		xParams.tone = this.tone;
		xParams.container = this.container;
		this.xAxis = new Interface.Slider(xParams);

		/**
		 *  y slider
		 */
		var yParams = params.y;
		yParams.axis = "y";
		yParams.element = this.element;
		yParams.tone = this.tone;
		yParams.container = this.container;
		this.yAxis = new Interface.Slider(yParams);

		//set the axis indicator
		var position = this.element.position();
		this.halfSize = this.xAxis.halfSize;
		this.xAxis.axisIndicator.css("top", position.top + this.halfSize);
		this.yAxis.axisIndicator.css("left", position.left + this.halfSize);
	} else {
		return new Interface.Dragger(params);
	}
};

Interface.Dragger.prototype._ondrag = function(e, pointer){
	if (this.drag){
		this.drag();
	}
	this.xAxis._ondrag(e, pointer);
	this.yAxis._ondrag(e, pointer);
	var position = this.element.position();
	this.xAxis.axisIndicator.css("top", position.top + this.halfSize);
	this.yAxis.axisIndicator.css("left", position.left + this.halfSize);
};

Interface.Dragger.prototype._onstart = function(e){
	if (this.start){
		this.start();
	}
	this.xAxis._onstart(e);
	this.yAxis._onstart(e);
};

Interface.Dragger.prototype._onend = function(e){
	if (this.end){
		this.end();
	}
	this.xAxis._onend(e);
	this.yAxis._onend(e);
	var position = this.element.position();
	this.xAxis.axisIndicator.css("top", position.top + this.halfSize);
	this.yAxis.axisIndicator.css("left", position.left + this.halfSize);
};



/**
 *
 *
 *  SLIDER
 *
 */
Interface.Slider = function(params){

	if (this instanceof Interface.Slider){

		this.tone = params.tone;

		/**
		 *  the name
		 */
		var name = params.name ? params.name : this.tone ? this.tone.toString() : "";

		/**
		 *  callback functions
		 */
		this.start = params.start;

		this.end = params.end;

		this.drag = params.drag;

		/**
		 *  the axis indicator
		 */
		this.axis = params.axis || "x";

		if (!params.element){

			this.container = $("<div>", {
				"class" : "Slider "+this.axis,
			}).appendTo(params.parent || "#Content");

			this.element = $("<div>", {
				"class" : "Dragger",
				"id" : name
			}).appendTo(this.container)
				.on("dragMove", this._ondrag.bind(this))
				.on("touchstart mousedown", this._onstart.bind(this))
				.on("dragEnd touchend mouseup", this._onend.bind(this));

			this.name = $("<div>", {
				"id" : "Name"
			}).appendTo(this.element);

			this.element.draggabilly({
				"axis" : this.axis,
				"containment": this.container.get(0)
			});
		} else {
			this.element = params.element;

			this.container = params.container;
		}

		this.axisIndicator = $("<div>", {
			"id" : this.axis + "Axis",
			"class" : "Axis"
		}).appendTo(this.container);

		/**
		 *  the initial value / position
		 */
		this.parameter = params.param || false;
		//default values
		this.min = typeof params.min === "undefined" ? 0 : params.min;
		this.max = typeof params.max === "undefined" ? 1 : params.max;
		this.exp = typeof params.exp === "undefined" ? 1 : params.exp;
		if (params.options){
			this.options = params.options;
			this.min = 0;
			this.max = this.options.length - 1;
			this.exp = params.exp || 1;
		}

		/**
		 *  cache some measurements for later
		 */
		this.halfSize = this.element.width() / 2;

		this.maxAxis = this.axis === "x" ? "width" : "height";
		this.posAxis = this.axis === "x" ? "left" : "top";
		this.oppositeAxis = this.axis === "x" ? "top" : "left";

		/**
		 *  initial value
		 */
		if (this.parameter || typeof params.value !== "undefined"){

			var paramValue = typeof params.value !== "undefined" ? params.value : this.tone.get(this.parameter);

			this.value(paramValue);
		}

	} else {
		return new Interface.Slider(params);
	}
};

Interface.Slider.prototype.value = function(val){
	var maxSize = this.container[this.maxAxis]() - this.element[this.maxAxis]();
	//y gets inverted
	if (this.axis === "y"){
		maxSize = this.container[this.maxAxis]() - maxSize;
	}

	if (val.hasOwnProperty(this.parameter)){
		val = val[this.parameter];
	}

	if (this.options){
		val = this.options.indexOf(val);
	}

	var pos = (val - this.min) / (this.max - this.min);
	pos = Math.pow(pos, 1 / this.exp) * (maxSize );
	this.element.css(this.posAxis, pos);

	if (this.options){
		this._setParam(this.options[val]);
	}
};


Interface.Slider.prototype._ondrag = function(e, pointer){
	if (typeof this.top === "undefined"){
		this.top = this.container.offset().top;
		this.left = this.container.offset().left;
	}

	var normPos;
	if (this.axis === "x"){
		var xVal = Math.max((pointer.pageX - this.left), 0);
		normPos =  xVal / (this.container.width());
	}  else {
		var yVal = Math.max((pointer.pageY - this.top ), 0);
		normPos =  yVal / (this.container.height());
		normPos = 1 - normPos;
	}
	normPos = Math.pow(normPos, this.exp);

	var result = normPos * (this.max - this.min) + this.min;

	result = Math.max(Math.min(this.max, result), this.min);

	var value = result;

	if (this.options){
		value = this.options[Math.round(result)];
	}

	if (this.drag){
		this.drag(value);
	}

	this._setParam(value);
};

Interface.Slider.prototype._onstart = function(e){
	e.preventDefault();
	if (this.start){
		this.start();
	}
};

Interface.Slider.prototype._onend = function(){
	if (this.end){
		this.end();
	}
};

Interface.Slider.prototype._setParam = function(value){
	if (this.parameter && this.tone){
		this.tone.set(this.parameter, value);
	}
};

/**
 *
 * BUTTON
 *
 */
Interface.Button = function(params){

	if (this instanceof Interface.Button){

		this.activeText = params.activeText || false;

		this.text = params.text || "Button";

		this.type = params.type || "moment";

		this.element = $("<div>", {
			"class" : "Button",
			"text" : this.text
		}).appendTo(params.parent || "#Content")
			.on("mousedown touchstart", this._start.bind(this));

		if (this.type === "moment"){
			this.element.on("mouseup touchend", this._end.bind(this));
		} else {
			this.element.addClass("Toggle");
		}

		/**
		 *  the button state
		 */
		this.active = false;

		/**
		 *  callbacks
		 */
		this.start = params.start;
		this.end = params.end;

		/**
		 *  key presses
		 */
		if (params.key){
			this.key = params.key;
			$(window).on("keydown", this._keydown.bind(this));
			if (this.type === "moment"){
				$(window).on("keyup", this._keyup.bind(this));
			}
		}
	} else {
		return new Interface.Button(params);
	}
};

Interface.Button.prototype._start = function(e){
	if (e){
		e.preventDefault();
	}
	if (!this.active){
		this.active = true;
		this.element.addClass("Active");
		if (this.activeText){
			this.element.text(this.activeText);
		}
		if (this.start){
			this.start();
		}
	} else if (this.type === "toggle" && this.active){
		this._end();
	}
};

Interface.Button.prototype._end = function(e){
	if (e){
		e.preventDefault();
	}
	if (this.active){
		this.active = false;
		this.element.removeClass("Active");
		this.element.text(this.text);
		if (this.end){
			this.end();
		}
	}
};

Interface.Button.prototype._keydown = function(e){
	if (e.which === this.key){
		e.preventDefault();
		this._start();
	}
};

Interface.Button.prototype._keyup = function(e){
	if (e.which === this.key){
		e.preventDefault();
		this._end();
	}
};

/**
 *
 *	TRANSPORT
 *
 */
Interface.Transport = function(){

	if (this instanceof Interface.Transport){

		this.element = $("<div>", {
			"class" : "Transport",
		}).appendTo("#Content");

		this.position = $("<div>", {
			"id" : "Position"
		}).appendTo(this.element);

		this._boundLoop = this._loop.bind(this);
		this._loop();

	} else {
		return new Interface.Transport();
	}
};

Interface.Transport.prototype._loop = function(){
	setTimeout(this._boundLoop, 50);
	this.position.text(Tone.Transport.position);
};

