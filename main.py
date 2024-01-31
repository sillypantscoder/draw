from http.server import BaseHTTPRequestHandler, HTTPServer
import typing
import json
import datetime
import os

hostName = "0.0.0.0"
serverPort = 8059

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

objects: list[SceneObject] = []
clients: list[Client] = []

def purgeClientList():
	pass # TODO

def saveObjectList():
	f = open("objects.json", "w")
	f.write(json.dumps(objects))
	f.close()

def loadObjectList():
	global objects
	if not os.path.isfile("objects.json"): return
	f = open("objects.json", "r")
	objects = json.loads(f.read())
	f.close()

def get(path: str) -> HttpResponse:
	if path == "/":
		return {
			"status": 200,
			"headers": {
				"Content-Type": "text/html"
			},
			"content": read_file("index.html")
		}
	elif path == "/main.js":
		return {
			"status": 200,
			"headers": {
				"Content-Type": "text/javascript"
			},
			"content": read_file("main.js")
		}
	elif path.startswith("/messages/"):
		id = int(path[10:])
		ci = -1
		for i in range(len(clients)):
			if clients[i]["id"] == id:
				ci = i
		if ci == -1: return {
			"status": 404,
			"headers": {},
			"content": b""
		}
		r = json.dumps(clients[ci]["messages"])
		clients[ci]["messages"] = []
		clients[ci]["lastTime"] = datetime.datetime.now()
		return {
			"status": 200,
			"headers": {
				"Content-Type": "text/json"
			},
			"content": r.encode("UTF-8")
		}
	else: # 404 page
		return {
			"status": 404,
			"headers": {},
			"content": b""
		}

def post(path: str, body: bytes) -> HttpResponse:
	if path == "/connect":
		id = int(body)
		clients.append({
			"id": id,
			"lastTime": datetime.datetime.now(),
			"messages": [
				{
					"type": "create_object",
					"id": o["id"],
					"data": o["data"]
				} for o in objects
			]
		})
		return {
			"status": 200,
			"headers": {},
			"content": b""
		}
	elif path == "/create_object":
		bodydata = json.loads(body)
		objects.append({
			"id": bodydata["id"],
			"data": bodydata["data"]
		})
		for i in range(len(clients)):
			clients[i]["messages"].append({
				"type": "create_object",
				"id": bodydata["id"],
				"data": bodydata["data"]
			})
		saveObjectList()
		return {
			"status": 200,
			"headers": {},
			"content": b""
		}
	elif path == "/erase":
		id = int(body)
		for i in [*objects]:
			if i["id"] == id:
				objects.remove(i)
				for i in range(len(clients)):
					clients[i]["messages"].append({
						"type": "erase",
						"id": id
					})
		saveObjectList()
		return {
			"status": 200,
			"headers": {},
			"content": b""
		}
	else:
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
	loadObjectList()
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
