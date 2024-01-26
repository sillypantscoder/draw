var theSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg")
document.body.appendChild(theSVG)

var clientID = Math.floor(Math.random() * 100000)

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
	/**
	 * @param {number} id
	 * @param {Object.<string, any>} data
	 */
	static sendCreateObject(id, data) {
		/** @type {Promise<void>} */
		var p = new Promise((resolve) => {
			var x = new XMLHttpRequest()
			x.open("POST", "/create_object")
			x.addEventListener("loadend", () => resolve())
			x.send(JSON.stringify({
				"id": id,
				"data": data
			}))
		})
		return p
	}
	/**
	 * @param {Object.<string, any>} data
	 * @returns {SceneObject}
	 */
	static createFromData(data) {
		var id = Math.floor(Math.random() * 100000)
		var objClass = objectTypes[data["type"]]
		var o = new objClass(id, data)
		o.add()
		return o
	}
	/**
	 * @param {Object.<string, any>} data
	 */
	static createAndSendFromData(data) {
		var o = this.createFromData(data)
		this.sendCreateObject(o.id, data)
	}
}
class DrawingObject extends SceneObject {
	/**
	 * @param {number} id
	 * @param {Object.<string, any>} data
	 */
	constructor(id, data) {
		super(id, data)
		this.path = data.d
		this.elm = document.createElementNS("http://www.w3.org/2000/svg", "path")
		this.elm.setAttribute("d", this.path)
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
}

/** @type {Object.<string, typeof SceneObject>} */
var objectTypes = {
	"drawing": DrawingObject
}

/** @type {SceneObject[]} */
var objects = []

/** @type {{ d: string, elm: SVGPathElement } | null} */
var currentPath = null

/**
 * @param {{ x: number, y: number }} pos
 */
function mousedown(pos) {
	currentPath = {
		d: `M ${pos.x} ${pos.y}`,
		elm: document.createElementNS("http://www.w3.org/2000/svg", "path")
	}
	currentPath.elm.setAttribute("fill", "none")
	currentPath.elm.setAttribute("stroke", "red")
	currentPath.elm.setAttribute("stroke-width", "5")
	theSVG.appendChild(currentPath.elm)
}

/**
 * @param {{ x: number, y: number }} pos
 */
function mousemove(pos) {
	if (currentPath) {
		currentPath.d += ` L ${pos.x} ${pos.y}`
		currentPath.elm.setAttribute("d", currentPath.d)
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
		SceneObject.createAndSendFromData({
			"type": "drawing",
			"d": currentPath.d
		})
		// Reset
		currentPath = null
	}
}

document.body.addEventListener("mousedown", (e) => {
	mousedown({
		x: e.clientX,
		y: e.clientY
	});
});
document.body.addEventListener("mousemove", (e) => {
	mousemove({
		x: e.clientX,
		y: e.clientY
	});
});
document.body.addEventListener("mouseup", (e) => {
	mouseup({
		x: e.clientX,
		y: e.clientY
	});
});

document.body.addEventListener("touchstart", (e) => {
	e.preventDefault();
	mousedown({
		x: e.touches[0].clientX,
		y: e.touches[0].clientY
	});
	return false
}, false);
document.body.addEventListener("touchmove", (e) => {
	e.preventDefault();
	mousemove({
		x: e.touches[0].clientX,
		y: e.touches[0].clientY
	});
	return false
}, false);
document.body.addEventListener("touchcancel", (e) => {
	e.preventDefault();
	mouseup(null);
	return false
}, false);
document.body.addEventListener("touchend", (e) => {
	e.preventDefault();
	mouseup(null);
	return false
}, false);
