"""Run against a disposable fresh demo, never a dataset to preserve."""
import json
import sys
import urllib.request

base = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000'


def call(path, body=None):
    payload = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(base + '/api' + path, data=payload, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


assert call('/health')['database'] == 'postgresql'
assert call('/sites')['total'] == 24
assert call('/devices')['total'] == 500
assert len(call('/cells')) == 72
features = call('/coverage')['features']
assert len({f['properties']['cell_id'] for f in features if f['properties']['kind']=='coverage'}) == 72
call('/simulation/control', {'action': 'pause'})
impact = call('/simulation/scenario', {'site_id': 14, 'scenario': 'backhaul'})
assert [impact['affected_devices'], impact['affected_applications'], impact['affected_areas']] == [42, 3, 1]
assert call('/simulation/scenario', {'site_id': 14, 'scenario': 'recover'})['affected_devices'] == 0
for _ in range(2):
    call('/simulation/control', {'action': 'reset'})
    assert call('/sites')['total'] == 24
    assert call('/devices')['total'] == 500
print('Fresh PostGIS demo passed: seed, coverage, 42/3/1 fault, recovery and repeated atomic reset.')
