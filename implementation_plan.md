# Đồng bộ Production Docker Compose — Plan v2

> Cập nhật theo review: fix Redis Upstash conflict + giữ Gateway dependencies lean.

---

## Proposed Changes

### [MODIFY] [docker-compose.prod.yml](file:///e:/UIT/cv/MiniDiscord/backend/docker-compose.prod.yml)

#### 1. Sửa `api-gateway` — Xóa hardcoded Redis, dùng [.env.prod](file:///e:/UIT/cv/MiniDiscord/backend/.env.prod)

**Lý do**: `REDIS_HOST=redis` ghi đè Upstash config từ [.env.prod](file:///e:/UIT/cv/MiniDiscord/backend/.env.prod) → service crash.
**Giải pháp**: Xóa Redis overrides, để `env_file: .env.prod` truyền Upstash credentials tự động.
**Dependencies**: Giữ nguyên `discovery-server` + xóa `redis` (vì không dùng internal Redis nữa).

```diff
   api-gateway:
     environment:
       - SPRING_PROFILES_ACTIVE=prod
       - EUREKA_URL=http://discovery-server:8761/eureka/
-      - REDIS_HOST=redis
-      - REDIS_PORT=6379
     depends_on:
       discovery-server:
         condition: service_healthy
-      redis:
-        condition: service_healthy
```

#### 2. Sửa `messaging-service` — Xóa hardcoded Redis

```diff
   messaging-service:
     environment:
       - SPRING_PROFILES_ACTIVE=prod
       - EUREKA_URL=http://discovery-server:8761/eureka/
-      - REDIS_HOST=redis
-      - REDIS_PORT=6379
     depends_on:
       discovery-server:
         condition: service_healthy
-      redis:
-        condition: service_healthy
```

#### 3. Sửa `user-service` — Thêm `depends_on` discovery-server (đã có), KHÔNG thêm Redis overrides

`user-service` sẽ tự nhận Redis config từ `env_file: .env.prod` (Upstash). Không cần khai báo thêm.

> Không thay đổi gì ở user-service — cấu hình hiện tại đã đúng.

#### 4. Xóa service `redis` container nội bộ

**Lý do**: Tất cả services đều dùng Upstash từ [.env.prod](file:///e:/UIT/cv/MiniDiscord/backend/.env.prod). Container Redis nội bộ không còn ai sử dụng.

```diff
-  redis:
-    image: redis:7-alpine
-    container_name: minidiscord-redis
-    restart: always
-    command: redis-server --maxmemory 64mb --maxmemory-policy allkeys-lru
-    deploy:
-      resources:
-        limits:
-          memory: 96M
-    networks:
-      - minidiscord-net
-    healthcheck:
-      test: ["CMD", "redis-cli", "ping"]
-      interval: 10s
-      timeout: 3s
-      retries: 3
```

#### 5. Thêm Healthcheck cho tất cả business services

| Service | Port | `start_period` |
|---|---|---|
| `user-service` | 8081 | 45s |
| `group-channel-service` | 8082 | 50s |
| `chat-history-service` | 8083 | 50s |
| `messaging-service` | 8084 | 50s |

Template:
```yaml
    healthcheck:
      test: ["CMD-SHELL", "wget --spider -q http://localhost:<port>/actuator/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: <value>s
```

---

### [MODIFY] [deploy-backend.yml](file:///e:/UIT/cv/MiniDiscord/.github/workflows/deploy-backend.yml)

Cập nhật deploy script: xóa bước `redis`, không cần khởi động Redis nội bộ.

```diff
   # Restart infra first
-  docker compose -f docker-compose.prod.yml up -d redis
   docker compose -f docker-compose.prod.yml up -d discovery-server
```

---

## Verification Plan

- Review diff sau khi chỉnh sửa
- Kiểm tra `docker compose -f docker-compose.prod.yml config` để validate YAML
- Deploy lên DigitalOcean, verify `docker compose ps` — tất cả services healthy
