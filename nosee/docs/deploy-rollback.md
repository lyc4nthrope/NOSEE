# Rollback Procedure

## Vercel
1. Ir a https://vercel.com/.../deployments
2. Encontrar el último deployment funcional
3. Click en "..." → "Rollback to this deployment"

## Azure Static Web Apps
1. Ir a Azure Portal → Static Web App
2. Deployment Slots → seleccionar slot anterior
3. Swap: source=staging → target=production
