import json

f = open("objects.json", "r")
t = json.loads(f.read())
f.close()

for i in t:
	i["data"]["color"] = "black"

f = open("objects.json", "w")
f.write(json.dumps(t))
f.close()
