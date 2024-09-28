// Function to get distance from line to point

function getDistanceFromLineToPointFunction() {
	/**
	 * @param {number} x
	 */
	function sqr(x) { return x * x }
	/**
	 * @param {{ x: number; y: number; }} v
	 * @param {{ x: number; y: number; }} w
	 */
	function distanceSquared(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y) }
	/**
	 * @param {{ x: number; y: number; }} point
	 * @param {{ x: number; y: number; }} linePoint1
	 * @param {{ x: number; y: number; }} linePoint2
	 */
	function distToSegmentSquared(point, linePoint1, linePoint2) {
		var l2 = distanceSquared(linePoint1, linePoint2);
		if (l2 == 0) return distanceSquared(point, linePoint1);
		var t = ((point.x - linePoint1.x) * (linePoint2.x - linePoint1.x) + (point.y - linePoint1.y) * (linePoint2.y - linePoint1.y)) / l2;
		t = Math.max(0, Math.min(1, t));
		return distanceSquared(point, { x: linePoint1.x + t * (linePoint2.x - linePoint1.x),
							y: linePoint1.y + t * (linePoint2.y - linePoint1.y) });
	}
	/**
	 * @param {{ x: number; y: number; }} point
	 * @param {{ x: number; y: number; }} linePoint1
	 * @param {{ x: number; y: number; }} linePoint2
	 */
	function distToSegment(point, linePoint1, linePoint2) { return Math.sqrt(distToSegmentSquared(point, linePoint1, linePoint2)); }
	return distToSegment
}
