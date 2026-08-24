# SuitePro.org

App web de gestión de congregaciones de Testigos de Jehová. Reemplaza las planillas manuales para organizar las reuniones y la predicación.

## Stack
React + Vite + TypeScript + Tailwind + shadcn/ui, backend en Supabase (Postgres + Auth + RLS + Edge Functions).

## Qué gestiona
- **Vida y Ministerio**: programa de la reunión entre semana (discursos, demostraciones, lectura bíblica, estudio de congregación), con precarga desde la plantilla oficial (jw.org) y asignación con IA.
- **Reunión Pública**: presidente, oradores, lector/conductor de La Atalaya.
- **Predicación**: territorios, asignación de capitanes, puntos de encuentro, historial de manzanas trabajadas.
- **Asignaciones de Servicio**: tareas rotativas (acomodadores, sonido, aseo, etc.) por mes.
- **Usuarios y permisos**: roles y perfiles granulares por congregación.
- Generación de PDF para publicar/imprimir cada programa.

## Multi-tenant
Una misma instancia sirve a muchas congregaciones (multi-tenant), cada una con su propio slug/URL, color y datos aislados por RLS.

## Entornos
- **DEV**: `dev.suitepro.org` — rama `develop`, proyecto Supabase separado.
- **PRD**: `suitepro.org` — rama `main`, proyecto Supabase separado.
- Flujo de trabajo: siempre se implementa y prueba en DEV primero; solo se promueve a PRD cuando el usuario lo pide explícitamente ("pasar a PRD").
