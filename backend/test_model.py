#!/usr/bin/env python3

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8000/optimize-event"

test_scenarios = [
    {
        "name": "Europe Only - London + Paris",
        "data": {
            "attendees": {"London": 2, "Paris": 3},
            "availability_window": {"start": "2025-10-06T09:00:00Z", "end": "2025-10-07T17:00:00Z"},
            "event_duration": {"days": 0, "hours": 2}
        },
        "expected": "Should choose Paris or London (attendee city)"
    },
    {
        "name": "Europe Only - Zurich + Geneva",
        "data": {
            "attendees": {"Zurich": 5, "Geneva": 3},
            "availability_window": {"start": "2025-10-10T09:00:00Z", "end": "2025-10-12T17:00:00Z"},
            "event_duration": {"days": 0, "hours": 4}
        },
        "expected": "Should choose Zurich or Geneva (both Swiss cities)"
    },
    {
        "name": "Asia-Pacific - Hong Kong + Singapore",
        "data": {
            "attendees": {"Hong Kong": 10, "Singapore": 8},
            "availability_window": {"start": "2025-11-01T09:00:00Z", "end": "2025-11-03T17:00:00Z"},
            "event_duration": {"days": 1, "hours": 0}
        },
        "expected": "Should choose HK or Singapore (both in same region)"
    },
    {
        "name": "Asia-Pacific - Mumbai + Dubai",
        "data": {
            "attendees": {"Mumbai": 15, "Dubai": 12},
            "availability_window": {"start": "2025-11-15T09:00:00Z", "end": "2025-11-18T17:00:00Z"},
            "event_duration": {"days": 2, "hours": 0}
        },
        "expected": "Should choose regional city or attendee city"
    },
    {
        "name": "Mixed - London + Hong Kong + Singapore",
        "data": {
            "attendees": {"London": 5, "Hong Kong": 8, "Singapore": 6},
            "availability_window": {"start": "2025-12-01T09:00:00Z", "end": "2025-12-05T17:00:00Z"},
            "event_duration": {"days": 1, "hours": 4}
        },
        "expected": "Should find good compromise location (maybe Dubai?)"
    },
    {
        "name": "All Regions - Global Meeting",
        "data": {
            "attendees": {"London": 10, "Hong Kong": 8, "New York": 5, "Sydney": 4, "Dubai": 6},
            "availability_window": {"start": "2026-01-10T09:00:00Z", "end": "2026-01-15T17:00:00Z"},
            "event_duration": {"days": 2, "hours": 6}
        },
        "expected": "Should find central location balancing all regions"
    },
    {
        "name": "Single City - All London",
        "data": {
            "attendees": {"London": 50},
            "availability_window": {"start": "2025-12-20T09:00:00Z", "end": "2025-12-22T17:00:00Z"},
            "event_duration": {"days": 0, "hours": 8}
        },
        "expected": "Should choose London (0 CO2, same city)"
    },
    {
        "name": "Small Group - 2 People",
        "data": {
            "attendees": {"London": 1, "Paris": 1},
            "availability_window": {"start": "2025-10-15T09:00:00Z", "end": "2025-10-16T17:00:00Z"},
            "event_duration": {"days": 0, "hours": 2}
        },
        "expected": "Should choose Paris or London"
    },
    {
        "name": "Large Group - Many Cities",
        "data": {
            "attendees": {
                "London": 20, "Paris": 15, "Zurich": 10, "Geneva": 8,
                "Hong Kong": 12, "Singapore": 10, "Mumbai": 8, "Dubai": 5
            },
            "availability_window": {"start": "2026-02-01T09:00:00Z", "end": "2026-02-10T17:00:00Z"},
            "event_duration": {"days": 3, "hours": 4}
        },
        "expected": "Should find optimal location for large diverse group"
    },
    {
        "name": "Europe Focus - Multiple European Cities",
        "data": {
            "attendees": {"London": 8, "Paris": 6, "Zurich": 4, "Geneva": 4, "Budapest": 3},
            "availability_window": {"start": "2025-11-20T09:00:00Z", "end": "2025-11-25T17:00:00Z"},
            "event_duration": {"days": 1, "hours": 6}
        },
        "expected": "Should choose European city (maybe Frankfurt or central Europe)"
    },
    {
        "name": "Short Window - 1 Day",
        "data": {
            "attendees": {"London": 3, "Paris": 2},
            "availability_window": {"start": "2025-10-25T09:00:00Z", "end": "2025-10-26T09:00:00Z"},
            "event_duration": {"days": 0, "hours": 2}
        },
        "expected": "Should choose closest/quickest option"
    },
    {
        "name": "Long Event - Multi-Day Conference",
        "data": {
            "attendees": {"London": 15, "Hong Kong": 12, "Singapore": 10},
            "availability_window": {"start": "2026-03-01T09:00:00Z", "end": "2026-03-15T17:00:00Z"},
            "event_duration": {"days": 5, "hours": 8}
        },
        "expected": "Should find optimal location for long event"
    }
]

def test_scenario(scenario, index):
    print(f"\n{'='*80}")
    print(f"Test {index + 1}/{len(test_scenarios)}: {scenario['name']}")
    print(f"{'='*80}")
    print(f"Expected: {scenario['expected']}")
    print()

    try:
        start_time = time.time()
        response = requests.post(BASE_URL, json=scenario['data'], timeout=30)
        elapsed = time.time() - start_time

        if response.status_code == 200:
            result = response.json()
            location = result.get('event_location', 'Unknown')
            co2 = result.get('total_co2', 0)
            avg_time = result.get('average_travel_hours', 0)

            print(f"✅ SUCCESS ({elapsed:.3f}s)")
            print(f"   📍 Location: {location}")
            print(f"   💨 Total CO₂: {co2:.2f} kg")
            print(f"   ⏱️  Avg Travel: {avg_time:.2f} hours")


            attendee_cities = list(scenario['data']['attendees'].keys())
            if location in attendee_cities:
                print(f"   ✅ Chose attendee city ({location}) - optimal choice!")


            if co2 < 100:
                print(f"   ✅ Low CO₂ - good choice")
            elif co2 > 5000:
                print(f"   ⚠️  High CO₂ - might not be optimal")

            return True
        else:
            print(f"❌ FAILED: Status {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False

    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False

def main():
    print("="*80)
    print("COMPREHENSIVE MODEL TEST SUITE")
    print("="*80)
    print(f"Testing {len(test_scenarios)} scenarios...")
    print(f"Base URL: {BASE_URL}")
    print()


    try:
        response = requests.get("http://localhost:8000/docs", timeout=5)
        print("✅ Server is running")
    except:
        print("⚠️  Could not verify server, but continuing tests...")

    results = []
    start_time = time.time()

    for i, scenario in enumerate(test_scenarios):
        success = test_scenario(scenario, i)
        results.append((scenario['name'], success))
        time.sleep(0.5)

    total_time = time.time() - start_time


    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    passed = sum(1 for _, success in results if success)
    failed = len(results) - passed

    print(f"Total: {len(results)} tests")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"⏱️  Total time: {total_time:.2f}s")
    print()

    if failed > 0:
        print("Failed tests:")
        for name, success in results:
            if not success:
                print(f"  ❌ {name}")
    else:
        print("🎉 All tests passed!")

if __name__ == "__main__":
    main()

