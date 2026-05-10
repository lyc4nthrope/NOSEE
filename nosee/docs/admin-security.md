# Admin Security — RLS y CSP

## RLS — Estado por tabla

| Tabla | RLS Habilitado | Policies Admin |
|-------|---------------|----------------|
| `reputation_config` | ✅ Sí | ✅ admins_read, admins_insert, admins_update |
| `dealer_applications` | ✅ Sí | ✅ select_admin, update_admin |
| `user_activity_logs` | ✅ Sí | ✅ admins_select_activity |
| `dealer_ratings` | ✅ Sí | ❌ Sin policy admin (solo owner/dealer) |
| `orders` | ✅ Sí | ❌ Sin policy admin explícita |
| `dealer_locations` | ✅ Sí | ❌ Sin policy admin explícita |
| `stores` | ✅ Sí | ❌ Sin policy admin (solo anon select visible) |
| `users` | ❓ No visible en migrations | ❓ Asumir RLS desde schema inicial |
| `price_publications` | ❓ No visible en migrations | ❓ Asumir RLS desde schema inicial |
| `products` | ❓ No visible en migrations | ❓ Asumir RLS desde schema inicial |
| `brands` | ❓ No visible en migrations | ❓ Asumir RLS desde schema inicial |
| `admin_content_audit_log` | ✅ Sí | ✅ admin_content_audit_log_select, admin_content_audit_log_insert |
| `login_audit_logs` | ✅ Sí | ✅ login_audit_logs_select, login_audit_logs_insert (permite anon) |
| `reports` | ✅ Sí | ✅ 6 policies (ver migration 20260510) |

### Resuelto: `reports`

La migration `20260510_enable_rls_reports.sql` habilitó RLS y creó 6 políticas:
- `admin_mod_select_reports` — admins/moderadores SELECT todos
- `user_select_own_reports` — usuarios SELECT propios
- `user_insert_reports` — INSERT con reporter_user_id = auth.uid()
- `user_update_own_reports` — UPDATE propios
- `admin_mod_update_reports` — admins/moderadores UPDATE cualquiera
- `user_delete_own_reports` — DELETE propios

## CSP (Content Security Policy)

Requiere configuración a nivel del deploy (no código JS). Para Vercel:

```json
// vercel.json — headers
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://api.cloudinary.com; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
        }
      ]
    }
  ]
}
```

Para Static Web Apps (Azure):
```json
// staticwebapp.config.json — ya existe en el proyecto
// Agregar al bloque "navigationFallback" o "routes"
```

**Nota:** CSP no se puede implementar desde el cliente — requiere configuración del servidor/proxy/CDN.
