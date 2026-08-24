# Performance Audit — 2026-08-24T15:20:32.183Z

**Base URL:** `https://sst-hostel-leave-phi.vercel.app`

## Summary

| Metric | Count |
|--------|------:|
| Routes tested | 34 |
| 🟢 Passing | 32 |
| 🟡 Warning | 0 |
| 🔴 Failing | 2 |

## Page Performance

| Route | Role | TTFB | FCP | LCP | CLS | JS | API # | Status |
|-------|:----:|-----:|----:|----:|----:|---:|------:|:------:|
| / | public |   30ms |  9.48s |  9.48s | 0.000 | 524.4KB |     0 | 🔴 |
| /login | public |   35ms |  5.86s |  5.86s | 0.000 | 437.3KB |     0 | 🔴 |
| /unauthorized | public |   31ms |  872ms |  872ms | 0.000 | 436.8KB |     0 | 🟢 |
| /student/dashboard | student |   36ms |  712ms |  1.34s | 0.000 | 538.0KB |     2 | 🟢 |
| /student/leaves | student |   28ms |  728ms |  1.20s | 0.000 | 528.2KB |     1 | 🟢 |
| /student/leaves/new | student |   31ms |  684ms |  1.31s | 0.000 | 604.8KB |     1 | 🟢 |
| /profile | student |   64ms |  1.16s |  1.16s | 0.000 | 442.8KB |     0 | 🟢 |
| /admin/dashboard | admin |   33ms |  700ms |  1.34s | 0.000 | 519.3KB |     4 | 🟢 |
| /admin/approvals | admin |   30ms |  844ms |  1.46s | 0.000 | 548.9KB |     6 | 🟢 |
| /admin/analytics | admin |   53ms |  760ms |  1.44s | 0.000 | 715.5KB |     4 | 🟢 |
| /admin/extension-approvals | admin |   30ms |  748ms |  1.52s | 0.000 | 548.7KB |     5 | 🟢 |
| /admin/movements | admin |   30ms |  728ms |  1.34s | 0.000 | 519.7KB |     4 | 🟢 |
| /admin/overdue | admin |   33ms |  728ms |  1.18s | 0.000 | 536.6KB |     4 | 🟢 |
| /admin/students | admin |   32ms |  696ms |  1.35s | 0.000 | 520.6KB |     5 | 🟢 |
| /super-admin/dashboard | super-admin |   33ms |  720ms |  1.37s | 0.000 | 521.6KB |     4 | 🟢 |
| /super-admin/analytics | super-admin |   32ms |  924ms |  1.56s | 0.000 | 717.1KB |     4 | 🟢 |
| /super-admin/approvals | super-admin |   35ms |  760ms |  1.50s | 0.000 | 550.5KB |     6 | 🟢 |
| /super-admin/extension-approvals | super-admin |   44ms |  788ms |  1.42s | 0.000 | 550.4KB |     5 | 🟢 |
| /super-admin/hostels | super-admin |   30ms |  732ms |  1.32s | 0.000 | 520.9KB |     4 | 🟢 |
| /super-admin/departments | super-admin |   30ms |  696ms |  1.32s | 0.000 | 520.3KB |     4 | 🟢 |
| /super-admin/academic-groups | super-admin |   31ms |  880ms |  1.31s | 0.000 | 520.7KB |     5 | 🟢 |
| /super-admin/leave-types | super-admin |   34ms |  732ms |  1.30s | 0.000 | 524.0KB |     4 | 🟢 |
| /super-admin/notification-rules | super-admin |   30ms |  716ms |  716ms | 0.000 | 521.3KB |     5 | 🟢 |
| /super-admin/notification-templates | super-admin |   31ms |  856ms |  1.31s | 0.000 | 521.0KB |     4 | 🟢 |
| /super-admin/notifications/delivery-logs | super-admin |   30ms |  692ms |  1.20s | 0.000 | 520.6KB |     3 | 🟢 |
| /super-admin/parents | super-admin |   31ms |  908ms |  1.35s | 0.000 | 638.8KB |     4 | 🟢 |
| /super-admin/policies | super-admin |   43ms |  728ms |  1.24s | 0.000 | 590.5KB |     7 | 🟢 |
| /super-admin/settings | super-admin |   36ms |  888ms |  1.46s | 0.000 | 521.0KB |     3 | 🟢 |
| /super-admin/students | super-admin |   35ms |  736ms |  1.46s | 0.000 | 640.6KB |     6 | 🟢 |
| /super-admin/users | super-admin |   30ms |  944ms |  1.74s | 0.000 | 522.1KB |     4 | 🟢 |
| /super-admin/users/new | super-admin |   30ms |  708ms |  708ms | 0.000 | 529.4KB |     4 | 🟢 |
| /super-admin/workflows | super-admin |   31ms |  744ms |  1.32s | 0.000 | 523.3KB |     4 | 🟢 |
| /poc/dashboard | poc |   32ms |  752ms |  1.40s | 0.000 | 548.1KB |     4 | 🟢 |
| /guard/scanner | guard |   27ms |  172ms |  172ms | 0.000 | 212.6KB |     0 | 🟢 |

