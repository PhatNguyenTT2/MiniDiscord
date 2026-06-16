"""Check exact response headers and body format to identify origin of 500."""
import urllib.request, json, ssl, time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
BASE = "https://api.tuelord.site"

# Register
t = int(time.time())
data = json.dumps({"username": f"hdr_{t}", "email": f"hdr_{t}@t.com", "password": "password123"}).encode()
r = urllib.request.Request(BASE + "/api/auth/register", data=data, method="POST")
r.add_header("Content-Type", "application/json")
with urllib.request.urlopen(r, context=ctx) as res:
    token = json.loads(res.read())["data"]["token"]

# Hit notifications - check headers
r2 = urllib.request.Request(BASE + "/api/users/notifications")
r2.add_header("Authorization", f"Bearer {token}")
try:
    with urllib.request.urlopen(r2, context=ctx) as res:
        print("OK")
except urllib.error.HTTPError as he:
    print("STATUS:", he.code)
    print("HEADERS:")
    for k, v in he.headers.items():
        print(f"  {k}: {v}")
    body = he.read().decode()
    print("BODY:", body[:300])
    # Check if body is JSON with "success" field (user-service format) 
    # or "timestamp"+"path" (Spring default format)
    # or "status"+"error" (Gateway format)
    try:
        j = json.loads(body)
        print("KEYS:", list(j.keys()))
    except:
        print("NOT_JSON")
