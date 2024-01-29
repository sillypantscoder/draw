var log = (() => {
	var logElm = document.createElement("div")
	logElm.setAttribute("style", `position: absolute; bottom: 0; right: 0;`)
	document.body.appendChild(logElm)
	/** @param {string} data */
	function log(data) {
		var e = document.createElement("div")
		logElm.appendChild(e)
		e.innerText = data
		setTimeout(() => {
			e.remove()
		}, 3000)
	}
	return log
})();
/**
 * @param {*} o
 * @returns {string}
 */
function repr(o) {
	if (typeof o == "string") {
		return "\"" + o + "\""
	}
	if (typeof o == "number") {
		return o.toString()
	}
	if (o instanceof Array) {
		return "[" + o.map((v) => repr(v)).join(", ") + "]"
	}
	// object
	var keys = Object.keys(o)
	var r = "{"
	for (var i = 0; i < keys.length; i++) {
		if (i != 0) r += ", "
		r += repr(keys[i])
		r += ": "
		r += repr(o[keys[i]])
	}
	r += "}"
	return r
}
/** @param {number[]} o */
function avg(o) {
	return o.reduce((a, b) => a + b, 0) / o.length
}
/**
 * @param {{ x: number, y: number }} point1
 * @param {{ x: number, y: number }} point2
 */
function dist(point1, point2) {
	return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2))
}

var theSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg")
document.querySelector(".mainContainer")?.appendChild(theSVG)
theSVG.id = "theSVG"

// Switch tools
document.querySelector(".menu")?.addEventListener("click", (event) => {
	/** @type {HTMLElement | null} */
	// @ts-ignore
	var menuoption = event.target
	while (menuoption != null) {
		if (menuoption.classList.contains("menu-option")) break;
		menuoption = menuoption.parentElement
	}
	if (menuoption != null) {
		document.querySelector('.menu-option-selected')?.classList.remove('menu-option-selected');
		menuoption.classList.add("menu-option-selected")
	}
}, false)

/**
 * @param {string} path
 * @returns {Promise<string>}
 */
function get(path) {
	return new Promise((resolve) => {
		var x = new XMLHttpRequest()
		x.open("GET", path)
		x.addEventListener("loadend", () => {
			resolve(x.responseText)
		})
		x.send()
	})
}
/**
 * @param {string} path
 * @param {string} body
 * @returns {Promise<void>}
 */
function post(path, body) {
	return new Promise((resolve) => {
		var x = new XMLHttpRequest()
		x.open("POST", path)
		x.addEventListener("loadend", () => {
			resolve()
		})
		x.send(body)
	})
}

var clientID = Math.floor(Math.random() * 100000)

/**
 * @param {{ x: number, y: number }[]} points
 */
function pointsToPath(points) {
	var r = `M ${points[0].x} ${points[0].y}`
	for (var i = 1; i < points.length; i++) {
		r += ` L ${points[i].x} ${points[i].y}`
	}
	return r
}