## Slowest Routes (by LCP)

| Rank | Route | LCP | TTFB | Verdict |
|-----:|-------|----:|-----:|:-------:|
| 1 | / | 9.48s | 30ms | 🔴 |
| 2 | /login | 5.86s | 35ms | 🔴 |
| 3 | /super-admin/users | 1.74s | 30ms | 🟢 |
| 4 | /super-admin/analytics | 1.56s | 32ms | 🟢 |
| 5 | /admin/extension-approvals | 1.52s | 30ms | 🟢 |
| 6 | /super-admin/approvals | 1.50s | 35ms | 🟢 |
| 7 | /super-admin/students | 1.46s | 35ms | 🟢 |
| 8 | /admin/approvals | 1.46s | 30ms | 🟢 |
| 9 | /super-admin/settings | 1.46s | 36ms | 🟢 |
| 10 | /admin/analytics | 1.44s | 53ms | 🟢 |
| 11 | /super-admin/extension-approvals | 1.42s | 44ms | 🟢 |
| 12 | /poc/dashboard | 1.40s | 32ms | 🟢 |
| 13 | /super-admin/dashboard | 1.37s | 33ms | 🟢 |
| 14 | /super-admin/parents | 1.35s | 31ms | 🟢 |
| 15 | /admin/students | 1.35s | 32ms | 🟢 |

## API Waterfalls

### /student/dashboard

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/dashboard/stats | GET | 200 |    651ms 🟡 |     192B |
| /api/v1/leaves | GET | 200 |    598ms 🟡 |      80B |

### /student/leaves

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/leaves | GET | 200 |    593ms 🟡 |      81B |

### /student/leaves/new

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/leave-types | GET | 200 |    583ms 🟡 |    6.5KB |

### /admin/dashboard

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/dashboard/stats | GET | 200 |    748ms 🟡 |    2.4KB |
| /api/v1/extensions/approvals | GET | 200 |    643ms 🟡 |    1.6KB |
| /api/v1/approvals | GET | 200 |    595ms 🟡 |      80B |
| /api/v1/overdue | GET | 200 |    590ms 🟡 |      26B |

### /admin/approvals

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/approvals | GET | 200 |    1.11s 🔴 |      81B |
| /api/v1/overdue | GET | 200 |    648ms 🟡 |      26B |
| /api/v1/leave-types | GET | 200 |    584ms 🟡 |    6.5KB |
| /api/v1/extensions/approvals | GET | 200 |    582ms 🟡 |    1.6KB |
| /api/v1/hostels | GET | 200 |    575ms 🟡 |     195B |
| /api/v1/dashboard/stats | GET | 200 |    503ms 🟡 |    2.4KB |

