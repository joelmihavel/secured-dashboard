# Performance Test Specifications
## Flent Secured - Performance Testing Documentation

<!-- FIGMA_STATUS: N/A -->
<!-- LAST_VERIFIED: 2026-01-31 -->
<!-- AUTO_UPDATE: false -->

---

## Overview

This document specifies performance tests and benchmarks for the Flent Secured application. Performance testing validates app responsiveness, memory usage, battery impact, and backend scalability.

**Platforms:**
- iOS: iPhone 12 (baseline), iPhone 15 Pro (target)
- Android: Pixel 5 (baseline), Pixel 7 (target)

**Tools:**
- React Native: Flashlight, Reactotron
- iOS: Instruments (Xcode)
- Android: Android Studio Profiler
- Backend: k6, Artillery

---

## Performance Budgets

### App Performance Targets

| Metric | Target | Acceptable | Critical |
|--------|--------|------------|----------|
| App startup (cold) | < 2s | < 3s | > 4s |
| App startup (warm) | < 1s | < 1.5s | > 2s |
| Screen transitions | < 300ms | < 500ms | > 800ms |
| Button response | < 100ms | < 200ms | > 300ms |
| List scroll (60fps) | 60fps | 55fps | < 45fps |
| Memory (active) | < 150MB | < 200MB | > 300MB |
| Memory (background) | < 50MB | < 80MB | > 120MB |
| Battery (1hr active) | < 5% | < 8% | > 12% |

### API Performance Targets

| Metric | Target | Acceptable | Critical |
|--------|--------|------------|----------|
| API response (p50) | < 100ms | < 200ms | > 500ms |
| API response (p95) | < 300ms | < 500ms | > 1s |
| API response (p99) | < 500ms | < 1s | > 2s |
| Concurrent users | 10,000 | 5,000 | < 1,000 |
| Requests/second | 1,000 | 500 | < 100 |

---

## 1. App Startup Performance

### PERF-START-001: Cold Start Time

**Description:** Measure time from app icon tap to interactive home screen

| Test ID | Scenario | Setup | Target |
|---------|----------|-------|--------|
| PERF-START-001-A | Cold start - fresh | Kill app, clear cache | < 2s |
| PERF-START-001-B | Cold start - cached | Kill app, cache warm | < 1.5s |
| PERF-START-001-C | Cold start - first launch | Fresh install | < 3s |

**Measurement Points:**
1. Process start time
2. Native bridge initialization
3. JavaScript bundle load
4. First render
5. Interactive (splash buttons clickable)

**Test Procedure:**
```bash
# iOS - Using Instruments
xcrun xctrace record --template 'Time Profiler' \
  --attach "FlentSecured" --output startup.trace

# Android - Using adb
adb shell am start-activity -W -S \
  com.flentsecured/.MainActivity | grep TotalTime
```

**React Native Specific:**
```javascript
// Measure in App.tsx
const startTime = global.nativePerformanceNow?.() || Date.now();

useEffect(() => {
  const endTime = global.nativePerformanceNow?.() || Date.now();
  console.log(`JS Init Time: ${endTime - startTime}ms`);
}, []);
```

---

### PERF-START-002: Warm Start Time

**Description:** Measure time from background to foreground

| Test ID | Scenario | Target |
|---------|----------|--------|
| PERF-START-002-A | Background < 30s | < 500ms |
| PERF-START-002-B | Background 5min | < 1s |
| PERF-START-002-C | Background 30min | < 1.5s |

---

## 2. Navigation Performance

### PERF-NAV-001: Screen Transition Times

**Description:** Measure time for screen transitions

| Test ID | Transition | Target |
|---------|------------|--------|
| PERF-NAV-001-A | Splash → Carousel | < 300ms |
| PERF-NAV-001-B | Carousel → Sign Up | < 300ms |
| PERF-NAV-001-C | Home → Payment Transaction | < 300ms |
| PERF-NAV-001-D | Payment → Payment Methods | < 300ms |
| PERF-NAV-001-E | Home → Profile | < 300ms |
| PERF-NAV-001-F | Modal open | < 200ms |
| PERF-NAV-001-G | Modal close | < 200ms |