class SceneObject {
	/**
	 * @param {number} id
	 * @param {Object.<string, any>} data
	 */
	constructor(id, data) {
		this.data = data
		this.id = id
	}
	add() {
		objects.push(this)
	}
	verify() {}
	remove() {
		objects.splice(objects.indexOf(this), 1)
	}
	removeAndSendErase() {
		this.remove()
		SceneObject.sendErase(this.id)
	}
	/**
	 * @param {number} id
	 * @param {Object.<string, any>} data
	 */
	static sendCreateObject(id, data) {
		return post("/create_object", JSON.stringify({
			"id": id,
			"data": data
		}))
	}
	/**
	 * @param {number} id
	 */
	static sendErase(id) {
		return post("/erase", id.toString())
	}
	/**
	 * @param {Object.<string, any>} data
	 * @param {number} id
	 * @returns {SceneObject}
	 */
	static createFromDataAndID(data, id) {
		var objClass = objectTypes[data["type"]]
		var o = new objClass(id, data)
		o.add()
		return o
	}
	/**
	 * @param {Object.<string, any>} data
	 * @returns {SceneObject}
	 */
	static createFromData(data) {
		var id = Math.floor(Math.random() * 100000)
		return this.createFromDataAndID(data, id)
	}
	/**
	 * @param {Object.<string, any>} data
	 */
	static createAndSendFromData(data) {
		var o = this.createFromData(data)
		this.sendCreateObject(o.id, data)
	}
	/** @param {{ x: number, y: number }} pos */
	collidepoint(pos) {
		return true
	}
}
class DrawingObject extends SceneObject {
	/**
	 * @param {number} id
	 * @param {Object.<string, any>} data
	 */
	constructor(id, data) {
		super(id, data)
		/** @type {{ x: number, y: number }[]} */
		this.path = data.d
		this.elm = document.createElementNS("http://www.w3.org/2000/svg", "path")
		this.elm.setAttribute("d", pointsToPath(this.path))
		this.elm.setAttribute("fill", "none")
		this.elm.setAttribute("stroke", "black")
		this.elm.setAttribute("stroke-width", "5")
		this.elm.setAttribute("opacity", "0.5")
	}
	add() {
		super.add()
		theSVG.appendChild(this.elm)
	}
	verify() {
		this.elm.removeAttribute("opacity")
	}
	remove() {
		super.remove()
		this.elm.remove()
	}
	/** @param {{ x: number, y: number }} pos */
	collidepoint(pos) {
		for (var i = 0; i < this.path.length; i += 3) {
			var p = this.path[i]
			var xi = Math.abs(p.x - pos.x)
			var yi = Math.abs(p.y - pos.y)
			if (xi < 10 && yi < 10) {
				return true
			}
		}
		return false
	}
}

/** @type {Object.<string, typeof SceneObject>} */
var objectTypes = {
	"drawing": DrawingObject
}

/** @type {SceneObject[]} */
var objects = []

/**
 * @param {number} id
 * @param {Object.<string, any>} data
 */
function importObject(id, data) {
	for (var i = 0; i < objects.length; i++) {
		if (objects[i].id == id) {
			// re-send
			objects[i].verify()
			return
		}
	}
	// create the object
	var o = SceneObject.createFromDataAndID(data, id)
	o.verify()
}
/**
 * @param {number} id
 */
function importErase(id) {
	for (var i = 0; i < objects.length; i++) {
		if (objects[i].id == id) {
			// erase this
			objects[i].remove()
			return
		}
	}
}
async function getMessages() {
	var data = await get("/messages/" + clientID)
	/** @type {({ type: "create_object", id: number, data: Object.<string, any> } | { "type": "erase", id: number })[]} */
	var messages = JSON.parse(data)
	for (var i = 0; i < messages.length; i++) {
		var msg = messages[i]
		if (msg.type == "create_object") {
			importObject(msg.id, msg.data)
		}
		if (msg.type == "erase") {
			importErase(msg.id)
		}
	}
}
async function getMessagesLoop() {
	while (true) {
		await getMessages()
		await new Promise((resolve) => setTimeout(resolve, 400))
	}
}
post("/connect", clientID.toString()).then(() => getMessagesLoop())

/** @type {{ x: number, y: number, zoom: number }} */
var viewPos = { x: 0, y: 0, zoom: 1 }

/** @returns {"Draw" | "Move" | "Erase"} */
function getCurrentMode() {
	// @ts-ignore
	return document.querySelector(".menu-option-selected").dataset.mode
}
function updateViewPos() {
	theSVG.setAttribute("style", `position: absolute; top: ${viewPos.y}px; left: ${viewPos.x}px; transform: scale(${viewPos.zoom}); transform-origin: top left;`)
}

/**
 * @param {{ x: number, y: number }} origin
 * @param {number} amount
 */
function zoomView(origin, amount) {
	// viewPos.x *= ((amount * origin.x) / -viewPos.x) + amount + (origin.x / viewPos.x)
	// viewPos.y *= ((amount * origin.y) / -viewPos.y) + amount + (origin.y / viewPos.y)
	viewPos.x += ((viewPos.x - origin.x) * amount) + (origin.x - viewPos.x)
	viewPos.y += ((viewPos.y - origin.y) * amount) + (origin.y - viewPos.y)
	viewPos.zoom *= amount
	// log(repr(viewPos))
}