### /admin/analytics

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/extensions/approvals | GET | 200 |    777ms 🟡 |    1.6KB |
| /api/v1/approvals | GET | 200 |    667ms 🟡 |      80B |
| /api/v1/dashboard/stats | GET | 200 |    638ms 🟡 |    2.4KB |
| /api/v1/overdue | GET | 200 |    560ms 🟡 |      26B |

### /admin/extension-approvals

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/extensions/approvals | GET | 200 |    808ms 🟡 |   13.9KB |
| /api/v1/approvals | GET | 200 |    768ms 🟡 |      80B |
| /api/v1/overdue | GET | 200 |    665ms 🟡 |      26B |
| /api/v1/leave-types | GET | 200 |    634ms 🟡 |    6.5KB |
| /api/v1/hostels | GET | 200 |    530ms 🟡 |     195B |

### /admin/movements

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/movements | GET | 200 |    711ms 🟡 |     731B |
| /api/v1/extensions/approvals | GET | 200 |    672ms 🟡 |    1.6KB |
| /api/v1/approvals | GET | 200 |    574ms 🟡 |      80B |
| /api/v1/overdue | GET | 200 |    561ms 🟡 |      26B |

### /admin/overdue

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/hostels | GET | 200 |    733ms 🟡 |     195B |
| /api/v1/extensions/approvals | GET | 200 |    627ms 🟡 |    1.6KB |
| /api/v1/approvals | GET | 200 |    564ms 🟡 |      80B |
| /api/v1/overdue | GET | 200 |    505ms 🟡 |      26B |

### /admin/students

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/students | GET | 200 |    680ms 🟡 |    1.7KB |
| /api/v1/dashboard/stats | GET | 200 |    679ms 🟡 |    2.4KB |
| /api/v1/extensions/approvals | GET | 200 |    652ms 🟡 |    1.6KB |
| /api/v1/overdue | GET | 200 |    461ms |      26B |
| /api/v1/approvals | GET | 200 |    450ms |      80B |

### /super-admin/dashboard

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/approvals | GET | 200 |    612ms 🟡 |    1.5KB |
| /api/v1/dashboard/stats | GET | 200 |    607ms 🟡 |    2.4KB |
| /api/v1/extensions/approvals | GET | 200 |    573ms 🟡 |    1.6KB |
| /api/v1/overdue | GET | 200 |    569ms 🟡 |      26B |

### /super-admin/analytics

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/extensions/approvals | GET | 200 |    784ms 🟡 |    1.6KB |
| /api/v1/approvals | GET | 200 |    722ms 🟡 |    1.5KB |
| /api/v1/dashboard/stats | GET | 200 |    613ms 🟡 |    2.4KB |
| /api/v1/overdue | GET | 200 |    597ms 🟡 |      26B |

### /super-admin/approvals

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/approvals | GET | 200 |    813ms 🟡 |   13.3KB |
| /api/v1/dashboard/stats | GET | 200 |    649ms 🟡 |    2.4KB |
| /api/v1/extensions/approvals | GET | 200 |    623ms 🟡 |    1.6KB |
| /api/v1/overdue | GET | 200 |    539ms 🟡 |      26B |
| /api/v1/leave-types | GET | 200 |    539ms 🟡 |    6.5KB |
| /api/v1/hostels | GET | 200 |    431ms |     368B |

### /super-admin/extension-approvals

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/extensions/approvals | GET | 200 |    896ms 🟡 |   15.0KB |
| /api/v1/overdue | GET | 200 |    613ms 🟡 |      26B |
| /api/v1/leave-types | GET | 200 |    602ms 🟡 |    6.5KB |
| /api/v1/hostels | GET | 200 |    556ms 🟡 |     368B |
| /api/v1/approvals | GET | 200 |    542ms 🟡 |    1.5KB |

