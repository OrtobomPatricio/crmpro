# ==========================================
# Sentry Error Tracking Setup Guide
# ==========================================

## Why Sentry?

Sentry provides real-time error tracking and performance monitoring for production applications:
- **Automatic error capture** with stack traces
- **Performance monitoring** (slow queries, API calls)
- **Release tracking** (know which version caused issues)
- **User feedback** integration
- **Alerts** via email, Slack, etc.

---

## Step 1: Create Sentry Account

1. Go to https://sentry.io/signup/
2. Create free account (includes 5,000 errors/month)
3. Create a new project:
   - Platform: **Node.js**
   - Name: **CRM PRO Backend**
4. Copy your **DSN** (looks like: `https://xxx@sentry.io/xxx`)

---

## Step 2: Install Dependencies

```bash
pnpm add @sentry/node @sentry/react
```

---

## Step 3: Configure Backend

Edit `server/_core/index.ts`:

```typescript
import * as Sentry from "@sentry/node";

// After imports, before creating Express app
if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1, // 10% of transactions
    
    // Optional: Release tracking
    release: process.env.npm_package_version,
    
    // Optional: Filter out sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers.cookie;
        delete event.request.headers.authorization;
      }
      return event;
    }
  });
  
  console.log("✅ Sentry error tracking initialized");
}

// ... rest of code ...

// Add error handler AFTER all routes
app.use(Sentry.Handlers.errorHandler());
```

---

## Step 4: Configure Frontend

Edit `client/src/main.tsx`:

```typescript
import * as Sentry from "@sentry/react";

if (import.meta.env.VITE_SENTRY_DSN && import.meta.env.MODE === 'production') {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay()
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0
  });
  
  console.log("✅ Sentry initialized");
}
```

---

## Step 5: Add Environment Variables

**.env (local):**
```env
# Sentry (optional in development)
SENTRY_DSN=
VITE_SENTRY_DSN=
```

**.env (production on VPS):**
```env
# Sentry Error Tracking
SENTRY_DSN=https://YOUR_DSN@sentry.io/YOUR_PROJECT_ID
VITE_SENTRY_DSN=https://YOUR_DSN@sentry.io/YOUR_PROJECT_ID
```

---

## Step 6: Test Error Tracking

**Test backend:**
```bash
curl http://localhost:3000/api/test-sentry-error
```

**Test frontend:**
Open browser console and run:
```javascript
throw new Error("Test Sentry error from frontend");
```

Check Sentry dashboard - errors should appear within seconds.

---

## Step 7: Setup Alerts

In Sentry dashboard:
1. Go to **Settings** → **Alerts**
2. Create alert rule:
   - Condition: "An event is seen"
   - Filters: Severity is "error" or higher
   - Action: Send notification to email/Slack
3. Save

---

## Optional: Performance Monitoring

Enable performance tracking for slow queries:

```typescript
// In tRPC queries
const result = await Sentry.startSpan(
  { name: 'leads.getAll', op: 'db.query' },
  async () => {
    return await db.query.leads.findMany();
  }
);
```

---

## Useful Sentry Features

### 1. User Context
```typescript
Sentry.setUser({ id: user.id, email: user.email });
```

### 2. Custom Tags
```typescript
Sentry.setTag('feature', 'campaigns');
```

### 3. Breadcrumbs
```typescript
Sentry.addBreadcrumb({
  message: 'Campaign started',
  category: 'campaign',
  level: 'info'
});
```

### 4. Manual Error Capture
```typescript
try {
  // risky code
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
```

---

## Troubleshooting

**Issue:** Errors not appearing in Sentry

**Solutions:**
1. Check DSN is correct in .env
2. Verify `NODE_ENV=production`
3. Check network: `curl https://sentry.io`
4. Enable debug mode:
   ```typescript
   Sentry.init({ debug: true, ... });
   ```

**Issue:** Too many errors (quota exceeded)

**Solutions:**
1. Add filters in `beforeSend`
2. Reduce `tracesSampleRate`
3. Upgrade Sentry plan
4. Filter specific error types

---

## Cost Optimization

Free tier includes:
- 5,000 errors/month
- 10,000 performance units/month
- 30 days retention

Tips to stay within limits:
- Sample only 10% of transactions
- Filter out expected errors (404s, etc.)
- Use error fingerprinting to group similar errors

---

## Next Steps

After Sentry is working:
1. Set up release tracking (git SHA in releases)
2. Configure source maps for better stack traces
3. Integrate with Slack for instant alerts
4. Set up custom dashboards

---

**Generated:** 2026-02-02  
**Status:** Optional but highly recommended for production
