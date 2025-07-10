# 📘 API Documentation

## 📌 Endpoint: `POST /auth/login`

**Description:**
Authenticate a user and return access and refresh tokens.

### Request

**Headers:**

```http
Content-Type: application/json
```

**Body:**

```json
{
  "email": "user@example.com",
  "password": "yourPassword123"
}
```

### Response

**Success (200):**

```json
{
  "accessToken": "<access_token>",
  "refreshToken": "<refresh_token>"
}
```

**Error (401):**

```json
{
  "error": "Invalid credentials"
}
```

### Status Codes

* `200 OK` – Successful login
* `401 Unauthorized` – Invalid credentials
* `400 Bad Request` – Missing fields