**Measurement:**
```javascript
// Using React Navigation performance hooks
import { useNavigation } from '@react-navigation/native';

const navigation = useNavigation();

navigation.addListener('transitionStart', () => {
  performance.mark('nav-start');
});

navigation.addListener('transitionEnd', () => {
  performance.mark('nav-end');
  performance.measure('navigation', 'nav-start', 'nav-end');
});
```

---

### PERF-NAV-002: Deep Link Performance

| Test ID | Scenario | Target |
|---------|----------|--------|
| PERF-NAV-002-A | `flent://payment` (warm) | < 500ms |
| PERF-NAV-002-B | `flent://payment` (cold) | < 2.5s |
| PERF-NAV-002-C | `flent://profile` | < 400ms |

---

## 3. Rendering Performance

### PERF-RENDER-001: Frame Rate

**Description:** Maintain 60fps during animations and scrolling

| Test ID | Scenario | Target FPS |
|---------|----------|------------|
| PERF-RENDER-001-A | Carousel swipe | 60 |
| PERF-RENDER-001-B | Home scroll | 60 |
| PERF-RENDER-001-C | Payment history list | 60 |
| PERF-RENDER-001-D | Success animation | 60 |
| PERF-RENDER-001-E | Button press animation | 60 |

**Measurement:**
```javascript
// Using Flashlight CLI
flashlight measure --bundleId com.flentsecured \
  --testCommand "maestro test e2e/scroll-test.yaml" \
  --duration 60
```

---

### PERF-RENDER-002: Jank Detection

**Description:** Identify frames taking > 16.6ms

| Test ID | Scenario | Max Janky Frames |
|---------|----------|------------------|
| PERF-RENDER-002-A | Home screen load | < 3 |
| PERF-RENDER-002-B | Carousel animation | 0 |
| PERF-RENDER-002-C | Payment list render | < 5 |

---

### PERF-RENDER-003: Re-render Optimization

**Description:** Verify components don't re-render unnecessarily

| Test ID | Component | Max Re-renders |
|---------|-----------|----------------|
| PERF-RENDER-003-A | PrimaryButton | 1 per state change |
| PERF-RENDER-003-B | TextInput | 1 per keystroke |
| PERF-RENDER-003-C | HomeCard | 1 per data change |
| PERF-RENDER-003-D | PaymentBreakdown | 1 per update |

**Measurement:**
```javascript
// Using React DevTools Profiler or custom hook
const useRenderCount = (componentName: string) => {
  const renderCount = useRef(0);
  renderCount.current++;
  console.log(`${componentName} rendered ${renderCount.current} times`);
};
```

---

## 4. Memory Performance

### PERF-MEM-001: Memory Usage

**Description:** Monitor memory consumption across app states

| Test ID | Scenario | Max Memory |
|---------|----------|------------|
| PERF-MEM-001-A | Splash screen | < 80MB |
| PERF-MEM-001-B | Home (active) | < 120MB |
| PERF-MEM-001-C | Payment flow (peak) | < 150MB |
| PERF-MEM-001-D | Profile with chart | < 140MB |
| PERF-MEM-001-E | Backgrounded | < 50MB |

**Measurement:**
```bash
# iOS
instruments -t "Allocations" FlentSecured.app

# Android
adb shell dumpsys meminfo com.flentsecured
```

---

### PERF-MEM-002: Memory Leaks

**Description:** Detect memory leaks during extended usage

| Test ID | Scenario | Check |
|---------|----------|-------|
| PERF-MEM-002-A | Navigate 50 screens | Memory returns to baseline |
| PERF-MEM-002-B | Open/close modals 20x | No growth per cycle |
| PERF-MEM-002-C | Scroll long lists | No unbounded growth |
| PERF-MEM-002-D | Background/foreground 10x | Consistent baseline |

