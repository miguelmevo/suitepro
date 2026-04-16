-- Add new department roles to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sservicio';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'srpublica';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'svministerio';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'saservicio';