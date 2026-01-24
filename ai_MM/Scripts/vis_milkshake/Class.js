/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

/* Simple JavaScript Inheritance
 * By John Resig http://ejohn.org/
 * MIT Licensed.
 */
// Inspired by base2 and Prototype
(function(){
    var initializing = false, fnTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/;
    this.Class = function(){};
    Class.extend = function(prop) {
	var _super = this.prototype;
	initializing = true;
	var prototype = new this();
	initializing = false;
	for (var name in prop) {
	    prototype[name] = typeof prop[name] == "function" && 
		typeof _super[name] == "function" && fnTest.test(prop[name]) ?
		(function(name, fn){
		    return function() {
			var tmp = this._super;
			this._super = _super[name];
			var ret = fn.apply(this, arguments);        
			this._super = tmp;
			return ret;
		    };
		})(name, prop[name]) :
		prop[name];
	}
	function Class() {
	    if ( !initializing && this.init )
		this.init.apply(this, arguments);
	}
	Class.prototype = prototype;
	Class.prototype.constructor = Class;
	Class.extend = arguments.callee;
	return Class;
    };
})();