**Test Procedure:**
```
1. Record baseline memory after app start
2. Perform action 50 times
3. Force garbage collection
4. Record memory
5. Delta should be < 5MB
```

---

### PERF-MEM-003: Image Memory

**Description:** Optimize image memory usage

| Test ID | Scenario | Max Image Memory |
|---------|----------|------------------|
| PERF-MEM-003-A | Home screen images | < 10MB |
| PERF-MEM-003-B | Profile with history | < 15MB |
| PERF-MEM-003-C | Document preview | < 20MB |

---

## 5. Network Performance

### PERF-NET-001: API Response Handling

**Description:** Measure API call performance from client perspective

| Test ID | Endpoint | Target (p50) | Target (p95) |
|---------|----------|--------------|--------------|
| PERF-NET-001-A | GET /user/profile | < 100ms | < 300ms |
| PERF-NET-001-B | GET /payments/current | < 150ms | < 400ms |
| PERF-NET-001-C | POST /payments/create | < 200ms | < 500ms |
| PERF-NET-001-D | POST /auth/verify-otp | < 100ms | < 300ms |
| PERF-NET-001-E | GET /payments/history | < 200ms | < 500ms |

---

### PERF-NET-002: Slow Network Handling

**Description:** App behavior on degraded networks

| Test ID | Network Condition | Expected Behavior |
|---------|-------------------|-------------------|
| PERF-NET-002-A | 3G (750kbps) | App usable, longer loading |
| PERF-NET-002-B | 2G (128kbps) | Timeout warnings, cached data |
| PERF-NET-002-C | High latency (500ms) | No timeouts, graceful |
| PERF-NET-002-D | Packet loss (5%) | Retry logic handles |
| PERF-NET-002-E | Offline | Cached data shown |

**Test Setup:**
```bash
# iOS - Network Link Conditioner
# Android -
adb shell settings put global captive_portal_mode 0
# Use Charles Proxy or similar for throttling
```

---

### PERF-NET-003: Data Transfer Size

**Description:** Minimize data transfer

| Test ID | Flow | Max Data |
|---------|------|----------|
| PERF-NET-003-A | Cold start API calls | < 50KB |
| PERF-NET-003-B | Home refresh | < 10KB |
| PERF-NET-003-C | Payment flow (all calls) | < 30KB |
| PERF-NET-003-D | Profile load | < 15KB |

---

## 6. Battery Performance

### PERF-BAT-001: Active Usage

**Description:** Battery drain during active use

| Test ID | Scenario | Max Drain/Hour |
|---------|----------|----------------|
| PERF-BAT-001-A | Normal use (home, browse) | < 5% |
| PERF-BAT-001-B | Payment flow | < 3% |
| PERF-BAT-001-C | Continuous scrolling | < 8% |

---

### PERF-BAT-002: Background Impact

**Description:** Battery drain while backgrounded

| Test ID | Scenario | Max Drain/Hour |
|---------|----------|----------------|
| PERF-BAT-002-A | Background idle | < 0.5% |
| PERF-BAT-002-B | Push notification receipt | < 1% |
| PERF-BAT-002-C | Background refresh | < 1% |

---

## 7. Backend Load Testing

### PERF-LOAD-001: API Load Test

**Description:** Test backend under load using k6

| Test ID | Scenario | Target RPS | Target p95 |
|---------|----------|------------|------------|
| PERF-LOAD-001-A | 100 concurrent users | 100 | < 500ms |
| PERF-LOAD-001-B | 1000 concurrent users | 500 | < 1s |
| PERF-LOAD-001-C | 5000 concurrent users | 1000 | < 2s |

