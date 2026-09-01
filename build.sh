#!/bin/bash
# Si DATABASE_URL no existe, usar una URL dummy para que prisma generate funcione
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://dummy:dummy@dummy.supabase.co:5432/dummy"
fi
npx prisma generate
npx next build