/** @param {{ x: number, y: number }} pos */
function erase(pos) {
	var o = [...objects]
	for (var i = 0; i < o.length; i++) {
		if (o[i].collidepoint(pos)) {
			o[i].removeAndSendErase()
		}
	}
}

class TrackedTouch {
	/**
	 * @param {number} initialX
	 * @param {number} initialY
	 * @param {number} id
	 */
	constructor(initialX, initialY, id) {
		this.x = initialX
		this.y = initialY
		this.id = id
		this.mode = this.getMode()
		touches.push(this)
	}
	getRealPos() {
		var realPos = { x: (this.x - viewPos.x) / viewPos.zoom, y: (this.y - viewPos.y) / viewPos.zoom }
		return realPos
	}
	/**
	 * @param {number} newX
	 * @param {number} newY
	 */
	updatePos(newX, newY) {
		this.mode.onMove(this.x, this.y, newX, newY)
		this.x = newX
		this.y = newY
	}
	remove() {
		this.mode.onEnd(this.x, this.y)
		touches.splice(touches.indexOf(this), 1)
	}
	cancel() {
		this.mode.onCancel(this.x, this.y)
		touches.splice(touches.indexOf(this), 1)
	}
	/** @returns {TouchMode} */
	getMode() {
		// First of all, if there is another touch, we are definitely zooming or panning or something.
		if (touches.length >= 1) {
			// Also, so are all the other touches.
			var _t = [...touches]
			for (var i = 0; i < _t.length; i++) {
				_t[i].cancel()
				_t[i].mode = new PanTouchMode(_t[i])
				touches.push(_t[i])
			}
			return new PanTouchMode(this)
		}
		// Then, find the selected mode in the toolbar.
		var mode = getCurrentMode()
		if (mode == "Draw") return new DrawTouchMode(this)
		if (mode == "Move") return new PanTouchMode(this)
		if (mode == "Erase") return new EraseTouchMode(this)
		// Uhhhh.....
		return new PanTouchMode(this)
	}
	toString() {
		return `TrackedTouch { x: ${this.x}; y: ${this.y}; mode: ${this.mode.toString()} }`
	}
}
class TouchMode {
	/**
	 * @param {TrackedTouch} touch
	 */
	constructor(touch) {
		this.touch = touch
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 * @param {number} newX
	 * @param {number} newY
	 */
	onMove(previousX, previousY, newX, newY) {}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onEnd(previousX, previousY) {}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onCancel(previousX, previousY) {}
	toString() {
		return `TouchMode { broken }`
	}
}
class DrawTouchMode extends TouchMode {
	/**
	 * @param {TrackedTouch} touch
	 */
	constructor(touch) {
		super(touch)
		/** @type {{ x: number, y: number }[]} */
		this.points = [touch.getRealPos()]
		/** @type {SVGPathElement} */
		this.elm = document.createElementNS("http://www.w3.org/2000/svg", "path")
		this.elm.setAttribute("fill", "none")
		this.elm.setAttribute("stroke", "red")
		this.elm.setAttribute("stroke-width", "5")
		theSVG.appendChild(this.elm)
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 * @param {number} newX
	 * @param {number} newY
	 */
	onMove(previousX, previousY, newX, newY) {
		this.points.push(this.touch.getRealPos())
		this.elm.setAttribute("d", pointsToPath(this.points))
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onEnd(previousX, previousY) {
		// Remove current display elm
		this.elm.remove()
		// Add drawing to screen
		if (this.points.length > 6) {
			SceneObject.createAndSendFromData({
				"type": "drawing",
				"d": this.points
			})
		}
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onCancel(previousX, previousY) {
		this.elm.remove()
	}
	toString() {
		return `DrawTouchMode { ${this.points.length} points }`
	}
}
class PanTouchMode extends TouchMode {
	/**
	 * @param {TrackedTouch} touch
	 */
	constructor(touch) {
		super(touch)
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 * @param {number} newX
	 * @param {number} newY
	 */
	onMove(previousX, previousY, newX, newY) {
		var previousPos = {
			x: avg(touches.map((v) => v.x)),
			y: avg(touches.map((v) => v.y))
		}
		var previousZoom = avg(touches.map((v) => dist(v, previousPos)))
		var target = this.touch
		var newPos = {
			x: avg(touches.map((v) => (v == target ? newX : v.x))),
			y: avg(touches.map((v) => (v == target ? newY : v.y)))
		}
		var newZoom = avg(touches.map((v) => dist(v == target ? {x:newX,y:newY} : v, newPos)))
		var zoom = newZoom / previousZoom
		if (previousZoom == 0 || newZoom == 0) zoom = 1
		viewPos.x += newPos.x - previousPos.x
		viewPos.y += newPos.y - previousPos.y
		zoomView(newPos, zoom)
		// Update
		// log(`${Math.round(previousZoom / 10)} ${"#".repeat(previousZoom / 10)} ${"#".repeat(newZoom / 10)} ${Math.round(newZoom / 10)}`)
		// log(repr(viewPos.zoom))
		updateViewPos()
	}
	toString() {
		return `PanTouchMode {}`
	}
}
class EraseTouchMode extends TouchMode {
	/**
	 * @param {TrackedTouch} touch
	 */
	constructor(touch) {
		super(touch)
		erase(touch.getRealPos())
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 * @param {number} newX
	 * @param {number} newY
	 */
	onMove(previousX, previousY, newX, newY) {
		erase(this.touch.getRealPos())
	}
	toString() {
		return `EraseTouchMode {}`
	}
}
/**
 * @type {TrackedTouch[]}
 */
var touches = []

/**
 * @param {number} id
 * @param {{ x: number; y: number; }} pos
 */
function mousemove(id, pos) {
	for (var i = 0; i < touches.length; i++) {
		if (touches[i].id == id) {
			touches[i].updatePos(pos.x, pos.y)
		}
	}
}
/**
 * @param {number} id
 */
function mouseup(id) {
	for (var i = 0; i < touches.length; i++) {
		if (touches[i].id == id) {
			touches[i].remove()
		}
	}
}
/** @param {TouchList} touchList */
function handleTouches(touchList) {
	// Check for new or updated touches
	for (var i = 0; i < touchList.length; i++) {
		// See if we already have this touch
		var touchID = touchList[i].identifier
		var idx = touches.findIndex((v) => v.id == touchID)
		if (idx == -1) {
			// New touch!
			new TrackedTouch(touchList[i].clientX, touchList[i].clientY, touchID)
		} else {
			// Update existing touch!
			touches[idx].updatePos(touchList[i].clientX, touchList[i].clientY)
		}
	}
	// Check for old touches
	var _t = [...touches]
	for (var i = 0; i < _t.length; i++) {
		var touchID = _t[i].id
		var idx = [...touchList].findIndex((v) => v.identifier == touchID)
		if (idx == -1) {
			// Old touch!
			_t[i].remove()
		}
	}
	// log(repr(touches.map((v) => v.toString())))
}

theSVG.parentElement?.addEventListener("mousedown", (e) => {
	new TrackedTouch(e.clientX, e.clientY, 0);
});
theSVG.parentElement?.addEventListener("mousemove", (e) => {
	mousemove(0, {
		x: e.clientX,
		y: e.clientY
	});
});
theSVG.parentElement?.addEventListener("mouseup", (e) => {
	mouseup(0);
});

theSVG.parentElement?.addEventListener("touchstart", (e) => {
	e.preventDefault();
	handleTouches(e.touches)
	return false
}, false);
theSVG.parentElement?.addEventListener("touchmove", (e) => {
	e.preventDefault();
	handleTouches(e.touches)
	return false
}, false);
theSVG.parentElement?.addEventListener("touchcancel", (e) => {
	e.preventDefault();
	handleTouches(e.touches)
	return false
}, false);
theSVG.parentElement?.addEventListener("touchend", (e) => {
	e.preventDefault();
	handleTouches(e.touches)
	return false
}, false);
