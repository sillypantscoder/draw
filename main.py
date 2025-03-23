from http.server import BaseHTTPRequestHandler, HTTPServer
import typing
import json
import datetime
import os
import threading
import time

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

def dt(time: datetime.datetime | None = None) -> str:
	timezone = datetime.timezone(datetime.timedelta(hours=-6))
	t = datetime.datetime.now(timezone)
	if time != None: t = time
	return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][t.weekday()] + \
		", " + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][t.month] + \
		" " + str(t.day) + ("th" if t.day//10 == 1 else ("st" if t.day%10 == 1 else ("nd" if t.day%10 == 2 else ("rd" if t.day%10 == 3 else "th")))) + \
		" at " + str(((t.hour - 1) % 12) + 1) + ":" + str(t.minute).rjust(2, '0') + ":" + str(t.second).rjust(2, '0') + " " + ("AM" if t.hour < 12 else "PM")

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
		self.created: datetime.datetime = datetime.datetime.now()
		self.deleted: bool = False
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
			"created": self.created.isoformat(),
			"deleted": self.deleted,
			"objects": self.objects
		}))
		f.close()
	def loadObjectList(self):
		if not os.path.isfile(f"objects/{self.id}.json"): return
		f = open(f"objects/{self.id}.json", "r")
		data = json.loads(f.read())
		f.close()
		self.name = data["name"]
		self.created = datetime.datetime.fromisoformat(data["created"])
		self.deleted = data["deleted"]
		self.objects = data["objects"]
		print("[Draw] Loaded", len(self.objects), "objects for whiteboard with id", self.id, "(name: " + repr(self.name) + ("; deleted" if self.deleted else "") + ")")
	def purgeClientList(self):
		clients = [*self.clients]
		for c in clients:
			timeDiff = datetime.datetime.now() - c["lastTime"]
			if timeDiff > datetime.timedelta(seconds=10):
				self.clients.remove(c)
				print(f"[Draw] [{dt()}] Logout from whiteboard {self.id} with client id {c['id']}; {len(self.clients)} client(s) connected")

whiteboards: list[Whiteboard] = []

def loadWhiteboards():
	files = os.listdir("objects")
	for f in files:
		w = Whiteboard(f.split(".")[0])
		w.loadObjectList()
		whiteboards.append(w)

def purge_thread():
	while True:
		time.sleep(3)
		for w in whiteboards:
			w.purgeClientList()

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
			"content": "\n".join([w.name + "\n" + w.created.isoformat() + "\n" + w.id for w in whiteboards if not w.deleted]).encode("UTF-8")
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
			client = board.clients[ci]
			r = json.dumps(client["messages"][:500])
			client["messages"] = client["messages"][500:]
			client["lastTime"] = datetime.datetime.now()
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
		print(f"[Draw] [{dt()}] New whiteboard with id:", w.id, "name:", repr(w.name), "clients")
		return {
			"status": 200,
			"headers": {},
			"content": w.id.encode("UTF-8")
		}
	elif path == "/rename":
		data = body.decode("UTF-8").split("\n")
		id = data[0]
		newname = data[1]
		for w in whiteboards:
			if w.id == id:
				print(f"[Draw] [{dt()}] Renamed whiteboard with id", w.id, " (old name: " + repr(w.name) + ") to:", repr(newname))
				w.name = newname
				w.saveObjectList()
		return {
			"status": 200,
			"headers": {},
			"content": b""
		}
	elif path == "/delete":
		id = body.decode("UTF-8")
		for w in whiteboards:
			if w.id == id:
				print(f"[Draw] [{dt()}] Deleted whiteboard with id", w.id)
				w.deleted = True
				w.saveObjectList()
		return {
			"status": 200,
			"headers": {},
			"content": b""
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
			print(f"[Draw] [{dt()}] Login to whiteboard {board.id} with client id {clientID}; {len(board.clients) + 1} client(s) connected")
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
			for c in range(len(board.clients)):
				board.clients[c]["messages"].append({
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
					for c in range(len(board.clients)):
						board.clients[c]["messages"].append({
							"type": "erase",
							"id": id
						})
			board.saveObjectList()
			return {
				"status": 200,
				"headers": {},
				"content": b""
			}
		if op == "get":
			id = int(body)
			for i in [*board.objects]:
				if i["id"] == id:
					for c in range(len(board.clients)):
						board.clients[c]["messages"].append({
							"type": "create_object",
							"id": id,
							"data": i["data"]
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
	th = threading.Thread(target=purge_thread, name="purge_thread", args=())
	th.daemon = True
	th.start()
	while running:
		try:
			webServer.handle_request()
		except KeyboardInterrupt:
			running = False
	webServer.server_close()
	print("Server stopped")