**k6 Test Script:**
```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 1000 }, // Peak load
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('https://api.flentsecured.com/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

---

### PERF-LOAD-002: Payment Spike Test

**Description:** Simulate rent payment day spike (1st-7th of month)

| Test ID | Scenario | Expected |
|---------|----------|----------|
| PERF-LOAD-002-A | 1000 payments/minute | All succeed |
| PERF-LOAD-002-B | 5000 payments/minute | < 5% timeout |
| PERF-LOAD-002-C | Spike to 10x normal | Auto-scale handles |

---

### PERF-LOAD-003: Database Performance

**Description:** Database query performance under load

| Test ID | Query | Target |
|---------|-------|--------|
| PERF-LOAD-003-A | User lookup by ID | < 10ms |
| PERF-LOAD-003-B | Payment history (paginated) | < 50ms |
| PERF-LOAD-003-C | Aggregate cashback calc | < 100ms |
| PERF-LOAD-003-D | Complex report query | < 500ms |

---

## 8. Stress Testing

### PERF-STRESS-001: Extended Usage

**Description:** App stability over extended periods

| Test ID | Duration | Check |
|---------|----------|-------|
| PERF-STRESS-001-A | 4 hours active | No crashes, memory stable |
| PERF-STRESS-001-B | 24 hours background | Wake correctly |
| PERF-STRESS-001-C | 100 navigation cycles | No degradation |

---

### PERF-STRESS-002: Resource Exhaustion

**Description:** Behavior under resource constraints

| Test ID | Constraint | Expected |
|---------|------------|----------|
| PERF-STRESS-002-A | Low memory (< 100MB free) | Graceful degradation |
| PERF-STRESS-002-B | Low storage (< 100MB free) | Clear warning |
| PERF-STRESS-002-C | CPU throttled | Slower but functional |

---

## 9. Animation Performance

### PERF-ANIM-001: Animation Smoothness

**Description:** All animations maintain 60fps

| Test ID | Animation | Duration | Target |
|---------|-----------|----------|--------|
| PERF-ANIM-001-A | Button press scale | 100ms | 60fps |
| PERF-ANIM-001-B | Carousel slide | 300ms | 60fps |
| PERF-ANIM-001-C | Modal open | 250ms | 60fps |
| PERF-ANIM-001-D | Success checkmark | 1000ms | 60fps |
| PERF-ANIM-001-E | Loading spinner | Continuous | 60fps |

**Measurement:**
```javascript
// Using Reanimated worklet logs
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

useAnimatedReaction(
  () => animatedValue.value,
  (current, previous) => {
    const frameDuration = performance.now() - lastFrameTime;
    if (frameDuration > 16.7) {
      runOnJS(console.warn)(`Dropped frame: ${frameDuration}ms`);
    }
  }
);
```

---

## 10. Benchmarking Infrastructure

### Continuous Performance Monitoring

```yaml
# GitHub Action for performance testing
name: Performance Tests

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  perf-test:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4

      - name: Build app
        run: cd rn-app && npm ci && npx expo prebuild --platform ios

      - name: Run Flashlight tests
        run: |
          npx @perf-tools/flashlight measure \
            --bundleId com.flentsecured \
            --testCommand "maestro test e2e/performance-suite.yaml" \
            --resultsFilePath results.json

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: perf-results
          path: results.json

      - name: Check thresholds
        run: node scripts/check-perf-thresholds.js results.json
```

### Performance Dashboard Metrics

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Cold start time | CI | > 3s |
| JS bundle size | Build | > 5MB |
| Native binary size | Build | > 50MB |
| API p95 latency | Monitoring | > 1s |
| Error rate | Monitoring | > 1% |
| Crash-free rate | Analytics | < 99.5% |

---

## Summary

| Category | Test Count | Priority |
|----------|------------|----------|
| App Startup | 5 | P0 |
| Navigation | 10 | P0 |
| Rendering | 12 | P0 |
| Memory | 11 | P0 |
| Network | 13 | P0 |
| Battery | 5 | P1 |
| Backend Load | 8 | P1 |
| Stress | 5 | P1 |
| Animation | 5 | P1 |
| **Total** | **74** | - |

---

*Document generated: 2026-01-31*
*Review frequency: Monthly or after major releases*
