async def test_health_ok(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


async def test_health_db(client):
    r = await client.get("/api/health/db")
    assert r.status_code == 200
    assert r.json()["database"] == "reachable"


async def test_root(client):
    r = await client.get("/")
    assert r.status_code == 200