### /super-admin/hostels

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/approvals | GET | 200 |    620ms 🟡 |    1.5KB |
| /api/v1/extensions/approvals | GET | 200 |    595ms 🟡 |    1.6KB |
| /api/v1/hostels | GET | 200 |    568ms 🟡 |     368B |
| /api/v1/overdue | GET | 200 |    443ms |      26B |

### /super-admin/departments

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/extensions/approvals | GET | 200 |    663ms 🟡 |    1.6KB |
| /api/v1/overdue | GET | 200 |    590ms 🟡 |      26B |
| /api/v1/departments | GET | 200 |    573ms 🟡 |     230B |
| /api/v1/approvals | GET | 200 |    537ms 🟡 |    1.5KB |

### /super-admin/academic-groups

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/approvals | GET | 200 |    600ms 🟡 |    1.5KB |
| /api/v1/overdue | GET | 200 |    598ms 🟡 |      26B |
| /api/v1/extensions/approvals | GET | 200 |    585ms 🟡 |    1.6KB |
| /api/v1/academic-groups | GET | 200 |    572ms 🟡 |     294B |
| /api/v1/departments | GET | 200 |    550ms 🟡 |     230B |

### /super-admin/leave-types

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/extensions/approvals | GET | 200 |    707ms 🟡 |    1.6KB |
| /api/v1/workflows | GET | 200 |    546ms 🟡 |    8.2KB |
| /api/v1/overdue | GET | 200 |    513ms 🟡 |      26B |
| /api/v1/approvals | GET | 200 |    449ms |    1.5KB |

### /super-admin/notification-rules

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/notification-templates | GET | 200 |    765ms 🟡 |   34.4KB |
| /api/v1/overdue | GET | 200 |    644ms 🟡 |      26B |
| /api/v1/notification-rules | GET | 200 |    584ms 🟡 |     353B |
| /api/v1/extensions/approvals | GET | 200 |    555ms 🟡 |    1.6KB |
| /api/v1/approvals | GET | 200 |    452ms |    1.5KB |

### /super-admin/notification-templates

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/extensions/approvals | GET | 200 |    603ms 🟡 |    1.6KB |
| /api/v1/notification-templates | GET | 200 |    594ms 🟡 |   34.4KB |
| /api/v1/approvals | GET | 200 |    473ms |    1.5KB |
| /api/v1/overdue | GET | 200 |    447ms |      26B |

### /super-admin/notifications/delivery-logs

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/extensions/approvals | GET | 200 |    601ms 🟡 |    1.6KB |
| /api/v1/approvals | GET | 200 |    587ms 🟡 |    1.5KB |
| /api/v1/overdue | GET | 200 |    585ms 🟡 |      26B |

### /super-admin/parents

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/approvals | GET | 200 |    764ms 🟡 |    1.5KB |
| /api/v1/parents | GET | 200 |    689ms 🟡 |     800B |
| /api/v1/extensions/approvals | GET | 200 |    678ms 🟡 |    1.6KB |
| /api/v1/overdue | GET | 200 |    650ms 🟡 |      26B |

### /super-admin/policies

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/overdue | GET | 200 |    1.85s 🔴 |      26B |
| /api/v1/leave-types | GET | 200 |    782ms 🟡 |    6.5KB |
| /api/v1/extensions/approvals | GET | 200 |    678ms 🟡 |    1.6KB |
| /api/v1/approvals | GET | 200 |    593ms 🟡 |    1.5KB |
| /api/v1/departments | GET | 200 |    590ms 🟡 |     230B |
| /api/v1/hostels | GET | 200 |    586ms 🟡 |     368B |
| /api/v1/policies | GET | 200 |    458ms |      26B |

### /super-admin/settings

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/extensions/approvals | GET | 200 |    754ms 🟡 |    1.6KB |
| /api/v1/overdue | GET | 200 |    559ms 🟡 |      26B |
| /api/v1/approvals | GET | 200 |    534ms 🟡 |    1.5KB |

