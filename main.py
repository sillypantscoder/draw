from http.server import BaseHTTPRequestHandler, HTTPServer
import typing
import json
import datetime
import os

hostName = "0.0.0.0"
serverPort = 8060

def read_file(filename: str) -> bytes:
	f = open(filename, "rb")
	t = f.read()
	f.close()
	return t

def write_file(filename: str, content: bytes):
	f = open(filename, "wb")
	f.write(content)
	f.close()

class HttpResponse(typing.TypedDict):
	status: int
	headers: dict[str, str]
	content: bytes

class SceneObject(typing.TypedDict):
	id: int
	data: dict[str, typing.Any]

class Client(typing.TypedDict):
	id: int
	lastTime: datetime.datetime
	messages: list[dict[str, typing.Any]]

class Whiteboard:
	def __init__(self, id: str):
		self.name: str = "New Whiteboard"
		self.objects: list[SceneObject] = []
		self.clients: list[Client] = []
		self.id = id
	@staticmethod
	def nextID():
		id = 0
		while os.path.exists(f"objects/{id}.json"):
			id += 1
		return str(id)
	def saveObjectList(self):
		f = open(f"objects/{self.id}.json", "w")
		f.write(json.dumps({
			"name": self.name,
			"objects": self.objects
		}))
		f.close()
	def loadObjectList(self):
		if not os.path.isfile(f"objects/{self.id}.json"): return
		f = open(f"objects/{self.id}.json", "r")
		data = json.loads(f.read())
		f.close()
		self.name = data["name"]
		self.objects = data["objects"]
		print("loaded", len(self.objects), "objects")
	def purgeClientList(self):
		pass # TODO

whiteboards: list[Whiteboard] = []

def loadWhiteboards():
	files = os.listdir("objects")
	for f in files:
		w = Whiteboard(f.split(".")[0])
		w.loadObjectList()
		whiteboards.append(w)

def get(path: str) -> HttpResponse:
	if path == "/":
		return {
			"status": 200,
			"headers": {
				"Content-Type": "text/html"
			},
			"content": read_file("index/index.html")
		}
	elif path == "/whiteboards":
		return {
			"status": 200,
			"headers": {
				"Content-Type": "text/plain"
			},
			"content": "\n".join([w.name + "\n" + w.id for w in whiteboards]).encode("UTF-8")
		}
	elif path == "/cp2l.js":
		return {
			"status": 200,
			"headers": {
				"Content-Type": "text/javascript"
			},
			"content": read_file("whiteboard/cp2l.js")
		}
	elif path.startswith("/whiteboard/"):
		board_name = path.split("/")[2]
		if board_name not in [w.id for w in whiteboards]:
			return {
				"status": 404,
				"headers": {
					"Content-Type": "text/html"
				},
				"content": b"Not Found"
			}
		board = [w for w in whiteboards if w.id == board_name][0]
		op = path.split("/")[3]
		if op == "":
			return {
				"status": 200,
				"headers": {
					"Content-Type": "text/html"
				},
				"content": read_file("whiteboard/whiteboard.html")
			}
		if op == "messages":
			clientID = int(path.split("/")[4])
			ci = -1
			for i in range(len(board.clients)):
				if board.clients[i]["id"] == clientID:
					ci = i
			if ci == -1: return {
				"status": 404,
				"headers": {},
				"content": b""
			}
			r = json.dumps(board.clients[ci]["messages"])
			board.clients[ci]["messages"] = []
			board.clients[ci]["lastTime"] = datetime.datetime.now()
			return {
				"status": 200,
				"headers": {
					"Content-Type": "text/json"
				},
				"content": r.encode("UTF-8")
			}
	elif path == "/whiteboard.js":
		return {
			"status": 200,
			"headers": {
				"Content-Type": "text/javascript"
			},
			"content": read_file("whiteboard/whiteboard.js")
		}
	# 404 page
	return {
		"status": 404,
		"headers": {},
		"content": b""
	}

def post(path: str, body: bytes) -> HttpResponse:
	if path == "/new":
		name = body.decode("UTF-8")
		w = Whiteboard(Whiteboard.nextID())
		whiteboards.append(w)
		w.name = name
		return {
			"status": 200,
			"headers": {},
			"content": w.id.encode("UTF-8")
		}
	elif path.startswith("/whiteboard/"):
		board_name = path.split("/")[2]
		if board_name not in [w.id for w in whiteboards]:
			return {
				"status": 404,
				"headers": {
					"Content-Type": "text/html"
				},
				"content": b"Not Found"
			}
		board = [w for w in whiteboards if w.id == board_name][0]
		op = path.split("/")[3]
		if op == "connect": # Register new client
			clientID = int(body)
			board.clients.append({
				"id": clientID,
				"lastTime": datetime.datetime.now(),
				"messages": [
					{
						"type": "create_object",
						"id": o["id"],
						"data": o["data"]
					} for o in board.objects
				]
			})
			return {
				"status": 200,
				"headers": {},
				"content": b""
			}
		if op == "create_object":
			bodydata = json.loads(body)
			create = True
			for o in board.objects:
				if o["id"] == bodydata["id"]:
					o["data"] = bodydata["data"]
					create = False
			if create:
				board.objects.append({
					"id": bodydata["id"],
					"data": bodydata["data"]
				})
			for i in range(len(board.clients)):
				board.clients[i]["messages"].append({
					"type": "create_object",
					"id": bodydata["id"],
					"data": bodydata["data"]
				})
			board.saveObjectList()
			return {
				"status": 200,
				"headers": {},
				"content": b""
			}
		if op == "erase":
			id = int(body)
			for i in [*board.objects]:
				if i["id"] == id:
					board.objects.remove(i)
					for i in range(len(board.clients)):
						board.clients[i]["messages"].append({
							"type": "erase",
							"id": id
						})
			board.saveObjectList()
			return {
				"status": 200,
				"headers": {},
				"content": b""
			}
	return {
		"status": 404,
		"headers": {},
		"content": b""
	}

class MyServer(BaseHTTPRequestHandler):
	def do_GET(self):
		global running
		res = get(self.path)
		self.send_response(res["status"])
		for h in res["headers"]:
			self.send_header(h, res["headers"][h])
		self.end_headers()
		self.wfile.write(res["content"])
	def do_POST(self):
		res = post(self.path, self.rfile.read(int(self.headers["Content-Length"])))
		self.send_response(res["status"])
		for h in res["headers"]:
			self.send_header(h, res["headers"][h])
		self.end_headers()
		self.wfile.write(res["content"])
	def log_message(self, format: str, *args: typing.Any) -> None:
		return;
		if 400 <= int(args[1]) < 500:
			# Errored request!
			print(u"\u001b[31m", end="")
		print(args[0].split(" ")[0], "request to", args[0].split(" ")[1], "(status code:", args[1] + ")")
		print(u"\u001b[0m", end="")
		# don't output requests

if __name__ == "__main__":
	loadWhiteboards()
	running = True
	webServer = HTTPServer((hostName, serverPort), MyServer)
	webServer.timeout = 1
	print("Server started http://%s:%s" % (hostName, serverPort))
	while running:
		try:
			webServer.handle_request()
		except KeyboardInterrupt:
			running = False
	webServer.server_close()
	print("Server stopped")
