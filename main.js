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
async function getMessages() {
	var data = await get("/messages/" + clientID)
	/** @type {({ type: "create_object", id: number, data: Object.<string, any> })[]} */
	var messages = JSON.parse(data)
	for (var i = 0; i < messages.length; i++) {
		var msg = messages[i]
		if (msg.type == "create_object") {
			importObject(msg.id, msg.data)
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

/** @type {{ x: number, y: number }} */
var viewPos = {x: 0, y: 0}

/** @type {{ d: { x: number, y: number }[], elm: SVGPathElement } | null} */
var currentPath = null
/** @type {{ x: number, y: number } | null} */
var currentDrag = null

function getCurrentMode() {
	// @ts-ignore
	return document.querySelector(".menu-option-selected").dataset.mode
}
function updateViewPos() {
	theSVG.setAttribute("style", `position: absolute; top: ${viewPos.y}px; left: ${viewPos.x}px;`)
}

/** @param {{ x: number, y: number }} pos */
function erase(pos) {
	var o = [...objects]
	for (var i = 0; i < o.length; i++) {
		if (o[i].collidepoint(pos)) {
			o[i].remove()
		}
	}
}

/**
 * @param {{ x: number, y: number }} pos
 */
function mousedown(pos) {
	var realPos = { x: pos.x - viewPos.x, y: pos.y - viewPos.y }
	if (getCurrentMode() == "Draw") {
		currentPath = {
			d: [realPos],
			elm: document.createElementNS("http://www.w3.org/2000/svg", "path")
		}
		currentPath.elm.setAttribute("fill", "none")
		currentPath.elm.setAttribute("stroke", "red")
		currentPath.elm.setAttribute("stroke-width", "5")
		theSVG.appendChild(currentPath.elm)
	}
	if (getCurrentMode() == "Move") {
		currentDrag = pos
	}
	if (getCurrentMode() == "Erase") {
		currentDrag = pos
		erase(realPos)
	}
}

/**
 * @param {{ x: number, y: number }} pos
 */
function mousemove(pos) {
	var realPos = { x: pos.x - viewPos.x, y: pos.y - viewPos.y }
	if (currentPath) {
		currentPath.d.push(realPos)
		currentPath.elm.setAttribute("d", pointsToPath(currentPath.d))
	}
	if (currentDrag) {
		if (getCurrentMode() == "Erase") {
			erase(realPos)
		} else {
			var rel = {
				x: pos.x - currentDrag.x,
				y: pos.y - currentDrag.y
			}
			viewPos.x += rel.x
			viewPos.y += rel.y
			updateViewPos()
			currentDrag = pos
		}
	}
}

/**
 * @param {{ x: number, y: number } | null} pos
 */
function mouseup(pos) {
	if (currentPath) {
		// Final position
		if (pos) mousemove(pos)
		// Remove current display elm
		currentPath.elm.remove()
		// Add drawing to screen
		if (currentPath.d.length > 6) {
			SceneObject.createAndSendFromData({
				"type": "drawing",
				"d": currentPath.d
			})
		}
		// Reset
		currentPath = null
	}
	if (currentDrag) {
		currentDrag = null
	}
}

theSVG.parentElement?.addEventListener("mousedown", (e) => {
	mousedown({
		x: e.clientX,
		y: e.clientY
	});
});
theSVG.parentElement?.addEventListener("mousemove", (e) => {
	mousemove({
		x: e.clientX,
		y: e.clientY
	});
});
theSVG.parentElement?.addEventListener("mouseup", (e) => {
	mouseup({
		x: e.clientX,
		y: e.clientY
	});
});

theSVG.parentElement?.addEventListener("touchstart", (e) => {
	e.preventDefault();
	mousedown({
		x: e.touches[0].clientX,
		y: e.touches[0].clientY
	});
	return false
}, false);
theSVG.parentElement?.addEventListener("touchmove", (e) => {
	e.preventDefault();
	mousemove({
		x: e.touches[0].clientX,
		y: e.touches[0].clientY
	});
	return false
}, false);
theSVG.parentElement?.addEventListener("touchcancel", (e) => {
	e.preventDefault();
	mouseup(null);
	return false
}, false);
theSVG.parentElement?.addEventListener("touchend", (e) => {
	e.preventDefault();
	mouseup(null);
	return false
}, false);