### /super-admin/students

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/extensions/approvals | GET | 200 |    709ms 🟡 |    1.6KB |
| /api/v1/students | GET | 200 |    693ms 🟡 |    3.7KB |
| /api/v1/hostels | GET | 200 |    686ms 🟡 |     368B |
| /api/v1/academic-groups | GET | 200 |    533ms 🟡 |     294B |
| /api/v1/approvals | GET | 200 |    528ms 🟡 |    1.5KB |
| /api/v1/overdue | GET | 200 |    492ms |      26B |

### /super-admin/users

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/approvals | GET | 200 |    727ms 🟡 |    1.5KB |
| /api/v1/users | GET | 200 |    713ms 🟡 |    8.3KB |
| /api/v1/extensions/approvals | GET | 200 |    709ms 🟡 |    1.6KB |
| /api/v1/overdue | GET | 200 |    672ms 🟡 |      26B |

### /super-admin/users/new

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/approvals | GET | 200 |    844ms 🟡 |    1.5KB |
| /api/v1/overdue | GET | 200 |    814ms 🟡 |      26B |
| /api/v1/extensions/approvals | GET | 200 |    670ms 🟡 |    1.6KB |
| /api/v1/hostels | GET | 200 |    530ms 🟡 |     368B |

### /super-admin/workflows

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/approvals | GET | 200 |    702ms 🟡 |    1.5KB |
| /api/v1/extensions/approvals | GET | 200 |    646ms 🟡 |    1.6KB |
| /api/v1/workflows | GET | 200 |    611ms 🟡 |    8.2KB |
| /api/v1/overdue | GET | 200 |    589ms 🟡 |      26B |

### /poc/dashboard

| Endpoint | Method | Status | Duration | Size |
|----------|-------:|-------:|---------:|-----:|
| /api/v1/dashboard/stats | GET | 200 |    633ms 🟡 |    2.4KB |
| /api/v1/approvals | GET | 200 |    585ms 🟡 |      81B |
| /api/v1/hostels | GET | 200 |    569ms 🟡 |     195B |
| /api/v1/leave-types | GET | 200 |    539ms 🟡 |    6.5KB |

## Bottleneck Analysis

### Slowest API Endpoints (>500ms)

| Page | Endpoint | Duration |
|------|----------|---------:|
| /super-admin/policies | /api/v1/overdue | 1.85s |
| /admin/approvals | /api/v1/approvals | 1.11s |
| /super-admin/extension-approvals | /api/v1/extensions/approvals | 896ms |
| /super-admin/users/new | /api/v1/approvals | 844ms |
| /super-admin/users/new | /api/v1/overdue | 814ms |
| /super-admin/approvals | /api/v1/approvals | 813ms |
| /admin/extension-approvals | /api/v1/extensions/approvals | 808ms |
| /super-admin/analytics | /api/v1/extensions/approvals | 784ms |
| /super-admin/policies | /api/v1/leave-types | 782ms |
| /admin/analytics | /api/v1/extensions/approvals | 777ms |
| /admin/extension-approvals | /api/v1/approvals | 768ms |
| /super-admin/notification-rules | /api/v1/notification-templates | 765ms |
| /super-admin/parents | /api/v1/approvals | 764ms |
| /super-admin/settings | /api/v1/extensions/approvals | 754ms |
| /admin/dashboard | /api/v1/dashboard/stats | 748ms |
| /admin/overdue | /api/v1/hostels | 733ms |
| /super-admin/users | /api/v1/approvals | 727ms |
| /super-admin/analytics | /api/v1/approvals | 722ms |
| /super-admin/users | /api/v1/users | 713ms |
| /admin/movements | /api/v1/movements | 711ms |

## Recommendations

### Priority 1: Fix Failing Routes

- **/**: FCP 9.48s (target: 1.50s), LCP 9.48s (target: 2.00s)
- **/login**: FCP 5.86s (target: 1.50s), LCP 5.86s (target: 2.00s)

---
*Generated by performance audit runner*