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
const isPointNearLine = getDistanceFromLineToPointFunction()

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
	// If we clicked on a menu option:
	if (menuoption != null) {
		// Remove the current selected option.
		document.querySelector('.menu-option-selected')?.classList.remove('menu-option-selected');
		// Add the new selected option.
		menuoption.classList.add("menu-option-selected")
		// Quit button
		if (menuoption.dataset.mode == "Quit") {
			location.assign("/")
			return
		}
	}
	// Set mode output
	var modeOutput = document.querySelector('#mode-output')
	if (modeOutput != null) modeOutput.textContent = getCurrentMode()
	// De-select items
	if (menuoption?.dataset.mode != "Move") {
		selection = []
		updateViewPos()
		updateSelectionWindow()
	}
}, false)

/**
 * @param {string} path
 * @returns {Promise<string>}
 */
function get(path) {
	return new Promise((resolve, reject) => {
		var x = new XMLHttpRequest()
		x.open("GET", path)
		x.addEventListener("loadend", () => {
			if (x.status == 200) resolve(x.responseText)
			else reject(x.status)
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
	 * @param {Object<string, any>} data
	 */
	constructor(id, data) {
		this.data = data
		this.id = id
	}
	add() {
		objects.push(this)
	}
	verify() {}
	update() {}
	remove() {
		objects.splice(objects.indexOf(this), 1)
	}
	removeAndSendErase() {
		this.remove()
		SceneObject.sendErase(this.id)
	}
	sendEdit() {
		// this.elm.setAttribute("class", "unverified")
		// SceneObject.sendCreateObject(this.id, { type: "...", ... })
	}
	/**
	 * @param {number} id
	 * @param {Object<string, any>} data
	 */
	static sendCreateObject(id, data) {
		return post(location.pathname + "create_object", JSON.stringify({
			"id": id,
			"data": data
		}))
	}
	/**
	 * @param {number} id
	 */
	static sendErase(id) {
		return post(location.pathname + "erase", id.toString())
	}
	/**
	 * @param {Object<string, any>} data
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
	 * @param {Object<string, any>} data
	 * @returns {SceneObject}
	 */
	static createFromData(data) {
		var id = Math.floor(Math.random() * 100000)
		return this.createFromDataAndID(data, id)
	}
	/**
	 * @param {Object<string, any>} data
	 */
	static createAndSendFromData(data) {
		var o = this.createFromData(data)
		this.sendCreateObject(o.id, data)
	}
	/** @param {{ x: number, y: number }} pos */
	collidepoint(pos) {
		return true
	}
	/**
	 * @param {{ x: number, y: number }} pos
	 * @param {{ x: number, y: number }} size
	 */
	colliderect(pos, size) {
		return true
	}
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	move(x, y) {
	}
}
class DrawingObject extends SceneObject {
	/**
	 * @param {number} id
	 * @param {Object<string, any>} data
	 */
	constructor(id, data) {
		super(id, data)
		/** @type {{ x: number, y: number }[]} */
		this.path = data.d
		this.color = data.color
		this.elm = document.createElementNS("http://www.w3.org/2000/svg", "path")
		this.elm.setAttribute("fill", "none")
		this.elm.setAttribute("opacity", "0.5")
		this.update()
	}
	add() {
		super.add()
		theSVG.appendChild(this.elm)
	}
	verify() {
		this.elm.removeAttribute("opacity")
	}
	update() {
		this.elm.setAttribute("d", pointsToPath(this.path.map((v) => getScreenPosFromStagePos(v.x, v.y))))
		// this.elm.setAttribute("stroke-width", (5 * viewPos.zoom).toString())
		if (selection.indexOf(this) != -1) {
			this.elm.setAttribute("stroke", "blue")
			this.elm.setAttribute("stroke-width", "8")
		} else {
			this.elm.setAttribute("stroke", this.color)
			this.elm.setAttribute("stroke-width", "5")
		}
	}
	remove() {
		super.remove()
		this.elm.remove()
	}
	sendEdit() {
		this.elm.setAttribute("opacity", "0.5")
		SceneObject.sendCreateObject(this.id, { type: "drawing", d: this.path, color: this.color })
	}
	/** @param {{ x: number, y: number }} pos */
	collidepoint(pos) {
		for (var i = 0; i < this.path.length - 1; i++) {
			if (isPointNearLine(pos, this.path[i], this.path[i + 1]) < 3 / viewPos.zoom) {
				return true
			}
		}
		return false
	}
	/**
	 * @param {{ x: number, y: number }} pos
	 * @param {{ x: number, y: number }} size
	 */
	colliderect(pos, size) {
		for (var i = 0; i < this.path.length; i++) {
			var px = this.path[i].x
			var py = this.path[i].y
			if (px >= pos.x && px <= pos.x + size.x && py >= pos.y && py <= pos.y + size.y) return true
		}
		return false;
	}
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	move(x, y) {
		for (var i = 0; i < this.path.length; i++) {
			this.path[i].x += x
			this.path[i].y += y
		}
		this.update()
	}
}
class TextObject extends SceneObject {
	/**
	 * @param {number} id
	 * @param {Object<string, any>} data
	 */
	constructor(id, data) {
		super(id, data)
		/** @type {{ x: number, y: number }} */
		this.pos = data.pos
		/** @type {string} */
		this.text = data.text
		/** @type {HTMLTextAreaElement} */
		this.elm = TextObject.createTextarea()
		this.elm.setAttribute("class", "unverified")
		var _text = this
		this.elm.addEventListener("click", (event) => {
			event.stopPropagation()
		}, false)
		this.elm.addEventListener("mousedown", (event) => {
			if (getCurrentMode() == "Text") {
				event.stopPropagation()
			} else {
				event.preventDefault()
			}
		}, false)
		this.elm.addEventListener("touchstart", (event) => {
			event.stopPropagation()
		}, false)
		this.elm.addEventListener("input", () => {
			_text.elm.style.width = (Math.max(..._text.elm.value.split("\n").map((v) => v.length)) + 3) + "ch"
			_text.elm.style.height = "";
			_text.elm.style.height = "calc(" + _text.elm.scrollHeight + "px + 0.25em)"
		})
		this.elm.addEventListener("blur", (event) => {
			_text.text = _text.elm.value
			_text.sendEdit()
		})
		requestAnimationFrame(() => _text.update())
	}
	add() {
		super.add()
		document.querySelector(".mainContainer")?.appendChild(this.elm)
	}
	verify() {
		this.elm.removeAttribute("class")
	}
	update() {
		if (document.activeElement != this.elm) this.elm.value = this.text
		this.elm.setAttribute("style", `top: ${(this.pos.y * viewPos.zoom) + viewPos.y}px; left: ${(this.pos.x * viewPos.zoom) + viewPos.x}px; transform: scale(${viewPos.zoom}); transform-origin: 0px 0px;`)
		this.elm.dispatchEvent(new KeyboardEvent("input"))
		// Focus
		if (selection.indexOf(this) != -1) {
			this.elm.classList.add("focus-shadow")
		} else {
			this.elm.classList.remove("focus-shadow")
		}
	}
	remove() {
		super.remove()
		this.elm.remove()
	}
	/** @param {{ x: number, y: number }} pos */
	collidepoint(pos) {
		var screenPos = getScreenPosFromStagePos(pos.x, pos.y)
		return document.elementsFromPoint(screenPos.x, screenPos.y).includes(this.elm)
	}
	/**
	 * @param {{ x: number, y: number }} pos
	 * @param {{ x: number, y: number }} size
	 */
	colliderect(pos, size) {
		var elementRect = this.elm.getBoundingClientRect()
		var stageSize = { x: elementRect.width * viewPos.zoom, y: elementRect.height * viewPos.zoom }
		// stagePos = this.pos
		return pos.x <= this.pos.x + stageSize.x && pos.x + size.x >= this.pos.x && pos.y <= this.pos.y + stageSize.y && pos.y + size.y >= this.pos.y
	}
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	move(x, y) {
		this.pos.x += x
		this.pos.y += y
		this.update()
	}
	sendEdit() {
		this.elm.setAttribute("class", "unverified")
		SceneObject.sendCreateObject(this.id, { type: "text", text: this.elm.value, pos: this.pos })
	}
	static createTextarea() {
		var t = document.createElementNS("http://www.w3.org/1999/xhtml", "textarea")
		if (! (t instanceof HTMLTextAreaElement)) {
			throw new Error("newly created element is of the wrong type!!! (This error is definitely not possible)")
		}
		return t
	}
}

/** @type {Object<string, typeof SceneObject>} */
var objectTypes = {
	"drawing": DrawingObject,
	"text": TextObject
}

/** @type {SceneObject[]} */
var objects = []

/** @type {SceneObject[]} */
var selection = []

/**
 * @param {number} id
 * @param {Object<string, any>} data
 */
function importObject(id, data) {
	var wasSelected = false
	for (var i = 0; i < objects.length; i++) {
		if (objects[i].id == id) {
			// check for selection
			if (selection.includes(objects[i])) {
				selection.splice(selection.indexOf(objects[i]), 1)
				wasSelected = true
			}
			// data is over-written
			objects[i].remove()
		}
	}
	// create the object
	var o = SceneObject.createFromDataAndID(data, id)
	o.verify()
	// re-select
	if (wasSelected) {
		selection.push(o)
		o.update()
	}
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
	try {
		var data = await get(location.pathname + "messages/" + clientID)
	} catch (e) {
		alert("Lost connection with the server!")
		throw e
	}
	/** @type {({ type: "create_object", id: number, data: Object<string, any> } | { "type": "erase", id: number })[]} */
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
var debug = false
async function getMessagesLoop() {
	while (true) {
		var time = new Date()
		await getMessages()
		if (debug) console.log(new Date().getTime() - time.getTime())
		await new Promise((resolve) => setTimeout(resolve, 500))
	}
}
post(location.pathname + "connect", clientID.toString()).then(() => getMessagesLoop())

/** @type {{ x: number, y: number, zoom: number }} */
var viewPos = { x: 0, y: 0, zoom: 1 }

/** @returns {"Draw" | "Text" | "Move" | "Select" | "Erase"} */
function getCurrentMode() {
	// @ts-ignore
	return document.querySelector(".menu-option-selected").dataset.mode
}
// function updateViewPos() {
// 	theSVG.setAttribute("style", `position: absolute; top: ${viewPos.y}px; left: ${viewPos.x}px; transform: scale(${viewPos.zoom}); transform-origin: top left;`)
// 	// log(theSVG.getAttribute("style"))
// }
function updateViewPos() {
	for (var i = 0; i < objects.length; i++) {
		objects[i].update()
	}
}
function updateSelectionWindow() {
	// update window
	var window = document.querySelector(".selection-window")
	if (window == null) throw new Error(".selection-window is missing")
	if (selection.length == 0) {
		window.classList.remove("active")
	} else {
		window.classList.add("active")
	}
	// update number
	var number = document.querySelector("#selection-number")
	if (number == null) throw new Error("#selection-number is missing")
	number.textContent = selection.length.toString();
	// update s
	var s = document.querySelector("#selection-s")
	if (s == null) throw new Error("#selection-s is missing")
	if (selection.length == 1) s.classList.add("hidden");
	else s.classList.remove("hidden");
}
/**
 * @param {number} x
 * @param {number} y
 */
function getStagePosFromScreenPos(x, y) {
	var realPos = { x: (x - viewPos.x) / viewPos.zoom, y: (y - viewPos.y) / viewPos.zoom }
	return realPos
}
/**
 * @param {number} x
 * @param {number} y
 */
function getScreenPosFromStagePos(x, y) {
	var realPos = { x: (x * viewPos.zoom) + viewPos.x, y: (y * viewPos.zoom) + viewPos.y }
	return realPos
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
	 * @param {boolean} isEraserButton
	 */
	constructor(initialX, initialY, id, isEraserButton) {
		this.x = initialX
		this.y = initialY
		this.id = id
		this.isEraserButton = isEraserButton
		this.mode = this.getMode()
		touches.push(this)
		// blur current element
		var a = document.activeElement
		if (a != null) {
			if (a instanceof HTMLElement) {
				a.blur()
			}
		}
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
		if (this.isEraserButton) return new EraseTouchMode(this)
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
		if (mode == "Draw") return new DrawTouchMode(this, (() => {
			var color = document.querySelector("#draw-color")
			if (color == null) throw new Error("draw color picker is missing :(")
			if (! (color instanceof HTMLSelectElement)) throw new Error("draw color picker is weird looking :O")
			return color.value
		})())
		if (mode == "Text") return new TextTouchMode(this)
		if (mode == "Move") {
			if (selection.length >= 1) return new MoveSelectionTouchMode(this)
			return new PanTouchMode(this)
		}
		if (mode == "Select") return new SelectTouchMode(this)
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
	 * @param {string} color
	 */
	constructor(touch, color) {
		super(touch)
		/** @type {{ x: number, y: number }[]} */
		this.points = [getStagePosFromScreenPos(touch.x, touch.y)]
		/** @type {SVGPathElement} */
		this.elm = document.createElementNS("http://www.w3.org/2000/svg", "path")
		this.elm.setAttribute("fill", "none")
		this.elm.setAttribute("stroke", "red")
		this.elm.setAttribute("stroke-width", "5")
		theSVG.appendChild(this.elm)
		this.color = color
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 * @param {number} newX
	 * @param {number} newY
	 */
	onMove(previousX, previousY, newX, newY) {
		this.points.push(getStagePosFromScreenPos(this.touch.x, this.touch.y))
		this.elm.setAttribute("d", pointsToPath(this.points.map((v) => getScreenPosFromStagePos(v.x, v.y))))
		// this.elm.setAttribute("stroke-width", (5 * viewPos.zoom).toString())
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
				"d": this.points,
				"color": this.color
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
class TextTouchMode extends TouchMode {
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
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onEnd(previousX, previousY) {
		SceneObject.createAndSendFromData({
			"type": "text",
			"text": "Enter text here",
			"pos": getStagePosFromScreenPos(previousX, previousY)
		})
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onCancel(previousX, previousY) {
	}
	toString() {
		return `TextTouchMode { }`
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
		updateViewPos()
	}
	toString() {
		return `PanTouchMode {}`
	}
}
class MoveSelectionTouchMode extends TouchMode {
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
		// Shift selection
		for (var i = 0; i < selection.length; i++) {
			var o = selection[i]
			var dx = (newX - previousX) / viewPos.zoom
			var dy = (newY - previousY) / viewPos.zoom
			o.move(dx, dy)
		}
		// Update
		updateViewPos()
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onEnd(previousX, previousY) {
		// Save seletion
		for (var i = 0; i < selection.length; i++) {
			var o = selection[i]
			o.sendEdit()
		}
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onCancel(previousX, previousY) {
	}
	toString() {
		return `MoveSelectionTouchMode {}`
	}
}
class SelectTouchMode extends TouchMode {
	/**
	 * @param {TrackedTouch} touch
	 */
	constructor(touch) {
		super(touch)
		/** @type {{ x: number, y: number }} */
		this.startPos = getStagePosFromScreenPos(touch.x, touch.y)
		/** @type {{ x: number, y: number }} */
		this.endPos = getStagePosFromScreenPos(touch.x, touch.y)
		/** @type {SVGRectElement} */
		this.elm = document.createElementNS("http://www.w3.org/2000/svg", "rect")
		this.elm.setAttribute("fill", "#AAF8")
		theSVG.appendChild(this.elm)
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 * @param {number} newX
	 * @param {number} newY
	 */
	onMove(previousX, previousY, newX, newY) {
		this.endPos = getStagePosFromScreenPos(newX, newY)
		// Get screen locations
		var startStagePos = getScreenPosFromStagePos(this.startPos.x, this.startPos.y)
		var endStagePos = getScreenPosFromStagePos(this.endPos.x, this.endPos.y)
		// Apply rect width and height
		var width = endStagePos.x - startStagePos.x
		if (width >= 0) {
			this.elm.setAttribute("x", startStagePos.x.toString())
			this.elm.setAttribute("width", width.toString())
		} else {
			this.elm.setAttribute("x", (startStagePos.x + width).toString())
			this.elm.setAttribute("width", (-width).toString())
		}
		var height = endStagePos.y - startStagePos.y
		if (height >= 0) {
			this.elm.setAttribute("y", startStagePos.y.toString())
			this.elm.setAttribute("height", height.toString())
		} else {
			this.elm.setAttribute("y", (startStagePos.y + height).toString())
			this.elm.setAttribute("height", (-height).toString())
		}
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onEnd(previousX, previousY) {
		// Remove current display elm
		this.elm.remove()
		// Normalize the rectangle
		var x = this.startPos.x
		var y = this.startPos.y
		var width = this.endPos.x - this.startPos.x
		if (width < 0) {
			x = this.endPos.x
			width = -width
		}
		var height = this.endPos.y - this.startPos.y
		if (height < 0) {
			y = this.endPos.y
			height = -height
		}
		var rectPos = { x, y }
		var rectSize = { x: width, y: height }
		// Select items!
		selection = []
		for (var i = 0; i < objects.length; i++) {
			if (objects[i].colliderect(rectPos, rectSize)) {
				selection.push(objects[i])
			}
		}
		updateViewPos()
		updateSelectionWindow()
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 */
	onCancel(previousX, previousY) {
		this.elm.remove()
	}
	toString() {
		return `SelectTouchMode { start: ${this.startPos.x}, ${this.startPos.y}, end: ${this.endPos.x}, ${this.endPos.y} }`
	}
}
class EraseTouchMode extends TouchMode {
	/**
	 * @param {TrackedTouch} touch
	 */
	constructor(touch) {
		super(touch)
		erase(getStagePosFromScreenPos(touch.x, touch.y))
	}
	/**
	 * @param {number} previousX
	 * @param {number} previousY
	 * @param {number} newX
	 * @param {number} newY
	 */
	onMove(previousX, previousY, newX, newY) {
		erase(getStagePosFromScreenPos(this.touch.x, this.touch.y))
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
/**
 * @param {number} id
 */
function mousecancel(id) {
	for (var i = 0; i < touches.length; i++) {
		if (touches[i].id == id) {
			touches[i].cancel()
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
			new TrackedTouch(touchList[i].clientX, touchList[i].clientY, touchID, false)
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
}

theSVG.parentElement?.addEventListener("mousedown", (e) => {
	if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
	if (e.buttons == 4 || e.buttons == 5) {
		mousecancel(0)
		new TrackedTouch(e.clientX, e.clientY, 0, true);
	} else {
		mouseup(0)
		new TrackedTouch(e.clientX, e.clientY, 0, false);
	}
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
theSVG.parentElement?.addEventListener("wheel", (e) => {
	zoomView({
		x: e.clientX,
		y: e.clientY
	}, Math.pow(2, e.deltaY / -500));
	updateViewPos();
});

theSVG.parentElement?.addEventListener("touchstart", (e) => {
	if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
	e.preventDefault();
	handleTouches(e.touches)
	return false
}, false);
theSVG.parentElement?.addEventListener("touchmove", (e) => {
	if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
	e.preventDefault();
	handleTouches(e.touches)
	return false
}, false);
theSVG.parentElement?.addEventListener("touchcancel", (e) => {
	if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
	e.preventDefault();
	handleTouches(e.touches)
	return false
}, false);
theSVG.parentElement?.addEventListener("touchend", (e) => {
	if (e.target instanceof HTMLTextAreaElement && getCurrentMode() == "Text") return
	e.preventDefault();
	handleTouches(e.touches)
	return false
}, false);
